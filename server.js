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
  "Rattle", "Shenzi", "Brick", 
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
  
      // Re-send draft state if already ongoing
      if (SessionManager.draft) {
        socket.emit("draftUpdate", {
          teamA: SessionManager.draft.teamA,
          teamB: SessionManager.draft.teamB,
          availablePlayers: SessionManager.draft.availablePlayers,
          currentCaptain: SessionManager.draft.currentCaptain,
        });
  
        // Also let the picking captain resume
        if (SessionManager.draft.currentCaptain === socket.id) {
          socket.emit("yourTurnToPick", {
            teamA: SessionManager.draft.teamA,
            teamB: SessionManager.draft.teamB,
            availablePlayers: SessionManager.draft.availablePlayers,
            currentCaptain: SessionManager.draft.currentCaptain,
          });
        }
      }
  
      // Re-send map if already chosen
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

  // ─── Draft Picks ──────────────────────────────────
  socket.on("pickPlayer", ({ playerId }) => {
    const result = SessionManager.pickPlayer(socket.id, playerId);
    if (!result) return;

    const { teamA, teamB, availablePlayers, currentCaptain } = result;

    if (availablePlayers.length > 0) {
      io.to(currentCaptain).emit("yourTurnToPick", {
        availablePlayers,
        teamA,
        teamB,
        currentCaptain
      });

      io.emit("draftUpdate", {
        teamA,
        teamB,
        availablePlayers,
        currentCaptain
      });
    } else {
      // Final pick done — emit final draft state
      io.emit("draftUpdate", {
        teamA,
        teamB,
        availablePlayers: [],
        currentCaptain: null
      });

      io.emit("draftComplete", {
        teamA,
        teamB
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


  socket.on("clearSession", () => {
    SessionManager.reset();
  
    // Remove all players completely, including test players
    SessionManager.playerQueue = [];
  
    io.emit("sessionReset");
    io.emit("playerPoolUpdate", []);
  });
  

  // ─── Reset Session ──────────────────────────
  socket.on("resetSession", () => {
    SessionManager.reset();
    io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    io.emit("sessionReset");
  });
  

  // ─── Disconnect Cleanup ───────────────────────────
  socket.on("disconnect", () => {
    console.log(`❌ Disconnected: ${socket.id}`);
  
    if (!SessionManager.sessionStarted) {
      SessionManager.removePlayer(socket.id);
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    }
  });  
});

// ─── Start Server ────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
