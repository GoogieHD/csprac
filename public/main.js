const socket = io();

const attendBtn = document.getElementById("attendBtn");
const nameInput = document.getElementById("nameInput");
const playerList = document.getElementById("playerList");

let playerName = "";

// 🟩 Join queue
attendBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (name) {
    playerName = name;
    socket.emit("attend", name);
  }
};

// 🟨 Update player pool
socket.on("playerPoolUpdate", (players) => {
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

// You are a captain
socket.on("youAreCaptain", () => {
  alert("You have been chosen as a Captain! Prepare to pick your team.");
});

// Draft started — pick a teammate
socket.on("yourTurnToPick", ({ availablePlayers }) => {
  playerList.innerHTML = `
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

  document.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      socket.emit("pickPlayer", { playerId: id });
    };
  });
});

// 🟨 Draft updated
socket.on("draftUpdate", ({ teamA, teamB }) => {
  playerList.innerHTML = renderTeams(teamA, teamB);
});

// ✅ Draft complete
socket.on("draftComplete", () => {
  playerList.innerHTML += `
    <p class="text-green-300 text-center font-bold mt-4">
      Draft Complete!
    </p>
  `;
});

// 🗺️ Map voting starts
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

// 🎯 Final map and teams revealed
socket.on("mapChosen", ({ finalMap, teamA, teamB }) => {
  playerList.innerHTML = `
    <h2 class="text-2xl font-bold text-green-400 text-center mb-4">
      Final Map: ${finalMap.toUpperCase()}
    </h2>
    ${renderTeams(teamA, teamB)}
    <p class="text-center text-gray-300 mt-6">
      Prepare to load into <strong>${finalMap.toUpperCase()}</strong>.
    </p>
  `;
});

// 🟩 Initial session start (random or captains)
socket.on("sessionStarted", ({ teamA, teamB }) => {
  playerList.innerHTML = renderTeams(teamA, teamB);
});

// ♻️ Utility: Render teams side-by-side
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
