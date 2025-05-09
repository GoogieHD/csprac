window.addEventListener("DOMContentLoaded", () => {
  const socket = io();

  const attendBtn = document.getElementById("attendBtn");
  const nameInput = document.getElementById("nameInput");
  const playerList = document.getElementById("playerList");
  const clearBtn = document.getElementById("adminClearBtn");

  let allPlayers = [];
  let playerName = "";
  let currentCaptainId = null;

  // Auto-rejoin
  socket.on("connect", () => {
    const saved = localStorage.getItem("playerName");
    if (saved) {
      playerName = saved;
      nameInput.value = saved;
      socket.emit("attend", saved);
    }
  });


  // Join queue
  if (attendBtn) {
    attendBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (name) {
        playerName = name;
        localStorage.setItem("playerName", name);
        socket.emit("attend", name);
      }
    };
  }

  // Clear session
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm("Clear everything? This will remove all players and reset the system.")) {
        socket.emit("clearSession");
      }
    };
  }

  socket.on("playerPoolUpdate", (players) => {
    allPlayers = players;
    let foundSelf = false;

    playerList.innerHTML = `
      <h2 class="text-xl font-semibold mb-2 text-left">Players in Queue:</h2>
      <ul class="list-disc list-inside space-y-1 text-gray-300 text-left">
        ${players.map((p) => {
          if (p.name === playerName) foundSelf = true;
          return `<li>${p.name}</li>`;
        }).join("")}
      </ul>
    `;

    if (foundSelf) {
      nameInput.disabled = true;
      attendBtn.disabled = true;
      attendBtn.textContent = "Attending...";
    }
  });

  socket.on("youAreCaptain", () => {
    Toastify({
      text: "You are a Captain! Get ready to pick your team.",
      duration: 4000,
      close: true,
      gravity: "top",
      position: "center",
      backgroundColor: "#10b981",
      stopOnFocus: true,
    }).showToast();
  });

  function renderDraftUI(availablePlayers, teamA, teamB, captainId) {
    const availableIds = new Set(availablePlayers.map(p => p.id));
    const teamMap = new Map();
    const isPicking = socket.id === captainId;

    teamA.forEach(p => teamMap.set(p.id, "Alpha"));
    teamB.forEach(p => teamMap.set(p.id, "Beta"));

    playerList.innerHTML = `
      <h2 class="text-xl font-semibold mb-4 text-center">
        ${captainId === socket.id
          ? "Your turn to pick a teammate"
          : "Waiting for captain to pick..."}
      </h2>
      <ul class="space-y-3">
        ${allPlayers.map(p => {
          const isAvailable = availableIds.has(p.id);
          const team = teamMap.get(p.id);
          const teamLabel = team
            ? `<span class="ml-2 text-sm font-semibold text-${team === 'Alpha' ? 'green' : 'blue'}-400">Team ${team}</span>`
            : '';

          return `
            <li>
              <button 
                data-id="${p.id}" 
                class="w-full px-4 py-2 rounded text-black font-medium transition ${
                  isAvailable
                    ? isPicking
                      ? 'bg-yellow-500 hover:bg-yellow-600 cursor-pointer'
                      : 'bg-yellow-400 opacity-60 cursor-not-allowed'
                    : 'bg-gray-600 opacity-50 cursor-not-allowed'
                }"
                ${isAvailable && isPicking ? '' : 'disabled'}
              >
                ${p.name} ${teamLabel}
              </button>
            </li>
          `;
        }).join('')}
      </ul>
    `;

    if (isPicking) {
      document.querySelectorAll("button[data-id]").forEach((btn) => {
        btn.onclick = () => {
          const id = btn.getAttribute("data-id");
          socket.emit("pickPlayer", { playerId: id });
          btn.classList.add("scale-90", "opacity-50");
        };
      });
    }
  }

  socket.on("yourTurnToPick", ({ availablePlayers, teamA = [], teamB = [], currentCaptain }) => {
    currentCaptainId = currentCaptain;
    renderDraftUI(availablePlayers, teamA, teamB, currentCaptainId);
  });

  socket.on("draftUpdate", ({ teamA, teamB, availablePlayers, currentCaptain }) => {
    currentCaptainId = currentCaptain;
    renderDraftUI(availablePlayers, teamA, teamB, currentCaptainId);
  });

  socket.on("draftComplete", ({ teamA, teamB }) => {
    Toastify({
      text: "Draft is complete!",
      duration: 3000,
      gravity: "top",
      position: "center",
      backgroundColor: "#4ade80",
    }).showToast();

    playerList.innerHTML = renderTeams(teamA, teamB) + `
      <p class="text-green-300 text-center font-bold mt-4">
        Draft Complete!
      </p>
    `;
  });

  socket.on("mapVotingStarted", ({ remainingMaps, currentCaptain }) => {
    const isCaptain = socket.id === currentCaptain;

    playerList.innerHTML = `
      <h2 class="text-xl font-semibold mb-4">Map Voting</h2>
      <p class="mb-2">${isCaptain ? "Your turn to ban a map" : "Waiting for other captain..."}</p>
      <ul class="grid grid-cols-2 gap-4">
        ${remainingMaps.map(map => `
          <li>
            <button data-map="${map}" class="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white ${!isCaptain ? "opacity-50 cursor-not-allowed" : ""}">
              ${map}
            </button>
          </li>`).join("")}
      </ul>
    `;

    if (isCaptain) {
      document.querySelectorAll("button[data-map]").forEach((btn) => {
        btn.onclick = () => {
          const map = btn.getAttribute("data-map");
          socket.emit("banMap", { map });
        };
      });
    }
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
      <p class="text-center text-gray-300 mt-6">
      Prepare to load into <strong>${finalMap.toUpperCase()}</strong>.
      </p>
      <p class="text-center text-gray-300 mt-6">
      IP: <strong><a href="steam://connect/cs2comp.datho.st:25876/tawnet" class="text-blue-400 underline">connect cs2comp.datho.st:25876; password tawnet</a></strong>.
      </p>
    `;
  });

  socket.on("sessionStarted", ({ teamA, teamB, mode }) => {
    if (mode === "random") {
      playerList.innerHTML = renderTeams(teamA, teamB);
    } else {
      playerList.innerHTML = `<p class="text-center text-gray-300">Waiting for captain selection...</p>`;
    }
  });

  socket.on("sessionReset", () => {
    Toastify({
      text: "Session has been cleared by admin.",
      duration: 4000,
      gravity: "top",
      position: "center",
      backgroundColor: "#ef4444"
    }).showToast();

    playerList.innerHTML = "";
    nameInput.disabled = false;
    attendBtn.disabled = false;
    attendBtn.textContent = "Join Queue";
    nameInput.value = "";
    localStorage.removeItem("playerName");
  });

  socket.on("warning", (message) => {
    Toastify({
      text: message,
      duration: 4000,
      close: true,
      gravity: "top",
      position: "right",
      backgroundColor: "#f97316",
      stopOnFocus: true,
    }).showToast();
  });

  function renderTeams(teamA, teamB) {
    return `
      <div class="flex flex-col md:flex-row gap-4 justify-center mt-4">
        <div class="flex-1 bg-green-800 rounded-xl p-4 shadow-md">
          <h3 class="text-2xl font-bold text-center mb-2">Team Alpha</h3>
          <ul class="space-y-1 text-lg">
            ${teamA.map(p => `<li class="text-white">${p.name}</li>`).join("")}
          </ul>
        </div>
        <div class="flex-1 bg-blue-800 rounded-xl p-4 shadow-md">
          <h3 class="text-2xl font-bold text-center mb-2">Team Beta</h3>
          <ul class="space-y-1 text-lg">
            ${teamB.map(p => `<li class="text-white">${p.name}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
  }
});
