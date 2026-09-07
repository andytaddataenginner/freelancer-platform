const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }

  try {
    // Reject tokens from a session that's been superseded by a newer login
    const { rows } = await pool.query('SELECT session_id FROM users WHERE id = $1', [decoded.id]);
    if (!rows[0] || rows[0].session_id !== decoded.sid) {
      return res.status(401).json({ error: 'SESSION_REVOKED' });
    }
    req.user = decoded;
    next();
  } catch (e) {
    next(e); // real DB error — let your error handler deal with it, don't disguise it as an auth failure
  }
}

function requireFreelancer(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'freelancer') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
}
function requireClient(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
}

module.exports = { requireAuth, requireFreelancer, requireClient, requireAdmin };
