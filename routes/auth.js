const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const { requireAuth } = require('../middleware/auth');

// =========================================================================
// SIGNUP ROUTE (Direct Registration & Instant Token Generation)
// =========================================================================

/**
 * Handles account creation directly in PostgreSQL and issues a JWT session token.
 */
async function handleSignup(req, res, next) {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Check if user already exists
    const { rows: existingRows } = await pool.query(
      'SELECT id FROM users WHERE email = $1', 
      [cleanEmail]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    // 2. Hash password & insert into PostgreSQL
    const password_hash = await bcrypt.hash(password, 10);
    const userRole = role || 'freelancer';

    const { rows: newRows } = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, email, role, company`,
      [name, cleanEmail, phone || null, password_hash, userRole]
    );

    const newUser = newRows[0];

    // 3. Issue 30-day JWT Token
    const token = jwt.sign(
      { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 4. Return token & user payload directly to frontend
    return res.status(201).json({ token, user: newUser });

  } catch (e) {
    next(e);
  }
}

// Route handlers for direct signup and frontend route aliases
router.post('/signup', handleSignup);
router.post('/signup/initiate', handleSignup);


// =========================================================================
// EXISTING AUTH ROUTES
// =========================================================================

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

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
  } catch (e) { 
    next(e); 
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, company FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(rows[0] || {});
  } catch (e) { 
    next(e); 
  }
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
  } catch (e) { 
    next(e); 
  }
});

module.exports = router;
