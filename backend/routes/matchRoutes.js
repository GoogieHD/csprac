const express = require('express');
const Match = require('../models/Match');
const MatchDTO = require('../dtos/MatchDTO');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all routes with authMiddleware
router.use(authMiddleware);

// Get all matches
router.get('/', async (req, res) => {
    try {
        const matches = await Match.find().populate('teamA teamB');
        res.json(matches.map(match => new MatchDTO(match)));
    } catch (err) {
        res.status(500).json({ message: 'Error fetching matches', error: err.message });
    }
});

// Create a new match
router.post('/', async (req, res) => {
    try {
        const { teamA, teamB, map } = req.body;
        const match = new Match({ teamA, teamB, map });
        await match.save();
        res.status(201).json(new MatchDTO(match));
    } catch (err) {
        res.status(400).json({ message: 'Error creating match', error: err.message });
    }
});

module.exports = router;
