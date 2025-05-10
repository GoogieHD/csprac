require("dotenv").config();
// ──────────────────────────────────────────────────────

const express = require("express");
const http = require("http");
const session = require("express-session");
const { Server } = require("socket.io");
const path = require("path");

const SessionManager = require("./src/logic/SessionManager");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─────── Express Middleware ───────
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// ─────── Admin Credentials ───────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const PORT = process.env.PORT || 3000;

// ─────── Auth Middleware ───────
function isAuthenticated(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect("/admin-login.html");
}

// Ensure admin.html is not directly accessible
app.use("/public/admin.html", (req, res) => {
  res.status(403).send("Forbidden");
});

// ─────── Routes ───────
// Serve admin.html securely from the views folder
app.get("/admin", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "/views/admin.html"));
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect("/admin");
  } else {
    return res.status(401).send("Unauthorized: Invalid credentials");
  }
});

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/admin-login.html");
  });
});

// ─────── Socket.io ───────
io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  socket.on("attend", (name) => {
    const player = SessionManager.addPlayer(socket.id, name);
    if (player) {
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());

      if (SessionManager.draft) {
        socket.emit("draftUpdate", {
          teamA: SessionManager.draft.teamA,
          teamB: SessionManager.draft.teamB,
          availablePlayers: SessionManager.draft.availablePlayers,
          currentCaptain: SessionManager.draft.currentCaptain,
        });

        if (SessionManager.draft.currentCaptain === socket.id) {
          socket.emit("yourTurnToPick", {
            teamA: SessionManager.draft.teamA,
            teamB: SessionManager.draft.teamB,
            availablePlayers: SessionManager.draft.availablePlayers,
            currentCaptain: SessionManager.draft.currentCaptain,
          });
        }
      }

      const finalMap = SessionManager.getFinalMap?.();
      if (finalMap) {
        socket.emit("mapChosen", {
          finalMap,
          teamA: SessionManager.draft?.teamA || [],
          teamB: SessionManager.draft?.teamB || [],
        });
      }
    }
  });

  socket.on("startSession", ({ mode }) => {
    if (SessionManager.playerQueue.length !== 10 || SessionManager.sessionStarted) return;

    SessionManager.sessionStarted = true;

    if (mode === "random") {
      const { teamA, teamB } = SessionManager.assignRandomTeams();
      const vetoCaptains = {
        A: teamA[Math.floor(Math.random() * 5)],
        B: teamB[Math.floor(Math.random() * 5)],
      };
      SessionManager.veto.captains = vetoCaptains;
      SessionManager.veto.currentCaptain = vetoCaptains.A.id;

      io.emit("sessionStarted", { teamA, teamB, mode });
      io.emit("draftComplete", { teamA, teamB, mode });
    }

    if (mode === "captains") {
      io.emit("selectCaptains");
    }
  });

  socket.on("setCaptains", ({ captain1Id, captain2Id }) => {
    const captains = SessionManager.setCaptains(captain1Id, captain2Id);

    if (captains) {
      captains.forEach((captain) => {
        io.to(captain.id).emit("youAreCaptain");
      });

      SessionManager.veto.captains = { A: captains[0], B: captains[1] };

      io.emit("sessionStarted", {
        teamA: [captains[0]],
        teamB: [captains[1]],
        mode: "captains",
      });

      SessionManager.startDraft([captains[0]], [captains[1]]);

      io.to(SessionManager.draft.currentCaptain).emit("yourTurnToPick", {
        availablePlayers: SessionManager.draft.availablePlayers,
        teamA: SessionManager.draft.teamA,
        teamB: SessionManager.draft.teamB,
        currentCaptain: SessionManager.draft.currentCaptain,
      });

      io.emit("draftUpdate", {
        teamA: SessionManager.draft.teamA,
        teamB: SessionManager.draft.teamB,
        availablePlayers: SessionManager.draft.availablePlayers,
        currentCaptain: SessionManager.draft.currentCaptain,
      });
    }
  });

  socket.on("pickPlayer", ({ playerId }) => {
    const result = SessionManager.pickPlayer(socket.id, playerId);
    if (!result) return;

    const { teamA, teamB, availablePlayers, currentCaptain } = result;

    if (availablePlayers.length > 0) {
      io.to(currentCaptain).emit("yourTurnToPick", {
        availablePlayers,
        teamA,
        teamB,
        currentCaptain,
      });

      io.emit("draftUpdate", {
        teamA,
        teamB,
        availablePlayers,
        currentCaptain,
      });
    } else {
      io.emit("draftUpdate", {
        teamA,
        teamB,
        availablePlayers: [],
        currentCaptain: null,
      });

      io.emit("draftComplete", { teamA, teamB });
    }
  });

  socket.on("startMapVoting", ({ mapPool }) => {
    if (!Array.isArray(mapPool) || mapPool.length < 2) {
      console.warn("Invalid map pool received.");
      return;
    }

    SessionManager.setMapPool(mapPool);
    const { captains } = SessionManager.veto;

    if (!captains?.A || !captains?.B) {
      console.warn("Captains missing.");
      return;
    }

    const startCaptain = Math.random() < 0.5 ? captains.A.id : captains.B.id;
    SessionManager.veto.currentCaptain = startCaptain;

    io.emit("mapVotingStarted", {
      remainingMaps: mapPool,
      currentCaptain: startCaptain,
      captains,
    });
  });

  socket.on("banMap", ({ map }) => {
    const veto = SessionManager.veto;
    if (!veto.remainingMaps.includes(map)) return;

    veto.remainingMaps = veto.remainingMaps.filter((m) => m !== map);
    veto.banned.push(map);

    if (veto.remainingMaps.length === 1) {
      const finalMap = veto.remainingMaps[0];
      io.emit("mapChosen", {
        finalMap,
        teamA: SessionManager.draft.teamA,
        teamB: SessionManager.draft.teamB,
      });
    } else {
      veto.currentCaptain =
        veto.currentCaptain === veto.captains.A.id
          ? veto.captains.B.id
          : veto.captains.A.id;

      io.emit("mapVotingStarted", {
        remainingMaps: veto.remainingMaps,
        currentCaptain: veto.currentCaptain,
        captains: veto.captains,
      });
    }
  });

  socket.on("clearSession", () => {
    SessionManager.reset();
    SessionManager.playerQueue = [];
    io.emit("sessionReset");
    io.emit("playerPoolUpdate", []);
  });

  socket.on("resetSession", () => {
    SessionManager.reset();
    io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    io.emit("sessionReset");
  });

  socket.on("disconnect", () => {
    console.log(`Disconnected: ${socket.id}`);
    if (!SessionManager.sessionStarted) {
      SessionManager.removePlayer(socket.id);
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    }
  });
});

// ─────── Start Server ───────
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

