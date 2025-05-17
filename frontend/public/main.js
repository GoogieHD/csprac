import { getPremierRankLabel } from "./utils/rankTier.js";

let socket;
let allPlayers = [];
let playerName = "";
let playerUsername = "";
let currentCaptainId = null;
let isAdmin = false;

window.addEventListener("DOMContentLoaded", () => {
  if (window.socketInitialized) {
    console.warn("[Client] Socket already initialized, skipping.");
    return;
  }
  window.socketInitialized = true;

  if (window.__SOCKET_ALREADY_CONNECTED__) {
    console.warn("[Client] Socket already connected. Skipping init.");
    return;
  }
  window.__SOCKET_ALREADY_CONNECTED__ = true;

  socket = io();
  console.log("[Client] Socket initialized:", socket.id);

  const attendBtn = document.getElementById("attendBtn");
  const nameInput = document.getElementById("nameInput");
  const playerList = document.getElementById("playerList");
  const clearBtn = document.getElementById("adminClearBtn");
  const isAdminPage = window.location.pathname.includes("admin");

  fetch("/api/session-info", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (!data?.username) throw new Error("Not authenticated");

      playerName = data.username;
      playerUsername = data.username;
      isAdmin = data.role === 3;
      nameInput.value = playerName;

      socket.emit("attend", playerName);

      attendBtn?.addEventListener("click", () => {
        if (!playerName) return;
        socket.emit("attend", playerName);
      });
    })
    .catch(() => (window.location.href = "/login.html"));

  clearBtn?.addEventListener("click", () => {
    if (confirm("Clear everything?")) {
      socket.emit("clearSession");
    }
  });

  socket.on("disconnect", () => {
    console.warn("[Socket] Disconnected");
  });

  socket.on("playerPoolUpdate", (players) => {
    allPlayers = players;
    let foundSelf = players.some((p) => p.name === playerName);

    playerList.innerHTML = `
      <h2 class="text-xl font-semibold mb-2 text-left">
        Players in Queue: <span class="text-green-400">${
          players.length
        }/10</span>
      </h2>
      <ul class="list-inside space-y-1 text-gray-300 text-left">
        ${players
          .map((p) => {
            const tier = getPremierRankLabel(p.rank);
            return `
              <li class="flex justify-between items-center">
              <span>${p.name}</span>
                ${
                  isAdmin && isAdminPage
                    ? `<button data-kick="${p.id}" class="ml-2 text-red-400 hover:text-red-600 text-sm">Kick</button>`
                    : ""
                }
                ${
                  p.rank
                    ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs text-white ${tier.color} border-2 border-white">${p.rank}</span>`
                    : ""
                }
              </li>`;
          })
          .join("")}
      </ul>`;

    // Admin kick handler
    if (isAdmin && isAdminPage) {
      document.querySelectorAll("button[data-kick]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const playerId = btn.getAttribute("data-kick");
          if (confirm("Kick this player from the lobby?")) {
            socket.emit("kickPlayer", { playerId });
          }
        });
      });
    }

    if (foundSelf) {
      nameInput.disabled = true;
      attendBtn.disabled = true;
      attendBtn.textContent = "Attending...";
    }
  });

  socket.on("youAreCaptain", () =>
    Toastify({
      text: "You are a Captain! Get ready to pick your team.",
      duration: 4000,
      close: true,
      gravity: "top",
      position: "center",
      backgroundColor: "#10b981",
    }).showToast()
  );

  socket.on("yourTurnToPick", renderDraftUpdate);
  socket.on("draftUpdate", renderDraftUpdate);

  function renderDraftUpdate({
    teamA,
    teamB,
    availablePlayers,
    currentCaptain,
  }) {
    currentCaptainId = currentCaptain;
    const isPicking = playerUsername === currentCaptain;
    const availableIds = new Set(availablePlayers.map((p) => p.id));
    const teamMap = new Map();

    teamA.forEach((p) => teamMap.set(p.id, "Alpha"));
    teamB.forEach((p) => teamMap.set(p.id, "Beta"));

    playerList.innerHTML = `
      <h2 class="text-xl font-semibold mb-4 text-center">
        ${
          isPicking
            ? "Your turn to pick a teammate"
            : "Waiting for captain to pick..."
        }
      </h2>
      <ul class="space-y-3">
        ${allPlayers
          .map((p) => {
            const team = teamMap.get(p.id);
            const teamLabel = team
              ? `<span class="ml-2 text-sm font-semibold text-${
                  team === "Alpha" ? "green" : "blue"
                }-400">Team ${team}</span>`
              : "";

            return `
              <li>
                <button 
                  data-id="${p.id}" 
                  class="w-full px-4 py-2 rounded text-black font-medium transition ${
                    availableIds.has(p.id)
                      ? isPicking
                        ? "bg-yellow-500 hover:bg-yellow-600"
                        : "bg-yellow-400 opacity-60 cursor-not-allowed"
                      : "bg-gray-600 opacity-50 cursor-not-allowed"
                  }"
                  ${availableIds.has(p.id) && isPicking ? "" : "disabled"}
                >
                  ${p.name} ${teamLabel}
                </button>
              </li>`;
          })
          .join("")}
      </ul>`;

    if (isPicking) {
      document.querySelectorAll("button[data-id]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          socket.emit("pickPlayer", { playerId: id });
          btn.classList.add("scale-90", "opacity-50");
        })
      );
    }
  }

  socket.on("draftComplete", ({ teamA, teamB }) => {
    Toastify({
      text: "Draft is complete!",
      duration: 3000,
      gravity: "top",
      position: "center",
      backgroundColor: "#4ade80",
    }).showToast();

    playerList.innerHTML =
      renderTeams(teamA, teamB) +
      `
      <p class="text-green-300 text-center font-bold mt-4">
        Draft Complete!
      </p>`;
  });

  socket.on("mapVotingStarted", ({ remainingMaps, currentCaptain }) => {
    renderMapVoting(
      remainingMaps,
      currentCaptain,
      playerUsername === currentCaptain
    );
  });

  socket.on("mapChosen", ({ finalMap, teamA, teamB }) => {
    Toastify({
      text: `Map chosen: ${finalMap.toUpperCase()}`,
      duration: 4000,
      gravity: "top",
      position: "center",
      backgroundColor: "#6366f1",
    }).showToast();

    playerList.innerHTML = `
      <h2 class="text-2xl font-bold text-green-400 text-center mb-4">
        Final Map: ${finalMap.toUpperCase()}
      </h2>
      ${renderTeams(teamA, teamB)}
      <div class="text-center text-gray-300 mt-6 space-y-2">
      <p>
        IP: <strong class="text-white">connect cs2comp.datho.st:25876; password tawnet</strong>
      </p>

      <button
        id="copyConnectBtn"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
      >
        Copy IP
      </button>

      <p>
        <a
          href="steam://run/730//+connect%20cs2comp.datho.st:25876"
          class="text-blue-400 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Launch CS2 via Steam
        </a>
      </p>
    </div>`;
  });

  socket.on("sessionStarted", ({ teamA, teamB, mode }) => {
    if (mode === "random") {
      playerList.innerHTML = renderTeams(teamA, teamB);
    } else {
      playerList.innerHTML = `<p class="text-center text-gray-300">Waiting for captain selection...</p>`;
    }
  });

  socket.on("sessionState", (state) => {
    console.log("[Client] Received session state:", state);

    if (!state.sessionStarted) {
      console.log("[Client] sessionStarted is false → show attend screen");
      return;
    }

    const isCaptain = playerUsername === state.veto?.currentCaptain;
    console.log("[Client] isCaptain:", isCaptain);

    if (state.veto?.remainingMaps?.length > 1) {
      console.log("[Client] Map voting in progress, rendering map voting...");
      renderMapVoting(
        state.veto.remainingMaps,
        state.veto.currentCaptain,
        isCaptain
      );
      return;
    }

    if (state.veto?.remainingMaps?.length === 1) {
      console.log("[Client] Map voting complete, showing final map...");
      const finalMap = state.veto.remainingMaps[0];
      playerList.innerHTML = `
      <h2 class="text-2xl font-bold text-green-400 text-center mb-4">
        Final Map: ${finalMap.toUpperCase()}
      </h2>
      ${renderTeams(state.draft.teamA, state.draft.teamB)}
      <div class="text-center text-gray-300 mt-6 space-y-2">
      <p>
        IP: <strong class="text-white">connect cs2comp.datho.st:25876; password tawnet</strong>
      </p>

      <button
        id="copyConnectBtn"
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
      >
        Copy IP
      </button>

      <p>
        <a
          href="steam://run/730//+connect%20cs2comp.datho.st:25876"
          class="text-blue-400 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Launch CS2 via Steam
        </a>
      </p>
    </div>
