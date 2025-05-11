require("dotenv").config();
const express = require("express");
const http = require("http");
const session = require("express-session");
const { Server } = require("socket.io");
const path = require("path");
const axios = require("axios");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const sharedSession = require("express-socket.io-session");

const SessionManager = require("./src/logic/SessionManager");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ─────── MongoDB Connection ───────
const mongoUrl = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB;
let db;

MongoClient.connect(mongoUrl, { useUnifiedTopology: true })
  .then((client) => {
    console.log("Connected to MongoDB");
    db = client.db(dbName);
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// ─────── Middleware ───────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware to enforce authentication
function isAuthenticated(req, res, next) {
  if (req.session?.userId) return next();
  res.redirect("/login.html");
}

// Apply authentication middleware to all routes except login and register
app.use((req, res, next) => {
  const publicPaths = [
    "/login.html",
    "/register.html",
    "/api/login",
    "/api/register",
  ];
  if (publicPaths.includes(req.path) || req.path.startsWith("/socket.io")) {
    return next();
  }
  isAuthenticated(req, res, next);
});

// ─────── Role-Based Middleware ───────
function isAdmin(req, res, next) {
  if (req.session?.role === 3) return next();
  return res.status(403).send("Forbidden");
}

// function isUser(req, res, next) {
//   if (req.session?.role === 1) return next();
//   return res.status(403).send("Forbidden");
// }

const PORT = process.env.PORT || 3000;

app.get("/api/session-info", (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }

  res.json({
    userId: req.session.userId,
    username: req.session.username,
    role: req.session.role,
  });
});

app.use("/public/admin.html", (req, res) => {
  res.status(403).send("Forbidden");
});

app.get("/admin", isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "/views/admin.html"));
});

app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db.collection("users").findOne({ username });

    if (!user || user.password !== password) {
      return res.status(401).send("Unauthorized: Invalid credentials");
    }

    if (user.role !== 3) {
      return res.status(403).send("Forbidden: Not an admin");
    }

    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.isAdmin = true;

    res.redirect("/admin");
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).send("Server error");
  }
});

app.get("/admin/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// ─────── User Registration/Login ───────

const { getCS2RankFromSteam } = require("./src/utils/steam");

app.post("/api/register", async (req, res) => {
  try {
    console.log("[Register] Incoming registration:", req.body.username);

    const { username, password, steamId, name, birth_date, gender, address } =
      req.body;
    const token = crypto.randomBytes(20).toString("hex");
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log("[Register] Fetching CS2 rank...");
    const cs2Rank = await getCS2RankFromSteam(steamId);
    console.log("[Register] Rank fetched:", cs2Rank);

    const person = { name, birth_date, gender, address, profile_picture: "" };
    const personResult = await db.collection("person").insertOne(person);

    const user = {
      username,
      password: hashedPassword,
      steamId,
      rank: cs2Rank,
      verification_token: token,
      is_verified: true,
      role: 1,
      person_id: personResult.insertedId,
    };

    await db.collection("users").insertOne(user);

    console.log("[Register] Registration complete for:", username);
    res
      .status(200)
      .json({ message: "Registration successful!", rank: cs2Rank });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.collection("users").findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid login" });
    }
    req.session.userId = user._id;
    req.session.username = user.username;
    req.session.role = user.role;
    res.json({ message: "Login successful", user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login error" });
  }
});

// ─────── Fake Players for Dev ───────
if (process.env.NODE_ENV === "development") {
  ["Dev1", "Dev2", "Dev3", "Dev4", "Dev5", "Dev6", "Dev7", "Dev8"].forEach(
    (name, i) => {
      SessionManager.addPlayer(`fakePlayer${i}`, name);
    }
  );
}

// ─────── Matchmaking API ───────
app.post("/api/start-match", async (req, res) => {
  const { map, teamA, teamB } = req.body;
  try {
    const response = await axios.post(
      "https://dathost.net/api/0.1/cs2/matches",
      {
        game_server_id: process.env.DATHOST_SERVER_ID,
        map,
        team1: {
          name: "Team Alpha",
          players: teamA.map((p) => ({ steam_id: p.steamId })),
        },
        team2: {
          name: "Team Beta",
          players: teamB.map((p) => ({ steam_id: p.steamId })),
        },
      },
      {
        auth: {
          username: process.env.DATHOST_API_USERNAME,
          password: process.env.DATHOST_API_PASSWORD,
        },
      }
    );
    res.json({ message: "Match started", match: response.data });
  } catch (err) {
    console.error("Start match failed:", err);
    res.status(500).json({ error: "Match start failed" });
  }
});

io.use(
  sharedSession(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: true,
    }),
    { autoSave: true }
  )
);

