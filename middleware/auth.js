const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
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
