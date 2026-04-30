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

// --- UPDATED PLAYER MODEL ---
const Player = mongoose.models.Player || mongoose.model('Player', new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 },
    goalsFor: { type: Number, default: 0 },      // Goals Scored
    goalsAgainst: { type: Number, default: 0 },  // Goals Attested
    trophies: { type: String, default: "" }      // Performance/Trophies
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

const StoreItem = mongoose.models.StoreItem || mongoose.model('StoreItem', new mongoose.Schema({
    name: String, price: String, oldPrice: String, image: String, category: String, date: { type: Date, default: Date.now }
}), 'store');

const Subscriber = mongoose.models.Subscriber || mongoose.model('Subscriber', new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    date: { type: Date, default: Date.now }
}), 'subscribers');

// --- RANKINGS ROUTE ---
app.get('/api/rankings', async (req, res) => {
    try {
        const players = await Player.find().sort({ points: -1, wins: -1, goalsFor: -1 });
        res.json(players);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/player-list', async (req, res) => {
    try { res.json(await Player.find().sort({ name: 1 })); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

// --- UPDATED TROPHY ROUTE ---
app.post('/api/update-trophies', async (req, res) => {
    try {
        await Player.updateOne({ name: req.body.name }, { $set: { trophies: req.body.trophies } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- UPDATED FIXTURE ROUTE (Auto Goal Counting) ---
app.post('/api/update-fixtures', async (req, res) => {
    const { tourId, stageId, matchId, action, matchData } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        const stage = tour.fixtures.id(stageId);
        const match = stage.matches.id(matchId);

        if (action === 'update-score') {
            const g1 = parseInt(matchData.s1) || 0;
            const g2 = parseInt(matchData.s2) || 0;
            
            // Auto Update Goals in Player stats
            await Player.updateOne({ name: match.p1 }, { $inc: { goalsFor: g1, goalsAgainst: g2 } });
            await Player.updateOne({ name: match.p2 }, { $inc: { goalsFor: g2, goalsAgainst: g1 } });

            match.s1 = matchData.s1;
            match.s2 = matchData.s2;
        } else if (action === 'add-stage') {
            tour.fixtures.push({ stageName: req.body.stageName, matches: [] });
        } else if (action === 'add-match') {
            stage.matches.push(matchData);
        } else if (action === 'delete-stage') {
            tour.fixtures.pull(stageId);
        }
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- EXISTING ROUTES ---
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
    try { await Player.updateMany({}, { $set: { wins: 0, points: 0, previousRank: 0, goalsFor: 0, goalsAgainst: 0, trophies: "" } }); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/delete-player-safe', async (req, res) => {
    try { await Player.findOneAndDelete({ name: req.body.name }); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/manage-tournament', async (req, res) => {
    try { res.json(await Tournament.find().sort({ _id: -1 })); } catch (err) { res.status(500).json({ error: "Failed" }); }
});
app.post('/api/manage-tournament', async (req, res) => {
    try { await new Tournament(req.body).save(); res.json({ success: true }); } catch (err) { res.status(500).json({ error: "Failed" }); }
});
app.post('/api/update-tournament', async (req, res) => {
    try { await Tournament.findByIdAndUpdate(req.body.id, req.body.data); res.json({ success: true }); } catch (err) { res.status(500).json({ error: "Failed" }); }
});
app.post('/api/delete-tournament', async (req, res) => {
    try { await Tournament.findByIdAndDelete(req.body.id); res.json({ success: true }); } catch (err) { res.status(500).json({ error: "Failed" }); }
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
app.get('/api/announcement', async (req, res) => {
    try { res.json(await Announcement.find().sort({ date: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/announcement', async (req, res) => {
    try { await new Announcement({ message: req.body.message }).save(); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/clear-announcements', async (req, res) => {
    try { await Announcement.deleteMany({}); res.json({ success: true }); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/store', async (req, res) => {
    try { res.json(await StoreItem.find().sort({ date: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/manage-store', async (req, res) => {
    try {
        if (req.body.action === 'add') await new StoreItem(req.body.data).save();
        else if (req.body.action === 'delete') await StoreItem.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.get('/api/arena-results', async (req, res) => {
    try {
        const tournaments = await Tournament.find().sort({ _id: -1 });
        let allMatches = [];
        tournaments.forEach(tour => {
            if (tour.fixtures) {
                tour.fixtures.forEach(stage => {
                    stage.matches.forEach(match => {
                        allMatches.push({ ...match.toObject(), tournamentTitle: tour.title, stageName: stage.stageName, tourStatus: tour.status });
                    });
                });
            }
        });
        res.json(allMatches.reverse());
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/subscribe', async (req, res) => {
    try { const newSub = new Subscriber({ email: req.body.email }); await newSub.save(); res.json({ success: true }); } 
    catch (err) { res.status(400).json({ error: "Email exists or invalid" }); }
});
app.get('/api/subscribers', async (req, res) => {
    try { res.json(await Subscriber.find().sort({ date: -1 })); } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server Running`));
