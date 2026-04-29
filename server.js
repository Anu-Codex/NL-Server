const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.log(err));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
