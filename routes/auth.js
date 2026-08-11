const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Temporary in-memory store for pending signups (or use a DB table/Redis if preferred)
const pendingSignups = new Map();

// Helper to generate a 6-digit OTP code
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// =========================================================================
// SIGNUP ROUTES (Fixes the 404 Error)
// =========================================================================

// POST /api/auth/signup/initiate
router.post('/signup/initiate', async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists in DB
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    // Hash password & generate verification codes
    const password_hash = await bcrypt.hash(password, 10);
    const emailCode = generateOTP();
    const phoneCode = generateOTP();
    const signupId = 'signup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // Save pending signup data in memory with expiration (15 mins)
    pendingSignups.set(signupId, {
      name,
      email: cleanEmail,
      phone,
      password_hash,
      role: role || 'freelancer',
      emailCode,
      phoneCode,
      createdAt: Date.now()
    });

    // TODO: Send emailCode via your Email Service & phoneCode via Twilio/SMS Service
    console.log(`[DEMO CODES] Email Code: ${emailCode} | Phone Code: ${phoneCode}`);

    res.json({ signupId, message: 'Verification codes sent' });
  } catch (e) { next(e); }
});

// POST /api/auth/signup/resend-otp
router.post('/signup/resend-otp', async (req, res, next) => {
  try {
    const { signupId, channel } = req.body;
    const signupData = pendingSignups.get(signupId);

    if (!signupData) {
      return res.status(400).json({ error: 'Signup session expired. Please start again.' });
    }

    const newCode = generateOTP();
    if (channel === 'email') signupData.emailCode = newCode;
    if (channel === 'phone') signupData.phoneCode = newCode;

    // TODO: Re-send SMS or Email here
    console.log(`[RESEND OTP] Channel: ${channel} | New Code: ${newCode}`);

    res.json({ message: `New ${channel} code sent` });
  } catch (e) { next(e); }
});

// POST /api/auth/signup/verify
router.post('/signup/verify', async (req, res, next) => {
  try {
    const { signupId, emailCode, phoneCode } = req.body;
    const signupData = pendingSignups.get(signupId);

    if (!signupData) {
      return res.status(400).json({ error: 'Signup session expired. Please start again.' });
    }

    // Verify OTP codes
    if (signupData.emailCode !== emailCode.trim() || signupData.phoneCode !== phoneCode.trim()) {
      return res.status(400).json({ error: 'Invalid email or phone verification code.' });
    }

    // Insert new user into the database
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, email, role, company`,
      [signupData.name, signupData.email, signupData.phone, signupData.password_hash, signupData.role]
    );

    const newUser = rows[0];

    // Remove from pending store
    pendingSignups.delete(signupId);

    // Generate Auth Token
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: newUser });
  } catch (e) { next(e); }
});

// =========================================================================
// EXISTING ROUTES
// =========================================================================

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows } = await pool.query(
      'SELECT id, name, email, password_hash, role, company FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, company: user.company }
    });
  } catch (e) { next(e); }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, company FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0] || {});
  } catch (e) { next(e); }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const { current, newPassword } = req.body;
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(current, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is wrong' });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, req.user.id]);
    res.json({ message: 'Password changed' });
  } catch (e) { next(e); }
});

module.exports = router;
