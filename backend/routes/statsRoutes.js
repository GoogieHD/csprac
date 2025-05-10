const express = require('express');
const StatsDTO = require('../dtos/StatsDTO');

const router = express.Router();

// Placeholder data for demonstration
const statsData = [
    { playerId: '1', matchesPlayed: 10, wins: 6, losses: 4, kills: 50, deaths: 30 },
    { playerId: '2', matchesPlayed: 8, wins: 4, losses: 4, kills: 40, deaths: 35 },
];

// Get all player stats
router.get('/', (req, res) => {
    const stats = statsData.map(stat => new StatsDTO(stat));
    res.json(stats);
});

// Get stats for a specific player
router.get('/:playerId', (req, res) => {
    const playerStats = statsData.find(stat => stat.playerId === req.params.playerId);
    if (!playerStats) {
        return res.status(404).json({ message: 'Player stats not found' });
    }
    res.json(new StatsDTO(playerStats));
});

module.exports = router;
