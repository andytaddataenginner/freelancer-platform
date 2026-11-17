const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer, requireAuth } = require('../middleware/auth');
const { applyFundsToUnpaidLogs } = require('./creditLedger');
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
  const dbClient = await pool.connect();
  try {
    let { client_id, elapsed_sec, description } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id required' });

    const clientCheck = await dbClient.query(
      `SELECT id FROM users WHERE id = $1 OR id = (SELECT user_id FROM clients WHERE id = $1) LIMIT 1`,
      [client_id]
    );
    if (!clientCheck.rows.length) return res.status(404).json({ error: 'Client user not found' });
    const actualUserId = clientCheck.rows[0].id;

    const check = await dbClient.query(`
      SELECT * FROM active_timers
      WHERE freelancer_id = $1 AND client_id = $2 AND is_running = TRUE
    `, [req.user.id, actualUserId]);

    if (!check.rows.length) return res.status(404).json({ error: 'No running timer found for this client' });
    const timer = check.rows[0];

    let totalSecs = parseInt(elapsed_sec) || 0;
    const hours = Math.round((totalSecs / 3600) * 10000) / 10000;

    const rateRes = await dbClient.query(
      `SELECT hourly_rate, rate_type FROM clients WHERE user_id = $1 OR id = $1 LIMIT 1`,
      [actualUserId]
    );
    const clientData = rateRes.rows[0] || {};
    const rateType = clientData.rate_type || 'hourly';
    const hourlyRate = parseFloat(clientData.hourly_rate || 0);

    const amount = rateType === 'fixed' ? 0 : Math.round((hours * hourlyRate) * 100) / 100;
    const finalDescription = description || timer.description || 'Timed session';

    await dbClient.query('BEGIN');

    if (hours > 0) {
      await dbClient.query(`
        INSERT INTO time_logs (client_id, freelancer_id, date, hours, amount, task_description, source, payment_status)
        VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, 'timer', 'unpaid')
      `, [actualUserId, req.user.id, hours, amount, finalDescription]);

      // Trigger the credit ledger allocation to auto-settle using existing credit balance
      await applyFundsToUnpaidLogs(dbClient, actualUserId, 0);
    }

    await dbClient.query(`DELETE FROM active_timers WHERE id = $1`, [timer.id]);

    await dbClient.query('COMMIT');

    pushToClient(actualUserId, { event: 'stopped', elapsed_sec: totalSecs });

    res.json({
      message: 'Timer stopped and saved',
      elapsed_sec: totalSecs,
      hours: hours,
      amount: amount
    });
  } catch (e) {
    await dbClient.query('ROLLBACK');
    next(e);
  } finally {
    dbClient.release();
  }
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
    if (String(req.user.role || '').trim().toLowerCase() !== 'client') return res.status(403).json({ error: 'Clients only' });

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
    
    if (client_id) {
      const clientCheck = await pool.query(
        `SELECT id FROM users WHERE id = $1 OR id = (SELECT user_id FROM clients WHERE id = $1) LIMIT 1`,
        [client_id]
      );
      if (clientCheck.rows.length) {
        const actualUserId = clientCheck.rows[0].id;
        await pool.query(`DELETE FROM active_timers WHERE freelancer_id = $1 AND client_id = $2`, [req.user.id, actualUserId]);
        pushToClient(actualUserId, { event: 'stopped', elapsed_sec: 0 });
      }
    } else {
      const activeTimers = await pool.query(`SELECT client_id FROM active_timers WHERE freelancer_id = $1`, [req.user.id]);
      for (const row of activeTimers.rows) {
        pushToClient(row.client_id, { event: 'stopped', elapsed_sec: 0 });
      }
      await pool.query(`DELETE FROM active_timers WHERE freelancer_id = $1`, [req.user.id]);
    }

    res.json({ message: 'Timer reset and cancelled successfully' });
  } catch (e) { next(e); }
});

// ── GET /api/timer/agency/status — agency-wide availability status ──────────
// ── GET /api/timer/agency/status — agency-wide availability status ──────────
// ── GET /api/timer/agency/status — agency-wide availability status ──────────
router.get('/agency/status', verifyToken, async (req, res, next) => {
  try {
    // Resolve the freelancer from both the client assignment row and the
    // current contract. Do not gate this on clients.is_active: legacy timer
    // status is based on the assigned freelancer's running timer.
    const { rows: assignedRows } = await pool.query(`
      SELECT DISTINCT assignment.freelancer_id,
             u.name AS freelancer_name,
             COALESCE(u.is_online, FALSE) AS is_online
      FROM (
        SELECT c.freelancer_id
        FROM clients c
        WHERE c.user_id = $1 AND c.freelancer_id IS NOT NULL

        UNION

        SELECT cc.freelancer_id
        FROM client_contracts cc
        WHERE cc.client_id = $1
          AND cc.freelancer_id IS NOT NULL
          AND cc.effective_to IS NULL
          AND cc.status IN ('active', 'paused')
      ) assignment
      JOIN users u ON u.id = assignment.freelancer_id
      WHERE LOWER(TRIM(u.role)) = 'freelancer'
      ORDER BY assignment.freelancer_id
    `, [req.user.id]);

    if (!assignedRows.length) {
      return res.json({
        status: 'offline', availability_scope: 'assigned-freelancer',
        assigned_freelancer_id: null, assigned_freelancer_name: null,
        is_available: false, is_busy: false, is_other_client: false,
        is_paused: false, active_session: null,
        reason: 'No freelancer assignment found for this client'
      });
    }

    const freelancerIds = assignedRows.map(row => row.freelancer_id);
    const { rows: timerRows } = await pool.query(`
      SELECT t.id, t.freelancer_id, t.client_id, t.started_at, t.description,
             t.is_paused, t.accumulated_seconds,
             CASE WHEN t.is_paused THEN t.accumulated_seconds
                  ELSE t.accumulated_seconds + EXTRACT(EPOCH FROM (NOW() - t.started_at))::int
             END AS elapsed_sec
      FROM active_timers t
      WHERE t.freelancer_id = ANY($1) AND t.is_running = TRUE
      ORDER BY (t.client_id <> $2) DESC, t.started_at DESC
      LIMIT 1
    `, [freelancerIds, req.user.id]);

    const timer = timerRows[0];
    const assigned = assignedRows.find(row =>
      String(row.freelancer_id) === String(timer?.freelancer_id)
    ) || assignedRows[0];

    if (timer) {
      const isOtherClient = String(timer.client_id) !== String(req.user.id);
      return res.json({
        status: 'busy',
        availability_scope: 'freelancer-wide',
        assigned_freelancer_id: timer.freelancer_id,
        assigned_freelancer_name: assigned.freelancer_name,
        is_available: false,
        is_busy: true,
        is_other_client: isOtherClient,
        is_paused: Boolean(timer.is_paused),
        active_session: isOtherClient ? null : {
          started_at: timer.started_at,
          description: timer.description,
          is_paused: Boolean(timer.is_paused),
          accumulated_seconds: timer.accumulated_seconds,
          elapsed_sec: timer.elapsed_sec
        }
      });
    }

    const isOnline = assignedRows.some(row => Boolean(row.is_online));
    return res.json({
      status: isOnline ? 'available' : 'offline',
      availability_scope: 'freelancer-wide',
      assigned_freelancer_id: assigned.freelancer_id,
      assigned_freelancer_name: assigned.freelancer_name,
      is_available: isOnline,
      is_busy: false,
      is_other_client: false,
      is_paused: false,
      active_session: null
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
