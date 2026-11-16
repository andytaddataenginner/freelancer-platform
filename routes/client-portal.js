const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireClient } = require('../middleware/auth');

// GET /api/client/stats - Fetch dashboard summary
router.get('/stats', requireClient, async (req, res, next) => {
  try {
    const clientId = req.user.id;

    // 1. Fetch client base details & current contract state from client_contracts
    const clientRes = await pool.query(
      `SELECT c.credit_balance, 
              COALESCE(cc.rate_type, c.rate_type, 'hourly') AS rate_type,
              COALESCE(cc.hourly_rate, c.hourly_rate, 0) AS hourly_rate,
              COALESCE(cc.fixed_price, c.fixed_price, 0) AS fixed_price,
              COALESCE(cc.status, CASE WHEN c.is_active THEN 'active' ELSE 'terminated' END) AS contract_status,
              c.fixed_payment_status
       FROM clients c
       LEFT JOIN client_contracts cc ON cc.client_id = c.user_id 
         AND cc.freelancer_id = c.freelancer_id 
         AND cc.effective_to IS NULL
       WHERE c.user_id = $1
       ORDER BY cc.effective_from DESC, cc.id DESC
       LIMIT 1`, 
      [clientId]
    );

    if (clientRes.rows.length === 0) return res.status(404).json({ error: 'Client not found.' });
    const profile = clientRes.rows[0];
    const contractStatus = profile.contract_status; // 'active', 'paused', 'terminated'

    let totalPaid = 0;
    let totalUnpaid = 0;

    if (profile.rate_type === 'fixed') {
      // Aggregate paid and unpaid records from fixed_monthly_payments
      const fixedRes = await pool.query(
        `SELECT amount, status FROM fixed_monthly_payments WHERE client_id = $1`,
        [clientId]
      );

      fixedRes.rows.forEach(r => {
        const amt = parseFloat(r.amount || 0);
        if (r.status === 'paid') {
          totalPaid += amt;
        } else if (contractStatus === 'active') {
          // Unpaid amounts are only added to outstanding KPIs if the contract is active
          totalUnpaid += amt;
        }
      });
    } else {
      // Hourly contract totals
      const logsRes = await pool.query(
        `SELECT hours, amount, payment_status FROM time_logs WHERE client_id = $1`, 
        [clientId]
      );
      const rate = parseFloat(profile.hourly_rate || 0);
      logsRes.rows.forEach(log => {
        let amt = parseFloat(log.amount || 0);
        if (!amt && log.hours) amt = parseFloat(log.hours) * rate;
        if (log.payment_status === 'paid') totalPaid += amt;
        else totalUnpaid += amt;
      });
    }

    res.json({
      rateType: profile.rate_type,
      contractStatus: contractStatus,
      hourlyRate: parseFloat(profile.hourly_rate || 0),
      fixedPrice: parseFloat(profile.fixed_price || 0),
      fixedStatus: profile.fixed_payment_status,
      creditBalance: parseFloat(profile.credit_balance || 0),
      totalPaid,
      totalUnpaid
    });
  } catch (e) { next(e); }
});

// ── GET /api/client/projects — client views their projects (Read-Only) ─────
router.get('/projects', requireClient, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id, p.name, p.description, p.status, p.deadline, p.created_at,
             u.name AS freelancer_name
      FROM projects p
      JOIN users u ON u.id = p.freelancer_id
      WHERE p.client_id = $1
      ORDER BY p.created_at DESC
    `, [req.user.id]);

    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET /api/client/notes — client views their notes/guidelines (Read-Only) ─
router.get('/notes', requireClient, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT n.id, n.category, n.title, n.content, n.is_pinned, n.created_at,
             u.name AS freelancer_name
      FROM client_notes n
      JOIN users u ON u.id = n.freelancer_id
      WHERE n.client_id = $1
      ORDER BY n.is_pinned DESC, n.created_at DESC
    `, [req.user.id]);

    res.json(rows);
  } catch (e) { next(e); }
});


// GET /api/client/timelogs
router.get('/timelogs', requireClient, async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM time_logs WHERE client_id = $1 ORDER BY date DESC', [req.user.id]);
        res.json(result.rows);
    } catch (e) { next(e); }
});

// GET /api/client/bookings
router.get('/bookings', requireClient, async (req, res, next) => {
    try {
        const result = await pool.query('SELECT * FROM bookings WHERE client_id = $1 ORDER BY date ASC', [req.user.id]);
        res.json(result.rows);
    } catch (e) { next(e); }
});

// POST /api/client/payments/record
router.post('/payments/record', requireClient, async (req, res, next) => {
  try {
    const { amount, date, notes } = req.body;
    const parsedAmount = parseFloat(amount);

    await pool.query(
      `INSERT INTO payments (client_id, amount, date, notes) VALUES ($1, $2, $3, $4)`,
      [req.user.id, parsedAmount, date, notes || null]
    );
    await pool.query(
      `UPDATE clients SET credit_balance = COALESCE(credit_balance, 0) + $1 WHERE user_id = $2`,
      [parsedAmount, req.user.id]
    );
    res.status(201).json({ success: true });
  } catch (e) { next(e); }
});


// GET /api/client/fixed-payments — client's fixed-fee billing history
router.get('/fixed-payments', requireClient, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, month, amount, status, paid_at, note FROM fixed_monthly_payments WHERE client_id=$1 ORDER BY month DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/client/payments — client's recorded remittances
router.get('/payments', requireClient, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, amount, date, notes FROM payments WHERE client_id=$1 ORDER BY date DESC, id DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/client/bookings — client requests a session with their assigned freelancer
router.post('/bookings', requireClient, async (req, res, next) => {
  try {
    const { date, time, duration = 1, type = 'call', message } = req.body;
    const validTypes = ['call', 'review', 'workshop', 'other'];
    const hours = Number(duration);
    if (!date || !time || !validTypes.includes(type) || !Number.isFinite(hours) || hours < 0.5 || hours > 8) {
      return res.status(400).json({ error: 'A valid date, time, session type and duration are required.' });
    }
    if (date < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'Please choose today or a future date.' });
    }
    const clientRes = await pool.query(
      'SELECT freelancer_id FROM clients WHERE user_id=$1 LIMIT 1',
      [req.user.id]
    );
    if (!clientRes.rows.length || !clientRes.rows[0].freelancer_id) {
      return res.status(404).json({ error: 'No freelancer is assigned to this client account.' });
    }
    const { rows } = await pool.query(
      "INSERT INTO bookings (client_id, freelancer_id, date, time, duration, type, message, status) VALUES ($1,$2,$3::date,$4::time,$5,$6,$7,'pending') RETURNING *",
      [req.user.id, clientRes.rows[0].freelancer_id, date, time, hours, type, message || null]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/client/bookings/:id/cancel — clients may cancel their own future requests
router.patch('/bookings/:id/cancel', requireClient, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "UPDATE bookings SET status='cancelled' WHERE id=$1 AND client_id=$2 AND date >= CURRENT_DATE AND status IN ('pending','confirmed') RETURNING *",
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Upcoming booking not found or cannot be cancelled.' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
