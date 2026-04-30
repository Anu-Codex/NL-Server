const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Nexus DB Connected"))
    .catch(err => console.error("❌ DB Connection Error:", err));

// --- MODELS ---
const Player = mongoose.models.Player || mongoose.model('Player', new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }
}), 'players');
const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', new mongoose.Schema({
    message: String,
    date: { type: Date, default: Date.now }
}), 'announcements');

const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', new mongoose.Schema({
    title: String, totalTeams: String, status: String, winner: String,
    fixtureLink: String, rosterLink: String, joinLink: String, prize: String, date: String,
    roster: [{ teamName: String, players: [String] }],
    fixtures: [{
        stageName: String, 
        matches: [{ p1: String, p2: String, s1: { type: String, default: "-" }, s2: { type: String, default: "-" } }]
    }]
}), 'tournaments');

// --- RANKINGS ROUTE (FIXED TO MATCH DASHBOARD LOGIC) ---
app.get('/api/rankings', async (req, res) => {
    try {
        // This sorts by points (highest first). If points are equal, it sorts by wins.
        const players = await Player.find().sort({ points: -1, wins: -1 });
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- PLAYER LIST (FOR DASHBOARD) ---
app.get('/api/player-list', async (req, res) => {
    try {
        const players = await Player.find().sort({ name: 1 });
        res.json(players);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- REMAINING ROUTES (ALL UNTOUCHED) ---
app.post('/api/add-player', async (req, res) => {
    try { await new Player(req.body).save(); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/update-points', async (req, res) => {
    const { name, result } = req.body;
    let pGain = (result === 'win') ? 3 : (result === 'draw' ? 1 : 0);
    let wGain = (result === 'win') ? 1 : 0;
    try {
        const list = await Player.find().sort({ points: -1, wins: -1 });
        for (let i = 0; i < list.length; i++) { await Player.updateOne({ _id: list[i]._id }, { $set: { previousRank: i + 1 } }); }
        await Player.updateOne({ name }, { $inc: { points: pGain, wins: wGain } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/reset-rankings', async (req, res) => {
    try { await Player.updateMany({}, { $set: { wins: 0, points: 0, previousRank: 0 } }); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/delete-player-safe', async (req, res) => {
    try { await Player.findOneAndDelete({ name: req.body.name }); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/manage-tournament', async (req, res) => {
    try { const tours = await Tournament.find().sort({ _id: -1 }); res.json(tours); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/manage-tournament', async (req, res) => {
    try { await new Tournament(req.body).save(); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/update-tournament', async (req, res) => {
    try { await Tournament.findByIdAndUpdate(req.body.id, req.body.data); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/delete-tournament', async (req, res) => {
    try { await Tournament.findByIdAndDelete(req.body.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/update-roster', async (req, res) => {
    const { tourId, teamName, playerName, action, teamId } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (action === 'add') {
            let team = tour.roster.find(t => t.teamName === teamName);
            if (team) team.players.push(playerName); else tour.roster.push({ teamName, players: [playerName] });
        } else if (action === 'remove-team') { tour.roster = tour.roster.filter(t => t._id.toString() !== teamId); }
        await tour.save(); res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/update-fixtures', async (req, res) => {
    const { tourId, stageName, matchData, action, stageId, matchId } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (action === 'add-stage') { tour.fixtures.push({ stageName, matches: [] }); } 
        else if (action === 'add-match') { const stage = tour.fixtures.id(stageId); stage.matches.push(matchData); }
        else if (action === 'update-score') { const stage = tour.fixtures.id(stageId); const match = stage.matches.id(matchId); match.s1 = matchData.s1; match.s2 = matchData.s2; }
        else if (action === 'delete-stage') { tour.fixtures.pull(stageId); }
        await tour.save(); res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- ANNOUNCEMENT ROUTES (Updated for History) ---
app.get('/api/announcement', async (req, res) => {
    try {
        // Fetch all messages, newest first
        const data = await Announcement.find().sort({ date: -1 });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/announcement', async (req, res) => {
    try {
        // Just save the new message (Don't delete old ones)
        await new Announcement({ message: req.body.message }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Add this to allow Admin to clear history if it gets too long
app.post('/api/clear-announcements', async (req, res) => {
    try {
        await Announcement.deleteMany({});
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(process.env.PORT || 5000, () => console.log("🚀 Server Running"));
