require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// --- Mongoose Models ---
const PlayerSchema = new mongoose.Schema({
    name: String,
    photoUrl: String,
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 },
    currentRank: { type: Number, default: 0 }
});
const Player = mongoose.model('Player', PlayerSchema);

const TournamentSchema = new mongoose.Schema({
    name: String,
    status: { type: String, enum:['past', 'live', 'upcoming'], default: 'upcoming' },
    winner: String,
    secondPlace: String,
    thirdPlace: String,
    matches:[{ team1: String, team2: String, score1: Number, score2: Number, status: String }]
});
const Tournament = mongoose.model('Tournament', TournamentSchema);

const SubscriberSchema = new mongoose.Schema({ email: String });
const Subscriber = mongoose.model('Subscriber', SubscriberSchema);

// --- Middleware ---
const verifyAdmin = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: 'No token provided' });
    jwt.verify(token.split(" ")[1], process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(500).json({ message: 'Failed to authenticate token' });
        next();
    });
};

// --- Routes ---
// 1. Auth (Specific Email & Pass in .env)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASS) {
        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
});

// 2. Public Routes
app.get('/api/players', async (req, res) => {
    const players = await Player.find().sort({ points: -1 }).limit(100);
    res.json(players);
});

app.get('/api/tournaments', async (req, res) => {
    const tournaments = await Tournament.find().sort({ _id: -1 });
    res.json(tournaments);
});

app.post('/api/subscribe', async (req, res) => {
    const newSub = new Subscriber({ email: req.body.email });
    await newSub.save();
    res.json({ message: 'Subscribed successfully!' });
});

// 3. Admin Protected Routes (Players)
app.post('/api/players', verifyAdmin, async (req, res) => {
    const { wins, draws } = req.body;
    const points = (wins * 3) + (draws * 1);
    const newPlayer = new Player({ ...req.body, points });
    await newPlayer.save();
    res.json(newPlayer);
});

app.put('/api/players/:id', verifyAdmin, async (req, res) => {
    const { wins, draws } = req.body;
    const points = (wins * 3) + (draws * 1);
    const updated = await Player.findByIdAndUpdate(req.params.id, { ...req.body, points }, { new: true });
    res.json(updated);
});

app.delete('/api/players/:id', verifyAdmin, async (req, res) => {
    await Player.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

// 4. Admin Protected Routes (Tournaments)
app.post('/api/tournaments', verifyAdmin, async (req, res) => {
    const newTour = new Tournament(req.body);
    await newTour.save();
    res.json(newTour);
});

app.put('/api/tournaments/:id', verifyAdmin, async (req, res) => {
    const updated = await Tournament.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
});

app.delete('/api/tournaments/:id', verifyAdmin, async (req, res) => {
    await Tournament.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