// ─────── Socket.io Logic ───────
io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on("attend", async (name) => {
    const player = await SessionManager.addPlayer(socket.id, name, db);
    if (!player) return;

    io.emit("playerPoolUpdate", SessionManager.getPlayerList());

    if (SessionManager.draft) {
      socket.emit("draftUpdate", SessionManager.draft);
      if (SessionManager.draft.currentCaptain === socket.id) {
        socket.emit("yourTurnToPick", SessionManager.draft);
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
  });

  socket.on("startSession", ({ mode }) => {
    if (
      SessionManager.playerQueue.length !== 10 ||
      SessionManager.sessionStarted
    )
      return;
    SessionManager.sessionStarted = true;

    if (mode === "random") {
      const { teamA, teamB } = SessionManager.assignRandomTeams();
      const vetoCaptains = {
        A: teamA[Math.floor(Math.random() * 5)],
        B: teamB[Math.floor(Math.random() * 5)],
      };
      SessionManager.veto = {
        captains: vetoCaptains,
        currentCaptain: vetoCaptains.A.id,
      };
      io.emit("sessionStarted", { teamA, teamB, mode });
      io.emit("draftComplete", { teamA, teamB });
    } else {
      io.emit("selectCaptains");
    }
  });

  socket.on("setCaptains", ({ captain1Id, captain2Id }) => {
    const captains = SessionManager.setCaptains(captain1Id, captain2Id);
    if (!captains) return;

    SessionManager.veto = {
      captains: { A: captains[0], B: captains[1] },
      currentCaptain: captains[0].id,
    };
    SessionManager.startDraft([captains[0]], [captains[1]]);

    io.to(SessionManager.draft.currentCaptain).emit(
      "yourTurnToPick",
      SessionManager.draft
    );
    io.emit("sessionStarted", {
      teamA: [captains[0]],
      teamB: [captains[1]],
      mode: "captains",
    });
    io.emit("draftUpdate", SessionManager.draft);
  });

  socket.on("pickPlayer", ({ playerId }) => {
    const result = SessionManager.pickPlayer(socket.id, playerId);
    if (!result) return;

    io.emit("draftUpdate", result);
    if (result.availablePlayers.length > 0) {
      io.to(result.currentCaptain).emit("yourTurnToPick", result);
    } else {
      io.emit("draftComplete", { teamA: result.teamA, teamB: result.teamB });
    }
  });

  socket.on("startMapVoting", ({ mapPool }) => {
    if (!Array.isArray(mapPool) || mapPool.length < 2) return;
    SessionManager.setMapPool(mapPool);
    const startCaptain =
      Math.random() < 0.5
        ? SessionManager.veto.captains.A.id
        : SessionManager.veto.captains.B.id;
    SessionManager.veto.currentCaptain = startCaptain;
    io.emit("mapVotingStarted", {
      remainingMaps: mapPool,
      currentCaptain: startCaptain,
      captains: SessionManager.veto.captains,
    });
  });

  socket.on("banMap", ({ map }) => {
    const veto = SessionManager.veto;
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
  console.log(`Server running on http://localhost:${PORT}`);
});
