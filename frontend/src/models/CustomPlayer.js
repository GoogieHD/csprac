class Player {
    constructor(id, name, rank = "Unavailable") {
        this.id = id;       // Socket ID
        this.name = name;
        this.rank = rank;
        this.team = null;   // 'A' | 'B' | null
        this.isCaptain = false;
    }
}

module.exports = Player;
