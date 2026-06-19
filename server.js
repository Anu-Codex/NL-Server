const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const arenaConn = mongoose.createConnection(process.env.MONGO_URI_ARENA);
const nfaConn = mongoose.createConnection(process.env.MONGO_URI_NFA);

// 1. CONNECT TO DATABASE
arenaConn.on('connected', () => console.log("✅ DB 1: Arena/Core Connected"));
nfaConn.on('connected', () => console.log("✅ DB 2: NFA Management Connected"));
// 2. DEFINE SCHEMAS & MODELS

// Player Stats Model (Global Rankings)
const PlayerSchema = new mongoose.Schema({
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
});


// Announcement Model
const AnnouncementSchema = new mongoose.Schema({
    message: String,
    date: { type: Date, default: Date.now }
});

// Tournament Model (Roster, Fixtures, Standings)
const TournamentSchema = new mongoose.Schema({
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
});
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true }, // In production, use bcrypt to hash
    balance: { type: Number, default: 10000 },
    verified: { type: Boolean, default: false },
    lastClaim: { type: Date, default: null },
    pendingAdCode: { type: String, default: null } 
});

const BetSchema = new mongoose.Schema({
    userId: String, username: String, matchId: String, pick: String,
    slips: { type: Number, default: 1 }, multiplier: Number, status: { type: String, default: "Pending" }
});

// --- UPDATE PREDICTION SCHEMA ---
const PredictionSchema = new mongoose.Schema({
    tourId: String, matchId: String, p1: String, p2: String,
    oddsP1: { type: Number, default: 2.0 }, // Multipliers
    oddsDraw: { type: Number, default: 3.0 },
    oddsP2: { type: Number, default: 2.0 },
    status: { type: String, default: "Available" }
});

// --- FREE AGENT MODEL ---
const FreeAgentSchema = new mongoose.Schema({
    name: String, division: String, playstyle: String, basePrice: String, whatsapp: String,
    status: { type: String, default: "Available" }, date: { type: Date, default: Date.now }
});

// Store Model
const StoreItemSchema = new mongoose.Schema({
    name: String,
    price: String,
    oldPrice: String,
    image: String,
    category: String,
    date: { type: Date, default: Date.now }
});

// Newsletter Model
const SubscriberSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    date: { type: Date, default: Date.now }
});


const OTPSchema = new mongoose.Schema({
    email: String,
    code: String,
    createdAt: { type: Date, default: Date.now, expires: 300 } 
});

const ActivitySchema = new mongoose.Schema({
    text: String,
    date: { type: Date, default: Date.now }
});

const ClubSchema = new mongoose.Schema({
    name: String, 
    owner: String, 
    manager: String,
    identityColor: String,
    stadium: String,
    budget: { type: Number, default: 800000000 }, // 800M Startup Grant
    crp: { type: Number, default: 0 }, // Club Reputation Points
    squad: [{
        playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
        playerName: String,
        releaseClause: { type: Number, default: 50000000 }, // e.g. 50M
        weeklyWage: { type: Number, default: 100000 },
        contractType: { type: String, default: "Permanent" } // Permanent or Loan
    }],
    isFranchise: { type: Boolean, default: true }
});

const NFALogSchema = new mongoose.Schema({
    clubId: String,
    type: String, // "Grant", "Transfer", "Stadium", "Fine"
    amount: Number,
    description: String,
    date: { type: Date, default: Date.now }
});
const BulletinSchema = new mongoose.Schema({
    title: String,
    content: String,
    severity: { type: String, default: "Info" }, // Info, Warning, Critical
    date: { type: Date, default: Date.now }
});
const Bulletin = nfaConn.model('Bulletin', BulletinSchema);
const MarketListingSchema = new mongoose.Schema({
    playerId: String, // ID from Arena DB
    playerName: String,
    currentClub: String,
    price: Number,
    type: { type: String, default: "Sale" }, // Sale or Loan
    expiry: Date, // For the countdown
    date: { type: Date, default: Date.now }
});
const MarketListing = nfaConn.model('MarketListing', MarketListingSchema);

// 2. Market Status: Global switch to Open/Close the window
const MarketStatusSchema = new mongoose.Schema({
    isOpen: { type: Boolean, default: false },
    closingDate: Date
});
const MarketStatus = nfaConn.model('MarketStatus', MarketStatusSchema);
const DraftPickSchema = new mongoose.Schema({
    clubId: String,
    clubName: String,
    playerId: String,
    playerName: String,
    round: Number,
    date: { type: Date, default: Date.now }
});
const DraftPick = nfaConn.model('DraftPick', DraftPickSchema);

