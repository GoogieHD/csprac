const Player = require("../models/CustomPlayer");

class SessionManager {
  veto = {
    remainingMaps: [],
    banned: [],
    currentCaptain: null,
    captains: null,
  };
  constructor() {
    this.reset();
  }

  reset() {
    this.playerQueue = [];
    this.sessionStarted = false;
  }

  addPlayer(id, name) {
    if (this.sessionStarted || this.playerQueue.length >= 10) return null;
    const player = new Player(id, name);
    this.playerQueue.push(player);
    return player;
  }

  removePlayer(id) {
    this.playerQueue = this.playerQueue.filter((p) => p.id !== id);
  }

  getPlayerList() {
    return this.playerQueue.map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      isCaptain: p.isCaptain,
    }));
  }

  assignRandomTeams() {
    const shuffled = [...this.playerQueue].sort(() => 0.5 - Math.random());
    shuffled.forEach((p, i) => {
      p.team = i < 5 ? "A" : "B";
    });
    this.sessionStarted = true;
    return {
      teamA: shuffled.slice(0, 5),
      teamB: shuffled.slice(5),
    };
  }

  setCaptains(captain1Id, captain2Id) {
    const cap1 = this.playerQueue.find((p) => p.id === captain1Id);
    const cap2 = this.playerQueue.find((p) => p.id === captain2Id);

    if (cap1 && cap2 && cap1.id !== cap2.id) {
      cap1.isCaptain = true;
      cap2.isCaptain = true;
      this.veto.captains = [cap1, cap2];
      return [cap1, cap2];
    }
    return null;
  }

  startDraft(teamA, teamB) {
    this.draft = {
      teamA: [...teamA],
      teamB: [...teamB],
      availablePlayers: this.playerQueue.filter(
        (p) => !teamA.includes(p) && !teamB.includes(p)
      ),
      currentCaptain: Math.random() < 0.5 ? teamA[0].id : teamB[0].id,
    };
  }

  pickPlayer(captainId, playerId) {
    const player = this.draft.availablePlayers.find((p) => p.id === playerId);
    if (!player || captainId !== this.draft.currentCaptain) return null;
    const team = this.draft.teamA.find((p) => p.id === captainId)
      ? this.draft.teamA
      : this.draft.teamB;
    team.push(player);
    this.draft.availablePlayers = this.draft.availablePlayers.filter(
      (p) => p.id !== playerId
    );
    const nextCaptain =
      captainId === this.draft.teamA[0].id
        ? this.draft.teamB[0].id
        : this.draft.teamA[0].id;
    this.draft.currentCaptain = nextCaptain;
    return {
      teamA: this.draft.teamA,
      teamB: this.draft.teamB,
      availablePlayers: this.draft.availablePlayers,
      currentCaptain: nextCaptain,
    };
  }

  setMapPool(maps) {
    this.mapPool = maps;
    this.veto.remainingMaps = [...maps];
  }
}

module.exports = new SessionManager();
