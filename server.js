const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Database Connected"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// --- PLAYER MODEL ---
const Player = mongoose.models.Player || mongoose.model('Player', new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }
}), 'players');

// --- TOURNAMENT MODEL (UPDATED WITH FIXTURES) ---
const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', new mongoose.Schema({
    title: String, totalTeams: String, status: String, winner: String,
    fixtureLink: String, rosterLink: String, joinLink: String, prize: String, date: String,
    roster: [{ teamName: String, players: [String] }],
    fixtures: [{
        stageName: String, 
        matches: [{
            p1: String, p2: String,
            s1: { type: String, default: "-" },
            s2: { type: String, default: "-" }
        }]
    }]
}), 'tournaments');

// --- FIXTURE MANAGEMENT ROUTE ---
app.post('/api/update-fixtures', async (req, res) => {
    const { tourId, stageName, matchData, action, stageId, matchId } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (action === 'add-stage') {
            tour.fixtures.push({ stageName, matches: [] });
        } else if (action === 'add-match') {
            const stage = tour.fixtures.id(stageId);
            stage.matches.push(matchData);
        } else if (action === 'update-score') {
            const stage = tour.fixtures.id(stageId);
            const match = stage.matches.id(matchId);
            match.s1 = matchData.s1;
            match.s2 = matchData.s2;
        } else if (action === 'delete-stage') {
            tour.fixtures.pull(stageId);
        }
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- EXISTING ROUTES (UNTOUCHED) ---
app.post('/api/update-roster', async (req, res) => {
    const { tourId, teamName, playerName, action, teamId } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (action === 'add') {
            let team = tour.roster.find(t => t.teamName === teamName);
            if (team) team.players.push(playerName);
            else tour.roster.push({ teamName, players: [playerName] });
        } else if (action === 'remove-team') {
            tour.roster = tour.roster.filter(t => t._id.toString() !== teamId);
        }
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/rankings', async (req, res) => {
    try { const players = await Player.find().sort({ points: -1, wins: -1 }); res.json(players); } 
    catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get('/api/player-list', async (req, res) => {
    try { const players = await Player.find({}, 'name').sort({ name: 1 }); res.json(players); } 
    catch (err) { res.status(500).json({ error: "Failed" }); }
});

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
    try { const newP = new Player(req.body); await newP.save(); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/delete-player-safe', async (req, res) => {
    try { await Player.findOneAndDelete({ name: req.body.name }); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reset-rankings', async (req, res) => {
    try { await Player.updateMany({}, { $set: { wins: 0, points: 0, previousRank: 0 } }); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.get('/api/manage-tournament', async (req, res) => {
    try { const tours = await Tournament.find().sort({ _id: -1 }); res.json(tours); } 
    catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/manage-tournament', async (req, res) => {
    try { const newT = new Tournament(req.body); await newT.save(); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/update-tournament', async (req, res) => {
    try { await Tournament.findByIdAndUpdate(req.body.id, req.body.data); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/delete-tournament', async (req, res) => {
    try { await Tournament.findByIdAndDelete(req.body.id); res.json({ success: true }); } 
    catch (err) { res.status(500).json({ error: "Failed" }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