`;
      const copyBtn = document.getElementById("copyConnectBtn");
      if (copyBtn) {
        copyBtn.addEventListener("click", () => {
          const connectCmd = "connect cs2comp.datho.st:25876; password tawnet";
          navigator.clipboard.writeText(connectCmd).then(() => {
            Toastify({
              text: "Copied IP!",
              duration: 3000,
              gravity: "top",
              position: "center",
              backgroundColor: "#4ade80",
            }).showToast();
          });
        });
      }

      return;
    }

    if (state.draft?.availablePlayers?.length > 0) {
      console.log("[Client] Draft in progress, rendering draft update...");
      if (playerUsername === state.draft.currentCaptain) {
        renderDraftUpdate(state.draft);
      } else {
        socket.emit("requestDraftUpdate");
      }
      return;
    }

    if (state.draft?.teamA && state.draft?.teamB) {
      console.log("[Client] Draft complete, no map vote yet → rendering teams");
      playerList.innerHTML = renderTeams(state.draft.teamA, state.draft.teamB);
    }
  });

  socket.on("sessionReset", () => {
    Toastify({
      text: "Lobby has been reset by admin.",
      duration: 4000,
      gravity: "top",
      position: "center",
      backgroundColor: "#ef4444",
    }).showToast();

    playerList.innerHTML = "";
    nameInput.disabled = false;
    attendBtn.disabled = false;
    attendBtn.textContent = "Join Queue";

    if (playerUsername) {
      nameInput.value = playerUsername;
    } else {
      nameInput.value = "";
    }
  });

  socket.on("warning", (message) =>
    Toastify({
      text: message,
      duration: 4000,
      gravity: "top",
      position: "right",
      backgroundColor: "#f97316",
    }).showToast()
  );

  function renderTeams(teamA, teamB) {
    return `
      <div class="flex flex-col md:flex-row gap-4 justify-center mt-4">
        <div class="flex-1 bg-green-800 rounded-xl p-4 shadow-md">
          <h3 class="text-2xl font-bold text-center mb-2">Team Alpha</h3>
          <ul class="space-y-1 text-lg">
            ${teamA
              .map((p) => `<li class="text-white">${p.name}</li>`)
              .join("")}
          </ul>
        </div>
        <div class="flex-1 bg-blue-800 rounded-xl p-4 shadow-md">
          <h3 class="text-2xl font-bold text-center mb-2">Team Beta</h3>
          <ul class="space-y-1 text-lg">
            ${teamB
              .map((p) => `<li class="text-white">${p.name}</li>`)
              .join("")}
          </ul>
        </div>
      </div>`;
  }

  function renderMapVoting(remainingMaps, currentCaptain, isCaptain) {
    const isFinalMap = remainingMaps.length === 1;

    playerList.innerHTML = `
    <h2 class="text-xl font-semibold mb-4">Map Voting</h2>
    <p class="mb-2">${
      isFinalMap
        ? `Final map locked in:`
        : isCaptain
        ? "Your turn to ban a map"
        : "Waiting for other captain..."
    }</p>
    <ul class="grid grid-cols-2 gap-4">
      ${remainingMaps
        .map(
          (map) => `
        <li>
          <button 
            data-map="${map}" 
            class="w-full px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium ${
              isFinalMap || !isCaptain
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-indigo-700"
            }"
            ${isFinalMap || !isCaptain ? "disabled" : ""}
          >
            ${map}
          </button>
        </li>`
        )
        .join("")}
    </ul>`;

    if (!isFinalMap && isCaptain) {
      document.querySelectorAll("button[data-map]").forEach((btn) =>
        btn.addEventListener("click", () => {
          const map = btn.getAttribute("data-map");
          socket.emit("banMap", { map });
        })
      );
    }
  }
});