// Attached to Arena DB
const Player = arenaConn.model('Player', PlayerSchema);
const User = arenaConn.model('User', UserSchema);
const Tournament = arenaConn.model('Tournament', TournamentSchema);
const Activity = arenaConn.model('Activity', new mongoose.Schema({ text: String, date: { type: Date, default: Date.now } }));
const OTP = arenaConn.model('OTP', new mongoose.Schema({ email: String, code: String, createdAt: { type: Date, default: Date.now, expires: 300 } }));

// Attached to NFA DB
const Club = nfaConn.model('Club', ClubSchema);
const NFALog = nfaConn.model('NFALog', NFALogSchema);

// --- CORRECTED REQUEST OTP ROUTE (REPLACE LINES 105-183) ---
app.post('/api/auth/request-otp', async (req, res) => {
    const { email, type } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    try {
        const userExists = await User.findOne({ username: email });

        // Security logic
        if (type === 'signup' && userExists) {
            return res.status(400).json({ error: "Email already registered. Please Sign In." });
        }
        if (type === 'login' && !userExists) {
            return res.status(400).json({ error: "Account not found. Please Sign Up first." });
        }
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        await OTP.findOneAndUpdate({ email }, { code: otpCode }, { upsert: true });

        // Email Customization
        let emailSubject = type === 'signup' ? `Welcome to Nexus - ${otpCode}` : `Arena Access Code - ${otpCode}`;
        let emailHeadline = type === 'signup' ? "WELCOME TO THE ARENA" : "WELCOME BACK STRIKER";
        let emailSubtext = type === 'signup' 
            ? `Verify your account to join the elite and <br>claim your <b style="color: #E4FF00;">₦10,000 Sign-up Bonus</b>.` 
            : `Use this code to return to your account <br>and manage your betting slips.`;

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { name: "Nexus Arena", email: "mysticfcmlegends@gmail.com" },
                to: [{ email: email }],
                subject: emailSubject,
                htmlContent: `
                <div style="background-color: #050505; padding: 40px 10px; font-family: sans-serif; color: white; text-align: center;">
                <div style="max-width: 450px; margin: 0 auto; background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                        <div style="background: linear-gradient(to right, #0041FF, #050505); padding: 25px; border-bottom: 2px solid #E4FF00;">
                            <h1 style="margin: 0; color: #fff; text-transform: uppercase; letter-spacing: 4px; font-size: 1.6rem;">NEXUS <span style="color: #E4FF00;">LEGENDS</span></h1>
                        </div>
                        <div style="padding: 40px 30px;">
                        <h2 style="margin: 0; font-size: 1.3rem; color: #fff; text-transform: uppercase;">${emailHeadline}</h2>
                            <div style="margin: 30px 0; background: #000; border: 1px dashed #333; padding: 25px; border-radius: 15px;">
                                <div style="font-size: 3.8rem; font-weight: 900; color: #E4FF00; letter-spacing: 12px;">${otpCode}</div>
                            </div>
                            <p style="color: #888; font-size: 0.95rem; line-height: 1.6;">${emailSubtext}</p>
                        </div>
                        <div style="background: #0d0d0d; padding: 20px; border-top: 1px solid #1a1a1a; color: #444; font-size: 0.7rem;">
                        VALID FOR 5 MINUTES • © 2024 NEXUS LEGENDS ARENA
                        </div>
                    </div>
                </div>`
            })
        });

        if (response.ok) {
            console.log(`🔑 OTP sent to ${email}: ${otpCode}`);
            res.json({ success: true });
        } else {
            res.status(500).json({ error: "Email delivery failed" });
        }
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

