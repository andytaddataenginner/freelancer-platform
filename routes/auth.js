const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// Temporary in-memory store for pending signups (expires after 15 mins)
const pendingSignups = new Map();

// Helper to generate a 6-digit OTP code
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Nodemailer Transporter Configuration
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail', // e.g. 'gmail', 'SendGrid', etc.
  auth: {
    user: process.env.EMAIL_USER, // Your sender email
    pass: process.env.EMAIL_PASS  // Your email app password
  }
});

// Helper function to send email
async function sendOTPEmail(toEmail, code) {
  // If email credentials aren't set in environment variables, print to console for development
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log(`\n========================================`);
    console.log(`[DEV OTP EMAIL] Sent to: ${toEmail}`);
    console.log(`[DEV OTP CODE]  Your Code is: ${code}`);
    console.log(`========================================\n`);
    return;
  }

  await transporter.sendMail({
    from: `"Quick Freelancing Agency" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Your QFA Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #0d2353;">Verify Your Email</h2>
        <p>Thank you for registering with Quick Freelancing Agency. Use the following 6-digit code to complete your signup:</p>
        <div style="background: #f4f6fb; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1a5cff; border-radius: 8px; margin: 20px 0;">
          ${code}
        </div>
        <p style="font-size: 12px; color: #7a8aaa;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
      </div>
    `
  });
}

// =========================================================================
// SIGNUP ROUTES (Email Verification Only)
// =========================================================================

// POST /api/auth/signup/initiate
router.post('/signup/initiate', async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already exists
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (rows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    // Hash password & generate code
    const password_hash = await bcrypt.hash(password, 10);
    const emailCode = generateOTP();
    const signupId = 'signup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // Save pending session
    pendingSignups.set(signupId, {
      name,
      email: cleanEmail,
      phone: phone || null,
      password_hash,
      role: role || 'freelancer',
      emailCode,
      createdAt: Date.now()
    });

    // Send the OTP Email
    await sendOTPEmail(cleanEmail, emailCode);

    res.json({ signupId, message: 'Verification code sent to email' });
  } catch (e) { next(e); }
});

// POST /api/auth/signup/resend-otp
router.post('/signup/resend-otp', async (req, res, next) => {
  try {
    const { signupId } = req.body;
    const signupData = pendingSignups.get(signupId);

    if (!signupData) {
      return res.status(400).json({ error: 'Signup session expired. Please start again.' });
    }

    const newCode = generateOTP();
    signupData.emailCode = newCode;

    await sendOTPEmail(signupData.email, newCode);

    res.json({ message: 'New verification code sent to email' });
  } catch (e) { next(e); }
});

// POST /api/auth/signup/verify
router.post('/signup/verify', async (req, res, next) => {
  try {
    const { signupId, emailCode } = req.body;
    const signupData = pendingSignups.get(signupId);

    if (!signupData) {
      return res.status(400).json({ error: 'Signup session expired. Please start again.' });
    }

    // Verify OTP code
    if (signupData.emailCode !== emailCode.trim()) {
      return res.status(400).json({ error: 'Invalid or expired email verification code.' });
    }

    // Insert new user into DB
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, email, role, company`,
      [signupData.name, signupData.email, signupData.phone, signupData.password_hash, signupData.role]
    );

    const newUser = rows[0];

    // Clean up memory
    pendingSignups.delete(signupId);

    // Generate JWT Token
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: newUser });
  } catch (e) { next(e); }
});

// =========================================================================
// EXISTING AUTH ROUTES
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
