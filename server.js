require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db/pool');
const jwt     = require('jsonwebtoken');
const app     = express();

app.use(cors({ origin:'*', methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders:['Content-Type','Authorization'], credentials:false }));
app.options('*', cors());
app.use(express.json());

// ── Auth middleware for timer endpoints ────────────────────────────────────────
const verifyUserToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required.' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

// ── Live Timer Routes ────────────────────────────────────────────────────────
// 1. Freelancer syncs their live timer state
app.post('/api/timer/sync', verifyUserToken, async (req, res, next) => {
  try {
    const freelancerId = req.user.id;
    const { client_id, task, start_time, accumulated_ms, state } = req.body;

    await pool.query(`
      INSERT INTO active_timers (freelancer_id, client_id, task, start_time, accumulated_ms, state, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (freelancer_id) 
      DO UPDATE SET client_id = $2, task = $3, start_time = $4, accumulated_ms = $5, state = $6, updated_at = CURRENT_TIMESTAMP
    `, [freelancerId, client_id || null, task || '', start_time || null, accumulated_ms || 0, state || 'idle']);

    res.json({ success: true });
  } catch (e) { next(e); }
});

// 2. Client checks if their freelancer is currently running a timer for them
app.get('/api/client/active-timer', verifyUserToken, async (req, res, next) => {
  try {
    const clientId = req.user.id;

    const { rows } = await pool.query(`
      SELECT t.task, t.start_time, t.accumulated_ms, t.state, u.name AS freelancer_name
      FROM active_timers t
      JOIN users u ON u.id = t.freelancer_id
      WHERE t.client_id = $1 AND t.state = 'running'
    `, [clientId]);

    if (!rows.length) {
      return res.json({ success: true, active: false });
    }

    res.json({ success: true, active: true, timer: rows[0] });
  } catch (e) { next(e); }
});

// ── Standard Routes ──────────────────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/clients',        require('./routes/clients'));
app.use('/api/timelogs',       require('./routes/timelogs'));
app.use('/api/schedule',       require('./routes/schedule'));
app.use('/api/portfolio',      require('./routes/portfolio'));
app.use('/api/stats',          require('./routes/stats'));
app.use('/api/contact',        require('./routes/contact'));
app.use('/api/client',         require('./routes/client-portal'));
app.use('/api/payments',       require('./routes/payments'));
app.use('/api/fixed-payments', require('./routes/fixed-payments')); 
app.use('/api/contracts',      require('./routes/contracts')); 
app.use('/api/chatbot',        require('./routes/chatbot'));

app.get('/api/health', (req, res) => res.json({ status:'ok', timestamp:new Date() }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status||500).json({ error:err.message||'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✓ API running on port ${PORT}`));