// 2. VERIFY OTP & SIGN IN
app.post('/api/auth/verify-otp', async (req, res) => {
    const { email, code, inviteCode } = req.body;
    try {
        const record = await OTP.findOne({ email, code });
        if (!record) return res.status(400).json({ error: "Invalid code" });

        let user = await User.findOne({ username: email });
        
        if (!user) {
            // 1. THIS IS A NEW USER
            user = new User({ 
                username: email, 
                password: "otp_user", 
                balance: 10000,
                referredBy: inviteCode || null // Store the inviter's ID
            });
            await user.save();

            // 2. CREDIT THE INVITER
            if (inviteCode && mongoose.Types.ObjectId.isValid(inviteCode)) {
                const inviter = await User.findById(inviteCode);
                if (inviter) {
                    inviter.balance += 2000;
                    inviter.referralCount = (inviter.referralCount || 0) + 1;
                    await inviter.save();
                    
                    // Log to activities for the Ticker
                    await new Activity({ text: `${inviter.username.split('@')[0]} earned 2,000 ₦ for a new recruit!` }).save();
                }
            }
        }

        await OTP.deleteOne({ email });
        res.json({ success: true, user });
    } catch (e) { res.status(500).json({ error: "System Error" }); }
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

// --- FIX: PREDICTION ROUTES (USING ARENA CONN) ---

// 1. GET ALL ACTIVE PREDICTIONS
app.get('/api/predictions', async (req, res) => {
    try {
        // We fetch everything that is not "Settled"
        const data = await arenaConn.model('Prediction').find({ status: { $ne: "Settled" } });
        res.json(data);
    } catch (err) { 
        res.status(500).json({ error: "Fetch failed" }); 
    }
});

// 2. OPEN/UPDATE A PREDICTION FROM DASHBOARD
app.post('/api/predictions/open', async (req, res) => {
    const { matchId, p1, p2, tourId, oddsP1, oddsDraw, oddsP2 } = req.body;
    try {
        // Use findOneAndUpdate so it updates the same match if you click it again
        await arenaConn.model('Prediction').findOneAndUpdate(
            { matchId: matchId },
            { 
                tourId, p1, p2, 
                oddsP1: parseFloat(oddsP1), 
                oddsDraw: parseFloat(oddsDraw), 
                oddsP2: parseFloat(oddsP2), 
                status: "Available" 
            },
            { upsert: true, new: true }
        );
        
        // Log to activity ticker
        await new (arenaConn.model('Activity'))({ text: `BET OPEN: ${p1} vs ${p2} at ${oddsP1}x odds!` }).save();
        
        res.json({ success: true });
    } catch (e) { 
        console.error("Open Pred Error:", e);
        res.status(500).json({ error: "Database Sync Error" }); 
    }
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
        await new Activity({ text: `Payout Distributed! Users won ₦ credits on match ${matchId.slice(-5)}`}).save();
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
    try {
        const bets = await Bet.find({ userId: req.params.userId, status: "Pending" });
        res.json(bets);
    } catch (e) { res.json([]); }
});

// --- UPDATED BET PLACING ROUTE WITH BREVO SLIP ---
app.post('/api/bets/place', async (req, res) => {
    const { userId, matchId, pick, slips, multiplier } = req.body;
    try {
        const pred = await Prediction.findOne({ matchId });
        if (!pred || pred.status !== "Available") return res.status(403).json({ error: "Betting Locked" });

        const user = await User.findById(userId);
        const cost = slips * 100;
        if (user.balance < cost) return res.status(400).json({ error: "Insufficient 🪙 Credits" });

        // 1. Process Transaction
        user.balance -= cost;
        await user.save();
        await new Bet({ userId, username: user.username, matchId, pick, slips, multiplier }).save();

        // 2. Prepare Data for Brevo
        const teamName = pick === 'p1' ? pred.p1 : (pick === 'p2' ? pred.p2 : "Draw");
        const expectedPayout = (cost * multiplier).toLocaleString();

        // 3. Send Professional Digital Slip via Brevo
        fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: "Nexus Bookmaker", email: "mysticfcmlegends@gmail.com" },
                to: [{ email: user.username }], // Assuming username is their email
                subject: `Bet Placed: ${pred.p1} vs ${pred.p2}`,
                htmlContent: `
                    <div style="background:#f4f7f6; padding:20px; font-family: sans-serif;">
                        <div style="max-width:400px; margin:auto; background:#fff; border-radius:10px; overflow:hidden; border:1px solid #ddd;">
                            <div style="background:#0041FF; padding:20px; text-align:center; color:white;">
                                <h2 style="margin:0;">NEXUS 1BET</h2>
                                <small>OFFICIAL BETTING SLIP</small>
                            </div>
                            <div style="padding:20px; color:#333;">
                                <p style="font-size:12px; color:#888;">MATCH ID: ${matchId.slice(-8).toUpperCase()}</p>
                                <h3 style="margin:10px 0; border-bottom:1px solid #eee; padding-bottom:10px;">
                                    ${pred.p1} <span style="color:#888; font-size:14px;">VS</span> ${pred.p2}
                                </h3>
                                <div style="display:flex; justify-content:space-between; margin:10px 0;">
                                    <span>Selection:</span> <b>${teamName}</b>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin:10px 0;">
                                    <span>Quantity:</span> <b>${slips} Slips</b>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin:10px 0;">
                                    <span>Total Stake:</span> <b>🪙 ${cost}</b>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin:10px 0; color:#0041FF;">
                                    <span>Odds:</span> <b>${multiplier}x</b>
                                </div>
                                <div style="margin-top:20px; background:#eef9f5; padding:15px; border-radius:8px; text-align:center;">
                                    <span style="display:block; font-size:12px; color:#27ae60;">EXPECTED PAYOUT</span>
                                    <b style="font-size:24px; color:#27ae60;">🪙 ${expectedPayout}</b>
                                </div>
                            </div>
                            <div style="background:#f9f9f9; padding:15px; text-align:center; font-size:10px; color:#aaa;">
                                Generated on ${new Date().toLocaleString()}<br>
                                Good luck, Striker!
                            </div>
                        </div>
                    </div>`
            })
        }).catch(e => console.log("Mail Error"));

        res.json({ success: true, newBalance: user.balance });
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});
// --- DAILY REWARD ROUTE ---
app.post('/api/auth/claim-daily', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "User ID missing from request." });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User profile not found." });

        const now = new Date();
        // If they never claimed, set lastClaim to a very old date
        const lastClaim = user.lastClaim ? new Date(user.lastClaim) : new Date(0);
        
        // Calculate hours since last claim
        const diffMs = now - lastClaim;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 24) {
            const timeLeft = (24 - diffHours).toFixed(1);
            return res.status(400).json({ error: `Reward locked. Try again in ${timeLeft} hours.` });
        }

        // Update balance and save date
        user.balance += 500;
        user.lastClaim = now;
        await user.save();
        await new Activity({ text:`${user.username.split('@')[0]} claimed 500 ₦ Daily Bonus!`}).save();

        res.json({ success: true, newBalance: user.balance });
    } catch (err) {
        console.error("Daily Claim Error:", err);
        res.status(500).json({ error: "Database error. Contact Admin." });
    }
});
// 1. Generate a unique code for a user when they click the ad link
app.get('/api/ad/generate-code/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // Generate a random 6-character uppercase string
        const uniqueCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await User.findByIdAndUpdate(userId, { pendingAdCode: uniqueCode });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Server Error" }); }
});

