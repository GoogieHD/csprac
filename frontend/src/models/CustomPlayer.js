class Player {
    constructor(id, name) {
        this.id = id;       // Socket ID
        this.name = name;
        this.team = null;   // 'A' | 'B' | null
        this.isCaptain = false;
    }
}

module.exports = Player;
