const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.log("❌ DB Error:", err));

// Collection: 'players'
const Player = mongoose.model('Player', new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }
}), 'players');
// server.js
const cors = require('cors');

// 1. Bulletproof CORS setup
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

// 2. Explicitly handle OPTIONS requests (Crucial for DELETE)
app.options('*', cors()); 

// 3. The Delete Route
app.delete('/api/delete-player/:name', async (req, res) => {
    try {
        const playerName = decodeURIComponent(req.params.name);
        const result = await Player.findOneAndDelete({ name: playerName });
        if (!result) return res.status(404).json({ error: "Player not found" });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 1. GET ALL PLAYERS
app.get('/api/rankings', async (req, res) => {
    try {
        const players = await Player.find().sort({ points: -1, wins: -1 });
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch players" });
    }
});

// 2. GET NAMES ONLY (For Dashboard)
app.get('/api/player-list', async (req, res) => {
    try {
        const players = await Player.find({}, 'name').sort({ name: 1 });
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch list" });
    }
});

// 3. UPDATE POINTS & SAVE PREVIOUS RANK
app.post('/api/update-points', async (req, res) => {
    const { name, result } = req.body;
    let pGain = (result === 'win') ? 3 : (result === 'draw' ? 1 : 0);
    let wGain = (result === 'win') ? 1 : 0;

    try {
        // Step A: Get current list to determine everyone's current rank
        const currentList = await Player.find().sort({ points: -1, wins: -1 });
        
        // Step B: Set everyone's 'previousRank' before we change anything
        for (let i = 0; i < currentList.length; i++) {
            await Player.updateOne({ _id: currentList[i]._id }, { $set: { previousRank: i + 1 } });
        }

        // Step C: Add points to the winner/drawer
        await Player.updateOne({ name: name }, { $inc: { points: pGain, wins: wGain } });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Update failed" });
    }
});
// 1. ADJUST POINTS (Delete/Subtract)
app.post('/api/adjust-points', async (req, res) => {
    const { name, wins, points } = req.body;
    try {
        // Use negative values to subtract
        await Player.updateOne(
            { name: name }, 
            { $inc: { wins: -wins, points: -points } }
        );
        res.json({ success: true, message: "Points adjusted!" });
    } catch (err) {
        res.status(500).json({ error: "Adjustment failed" });
    }
});

// 2. RESET ALL RANKINGS
app.post('/api/reset-rankings', async (req, res) => {
    try {
        await Player.updateMany({}, { 
            $set: { wins: 0, points: 0, previousRank: 0 } 
        });
        res.json({ success: true, message: "All rankings reset to zero!" });
    } catch (err) {
        res.status(500).json({ error: "Reset failed" });
    }
});
// ADD NEW PLAYER TO DATABASE
app.post('/api/add-player', async (req, res) => {
    const { name } = req.body;
    
    try {
        // Check if name is provided
        if (!name) return res.status(400).json({ error: "Name is required" });

        // Check if player already exists
        const existingPlayer = await Player.findOne({ name: name });
        if (existingPlayer) {
            return res.status(400).json({ error: "Player already exists in database!" });
        }

        // Create new player with default stats
        const newPlayer = new Player({
            name: name,
            wins: 0,
            points: 0,
            previousRank: 0
        });

        await newPlayer.save();
        res.json({ success: true, message: "New Player Added!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to add player" });
    }
});
// Updated Tournament Schema
const Tournament = mongoose.model('Tournament', new mongoose.Schema({
    title: String,
    totalTeams: String,
    status: String, // Upcoming, Live, Ended
    winner: { type: String, default: "" },
    fixtureLink: String, // Link to Brackets/Challonge
    rosterLink: String,  // Link to Roster/Google Sheet
    liveResult: String,  // Current Match/Score
    prize: String,
    date: String
}), 'tournaments');

// API: Post Tournament
app.post('/api/manage-tournament', async (req, res) => {
    try {
        const newTour = new Tournament(req.body);
        await newTour.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save tournament" });
    }
});

// API: Get All Tournaments
app.get('/api/tournaments', async (req, res) => {
    const tours = await Tournament.find().sort({ _id: -1 });
    res.json(tours);
});
// Add 'joinLink' to your Tournament Schema
const Tournament = mongoose.model('Tournament', new mongoose.Schema({
    title: String,
    totalTeams: String,
    status: String,
    winner: { type: String, default: "" },
    fixtureLink: String,
    rosterLink: String,
    joinLink: String,  // <--- NEW FIELD
    liveResult: String,
    prize: String,
    date: String
}), 'tournaments');

// Update the POST route to accept joinLink
app.post('/api/manage-tournament', async (req, res) => {
    try {
        const newTour = new Tournament(req.body);
        await newTour.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to save tournament" });
    }
});
// DELETE PLAYER FROM DATABASE
app.delete('/api/delete-player/:name', async (req, res) => {
    const playerName = req.params.name;
    
    try {
        const deletedPlayer = await Player.findOneAndDelete({ name: playerName });
        
        if (!deletedPlayer) {
            return res.status(404).json({ error: "Player not found" });
        }

        // Optional: Recalculate ranks for everyone else after a player is removed
        const allPlayers = await Player.find().sort({ points: -1, wins: -1 });
        for (let i = 0; i < allPlayers.length; i++) {
            await Player.findByIdAndUpdate(allPlayers[i]._id, { previousRank: i + 1 });
        }

        res.json({ success: true, message: `Player ${playerName} deleted forever.` });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete player" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
