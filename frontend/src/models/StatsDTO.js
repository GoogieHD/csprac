class StatsDTO {
    constructor(stats) {
        this.playerId = stats.playerId;
        this.matchesPlayed = stats.matchesPlayed;
        this.wins = stats.wins;
        this.losses = stats.losses;
        this.kills = stats.kills;
        this.deaths = stats.deaths;
    }
}

module.exports = StatsDTO;
