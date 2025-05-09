const socket = io();

// DOM references
const modeSelect = document.getElementById("teamModeSelect");
const nameInput = document.getElementById("adminNameInput");
const joinBtn = document.getElementById("adminJoinBtn");
const startBtn = document.getElementById("adminStartBtn");
const displayArea = document.getElementById("adminDisplayArea");
const resetBtn = document.getElementById("adminResetBtn");

const adminContent = document.getElementById("adminContent");

let playerName = "";
let currentPlayerPool = [];

startBtn.disabled = true;

// Join as player
joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (name) {
    playerName = name;
    socket.emit("attend", name);
    nameInput.disabled = true;
    joinBtn.disabled = true;
    joinBtn.textContent = "Joined";
  }
};

// Start session
startBtn.onclick = () => {
  const mode = modeSelect.value;
  socket.emit("startSession", { mode });
};

// Reset session
resetBtn.onclick = () => {
  if (confirm("Are you sure you want to reset the session?")) {
    socket.emit("resetSession");
    nameInput.disabled = false;
    joinBtn.disabled = false;
    joinBtn.textContent = "Join";
    startBtn.disabled = true;
  }
};

// Player pool updated
socket.on("playerPoolUpdate", (players) => {
  currentPlayerPool = players;
  startBtn.disabled = players.length !== 10;

  displayArea.innerHTML = `
    <h2 class="text-xl font-semibold mb-2 text-left">Current Player Pool:</h2>
    <ul class="list-disc list-inside space-y-1 text-gray-300 text-left">
      ${players.map(p => `<li>${p.name}</li>`).join("")}
    </ul>
  `;
});

// Captain selection mode
socket.on("selectCaptains", () => {
  if (!currentPlayerPool.length) {
    console.warn("No players available to select as captains.");
    return;
  }

  displayArea.innerHTML = `
    <h2 class="text-xl font-semibold mb-2">Select 2 Captains</h2>
    <ul id="captainSelectList" class="space-y-2">
      ${currentPlayerPool.map(p => `
        <li>
          <button data-id="${p.id}" class="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-white">
            ${p.name}
          </button>
        </li>`).join("")}
    </ul>
  `;

  const list = document.getElementById("captainSelectList");
  const selected = new Set();

  list.onclick = (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    if (selected.has(id)) {
      selected.delete(id);
      btn.classList.remove("bg-green-700");
    } else {
      selected.add(id);
      btn.classList.add("bg-green-700");
    }

    if (selected.size === 2) {
      const [cap1, cap2] = [...selected];
      socket.emit("setCaptains", { captain1Id: cap1, captain2Id: cap2 });
      displayArea.innerHTML = `<p class="text-green-400 font-bold">Captains Selected</p>`;
    }
  };
});

// Initial session started (for both random or captains)
socket.on("sessionStarted", ({ teamA, teamB }) => {
  startBtn.disabled = true;
  nameInput.disabled = true;
  joinBtn.disabled = true;
  joinBtn.textContent = "Match ongoing!";
  displayArea.innerHTML = renderTeams(teamA, teamB);
});

// Live draft updates
socket.on("draftUpdate", ({ teamA, teamB }) => {
  displayArea.innerHTML = renderTeams(teamA, teamB);
});

// Draft completed — show map voting start button
socket.on("draftComplete", ({ teamA, teamB }) => {
  displayArea.innerHTML += `
    <div class="mt-6 text-center">
      <button id="startMapVotingBtn" class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">
        Start Map Voting
      </button>
    </div>
  `;

  document.getElementById("startMapVotingBtn").onclick = () => {
    const raw = document.getElementById("mapPoolInput").value;
    const mapPool = raw.split(",").map(m => m.trim()).filter(m => m.length);

    if (mapPool.length < 2) {
      alert("Map pool must have at least 2 maps.");
      return;
    }

    socket.emit("startMapVoting", { mapPool });
  };
});

// Captain picks a teammate
socket.on("yourTurnToPick", ({ availablePlayers }) => {
  displayArea.innerHTML = `
    <h2 class="text-xl font-semibold mb-2">Pick a teammate</h2>
    <ul class="space-y-2">
      ${availablePlayers.map(p => `
        <li>
          <button data-id="${p.id}" class="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded text-black">
            ${p.name}
          </button>
        </li>`).join("")}
    </ul>
  `;

  document.querySelectorAll("button[data-id]").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      socket.emit("pickPlayer", { playerId: id });
    };
  });
});

// Map voting in progress
socket.on("mapVotingStarted", ({ remainingMaps, currentCaptain, captains }) => {
  const isCaptain = socket.id === currentCaptain;

  displayArea.innerHTML = `
    <h2 class="text-xl font-semibold mb-4">Map Voting</h2>
    <p class="mb-2">
      ${isCaptain ? "Your turn to ban a map" : "Waiting for the current captain to pick..."}
    </p>
    <ul class="grid grid-cols-2 gap-4">
      ${remainingMaps.map(map => `
        <li>
          <button data-map="${map}" class="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white ${!isCaptain ? 'opacity-50 cursor-not-allowed' : ''}">
            ${map}
          </button>
        </li>`).join("")}
    </ul>
  `;

  if (isCaptain) {
    document.querySelectorAll("button[data-map]").forEach(btn => {
      btn.onclick = () => {
        const map = btn.getAttribute("data-map");
        socket.emit("banMap", { map });
      };
    });
  }
});

// Final map chosen and show teams
socket.on("mapChosen", ({ finalMap, teamA, teamB }) => {
  displayArea.innerHTML = `
    <h2 class="text-2xl font-bold text-green-400 text-center mb-4">
      Final Map: ${finalMap}
    </h2>
    ${renderTeams(teamA, teamB)}
    <p class="text-center text-gray-300 mt-6">
      Prepare to load into <strong>${finalMap}</strong>.
    </p>
  `;
});

// Render team layout
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
