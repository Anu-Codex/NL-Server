const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Player = require('./models/Player'); // Adjust the path to your file

const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.log(err));
mongoose.connect(process.env.MONGO_URI).then(async () => {
    console.log("Connected!");
    
    // This updates all existing players who don't have a 'points' field yet
    const result = await Player.updateMany(
        { points: { $exists: false } }, 
        { $set: { wins: 0, draws: 0, points: 0, previousRank: 0 } }
    );
    console.log(`Initialized ${result.modifiedCount} players from auction site.`);
});

// Tournament Model
const Tournament = mongoose.model('Tournament', {
    title: String,
    status: String,
    prize: String,
    date: String,
    link: String
});

// GET: Fetch all tournaments for the homepage
app.get('/api/tournaments', async (req, res) => {
    const tours = await Tournament.find();
    res.json(tours);
});

// POST: Add new tournament (Used by Admin Dashboard)
app.post('/api/tournaments', async (req, res) => {
    const newTour = new Tournament(req.body);
    await newTour.save();
    res.json({ message: "Tournament Updated!" });
});

// DELETE: Remove tournament
app.delete('/api/tournaments/:id', async (req, res) => {
    await Tournament.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
});
// Endpoint to update player stats
app.post('/api/update-points', async (req, res) => {
    const { name, result } = req.body;
    let pointGain = 0;
    let winGain = 0;

    if (result === 'win') { pointGain = 3; winGain = 1; }
    else if (result === 'draw') { pointGain = 1; }

    // 1. Update the player stats
    await Player.findOneAndUpdate(
        { name: name },
        { $inc: { points: pointGain, wins: winGain } }
    );

    // 2. Logic to update all previousRanks for trend symbols
    // Fetch all players sorted by points to calculate new ranks
    const allPlayers = await Player.find().sort({ points: -1 });
    for (let i = 0; i < allPlayers.length; i++) {
        await Player.findByIdAndUpdate(allPlayers[i]._id, { previousRank: i + 1 });
    }

    res.json({ success: true });
});

// Endpoint to get rankings
app.get('/api/rankings', async (req, res) => {
    const players = await Player.find().sort({ points: -1 });
    res.json(players);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
