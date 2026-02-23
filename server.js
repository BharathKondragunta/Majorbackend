const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');


// Models
const User = require('./models/User');
const Case = require('./models/Case');
const Evidence = require('./models/Evidence');
const Log = require('./models/Log');
const LoginLog = require('./models/LoginLog');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';
if (process.env.JWT_SECRET) {
    console.log('✅ JWT_SECRET loaded from environment');
} else {
    console.warn('⚠️  JWT_SECRET not found in environment, using fallback. TOKENS MAY BE INVALID ACROSS RESTARTS.');
}

// Middleware
app.use(helmet());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
    origin: "*",
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200,
}));

// Static folder for file access
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
const mongoURI = process.env.mongo_db_url;
mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));

// --- Multer Configuration ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.warn('❌ Access Denied: No Token Provided');
        return res.status(401).json({ message: 'Access Denied: No Token Provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ Token Verification Failed:', err.message);
            // console.debug('Token received:', token.substring(0, 10) + '...');
            return res.status(403).json({ message: 'Invalid Token', error: err.message });
        }
        req.user = user;
        next();
    });
}

// --- API Routes ---
app.get("/", async (req, res) => {
    return res.status(200).json({ message: "Hello World" })
})
// 1. Auth: Register
app.post('/api/auth/register', [
    body('username').notEmpty().trim(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { username, email, password, clearance } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, email, password: hashedPassword, clearance });
        await user.save();
        res.status(201).json({ success: true, message: 'User registered' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Auth: Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        // Log the login
        await new LoginLog({
            userId: user._id,
            email: user.email,
            ip: req.ip || req.connection.remoteAddress,
            device: req.headers['user-agent'] || 'Unknown',
            status: 'Success'
        }).save();

        res.status(200).json({ success: true, token, user: { id: user._id, username: user.username, email: user.email, role: user.role, clearance: user.clearance } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2.1 Auth: Get Login Logs
app.get('/api/auth/login-logs', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const logs = await LoginLog.find().sort({ timestamp: -1 }).limit(limit);
        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Case: Create
app.post('/api/cases', authenticateToken, async (req, res) => {
    try {
        const newCase = new Case({ ...req.body, investigator: req.user.id });
        await newCase.save();

        // Log the action
        await new Log({
            action: 'Case Created',
            target: newCase.title,
            caseId: newCase.caseId,
            type: 'Case',
            status: 'Created',
            performedBy: req.user.id
        }).save();

        res.status(201).json({ success: true, data: newCase });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4. Case: List All
app.get('/api/cases', authenticateToken, async (req, res) => {
    try {
        const cases = await Case.find().populate('investigator', 'username');
        res.status(200).json({ success: true, data: cases });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 4.1 Case: Update Status (Archive/Unarchive)
app.put('/api/cases/:id/status', authenticateToken, async (req, res) => {
    try {
        const { status } = req.body; // 'Active' or 'Archived'
        const caseId = req.params.id;

        const updatedCase = await Case.findOneAndUpdate({ caseId }, { status }, { new: true });
        if (!updatedCase) return res.status(404).json({ success: false, message: 'Case not found' });

        // Log the action
        await new Log({
            action: status === 'Archived' ? 'Case Archived' : 'Case Unarchived',
            target: updatedCase.title,
            caseId: updatedCase.caseId,
            type: 'Case',
            status: status === 'Archived' ? 'Archived' : 'Updated', // Adjust enum if needed or map to allowed
            performedBy: req.user.id
        }).save(); // Note: 'Archived' status might need to be added to Log schema enum if strict

        res.status(200).json({ success: true, data: updatedCase });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 5. Evidence: Upload & Log
app.post('/api/evidence', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        const { caseId, title, type, location, hashSHA256, hashMD5, metadata } = req.body;

        const evidence = new Evidence({
            evidenceId: `EV-${Date.now().toString().slice(-4)}`,
            caseId,
            title,
            type,
            location,
            hashSHA256,
            hashMD5,
            fileName: req.file ? req.file.filename : null,
            filePath: req.file ? `/uploads/${req.file.filename}` : null,
            size: req.file ? `${(req.file.size / 1024).toFixed(2)} KB` : '0 KB',
            uploadedBy: req.user.id,
            metadata: metadata ? JSON.parse(metadata) : {}
        });

        await evidence.save();

        // Log the action
        await new Log({
            action: 'Evidence Secured',
            target: title,
            caseId: caseId,
            type: 'Evidence',
            status: 'Secured',
            performedBy: req.user.id
        }).save();

        res.status(201).json({ success: true, data: evidence });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6. Evidence: List for Case
app.get('/api/evidence/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const evidence = await Evidence.find({ caseId: req.params.caseId });
        res.status(200).json({ success: true, data: evidence });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 6.1 Evidence: List All (Vault)
app.get('/api/evidence', authenticateToken, async (req, res) => {
    try {
        const evidence = await Evidence.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: evidence });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 7. Audit: List Logs for Case
app.get('/api/logs/case/:caseId', authenticateToken, async (req, res) => {
    try {
        const logs = await Log.find({ caseId: req.params.caseId }).populate('performedBy', 'username').sort({ timestamp: -1 });
        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 8. Audit: List All Logs
app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const logs = await Log.find().populate('performedBy', 'username').sort({ timestamp: -1 });
        res.status(200).json({ success: true, data: logs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 ChainGuard Backend running on port ${PORT}`);
});
