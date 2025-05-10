const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    teamA: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    teamB: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    map: { type: String, required: true },
    date: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Match', matchSchema);
