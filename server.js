const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. FIXED CORS
app.use(cors());
app.use(express.json());

// 2. CONNECT TO DATABASE
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// 3. DEFINE MODELS (Only once!)
const Player = mongoose.models.Player || mongoose.model('Player', new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }
}), 'players');

// --- UPDATE TOURNAMENT SCHEMA ---
const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', new mongoose.Schema({
    title: String,
    totalTeams: String,
    status: String,
    winner: String,
    fixtureLink: String,
    rosterLink: String,
    joinLink: String,
    prize: String,
    date: String,
    roster: [{ teamName: String, players: [String] }],
    // NEW FIELD: Match Data
    matches: [{
        round: String, // e.g., "Round of 16", "Semi-Final"
        p1: String,    // Player/Team 1
        p2: String,    // Player/Team 2
        s1: { type: String, default: "-" }, // Score 1
        s2: { type: String, default: "-" }, // Score 2
        isLive: { type: Boolean, default: false }
    }]
}), 'tournaments');

// --- NEW ROUTE: UPDATE MATCHES ---
app.post('/api/update-bracket', async (req, res) => {
    const { tourId, matchData, action, matchId } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (action === 'add') {
            tour.matches.push(matchData);
        } else if (action === 'update-score') {
            const match = tour.matches.id(matchId);
            match.s1 = matchData.s1;
            match.s2 = matchData.s2;
            match.isLive = matchData.isLive;
        } else if (action === 'delete') {
            tour.matches.pull(matchId);
        }
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Optimized Roster Endpoint
app.post('/api/update-roster', async (req, res) => {
    const { tourId, teamName, playerName, action } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (action === 'add') {
            let team = tour.roster.find(t => t.teamName === teamName);
            if (team) {
                team.players.push(playerName);
            } else {
                tour.roster.push({ teamName, players: [playerName] });
            }
        } else if (action === 'remove-team') {
            tour.roster = tour.roster.filter(t => t._id.toString() !== req.body.teamId);
        }
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. RANKINGS ROUTE
app.get('/api/rankings', async (req, res) => {
    try {
        const players = await Player.find().sort({ points: -1, wins: -1 });
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch rankings" });
    }
});

// 5. PLAYER LIST (For Dashboard)
app.get('/api/player-list', async (req, res) => {
    try {
        const players = await Player.find({}, 'name').sort({ name: 1 });
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch list" });
    }
});

// 6. UPDATE SCORING logic
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/add-player', async (req, res) => {
    try {
        const newP = new Player(req.body);
        await newP.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/delete-player-safe', async (req, res) => {
    try {
        await Player.findOneAndDelete({ name: req.body.name });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/adjust-points', async (req, res) => {
    try {
        await Player.updateOne({ name: req.body.name }, { $inc: { wins: -req.body.wins, points: -req.body.points } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- RESET ALL PLAYERS TO ZERO ---
app.post('/api/reset-rankings', async (req, res) => {
    try {
        console.log("Reset Request Received");
        // This targets every single player and wipes their scores
        const result = await Player.updateMany({}, { 
            $set: { 
                wins: 0, 
                points: 0, 
                previousRank: 0 
            } 
        });
        
        console.log("Reset Success:", result);
        res.json({ success: true, message: "All rankings reset!" });
    } catch (err) {
        console.error("Reset Error:", err);
        res.status(500).json({ error: "Reset failed", details: err.message });
    }
});

// 7. TOURNAMENT ROUTES
app.get('/api/manage-tournament', async (req, res) => {
    try {
        const tours = await Tournament.find().sort({ _id: -1 });
        res.json(tours);
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/manage-tournament', async (req, res) => {
    try {
        const newT = new Tournament(req.body);
        await newT.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/update-tournament', async (req, res) => {
    try {
        await Tournament.findByIdAndUpdate(req.body.id, req.body.data);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/delete-tournament', async (req, res) => {
    try {
        await Tournament.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
