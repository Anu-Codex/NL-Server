const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 1. CONNECT TO DATABASE
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Nexus DB Connected Successfully"))
    .catch(err => console.error("❌ DB Connection Error:", err));
const nodemailer = require('nodemailer');
// --- THE "BULLETPROOF" SMTP CONFIG ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    // Increase timeouts so Render doesn't give up too early
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000
});

// CHECK CONNECTION IMMEDIATELY
transporter.verify((error, success) => {
    if (error) {
        console.log("❌ MAIL SERVER STILL BLOCKED:", error.message);
    } else {
        console.log("✅ MAIL SERVER IS OPEN AND READY");
    }
});

// 2. DEFINE SCHEMAS & MODELS

// Player Stats Model (Global Rankings)
const Player = mongoose.models.Player || mongoose.model('Player', new mongoose.Schema({
    name: String,
    wins: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    previousRank: { type: Number, default: 0 },
    goalsFor: { type: Number, default: 0 },      // GS
    goalsAgainst: { type: Number, default: 0 },  // GA
    trophies: { type: String, default: "" },
    playstyle: { type: String, default: "Balanced" },
    formation: { type: String, default: "4-3-3" },
    signaturePlayer: { type: String, default: "Standard" },
    avatar: { type: String, default: "" }
}), 'players'); // Performance


// Announcement Model
const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', new mongoose.Schema({
    message: String,
    date: { type: Date, default: Date.now }
}), 'announcements');

// Tournament Model (Roster, Fixtures, Standings)
const Tournament = mongoose.models.Tournament || mongoose.model('Tournament', new mongoose.Schema({
    title: String,
    totalTeams: String,
    status: String,
    winner: String,
    fixtureLink: String,
    rosterLink: String,
    joinLink: String,
    prize: String,
    date: String,
    tableType: { type: String, default: "Normal" }, // Normal or Group
    roster: [{ 
        teamName: String, 
        players: [String],
        groupName: { type: String, default: "Group A" }
    }],
    fixtures: [{
        stageName: String, 
        matches: [{ 
            p1: String, 
            p2: String, 
            s1: { type: String, default: "-" }, 
            s2: { type: String, default: "-" },
            evidence: { type: String, default: "" }
        }]
    }],
    pendingApplicants: [{ name: String, whatsapp: String, date: { type: Date, default: Date.now } }]
}), 'tournaments');
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }, // In production, use bcrypt to hash
    balance: { type: Number, default: 10000 },
    verified: { type: Boolean, default: false }
}), 'users');

const Bet = mongoose.models.Bet || mongoose.model('Bet', new mongoose.Schema({
    userId: String, username: String, matchId: String, pick: String,
    slips: { type: Number, default: 1 }, multiplier: Number, status: { type: String, default: "Pending" }
}), 'bets');

// --- UPDATE PREDICTION SCHEMA ---
const Prediction = mongoose.models.Prediction || mongoose.model('Prediction', new mongoose.Schema({
    tourId: String, matchId: String, p1: String, p2: String,
    oddsP1: { type: Number, default: 2.0 }, // Multipliers
    oddsDraw: { type: Number, default: 3.0 },
    oddsP2: { type: Number, default: 2.0 },
    status: { type: String, default: "Available" }
}), 'predictions');

// --- FREE AGENT MODEL ---
const FreeAgent = mongoose.models.FreeAgent || mongoose.model('FreeAgent', new mongoose.Schema({
    name: String, division: String, playstyle: String, basePrice: String, whatsapp: String,
    status: { type: String, default: "Available" }, date: { type: Date, default: Date.now }
}));

// Store Model
const StoreItem = mongoose.models.StoreItem || mongoose.model('StoreItem', new mongoose.Schema({
    name: String,
    price: String,
    oldPrice: String,
    image: String,
    category: String,
    date: { type: Date, default: Date.now }
}), 'store');

// Newsletter Model
const Subscriber = mongoose.models.Subscriber || mongoose.model('Subscriber', new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    date: { type: Date, default: Date.now }
}), 'subscribers');


const OTP = mongoose.models.OTP || mongoose.model('OTP', new mongoose.Schema({
    email: String,
    code: String,
    createdAt: { type: Date, default: Date.now, expires: 300 } 
}), 'otps');

