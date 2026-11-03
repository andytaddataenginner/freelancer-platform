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

// Helper to resolve client user ID
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
      INSERT INTO active_timers (freelancer_id, client_id, started_at, description, is_running, is_paused, accumulated_seconds)
      VALUES ($1, $2, NOW(), $3, TRUE, FALSE, 0)
      ON CONFLICT (freelancer_id, client_id)
      DO UPDATE SET started_at = NOW(), description = $3, is_running = TRUE, is_paused = FALSE, accumulated_seconds = 0
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

// ── POST /api/timer/pause ────────────────────────────────────────────────────
router.post('/pause', requireFreelancer, async (req, res, next) => {
  try {
    let { client_id } = req.body;
    const actualUserId = await resolveClientUserId(client_id);
    if (!actualUserId) return res.status(404).json({ error: 'Client user not found' });

    const { rows } = await pool.query(`
      UPDATE active_timers
      SET is_paused = TRUE,
          accumulated_seconds = accumulated_seconds + EXTRACT(EPOCH FROM (NOW() - started_at))::int
      WHERE freelancer_id = $1 AND client_id = $2 AND is_running = TRUE AND is_paused = FALSE
      RETURNING *, accumulated_seconds AS elapsed_sec
    `, [req.user.id, actualUserId]);

    if (!rows.length) return res.status(404).json({ error: 'No active running timer found to pause' });

    const timer = rows[0];
    pushToClient(actualUserId, { event: 'paused', elapsed_sec: timer.elapsed_sec });
    res.json({ message: 'Timer paused', elapsed_sec: timer.elapsed_sec });
  } catch (e) { next(e); }
});

// ── POST /api/timer/resume ───────────────────────────────────────────────────
router.post('/resume', requireFreelancer, async (req, res, next) => {
  try {
    let { client_id } = req.body;
    const actualUserId = await resolveClientUserId(client_id);
    if (!actualUserId) return res.status(404).json({ error: 'Client user not found' });

    const { rows } = await pool.query(`
      UPDATE active_timers
      SET is_paused = FALSE, started_at = NOW()
      WHERE freelancer_id = $1 AND client_id = $2 AND is_running = TRUE AND is_paused = TRUE
      RETURNING *
    `, [req.user.id, actualUserId]);

    if (!rows.length) return res.status(404).json({ error: 'No paused timer found to resume' });

    const timer = rows[0];
    pushToClient(actualUserId, { event: 'resumed', started_at: timer.started_at });
    res.json({ message: 'Timer resumed', timer });
  } catch (e) { next(e); }
});

// ── POST /api/timer/stop (Stop & Save) ───────────────────────────────────────
router.post('/stop', requireFreelancer, async (req, res, next) => {
  try {
    let { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    const clientCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 OR id = (SELECT user_id FROM clients WHERE id = $1) LIMIT 1`,
      [client_id]
    );
    if (!clientCheck.rows.length) return res.status(404).json({ error: 'Client user not found' });
    const actualUserId = clientCheck.rows[0].id;

    // Fetch current timer state
    const check = await pool.query(`
      SELECT *, 
             CASE WHEN is_paused THEN accumulated_seconds 
                  ELSE accumulated_seconds + EXTRACT(EPOCH FROM (NOW() - started_at))::int 
             END AS total_secs
      FROM active_timers
      WHERE freelancer_id = $1 AND client_id = $2 AND is_running = TRUE
    `, [req.user.id, actualUserId]);

    if (!check.rows.length) return res.status(404).json({ error: 'No running timer found for this client' });
    const timer = check.rows[0];
    const elapsedSec = parseInt(timer.total_secs || 0);
    const hours = Math.round((elapsedSec / 3600) * 100) / 100;

    // Insert into time_logs so it shows up in billing and history
    if (hours > 0) {
      await pool.query(`
        INSERT INTO time_logs (client_id, date, hours, task_description, source, payment_status)
        VALUES ($1, CURRENT_DATE, $2, $3, 'timer', 'unpaid')
      `, [actualUserId, hours, timer.description || 'Timed session']);
    }

    // Clean up active timer
    await pool.query(`DELETE FROM active_timers WHERE id = $1`, [timer.id]);

    pushToClient(actualUserId, { event: 'stopped', elapsed_sec: elapsedSec });

    res.json({ message: 'Timer stopped and saved', elapsed_sec: elapsedSec, hours, started_at: timer.started_at });
  } catch (e) { next(e); }
});

// ── GET /api/timer/status — freelancer active timers ──────────────────────────
router.get('/status', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS client_name, u.company,
             CASE WHEN t.is_paused THEN t.accumulated_seconds 
                  ELSE t.accumulated_seconds + EXTRACT(EPOCH FROM (NOW() - t.started_at))::int 
             END AS elapsed_sec
      FROM active_timers t
      JOIN users u ON u.id = t.client_id
      WHERE t.freelancer_id = $1 AND t.is_running = TRUE
      ORDER BY t.started_at
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET /api/timer/client-status — client status poll ─────────────────────────
router.get('/client-status', verifyToken, async (req, res, next) => {
  try {
    if (req.user.role !== 'client') return res.status(403).json({ error: 'Clients only' });

    const { rows } = await pool.query(`
      SELECT t.started_at, t.description, t.is_running, t.is_paused, t.accumulated_seconds,
             CASE WHEN t.is_paused THEN t.accumulated_seconds 
                  ELSE t.accumulated_seconds + EXTRACT(EPOCH FROM (NOW() - t.started_at))::int 
             END AS elapsed_sec
      FROM active_timers t
      WHERE t.client_id = $1 AND t.is_running = TRUE
      ORDER BY t.started_at DESC LIMIT 1
    `, [req.user.id]);

    if (!rows.length) return res.json({ running: false });
    res.json({ running: true, ...rows[0] });
  } catch (e) { next(e); }
});

// ── POST /api/timer/cancel — freelancer resets/deletes active timer ──────────
router.post('/cancel', requireFreelancer, async (req, res, next) => {
  try {
    let { client_id } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    const clientCheck = await pool.query(
      `SELECT id FROM users WHERE id = $1 OR id = (SELECT user_id FROM clients WHERE id = $1) LIMIT 1`,
      [client_id]
    );
    if (!clientCheck.rows.length) return res.status(404).json({ error: 'Client user not found' });
    const actualUserId = clientCheck.rows[0].id;

    // Delete active timer record without saving to time_logs
    await pool.query(`DELETE FROM active_timers WHERE freelancer_id = $1 AND client_id = $2`, [req.user.id, actualUserId]);

    // Notify client to hide the timer immediately
    pushToClient(actualUserId, { event: 'stopped', elapsed_sec: 0 });

    res.json({ message: 'Timer reset and cancelled' });
  } catch (e) { next(e); }
});

module.exports = router;
