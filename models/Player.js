const Player = mongoose.model('Player', {
    name: String,
    wins: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 }, // For the Up/Down arrow logic
    lastUpdated: { type: Date, default: Date.now }
});
