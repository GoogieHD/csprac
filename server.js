const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const SessionManager = require("./src/logic/SessionManager");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(express.static("public"));

// ─── Test Players (Optional) ──────────────────────────

const DEFAULT_FAKE_PLAYER_NAMES = [
  "ScratchFiveK", "Googie", "Slurp", "AncientOldie", "Joakim",
  "Rattle", "Shenzi", "audeaeaeamus", "Brick", "Jorgen"
];

const DEFAULT_FAKE_PLAYERS = DEFAULT_FAKE_PLAYER_NAMES.length;

DEFAULT_FAKE_PLAYER_NAMES.forEach((name, i) => {
  SessionManager.addPlayer(`fakePlayer${i}`, name);
});

// ─── Socket.io Logic ──────────────────────────────────

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // ─── Join Player Pool ──────────────────────────────
  socket.on("attend", (name) => {
    const player = SessionManager.addPlayer(socket.id, name);
    if (player) {
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    }
  });

  // ─── Start Session (Admin) ─────────────────────────
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

  // ─── Captain Selection ─────────────────────────────
  socket.on("setCaptains", ({ captain1Id, captain2Id }) => {
    const captains = SessionManager.setCaptains(captain1Id, captain2Id);

    if (captains) {
      captains.forEach((captain) => {
        io.to(captain.id).emit("youAreCaptain");
      });

      SessionManager.veto.captains = {
        A: captains[0],
        B: captains[1],
      };

      io.emit("sessionStarted", {
        teamA: [captains[0]],
        teamB: [captains[1]],
        mode: "captains",
      });

      SessionManager.startDraft([captains[0]], [captains[1]]);

      io.to(SessionManager.draft.currentCaptain).emit("yourTurnToPick", {
        availablePlayers: SessionManager.draft.availablePlayers,
      });
    }
  });

  // ─── Draft Picks ──────────────────────────────────
  socket.on("pickPlayer", ({ playerId }) => {
    const result = SessionManager.pickPlayer(socket.id, playerId);
    if (!result) return;

    io.emit("draftUpdate", {
      teamA: result.teamA,
      teamB: result.teamB,
      availablePlayers: result.availablePlayers,
    });

    if (result.availablePlayers.length > 0) {
      io.to(result.currentCaptain).emit("yourTurnToPick", {
        availablePlayers: result.availablePlayers,
      });
    } else {
      io.emit("draftComplete", {
        teamA: result.teamA,
        teamB: result.teamB,
      });
    }
  });

  // ─── Map Voting ───────────────────────────────────
  socket.on("startMapVoting", ({ mapPool }) => {
    if (!Array.isArray(mapPool) || mapPool.length < 2) {
      console.warn("⚠️ Invalid map pool received.");
      return;
    }

    SessionManager.setMapPool(mapPool);
    const { captains } = SessionManager.veto;

    if (!captains || !captains.A || !captains.B) {
      console.warn("⚠️ Map voting started before captains set.");
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

  // ─── Disconnect Cleanup ───────────────────────────
  socket.on("disconnect", () => {
    SessionManager.removePlayer(socket.id);
    console.log(`❌ Disconnected: ${socket.id}`);

    if (!SessionManager.sessionStarted) {
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    }
  });
});

// ─── Start Server ────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
