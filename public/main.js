const socket = io();
const attendBtn = document.getElementById("attendBtn");
const startBtn = document.getElementById("startBtn");
const playerList = document.getElementById("playerList");
const nameInput = document.getElementById("nameInput");

attendBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (name) {
    playerName = name;
    socket.emit("attend", name);
  }
};
socket.on("playerPoolUpdate", (players) => {
  let foundSelf = false;

  playerList.innerHTML = `
      <h2 class="text-xl font-semibold mb-2 text-left">Players in Queue:</h2>
      <ul class="list-disc list-inside space-y-1 text-gray-300 text-left">
        ${players
          .map((p) => {
            if (p.name === playerName) foundSelf = true;
            return `<li>${p.name}</li>`;
          })
          .join("")}
      </ul>
    `;

  if (foundSelf) {
    nameInput.disabled = true;
    attendBtn.disabled = true;
    attendBtn.textContent = "Attending...";
  }
});

socket.on("sessionStarted", ({ teamA, teamB }) => {
  const container = document.getElementById("playerList");
  container.innerHTML = `
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
      </div>
    `;
});

socket.on("youAreCaptain", () => {
  alert("You have been chosen as a Captain! Prepare to pick your team.");
});

socket.on("yourTurnToPick", ({ availablePlayers }) => {
  const list = availablePlayers
    .map(
      (p) => `
      <li>
        <button data-id="${p.id}" class="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded text-black w-full">
          ${p.name}
        </button>
      </li>`
    )
    .join("");
  playerList.innerHTML = `
      <h2 class="text-xl font-semibold mb-2">Pick a teammate</h2>
      <ul class="space-y-2">${list}</ul>
    `;
  document.querySelectorAll("button[data-id]").forEach((btn) => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      socket.emit("pickPlayer", { playerId: id });
    };
  });
});

socket.on("draftUpdate", ({ teamA, teamB, availablePlayers }) => {
  playerList.innerHTML = `
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
      </div>
    `;
});

socket.on("draftComplete", ({ teamA, teamB }) => {
  playerList.innerHTML += `<p class="text-green-300 text-center font-bold mt-4">Draft Complete!</p>`;
});

socket.on("mapVotingStarted", ({ remainingMaps, currentCaptain, captains }) => {
  const isCaptain = socket.id === currentCaptain;
  playerList.innerHTML = `
    <h2 class="text-xl font-semibold mb-4">Map Voting</h2>
    <p class="mb-2">${
      isCaptain ? "Your turn to ban a map" : "Waiting for other captain..."
    }</p>
    <ul class="grid grid-cols-2 gap-4">
      ${remainingMaps
        .map(
          (map) => `
        <li>
          <button data-map="${map}" class="w-full px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white ${
            !isCaptain ? "opacity-50 cursor-not-allowed" : ""
          }">
            ${map}
          </button>
        </li>`
        )
        .join("")}
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
  const target = typeof displayArea !== "undefined" ? displayArea : playerList;

  target.innerHTML = `
    <h2 class="text-2xl font-bold text-green-400 text-center mb-4">
      Final Map: ${finalMap.toUpperCase()}
    </h2>
    <div class="flex flex-col md:flex-row gap-4 justify-center mt-4">
      <div class="flex-1 bg-green-800 rounded-xl p-4 shadow-md">
        <h3 class="text-xl font-bold text-center mb-2">Team Alpha</h3>
        <ul class="space-y-1 text-lg">
          ${teamA.map((p) => `<li class="text-white">${p.name}</li>`).join("")}
        </ul>
      </div>
      <div class="flex-1 bg-blue-800 rounded-xl p-4 shadow-md">
        <h3 class="text-xl font-bold text-center mb-2">Team Beta</h3>
        <ul class="space-y-1 text-lg">
          ${teamB.map((p) => `<li class="text-white">${p.name}</li>`).join("")}
        </ul>
      </div>
    </div>
    <p class="text-center text-gray-300 mt-6">Prepare to load into <strong>${finalMap.toUpperCase()}</strong>.</p>
  `;
});