// 2. Fetch the user's specific code (Used by vault.html)
app.get('/api/ad/get-my-code/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        res.json({ code: user.pendingAdCode });
    } catch (e) { res.json({ code: "EXPIRED" }); }
});

// 3. Verify and Clear (Claim Reward)
app.post('/api/auth/verify-ad-code', async (req, res) => {
    const { userId, userCode } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user.pendingAdCode || userCode !== user.pendingAdCode) {
            return res.status(400).json({ error: "Invalid or Expired Code!" });
        }

        user.balance += 100; 
        user.pendingAdCode = null; // RESET the code so it can't be used again
        await user.save();

        res.json({ success: true, newBalance: user.balance });
    } catch (err) { res.status(500).json({ error: "System Error" }); }
});
// --- NEW GLOBAL SETTINGS ---
let adSettings = {
    reward: 100,
    link: "https://shrinkme.click/kk11PbZ8"
};

// Route to get settings
app.get('/api/admin/ad-settings', (req, res) => res.json(adSettings));

// Route to update settings
app.post('/api/admin/ad-settings', (req, res) => {
    adSettings.reward = parseInt(req.body.reward) || 100;
    adSettings.link = req.body.link || adSettings.link;
    res.json({ success: true, settings: adSettings });
});

// --- UPDATE THE VERIFY ROUTE TO USE THE VARIABLE REWARD ---
app.post('/api/auth/verify-ad-code', async (req, res) => {
    const { userId, userCode } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user.pendingAdCode || userCode !== user.pendingAdCode) {
            return res.status(400).json({ error: "Invalid or Expired Code!" });
        }

        // Use the global variable instead of hardcoded 100
        user.balance += adSettings.reward; 
        user.pendingAdCode = null; 
        await user.save();

        res.json({ success: true, newBalance: user.balance, rewardGiven: adSettings.reward });
    } catch (err) { res.status(500).json({ error: "System Error" }); }
});
app.get('/api/activities', async (req, res) => {
    try {
        const logs = await Activity.find().sort({ date: -1 }).limit(10);
        // If DB is empty, send a default message instead of an error
        if (logs.length === 0) {
            return res.json([{ text: "Welcome to Nexus Legends Arena! Good luck Strikers!" }]);
        }
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});
// --- GET INDIVIDUAL USER REFERRAL STATS ---
app.get('/api/user/referral-stats/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        // Find all users who were invited by this user
        const invitedUsers = await User.find({ referredBy: req.params.userId }, 'username date');
        res.json({
            balance: user.balance,
            referralCount: user.referralCount || 0,
            history: invitedUsers
        });
    } catch (err) { res.status(500).json({ error: "Failed to load stats" }); }
});
// --- NEW ROUTE: MANUALLY MANAGE GS & GA ---
app.post('/api/update-gs-ga', async (req, res) => {
    const { name, goalsFor, goalsAgainst } = req.body;
    try {
        // Convert to numbers to ensure database integrity
        const updateData = {};
        if (goalsFor !== "") updateData.goalsFor = parseInt(goalsFor);
        if (goalsAgainst !== "") updateData.goalsAgainst = parseInt(goalsAgainst);

        await Player.updateOne({ name }, { $set: updateData });
        res.json({ success: true });
    } catch (err) { 
        res.status(500).json({ error: "Failed to update stats" }); 
    }
});
// --- NEW ROUTE: DUAL GS & GA MANAGEMENT ---
app.post('/api/update-gs-ga-duel', async (req, res) => {
    const { p1Name, p2Name, p1gs, p1ga } = req.body;
    
    try {
        const gs = parseInt(p1gs) || 0;
        const ga = parseInt(p1ga) || 0;

        if (p1Name === p2Name) return res.status(400).json({ error: "Cannot duel the same player!" });

        // Update Player 1: Gets GS and GA as entered
        await Player.updateOne({ name: p1Name }, { $inc: { goalsFor: gs, goalsAgainst: ga } });

        // Update Player 2: Gets Player 1's GA as GS, and Player 1's GS as GA
        await Player.updateOne({ name: p2Name }, { $inc: { goalsFor: ga, goalsAgainst: gs } });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Database sync failed" });
    }
});
app.get('/api/nfa/clubs', async (req, res) => {
    try {
        const clubs = await Club.find().sort({ crp: -1 });
        res.json(clubs);
    } catch (e) { res.status(500).send(e); }
});

