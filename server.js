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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
