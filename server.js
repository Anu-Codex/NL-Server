const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express(); // THIS LINE DEFINES 'app' - IT MUST BE HERE

// Middlewares
app.use(cors());
app.use(express.json());

// 1. Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("✅ Connected to MongoDB");

    // THIS CODE WILL SHOW YOU THE ACTUAL COLLECTIONS IN THE LOGS
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Your Collections are:", collections.map(c => c.name));

    // CHECK IF DATA EXISTS
    const count = await mongoose.connection.db.collection('players').countDocuments();
    console.log(`There are ${count} players in the 'players' collection.`);
  })
  .catch(err => console.error("❌ Connection Error:", err));

// 2. Player Model (Ensure the collection name 'players' matches your auction DB)
const playerSchema = new mongoose.Schema({
    // If your auction site used 'playerName', change 'name' to 'playerName' below
    name: { type: String, alias: 'playerName' }, 
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }
}, { strict: false }); // 'strict: false' allows it to load players even if they don't match the schema perfectly

const Player = mongoose.model('Player', playerSchema, 'players'); 

// 3. API ROUTES (Must come AFTER app is defined)

// Get all players for rankings
app.get('/api/rankings', async (req, res) => {
    try {
        const players = await Player.find().sort({ points: -1, wins: -1 });
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get names for the dashboard dropdown
app.get('/api/player-list', async (req, res) => {
    try {
        const players = await Player.find({}, 'name');
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update points logic
app.post('/api/update-points', async (req, res) => {
    const { name, result } = req.body;
    let pointGain = 0;
    let winGain = 0;

    if (result === 'win') { pointGain = 3; winGain = 1; }
    else if (result === 'draw') { pointGain = 1; }

    try {
        // STEP 1: Get all players in their CURRENT order (before the update)
        const currentStandings = await Player.find().sort({ points: -1, wins: -1 });

        // STEP 2: Save their current positions as 'previousRank'
        for (let i = 0; i < currentStandings.length; i++) {
            await Player.findByIdAndUpdate(currentStandings[i]._id, { previousRank: i + 1 });
        }

        // STEP 3: Now apply the new points to the specific player
        await Player.findOneAndUpdate(
            { name: name }, 
            { $inc: { points: pointGain, wins: winGain } }
        );

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