// 3. Admin: Initialize the 8 Franchise Clubs
app.post('/api/admin/nfa/init-franchise', async (req, res) => {
    const { auth } = req.body;
    if(auth !== "nexus2024") return res.status(403).send("Unauthorized");
    
    const clubNames = ["Titan FC", "Shadow Kings", "Nexus United", "Apex Strikers", "Vortex FC", "Iron Guardians", "Neon Pulse", "Elite XI"];
    try {
        await Club.deleteMany({}); // Clear old data in NFA DB
        const created = await Club.insertMany(clubNames.map(name => ({
            name,
            owner: "Pending",
            budget: 800000000,
            stadium: `${name} Arena`
        })));
        res.json({ success: true, clubs: created });
    } catch (e) { res.status(500).send(e); }
});

// 4. Spending Logic (Financial Fair Play)
app.post('/api/nfa/transaction', async (req, res) => {
    const { clubId, amount, type, description } = req.body;
    try {
        const club = await Club.findById(clubId);
        if(type === "Debit" && club.budget < amount) {
            return res.status(400).json({ error: "FFP Violation: Insufficient Credits" });
        }
        
        club.budget = (type === "Credit") ? club.budget + amount : club.budget - amount;
        await club.save();
        
        const log = new NFALog({ clubId, type, amount, description });
        await log.save();
        
        res.json({ success: true, newBalance: club.budget });
    } catch (e) { res.status(500).send(e); }
});

app.get('/api/nfa/bulletins', async (req, res) => {
    try {
        const data = await Bulletin.find().sort({ date: -1 }).limit(5);
        res.json(data);
    } catch (e) { res.status(500).json([]); }
});

