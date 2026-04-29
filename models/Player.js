// Replace 'players' with the EXACT name of the collection in your MongoDB auction database
const playerSchema = new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }
});

// IMPORTANT: The third argument 'players' is the name of your existing collection
const Player = mongoose.model('Player', playerSchema, 'players'); 

// NEW: Endpoint to get JUST the names for the Admin Dashboard dropdown
app.get('/api/player-list', async (req, res) => {
    try {
        const players = await Player.find({}, 'name'); // Fetch only names
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Existing rankings endpoint
app.get('/api/rankings', async (req, res) => {
    try {
        const players = await Player.find().sort({ points: -1, wins: -1 });
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
