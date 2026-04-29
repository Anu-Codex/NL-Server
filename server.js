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

// --- SCHEMAS ---
const Player = mongoose.model('Player', new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }
}), 'players');

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
app.get('/api/player-list', async (req, res) => {
    const players = await Player.find({}, 'name').sort({ name: 1 });
    res.json(players);
});

app.post('/api/add-player', async (req, res) => {
    const newP = new Player(req.body);
    await newP.save();
    res.json({ success: true });
});

app.post('/api/update-points', async (req, res) => {
    const { name, result } = req.body;
    let pGain = (result === 'win') ? 3 : (result === 'draw' ? 1 : 0);
    let wGain = (result === 'win') ? 1 : 0;
    await Player.updateOne({ name }, { $inc: { points: pGain, wins: wGain } });
    res.json({ success: true });
});

app.post('/api/delete-player-safe', async (req, res) => {
    await Player.findOneAndDelete({ name: req.body.name });
    res.json({ success: true });
});

// --- TOURNAMENT ROUTES ---

// 1. Get all tournaments
app.get('/api/manage-tournament', async (req, res) => {
    const tours = await Tournament.find().sort({ _id: -1 });
    res.json(tours);
});

// 2. Create new tournament
app.post('/api/manage-tournament', async (req, res) => {
    const newTour = new Tournament(req.body);
    await newTour.save();
    res.json({ success: true });
});

// 3. Update existing tournament
app.post('/api/update-tournament', async (req, res) => {
    const { id, data } = req.body;
    await Tournament.findByIdAndUpdate(id, data);
    res.json({ success: true });
});

// 4. Delete tournament
app.post('/api/delete-tournament', async (req, res) => {
    await Tournament.findByIdAndDelete(req.body.id);
    res.json({ success: true });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));