app.get('/api/nfa/market', async (req, res) => {
    try {
        const [status, listings, logs] = await Promise.all([
            MarketStatus.findOne(),
            MarketListing.find().sort({ date: -1 }),
            nfaConn.model('NFALog').find({ type: "Transfer" }).sort({ date: -1 }).limit(10)
        ]);
        res.json({ status, listings, logs });
    } catch (e) { res.status(500).json({ error: "Market Offline" }); }
});
// --- GET SINGLE CLUB WITH SQUAD DATA ---
app.get('/api/nfa/club/:id', async (req, res) => {
    try {
        const club = await Club.findById(req.params.id);
        if (!club) return res.status(404).json({ error: "Club not found" });

        // CROSS-DB Handshake: 
        // We take the IDs from the NFA Club squad and find their details in the Arena DB
        const squadDetails = await Player.find({ 
            _id: { $in: club.squad } 
        }, 'name avatar goalsFor points');

        res.json({ club, squad: squadDetails });
    } catch (e) { res.status(500).json({ error: "Database Link Error" }); }
});
app.get('/api/nfa/draft/prospects', async (req, res) => {
    try {
        // Get all signed player IDs from all clubs
        const clubs = await nfaConn.model('Club').find({}, 'squad');
        const signedIds = clubs.flatMap(c => c.squad);

        // Fetch players from Arena DB who are NOT in the signed list
        const prospects = await arenaConn.model('Player').find({
            _id: { $nin: signedIds }
        }, 'name avatar points playstyle');

        res.json(prospects);
    } catch (e) { res.status(500).json({ error: "Draft Database Error" }); }
});
app.get('/api/nfa/draft/history', async (req, res) => {
    try {
        const history = await DraftPick.find().sort({ date: -1 });
        res.json(history);
    } catch (e) { res.status(500).json([]); }
});
// --- ADMIN NFA ROUTES ---

// 1. Update Club Identity
app.post('/api/admin/nfa/update-club', async (req, res) => {
    try {
        await Club.findByIdAndUpdate(req.body.id, req.body.data);
        res.json({ success: true });
    } catch (e) { res.status(500).send(e); }
});

// 2. Post Bulletin
app.post('/api/admin/nfa/bulletin', async (req, res) => {
    try {
        await new Bulletin(req.body).save();
        res.json({ success: true });
    } catch (e) { res.status(500).send(e); }
});

// 3. Squad Assignment (The Cross-DB Bridge)
app.post('/api/admin/nfa/assign-squad', async (req, res) => {
    const { playerId, clubId } = req.body;
    try {
        const club = await Club.findById(clubId);
        // Ensure player isn't already in squad
        if (!club.squad.includes(playerId)) {
            club.squad.push(playerId);
            await club.save();
        }
        res.json({ success: true });
    } catch (e) { res.status(500).send(e); }
});

// 4. Set Market Status
app.post('/api/admin/nfa/market-toggle', async (req, res) => {
    const { isOpen, closingDate } = req.body;
    try {
        await MarketStatus.findOneAndUpdate({}, { isOpen, closingDate }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).send(e); }
});
app.post('/api/nfa/market/activate-buyout', async (req, res) => {
    const { buyerClubId, sellerClubId, playerId, price } = req.body;
    try {
        const buyer = await Club.findById(buyerClubId);
        const seller = await Club.findById(sellerClubId);

        if (buyer.budget < price) return res.status(400).json({ error: "FFP Violation: Insufficient Funds" });

        // 1. Financial Exchange
        buyer.budget -= price;
        seller.budget += price;

        // 2. Transfer the Player
        const playerIndex = seller.squad.findIndex(p => p.playerId.toString() === playerId);
        const playerData = seller.squad[playerIndex];
        
        seller.squad.splice(playerIndex, 1); // Remove from seller
        buyer.squad.push(playerData); // Add to buyer

        await buyer.save();
        await seller.save();

        // 3. Log to NFA History
        await new NFALog({ 
            clubId: buyerClubId, 
            type: "Transfer", 
            amount: price, 
            description: `RELEASE CLAUSE ACTIVATED: Signed ${playerData.playerName} from ${seller.name}` 
        }).save();

        res.json({ success: true, newBalance: buyer.budget });
    } catch (e) { res.status(500).send(e); }
});
// 4. START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Nexus Server Running on Port ${PORT}`));
