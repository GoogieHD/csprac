const express = require('express');
const User = require('../models/User');
const UserDTO = require('../dtos/UserDTO');

const router = express.Router();

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users.map(user => new UserDTO(user)));
    } catch (err) {
        res.status(500).json({ message: 'Error fetching users', error: err.message });
    }
});

// Get a specific user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(new UserDTO(user));
    } catch (err) {
        res.status(500).json({ message: 'Error fetching user', error: err.message });
    }
});

module.exports = router;
