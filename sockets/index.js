const SessionManager = require("../frontend/src/logic/SessionManager");

module.exports = (io, db) => {
  SessionManager.setSocketIO(io);
  SessionManager.setDB(db);

  function sendPlayerSync(socket, name) {
    socket.emit("playerPoolUpdate", SessionManager.getPlayerList());

    const draft = SessionManager.draft;
    const veto = SessionManager.veto;

    if (draft) {
      socket.emit("draftUpdate", draft);
      if (draft.currentCaptain === name) {
        socket.emit("yourTurnToPick", draft);
      }
    }

    const finalMap = SessionManager.getFinalMap();
    if (finalMap) {
      socket.emit("mapChosen", {
        finalMap,
        teamA: draft?.teamA || [],
        teamB: draft?.teamB || [],
      });
    } else if (veto?.remainingMaps?.length > 1) {
      const isCaptain = veto.currentCaptain === name;
      socket.emit("mapVotingStarted", {
        remainingMaps: veto.remainingMaps,
        currentCaptain: veto.currentCaptain,
        captains: veto.captains,
      });
      if (isCaptain) socket.emit("youAreCaptain");
    }

    socket.emit("sessionState", SessionManager.getCurrentState());
  }

  io.on("connection", (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.emit("playerPoolUpdate", SessionManager.getPlayerList());
    const sessionState = SessionManager.getCurrentState();
    socket.emit("sessionState", sessionState);
    console.log(`[Server] Emitting sessionState to ${socket.id}:`, sessionState);

    socket.on("attend", async (name) => {
      const alreadyInQueue = SessionManager.playerQueue.find((p) => p.name === name);
      if (alreadyInQueue) {
        alreadyInQueue.id = socket.id;
        console.log(`[Server] Reassign socket ID for returning player: ${name} → ${socket.id}`);
      } else {
        const player = await SessionManager.addPlayer(socket.id, name);
        if (!player) return;
      }

      sendPlayerSync(socket, name);
    });

    socket.on("addFakePlayer", () => {
      if (SessionManager.addFakePlayer()) {
        io.emit("playerPoolUpdate", SessionManager.getPlayerList());
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
        SessionManager.veto = {
          captains: vetoCaptains,
          currentCaptain: vetoCaptains.A.name,
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

      SessionManager.startDraft([captains[0]], [captains[1]]);
      const firstCaptain = SessionManager.draft.currentCaptain;
      const captainSocket = SessionManager.getSocketIdForPlayer(firstCaptain);
      if (captainSocket) io.to(captainSocket).emit("yourTurnToPick", SessionManager.draft);

      io.emit("sessionStarted", {
        teamA: [captains[0]],
        teamB: [captains[1]],
        mode: "captains",
      });
      io.emit("draftUpdate", SessionManager.draft);
    });

    socket.on("pickPlayer", ({ playerId }) => {
      const username = socket.handshake.session.username;
      const result = SessionManager.pickPlayer(username, playerId);
      if (!result) return;

      io.emit("draftUpdate", result);

      if (result.availablePlayers.length > 0) {
        const nextCaptain = result.currentCaptain;
        const captainSocket = SessionManager.getSocketIdForPlayer(nextCaptain);
        if (captainSocket) io.to(captainSocket).emit("yourTurnToPick", result);
      } else {
        io.emit("draftComplete", { teamA: result.teamA, teamB: result.teamB });
        const mapPool = [
          "Mirage", "Inferno", "Nuke", "Overpass", "Ancient",
          "Dust 2", "Cache", "Cobblestone", "Season", "Anubis"
        ];
        SessionManager.setMapPool(mapPool);
        const startCaptain = Math.random() < 0.5 ? SessionManager.veto.captains.A : SessionManager.veto.captains.B;
        SessionManager.veto.currentCaptain = startCaptain;
        const captainSocket = SessionManager.getSocketIdForPlayer(startCaptain);
        io.emit("mapVotingStarted", {
          remainingMaps: mapPool,
          currentCaptain: startCaptain,
          captains: SessionManager.veto.captains,
        });
        if (captainSocket) io.to(captainSocket).emit("youAreCaptain");
      }
    });

    socket.on("banMap", ({ map }) => {
      const username = socket.handshake.session.username;
      if (!username || SessionManager.veto.currentCaptain !== username) return;

      const result = SessionManager.banMap(map);
      if (!result) return;

      if (result.remainingMaps.length === 1) {
        const finalMap = result.remainingMaps[0];
        io.emit("mapChosen", {
          finalMap,
          teamA: SessionManager.draft?.teamA || [],
          teamB: SessionManager.draft?.teamB || [],
        });
        return;
      }

      const captainSocket = SessionManager.getSocketIdForPlayer(result.currentCaptain);
      io.emit("mapVotingStarted", {
        remainingMaps: result.remainingMaps,
        currentCaptain: result.currentCaptain,
        currentCaptainSocket: captainSocket,
        captains: SessionManager.veto.captains,
      });
      if (captainSocket) io.to(captainSocket).emit("youAreCaptain");
    });

    socket.on("kickPlayer", ({ playerId }) => {
      SessionManager.removePlayer(playerId);
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());
      const targetSocket = io.sockets.sockets.get(playerId);
      if (targetSocket) {
        targetSocket.emit("warning", "You have been kicked from the lobby.");
        targetSocket.disconnect();
      }
    });

    socket.on("resetSession", () => {
      SessionManager.reset();
      io.emit("sessionReset");
      io.emit("playerPoolUpdate", SessionManager.getPlayerList());
    });

    socket.on("clearSession", () => {
      SessionManager.reset();
      SessionManager.playerQueue = [];
      io.emit("sessionReset");
      io.emit("playerPoolUpdate", []);
    });

    socket.on("disconnect", () => {
      if (!SessionManager.sessionStarted) {
        SessionManager.removePlayer(socket.id);
        io.emit("playerPoolUpdate", SessionManager.getPlayerList());
      }
    });
  });
};
