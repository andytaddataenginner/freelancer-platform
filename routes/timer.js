const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer, requireAuth } = require('../middleware/auth');
const verifyToken = requireAuth;

const sseClients = new Map();

function pushToClient(clientId, payload) {
  const set = sseClients.get(String(clientId));
  if (!set) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  set.forEach(res => { try { res.write(data); } catch (_) {} });
}

// Helper to resolve any client identifier (users.id or clients.id) to the real users.id
async function resolveClientUserId(client_id) {
  const clientCheck = await pool.query(
    `SELECT id FROM users WHERE id = $1 OR id = (SELECT user_id FROM clients WHERE id = $1) LIMIT 1`,
    [client_id]
  );
  if (!clientCheck.rows.length) return null;
  return clientCheck.rows[0].id;
}

// ── POST /api/timer/start ────────────────────────────────────────────────────
router.post('/start', requireFreelancer, async (req, res, next) => {
  try {
    let { client_id, description } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    const actualUserId = await resolveClientUserId(client_id);
    if (!actualUserId) return res.status(404).json({ error: 'Client user not found' });

    const { rows } = await pool.query(`
      INSERT INTO active_timers (freelancer_id, client_id, started_at, description, is_running)
      VALUES ($1, $2, NOW(), $3, TRUE)
      ON CONFLICT (freelancer_id, client_id)
      DO UPDATE SET started_at = NOW(), description = $3, is_running = TRUE
      RETURNING *
    `, [req.user.id, actualUserId, description || null]);

    const timer = rows[0];
    pushToClient(actualUserId, {
      event:       'started',
      started_at:  timer.started_at,
      description: timer.description,
      elapsed_sec: 0
    });

    res.json({ message: 'Timer started', timer });
  } catch (e) { next(e); }
});

// ── POST /api/timer/stop ─────────────────────────────────────────────────────
router.post('/stop', requireFreelancer, async (req, res, next) => {
  try {
    let { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    const actualUserId = await resolveClientUserId(client_id);
    if (!actualUserId) return res.status(404).json({ error: 'Client user not found' });

    const { rows } = await pool.query(`
      UPDATE active_timers
      SET is_running = FALSE
      WHERE freelancer_id = $1 AND client_id = $2 AND is_running = TRUE
      RETURNING *, EXTRACT(EPOCH FROM (NOW() - started_at))::int AS elapsed_sec
    `, [req.user.id, actualUserId]);

    if (!rows.length) return res.status(404).json({ error: 'No running timer found for this client' });

    const timer = rows[0];
    pushToClient(actualUserId, {
      event:       'stopped',
      elapsed_sec: timer.elapsed_sec,
      description: timer.description
    });

    res.json({
      message:     'Timer stopped',
      elapsed_sec: timer.elapsed_sec,
      hours:       (timer.elapsed_sec / 3600).toFixed(4),
      started_at:  timer.started_at
    });
  } catch (e) { next(e); }
});

// ── GET /api/timer/status — freelancer sees all their running timers ──────────
router.get('/status', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS client_name, u.company,
             EXTRACT(EPOCH FROM (NOW() - t.started_at))::int AS elapsed_sec
      FROM active_timers t
      JOIN users u ON u.id = t.client_id
      WHERE t.freelancer_id = $1 AND t.is_running = TRUE
      ORDER BY t.started_at
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET /api/timer/client-status — client polls their own timer (JSON) ────────
router.get('/client-status', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });

    const { rows } = await pool.query(`
      SELECT t.started_at, t.description, t.is_running,
             EXTRACT(EPOCH FROM (NOW() - t.started_at))::int AS elapsed_sec
      FROM active_timers t
      WHERE t.client_id = $1 AND t.is_running = TRUE
      ORDER BY t.started_at DESC LIMIT 1
    `, [req.user.id]);

    if (!rows.length) return res.json({ running: false });
    res.json({ running: true, ...rows[0] });
  } catch (e) { next(e); }
});

// ── GET /api/timer/watch — SSE: client subscribes to live timer ticks ─────────
router.get('/watch', async (req, res, next) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).send('Token required');

    const jwt = require('jsonwebtoken');
    let user;
    try { user = jwt.verify(token, process.env.JWT_SECRET); }
    catch (_) { return res.status(403).send('Invalid token'); }

    if (user.role !== 'client') return res.status(403).send('Clients only');

    const clientId = String(user.id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!sseClients.has(clientId)) sseClients.set(clientId, new Set());
    sseClients.get(clientId).add(res);

    const { rows } = await pool.query(`
      SELECT started_at, description, is_running,
             EXTRACT(EPOCH FROM (NOW() - started_at))::int AS elapsed_sec
      FROM active_timers
      WHERE client_id = $1 AND is_running = TRUE
      ORDER BY started_at DESC LIMIT 1
    `, [user.id]);

    if (rows.length) {
      res.write(`data: ${JSON.stringify({ event: 'sync', ...rows[0] })}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify({ event: 'idle' })}\n\n`);
    }

    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch (_) { clearInterval(heartbeat); }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      const set = sseClients.get(clientId);
      if (set) { set.delete(res); if (!set.size) sseClients.delete(clientId); }
    });

  } catch (e) { next(e); }
});

module.exports = router;
