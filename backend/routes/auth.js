const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { admin, isInitialized: isFirebaseReady } = require('../firebaseAdmin');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'ledgertrace-secret-key-change-in-production';

// Strip everything except digits, then keep the last 10. Matches "+91 98xxx xxx12" → "98xxxxxxx12".
const normalizeContact = (s) => String(s || '').replace(/\D/g, '').slice(-10);

const issueToken = (user) => jwt.sign(
  { id: user._id, name: user.name, role: user.role, dept: user.dept || '' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// POST /api/auth/login — username + password (fallback path)
router.post('/login', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: 'Name and password are required' });
    }

    const user = await User.findOne({ name }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({ token: issueToken(user), user: user.toJSON() });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/auth/firebase-login — exchange a Firebase ID token (from phone OTP verification)
// for our app JWT. Firebase handles SMS delivery and OTP verification; we just trust the
// resulting ID token, extract the phone number, and look the user up in MongoDB.
router.post('/firebase-login', async (req, res) => {
  try {
    if (!isFirebaseReady()) {
      return res.status(503).json({ message: 'OTP login is not configured on this server. Please use username and password.' });
    }

    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'Firebase ID token is required' });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      console.error('Firebase token verification failed:', e.message);
      return res.status(401).json({ message: 'Invalid or expired authentication token' });
    }

    const phone = decoded.phone_number || '';
    const norm = normalizeContact(phone);
    if (!norm || norm.length !== 10) {
      return res.status(400).json({ message: 'Firebase token does not contain a valid phone number' });
    }

    const candidates = await User.find({ contact: { $ne: null } });
    const user = candidates.find(u => normalizeContact(u.contact) === norm);
    if (!user) {
      return res.status(404).json({ message: 'No user is registered with this mobile number' });
    }

    res.json({ token: issueToken(user), user: user.toJSON() });
  } catch (err) {
    console.error('Firebase login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
