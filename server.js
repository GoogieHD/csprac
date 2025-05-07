const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const SessionManager = require("./src/logic/SessionManager");
// Add fake players for testing
const DEFAULT_FAKE_PLAYERS = 8;

for (let i = 1; i <= DEFAULT_FAKE_PLAYERS; i++) {
  SessionManager.addPlayer(`fake-${i}`, `Bot_${i}`);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("attend", (name) => {
    const player = SessionManager.addPlayer(socket.id, name);
    if (player) {
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    }
  });

  socket.on("startSession", ({ mode }) => {
    if (
      SessionManager.playerQueue.length === 10 &&
      !SessionManager.sessionStarted
    ) {
      SessionManager.sessionStarted = true;
      if (mode === "random") {
        const shuffled = [...SessionManager.playerQueue].sort(
          () => 0.5 - Math.random()
        );
        const teamA = shuffled.slice(0, 5);
        const teamB = shuffled.slice(5);
        // pick one random player from each team to be veto captains
        const vetoCaptains = {
          A: teamA[Math.floor(Math.random() * 5)],
          B: teamB[Math.floor(Math.random() * 5)],
        };
        SessionManager.veto.currentCaptain = vetoCaptains.A.id;
        SessionManager.veto.captains = vetoCaptains;
        io.emit("sessionStarted", { teamA, teamB, mode });
        // No Drafting needed since this is Random Mode
        io.emit("draftComplete", { teamA, teamB, mode });
      } else if (mode === "captains") {
        io.emit("selectCaptains");
      }
    }
  });

  socket.on("setCaptains", ({ captain1Id, captain2Id }) => {
    const captains = SessionManager.setCaptains(captain1Id, captain2Id);
    if (captains) {
      captains.forEach((captain) => {
        io.to(captain.id).emit("youAreCaptain");
      });
      if (!SessionManager.veto) {
        SessionManager.veto = {
          remainingMaps: [],
          banned: [],
          currentCaptain: null,
          captains: null,
        };
      }
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

  socket.on("disconnect", () => {
    SessionManager.removePlayer(socket.id);
    console.log("User disconnected:", socket.id);
    if (!SessionManager.sessionStarted) {
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    }
  });

  socket.on("pickPlayer", ({ playerId }) => {
    const result = SessionManager.pickPlayer(socket.id, playerId);
    if (result) {
      io.emit("draftUpdate", {
        teamA: result.teamA,
        teamB: result.teamB,
        availablePlayers: result.availablePlayers,
      });
      if (result.availablePlayers.length > 0) {
        // Notify next captain
        io.to(result.currentCaptain).emit("yourTurnToPick", {
          availablePlayers: result.availablePlayers,
        });
      } else {
        io.emit("draftComplete", {
          teamA: result.teamA,
          teamB: result.teamB,
        });
      }
    }
  });

  socket.on("startMapVoting", ({ mapPool }) => {
    if (!mapPool || mapPool.length < 2) {
      console.warn("Invalid map pool received.");
      return;
    }
    SessionManager.setMapPool(mapPool);
    const veto = SessionManager.veto;
    if (!veto.captains) {
      console.warn("Map voting attempted without captains.");
      return;
    }
    const { A, B } = veto.captains;
    veto.currentCaptain = Math.random() < 0.5 ? A.id : B.id;
    io.emit("mapVotingStarted", {
      remainingMaps: mapPool,
      currentCaptain: SessionManager.veto.currentCaptain,
      captains: { A, B },
    });
  });

  socket.on("banMap", ({ map }) => {
    const veto = SessionManager.veto;
    if (!veto.remainingMaps.includes(map)) return;

    veto.remainingMaps = veto.remainingMaps.filter((m) => m !== map);
    veto.banned.push(map);

    const nextCaptain =
      veto.currentCaptain === veto.captains.A.id
        ? veto.captains.B.id
        : veto.captains.A.id;

    if (veto.remainingMaps.length === 1) {
      const finalMap = veto.remainingMaps[0];

      // Emit final map + teams to everyone
      io.emit("mapChosen", {
        finalMap,
        teamA: SessionManager.draft.teamA,
        teamB: SessionManager.draft.teamB,
      });
    } else {
      veto.currentCaptain = nextCaptain;
      io.emit("mapVotingStarted", {
        remainingMaps: veto.remainingMaps,
        currentCaptain: veto.currentCaptain,
        captains: veto.captains,
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
