class MatchDTO {
    constructor(match) {
        this.id = match._id;
        this.teamA = match.teamA.map(player => ({ id: player._id, name: player.name }));
        this.teamB = match.teamB.map(player => ({ id: player._id, name: player.name }));
        this.map = match.map;
        this.date = match.date;
    }
}

module.exports = MatchDTO;
