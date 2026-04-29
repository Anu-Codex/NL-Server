const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. Bulletproof CORS setup
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.options('*', cors()); 

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.log("❌ DB Error:", err));

// --- SCHEMAS (Defined before Routes) ---

// Player Schema
const Player = mongoose.model('Player', new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }
}), 'players');

// Tournament Schema
const Tournament = mongoose.model('Tournament', new mongoose.Schema({
    title: String,
    totalTeams: String,
    status: String,
    winner: { type: String, default: "" },
    fixtureLink: String,
    rosterLink: String,
    joinLink: String,
    liveResult: String,
    prize: String,
    date: String
}), 'tournaments');


// --- PLAYER ROUTES ---

// GET ALL PLAYERS (For Rankings)
app.get('/api/rankings', async (req, res) => {
    try {
        const players = await Player.find().sort({ points: -1, wins: -1 });
        res.json(players);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

// GET NAMES ONLY (For Dashboard Dropdown)
app.get('/api/player-list', async (req, res) => {
    try {
        const players = await Player.find({}, 'name').sort({ name: 1 });
        res.json(players);
    } catch (err) { res.status(500).json({ error: "Fetch failed" }); }
});

// ADD NEW PLAYER
app.post('/api/add-player', async (req, res) => {
    const { name } = req.body;
    try {
        const existing = await Player.findOne({ name });
        if (existing) return res.status(400).json({ error: "Exists" });
        const newP = new Player({ name });
        await newP.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Fail" }); }
});

// UPDATE POINTS
app.post('/api/update-points', async (req, res) => {
    const { name, result } = req.body;
    let pGain = (result === 'win') ? 3 : (result === 'draw' ? 1 : 0);
    let wGain = (result === 'win') ? 1 : 0;
    try {
        const currentList = await Player.find().sort({ points: -1, wins: -1 });
        for (let i = 0; i < currentList.length; i++) {
            await Player.updateOne({ _id: currentList[i]._id }, { $set: { previousRank: i + 1 } });
        }
        await Player.updateOne({ name }, { $inc: { points: pGain, wins: wGain } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Fail" }); }
});

// DELETE PLAYER (Mobile Safe Post)
app.post('/api/delete-player-safe', async (req, res) => {
    try {
        const { name } = req.body;
        await Player.findOneAndDelete({ name });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Fail" }); }
});

// ADJUST / RESET ROUTES
app.post('/api/adjust-points', async (req, res) => {
    try {
        await Player.updateOne({ name: req.body.name }, { $inc: { wins: -req.body.wins, points: -req.body.points } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Fail" }); }
});

app.post('/api/reset-rankings', async (req, res) => {
    try {
        await Player.updateMany({}, { $set: { wins: 0, points: 0, previousRank: 0 } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Fail" }); }
});


// --- TOURNAMENT ROUTES (Fixed URLs) ---

// 1. SAVE TOURNAMENT (From Dashboard)
app.post('/api/manage-tournament', async (req, res) => {
    try {
        const newTour = new Tournament(req.body);
        await newTour.save();
        res.json({ success: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to save tournament" });
    }
});

// 2. GET TOURNAMENTS (For Info Page)
// Both URLs now point to the same data to prevent errors
app.get('/api/manage-tournament', async (req, res) => {
    try {
        const tours = await Tournament.find().sort({ _id: -1 });
        res.json(tours);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch" });
    }
});

// Fallback route for older code versions
app.get('/api/tournaments', async (req, res) => {
    const tours = await Tournament.find().sort({ _id: -1 });
    res.json(tours);
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server live on ${PORT}`));