// --- CRITICAL: ADD THIS BEFORE YOUR ROUTES ---
transporter.verify((error, success) => {
    if (error) console.log("❌ MAIL CONFIG ERROR: Check EMAIL_USER and EMAIL_PASS in Render settings");
    else console.log("✅ MAIL ENGINE READY");
});

// --- UPDATED REQUEST OTP ROUTE ---
app.post('/api/auth/request-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    try {
        // 1. Save to Database
        await OTP.findOneAndUpdate({ email }, { code: otpCode }, { upsert: true });

        // 2. CRITICAL: Print code to Render Logs so you can see it!
        console.log("-----------------------------------------");
        console.log(`🔑 NEXUS DEBUG: OTP FOR ${email} IS: ${otpCode}`);
        console.log("-----------------------------------------");

        const mailOptions = {
            from: `"Nexus Arena" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Arena Access Code",
            text: `Your code is ${otpCode}`
        };

        // 3. Attempt to send email but DON'T wait for it
        // This stops the "Sending..." button from getting stuck
        transporter.sendMail(mailOptions).catch(err => {
            console.log("📧 Email blocked by Render, but that's okay for now.");
        });

        // 4. Immediately tell the browser "Success" 
        // This allows you to move to the "Enter Code" screen
        res.json({ success: true, message: "Check Render logs for code if email doesn't arrive." });

    } catch (e) {
        res.status(500).json({ error: "Database Error" });
    }
});


// 2. VERIFY OTP & SIGN IN
app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, code } = req.body;
    try {
        const record = await OTP.findOne({ email, code });
        if (!record) return res.status(400).json({ error: "Invalid or expired code" });

        // Email is the username in OTP mode
        let user = await User.findOne({ username: email });
        if (!user) {
            user = new User({ 
                username: email, 
                password: "otp_user_no_pass", // placeholder
                balance: 10000 
            });
            await user.save();
        }
        await OTP.deleteOne({ email });
        res.json({ success: true, user });
    } catch (e) {
        res.status(500).json({ error: "Verification system error" });
    }
});

// 3. API ROUTES

// --- GLOBAL RANKINGS ---
app.get('/api/rankings', async (req, res) => {
    try {
        const players = await Player.find().sort({ points: -1, wins: -1, goalsFor: -1 });
        res.json(players);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/player-list', async (req, res) => {
    try {
        const players = await Player.find().sort({ name: 1 });
        res.json(players);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- SCORING & STATS ---
app.post('/api/add-player', async (req, res) => {
    try {
        const newP = new Player(req.body);
        await newP.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/update-points', async (req, res) => {
    const { name, result } = req.body;
    let pGain = (result === 'win') ? 3 : (result === 'draw' ? 1 : 0);
    let wGain = (result === 'win') ? 1 : 0;
    try {
        const list = await Player.find().sort({ points: -1, wins: -1 });
        for (let i = 0; i < list.length; i++) {
            await Player.updateOne({ _id: list[i]._id }, { $set: { previousRank: i + 1 } });
        }
        await Player.updateOne({ name }, { $inc: { points: pGain, wins: wGain } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/adjust-points', async (req, res) => {
    try {
        await Player.updateOne({ name: req.body.name }, { $inc: { wins: -req.body.wins, points: -req.body.points } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/update-trophies', async (req, res) => {
    try {
        await Player.updateOne({ name: req.body.name }, { $set: { trophies: req.body.trophies } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reset-rankings', async (req, res) => {
    try {
        await Player.updateMany({}, { $set: { wins: 0, points: 0, previousRank: 0, goalsFor: 0, goalsAgainst: 0, trophies: "" } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/delete-player-safe', async (req, res) => {
    try {
        await Player.findOneAndDelete({ name: req.body.name });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- TOURNAMENT CONTROLLER ---
app.get('/api/manage-tournament', async (req, res) => {
    try {
        const tours = await Tournament.find().sort({ _id: -1 });
        res.json(tours);
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/manage-tournament', async (req, res) => {
    try {
        const newT = new Tournament(req.body);
        await newT.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/update-tournament', async (req, res) => {
    try {
        await Tournament.findByIdAndUpdate(req.body.id, req.body.data);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

app.post('/api/delete-tournament', async (req, res) => {
    try {
        await Tournament.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Failed" }); }
});

// --- ROSTER & FIXTURES (AUTO-SYNC GOALS) ---
app.post('/api/update-roster', async (req, res) => {
    const { tourId, teamName, playerName, groupName, action, teamId } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (action === 'add') {
            let team = tour.roster.find(t => t.teamName === teamName);
            if (team) team.players.push(playerName);
            else tour.roster.push({ teamName, players: [playerName], groupName });
        } else if (action === 'remove-team') {
            tour.roster = tour.roster.filter(t => t._id.toString() !== teamId);
        }
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/update-fixtures', async (req, res) => {
    const { tourId, stageId, matchId, action, matchData, stageName } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (action === 'add-stage') {
            tour.fixtures.push({ stageName, matches: [] });
        } else if (action === 'add-match') {
            const stage = tour.fixtures.id(stageId);
            stage.matches.push(matchData);
        } else if (action === 'update-score') {
            const stage = tour.fixtures.id(stageId);
            const match = stage.matches.id(matchId);
            
            const g1 = parseInt(matchData.s1) || 0;
            const g2 = parseInt(matchData.s2) || 0;

            // Automated Goal Tracking for Global Rankings
            await Player.updateOne({ name: match.p1 }, { $inc: { goalsFor: g1, goalsAgainst: g2 } });
            await Player.updateOne({ name: match.p2 }, { $inc: { goalsFor: g2, goalsAgainst: g1 } });

            match.s1 = matchData.s1;
            match.s2 = matchData.s2;
        } else if (action === 'delete-stage') {
            tour.fixtures.pull(stageId);
        }
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- ARENA BROADCAST CENTER ---
app.get('/api/announcement', async (req, res) => {
    try {
        const data = await Announcement.find().sort({ date: -1 });
        res.json(data);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/announcement', async (req, res) => {
    try {
        await new Announcement({ message: req.body.message }).save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/clear-announcements', async (req, res) => {
    try {
        await Announcement.deleteMany({});
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- STORE SYSTEM ---
app.get('/api/store', async (req, res) => {
    try {
        const items = await StoreItem.find().sort({ date: -1 });
        res.json(items);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/manage-store', async (req, res) => {
    try {
        if (req.body.action === 'add') await new StoreItem(req.body.data).save();
        else if (req.body.action === 'delete') await StoreItem.findByIdAndDelete(req.body.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NEWSLETTER & ARENA RESULTS ---
app.get('/api/arena-results', async (req, res) => {
    try {
        const tours = await Tournament.find().sort({ _id: -1 });
        let allMatches = [];
        tours.forEach(tour => {
            if (tour.fixtures) {
                tour.fixtures.forEach(stage => {
                    stage.matches.forEach(m => {
                        allMatches.push({ ...m.toObject(), tournamentTitle: tour.title, stageName: stage.stageName, tourStatus: tour.status });
                    });
                });
            }
        });
        res.json(allMatches.reverse());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscribe', async (req, res) => {
    try {
        const newSub = new Subscriber({ email: req.body.email });
        await newSub.save();
        res.json({ success: true });
    } catch (err) { res.status(400).json({ error: "Email already exists" }); }
});

app.get('/api/subscribers', async (req, res) => {
    try {
        const list = await Subscriber.find().sort({ date: -1 });
        res.json(list);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- 1. GLOBAL RENAME: Updates Roster AND all Fixtures at once ---
app.post('/api/edit-team-name', async (req, res) => {
    const { tourId, oldName, newName } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (!tour) return res.status(404).json({ error: "Tournament not found" });

        // Update in Roster
        tour.roster.forEach(t => {
            if (t.teamName === oldName) t.teamName = newName;
        });

        // Update in ALL Fixtures/Matches (Fixes your "Old name showing" issue)
        if (tour.fixtures) {
            tour.fixtures.forEach(stage => {
                stage.matches.forEach(match => {
                    if (match.p1 === oldName) match.p1 = newName;
                    if (match.p2 === oldName) match.p2 = newName;
                });
            });
        }

        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 2. MATCH SPECIFIC EDIT: Updates a player name in just one specific match ---
app.post('/api/edit-match-player', async (req, res) => {
    const { tourId, stageId, matchId, p1, p2 } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        const stage = tour.fixtures.id(stageId);
        const match = stage.matches.id(matchId);
        
        if (p1) match.p1 = p1;
        if (p2) match.p2 = p2;

        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- NEW ROUTE: EDIT PLAYER NAME (CROSS-DATABASE UPDATE) ---
app.post('/api/edit-player-name', async (req, res) => {
    const { tourId, oldName, newName } = req.body;
    try {
        // 1. Update Global Player Collection (Rankings)
        await Player.updateOne({ name: oldName }, { $set: { name: newName } });

        // 2. Update specific Tournament Data
        const tour = await Tournament.findById(tourId);
        if (tour) {
            // Update Roster
            tour.roster.forEach(team => {
                team.players = team.players.map(p => p === oldName ? newName : p);
            });
            // Update Fixtures/Brackets
            if (tour.fixtures) {
                tour.fixtures.forEach(stage => {
                    stage.matches.forEach(match => {
                        if (match.p1 === oldName) match.p1 = newName;
                        if (match.p2 === oldName) match.p2 = newName;
                    });
                });
            }
            await tour.save();
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- NEW ROUTE: REMOVE SPECIFIC PLAYER FROM A TEAM ROSTER ---
app.post('/api/remove-player-roster', async (req, res) => {
    const { tourId, teamId, playerName } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        if (tour) {
            const team = tour.roster.id(teamId);
            if (team) {
                // Filter out the specific player name
                team.players = team.players.filter(p => p !== playerName);
                await tour.save();
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- UPDATE TOURNAMENT SCHEMA in server.js ---
// Find the matches array inside fixtures and add: evidence: { type: String, default: "" }

// --- NEW ROUTE: SAVE MATCH EVIDENCE ---
app.post('/api/save-evidence', async (req, res) => {
    const { tourId, stageId, matchId, evidenceUrl } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        const stage = tour.fixtures.id(stageId);
        const match = stage.matches.id(matchId);
        
        match.evidence = evidenceUrl; // Save the ImgBB link
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- NEW ROUTE: DELETE MATCH PROOF ---
app.post('/api/delete-evidence', async (req, res) => {
    const { tourId, stageId, matchId } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        const stage = tour.fixtures.id(stageId);
        const match = stage.matches.id(matchId);
        
        match.evidence = ""; // Clear the link
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/update-profile', async (req, res) => {
    try {
        await Player.updateOne({ name: req.body.name }, { $set: req.body.data });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/predictions', async (req, res) => {
    try {
        // This query finds EVERYTHING that is not "Settled"
        // This will bring back all your "vanished" matches immediately
        const data = await Prediction.find({ status: { $ne: "Settled" } });
        res.json(data);
    } catch (err) { 
        res.status(500).json({ error: "Recovery Failed" }); 
    }
});

// --- FIX 2: NO DELETION (UPSERT LOGIC) ---
app.post('/api/predictions/open', async (req, res) => {
    const { matchId, p1, p2, tourId, oddsP1, oddsDraw, oddsP2 } = req.body;
    try {
        // Instead of deleteMany, we use findOneAndUpdate with "upsert: true"
        // This updates the match if it exists, or creates it if it's missing.
        // NO DATA LOSS.
        await Prediction.findOneAndUpdate(
            { matchId: matchId },
            { 
                tourId, p1, p2, oddsP1, oddsDraw, oddsP2, 
                status: "Available" // Force it back to visible
            },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Failed to open" }); }
});

// --- FIX 3: GLOBAL SETTLE ---
app.post('/api/bets/settle', async (req, res) => {
    const { matchId, result } = req.body;
    try {
        const winners = await Bet.find({ matchId, pick: result, status: "Pending" });
        for (let bet of winners) {
            const payout = bet.slips * 100 * bet.multiplier;
            await User.findByIdAndUpdate(bet.userId, { $inc: { balance: payout } });
            bet.status = "Won"; await bet.save();
        }
        await Bet.updateMany({ matchId, status: "Pending" }, { status: "Lost" });
        
        // IMPORTANT: Only when you click "WON", it becomes "Settled" and hides from page
        await Prediction.findOneAndUpdate({ matchId }, { status: "Settled" });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Settle Error" }); }
});

// --- FREE AGENT ROUTES ---
app.get('/api/free-agents', async (req, res) => {
    try { res.json(await FreeAgent.find().sort({ date: -1 })); } 
    catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/manage-agents', async (req, res) => {
    const { action, data, id } = req.body;
    try {
        if (action === 'add') await new FreeAgent(data).save();
        if (action === 'sign') await FreeAgent.findByIdAndUpdate(id, { status: "Signed" });
        if (action === 'delete') await FreeAgent.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});
// --- TOURNAMENT APPLICATION ROUTES ---

// 1. Submit Application (User)
app.post('/api/apply-tournament', async (req, res) => {
    const { tourId, name, whatsapp } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        // Check if already applied
        const exists = tour.pendingApplicants.find(a => a.whatsapp === whatsapp);
        if (exists) return res.status(400).json({ error: "Already applied!" });

        tour.pendingApplicants.push({ name, whatsapp });
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Approve/Reject Application (Admin)
app.post('/api/manage-applications', async (req, res) => {
    const { tourId, appId, action, teamName, groupName } = req.body;
    try {
        const tour = await Tournament.findById(tourId);
        const applicant = tour.pendingApplicants.id(appId);

        if (action === 'approve') {
            // Add to Roster automatically
            let team = tour.roster.find(t => t.teamName === teamName);
            if (team) {
                team.players.push(applicant.name);
            } else {
                tour.roster.push({ teamName, players: [applicant.name], groupName });
            }
        }
        
        // Remove from pending in both cases (Approve or Reject)
        tour.pendingApplicants.pull(appId);
        await tour.save();
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- NEW AUTH ROUTES ---
app.post('/api/auth/signup', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.json({ success: true, user });
    } catch (e) { res.status(400).json({ error: "Username taken" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const user = await User.findOne(req.body);
    if (user) res.json({ success: true, user });
    else res.status(401).json({ error: "Invalid credentials" });
});

// --- BETTING ROUTES ---


// --- NEW ROUTE: TOGGLE MATCH STATUS (Admin) ---
app.post('/api/predictions/toggle-status', async (req, res) => {
    const { matchId, status } = req.body;
    try {
        await Prediction.findOneAndUpdate({ matchId }, { status });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- FIXED WITHDRAW ROUTE ---
app.post('/api/bets/withdraw', async (req, res) => {
    const { userId, matchId } = req.body;
    try {
        // 1. Find the prediction to check if betting is still open
        const pred = await Prediction.findOne({ matchId });
        
        // Safety: If Admin closed it, no refund allowed (prevents cheating during match)
        if (!pred || pred.status !== "Available") {
            return res.status(403).json({ error: "Betting is LOCKED. Cannot withdraw now." });
        }

        // 2. Find all pending bets for THIS user on THIS match
        const userBets = await Bet.find({ userId, matchId, status: "Pending" });

        if (userBets.length === 0) {
            return res.status(404).json({ error: "No active bets found to withdraw." });
        }

        // 3. Calculate total refund (Slips * 100₦)
        const totalRefund = userBets.reduce((sum, bet) => sum + (bet.slips * 100), 0);

        // 4. Update user balance in DB
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        
        user.balance += totalRefund;
        await user.save();

        // 5. Delete the bets from DB so they don't count for payouts later
        await Bet.deleteMany({ userId, matchId, status: "Pending" });

        res.json({ success: true, newBalance: user.balance });
    } catch (err) {
        console.error("Withdraw Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});
app.get('/api/user-bets-all/:userId', async (req, res) => {
    const bets = await Bet.find({ userId: req.params.userId, status: "Pending" });
    res.json(bets);
});

// --- UPDATE BET PLACING ROUTE (Check Status) ---
app.post('/api/bets/place', async (req, res) => {
    const { userId, matchId, pick, slips, multiplier } = req.body;
    try {
        const pred = await Prediction.findOne({ matchId });
        if (pred.status !== "Available") return res.status(403).json({ error: "Betting is CLOSED for this match!" });

        const cost = slips * 100;
        const user = await User.findById(userId);
        if (user.balance < cost) return res.status(400).json({ error: "Insufficient ₦" });

        user.balance -= cost;
        await user.save();
        await new Bet({ userId, username: user.username, matchId, pick, slips, multiplier }).save();
        res.json({ success: true, newBalance: user.balance });
    } catch (e) { res.status(500).json({ error: "Fail" }); }
});


// 4. START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Nexus Server Running on Port ${PORT}`));
