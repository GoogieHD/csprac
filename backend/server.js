require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

// Ensure all required modules are installed
// Check for missing or incorrect imports
const userRoutes = require("./routes/userRoutes");
const statsRoutes = require("./routes/statsRoutes"); // Ensure this file exists
const matchRoutes = require("./routes/matchRoutes");
const authRoutes = require("./routes/authRoutes");

// Initialize Express app
const app = express();

// Middleware
app.use(express.json()); // Parse JSON bodies

// Connect to MongoDB
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

// Placeholder for API documentation
app.get('/', (req, res) => {
    res.send('Welcome to the CS Practice Queue API. Documentation coming soon.');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));