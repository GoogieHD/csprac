const Player = require("../models/CustomPlayer");

class SessionManager {
  constructor() {
    this.reset();
    this.veto = {
      remainingMaps: [],
      banned: [],
      currentCaptain: null,
      captains: null,
    };
    this.draft = null;
    this.mapPool = [];
  }

  reset() {
    this.playerQueue = [];
    this.sessionStarted = false;
    this.draft = null;
    this.veto = {
      remainingMaps: [],
      banned: [],
      currentCaptain: null,
      captains: null,
    };
    this.mapPool = [];
  }

  // ─── Player Management ───────────────────────────────

  addPlayer(id, name) {
    const existing = this.playerQueue.find(p => p.name === name);
    if (existing) {
      existing.id = id;
      return existing;
    }
  
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

  // ─── Team Assignment ────────────────────────────────

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

      this.veto.captains = {
        A: cap1,
        B: cap2,
      };

      return [cap1, cap2];
    }

    return null;
  }

  // ─── Draft Logic ────────────────────────────────────

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
    if (!this.draft) return null;

    const player = this.draft.availablePlayers.find((p) => p.id === playerId);
    if (!player || captainId !== this.draft.currentCaptain) return null;

    const currentTeam = this.draft.teamA.find((p) => p.id === captainId)
      ? this.draft.teamA
      : this.draft.teamB;

    currentTeam.push(player);

    this.draft.availablePlayers = this.draft.availablePlayers.filter(
      (p) => p.id !== playerId
    );

    this.draft.currentCaptain =
      captainId === this.draft.teamA[0].id
        ? this.draft.teamB[0].id
        : this.draft.teamA[0].id;

    return {
      teamA: this.draft.teamA,
      teamB: this.draft.teamB,
      availablePlayers: this.draft.availablePlayers,
      currentCaptain: this.draft.currentCaptain,
    };
  }

  // ─── Map Veto Logic ─────────────────────────────────

  setMapPool(maps) {
    this.mapPool = [...maps];
    this.veto.remainingMaps = [...maps];
    this.veto.banned = [];
  }

  banMap(map) {
    if (!this.veto.remainingMaps.includes(map)) return null;

    this.veto.remainingMaps = this.veto.remainingMaps.filter((m) => m !== map);
    this.veto.banned.push(map);

    // Swap turn
    const current = this.veto.currentCaptain;
    const next =
      current === this.veto.captains.A.id
        ? this.veto.captains.B.id
        : this.veto.captains.A.id;

    this.veto.currentCaptain = next;

    return {
      remainingMaps: this.veto.remainingMaps,
      banned: this.veto.banned,
      currentCaptain: this.veto.currentCaptain,
    };
  }

  getFinalMap() {
    return this.veto.remainingMaps.length === 1
      ? this.veto.remainingMaps[0]
      : null;
  }
}

module.exports = new SessionManager();
