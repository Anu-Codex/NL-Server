const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected to Nexus DB'))
  .catch(err => console.log(err));

// --- DATABASE MODELS ---
const Admin = mongoose.model('Admin', new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
}));

const Player = mongoose.model('Player', new mongoose.Schema({
    name: String,
    elo: Number,
    winRate: String
}));

const Tournament = mongoose.model('Tournament', new mongoose.Schema({
    name: String,
    status: { type: String, default: 'Upcoming' },
    matches:[{ teamA: String, teamB: String, scoreA: Number, scoreB: Number, isComplete: Boolean }]
}));

// --- AUTH MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access Denied' });
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = verified;
        next();
    } catch (err) {
        res.status(400).json({ message: 'Invalid Token' });
    }
};

// --- API ROUTES: ADMIN AUTH ---
// Run this ONCE via Postman to create your first admin account, then remove/comment out
app.post('/api/admin/setup', async (req, res) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    const newAdmin = new Admin({ email: 'admin@nexus.com', password: hashedPassword });
    await newAdmin.save();
    res.json({ message: 'Admin created! Email: admin@nexus.com, Pass: admin123' });
});

app.post('/api/admin/login', async (req, res) => {
    const admin = await Admin.findOne({ email: req.body.email });
    if (!admin) return res.status(400).json({ message: 'Admin not found' });

    const validPass = await bcrypt.compare(req.body.password, admin.password);
    if (!validPass) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ _id: admin._id }, process.env.JWT_SECRET);
    res.header('Authorization', token).json({ token, message: 'Logged in successfully' });
});

// --- API ROUTES: PLAYERS (Rankings) ---
app.get('/api/players', async (req, res) => {
    const players = await Player.find().sort({ elo: -1 }); // Highest ELO first
    res.json(players);
});

app.post('/api/players', authenticateToken, async (req, res) => {
    const newPlayer = new Player(req.body);
    await newPlayer.save();
    res.json(newPlayer);
});

// --- API ROUTES: TOURNAMENTS ---
app.get('/api/tournaments', async (req, res) => {
    const tournaments = await Tournament.find();
    res.json(tournaments);
});

app.post('/api/tournaments', authenticateToken, async (req, res) => {
    const newTournament = new Tournament(req.body);
    await newTournament.save();
    res.json(newTournament);
});

app.put('/api/tournaments/:id/match', authenticateToken, async (req, res) => {
    const tournament = await Tournament.findById(req.params.id);
    tournament.matches.push(req.body); // Add a match
    await tournament.save();
    res.json(tournament);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Command Center running on port ${PORT}`));
