const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// GET /api/fixed-payments/:clientId — get all monthly records for a fixed client
router.get('/:clientId', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM fixed_monthly_payments
      WHERE client_id = $1 AND freelancer_id = $2
      ORDER BY month DESC
    `, [req.params.clientId, req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/fixed-payments/generate — auto-generate a monthly record
// Refuses to create a record for a month before the client's start date
// (clients.created_at) — a client can't owe a fixed fee for a month
// before they were actually a client.
router.post('/generate', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, month } = req.body; // month = '2025-06'
    if (!client_id || !month)
      return res.status(400).json({ error: 'client_id and month required' });

    const clientInfo = await pool.query(
      `SELECT fixed_price, to_char(created_at, 'YYYY-MM') AS start_month
       FROM clients WHERE user_id=$1 AND freelancer_id=$2`,
      [client_id, req.user.id]
    );
    if (!clientInfo.rows.length)
      return res.status(404).json({ error: 'Client not found' });

    const { fixed_price: amount, start_month } = clientInfo.rows[0];
    if (month < start_month) {
      return res.status(400).json({
        error: `This client's billing starts ${start_month} — can't generate a fee for ${month}.`
      });
    }

    // Insert or ignore if already exists
    const { rows } = await pool.query(`
      INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
      VALUES ($1, $2, $3, $4, 'unpaid')
      ON CONFLICT (client_id, month) DO NOTHING
      RETURNING *
    `, [client_id, req.user.id, month, amount]);

    // Return existing or new record
    if (!rows.length) {
      const existing = await pool.query(
        'SELECT * FROM fixed_monthly_payments WHERE client_id=$1 AND month=$2',
        [client_id, month]
      );
      return res.json(existing.rows[0]);
    }
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/fixed-payments/:id/status — mark a month as paid or unpaid
router.patch('/:id/status', requireFreelancer, async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!['paid','unpaid'].includes(status))
      return res.status(400).json({ error: 'status must be paid or unpaid' });

    const { rows } = await pool.query(`
      UPDATE fixed_monthly_payments
      SET status  = $1,
          paid_at = $2,
          note    = $3
      WHERE id = $4 AND freelancer_id = $5
      RETURNING *
    `, [
      status,
      status === 'paid' ? new Date() : null,
      note || null,
      req.params.id,
      req.user.id
    ]);

    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /api/fixed-payments/bulk-generate — generate records for all fixed
// clients for a given month. Skips any client whose created_at is later
// than the requested month, so paging to a past month never fabricates a
// fee for a client who didn't exist yet.
router.post('/bulk-generate', requireFreelancer, async (req, res, next) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ error: 'month required' });

    const clients = await pool.query(`
      SELECT u.id, c.fixed_price FROM clients c
      JOIN users u ON u.id = c.user_id
      WHERE c.freelancer_id = $1 
        AND c.rate_type = 'fixed' 
        AND c.fixed_price IS NOT NULL
        AND to_char(c.created_at, 'YYYY-MM') <= $2
    `, [req.user.id, month]);

    // Generate a record for each eligible fixed client for this month
    await Promise.all(clients.rows.map(cl =>
      pool.query(`
        INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
        VALUES ($1, $2, $3, $4, 'unpaid')
        ON CONFLICT (client_id, month) DO NOTHING
      `, [cl.id, req.user.id, month, cl.fixed_price])
    ));

    // Return all records for this month
    const { rows } = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      WHERE f.freelancer_id = $1 AND f.month = $2
      ORDER BY u.name
    `, [req.user.id, month]);

    res.json(rows);
  } catch (e) { next(e); }
});

// DELETE /api/fixed-payments/:id — remove a monthly record
router.delete('/:id', requireFreelancer, async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM fixed_monthly_payments WHERE id=$1 AND freelancer_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

// GET /api/fixed-payments — every fixed-fee record for this freelancer,
// across all clients and all months. Powers the "All Time" statement.
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      WHERE f.freelancer_id = $1
      ORDER BY f.month DESC, u.name
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/fixed-payments/backfill-all
// body: { start_month: 'YYYY-MM' }
// One-time seed: creates an 'unpaid' row for every fixed-rate client for
// every month from start_month (or the client's own created_at, whichever
// is LATER) through the current month. A client is never backfilled to a
// month before they actually started. Safe to re-run — ON CONFLICT DO
// NOTHING skips months that already have a record.
router.post('/backfill-all', requireFreelancer, async (req, res, next) => {
  try {
    const { start_month } = req.body;
    if (!start_month) return res.status(400).json({ error: 'start_month required (YYYY-MM)' });

    const clients = await pool.query(`
      SELECT c.user_id, c.fixed_price, to_char(c.created_at, 'YYYY-MM') AS start_month
      FROM clients c
      WHERE c.freelancer_id = $1 AND c.rate_type = 'fixed' AND c.fixed_price IS NOT NULL
    `, [req.user.id]);

    const now = new Date();
    const endY = now.getFullYear(), endM = now.getMonth() + 1;

    function monthsFrom(fromMonth) {
      const months = [];
      let [y, m] = fromMonth.split('-').map(Number);
      while (y < endY || (y === endY && m <= endM)) {
        months.push(`${y}-${String(m).padStart(2, '0')}`);
        m++; if (m > 12) { m = 1; y++; }
      }
      return months;
    }

    let created = 0;
    for (const cl of clients.rows) {
      // Never generate a fee for a month before this client actually
      // started — clamp the requested start_month forward to whichever
      // is later: the requested date or the client's own created_at.
      const effectiveStart = cl.start_month > start_month ? cl.start_month : start_month;
      const months = monthsFrom(effectiveStart);
      for (const mo of months) {
        const r = await pool.query(`
          INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
          VALUES ($1, $2, $3, $4, 'unpaid')
          ON CONFLICT (client_id, month) DO NOTHING
          RETURNING id
        `, [cl.user_id, req.user.id, mo, cl.fixed_price]);
        if (r.rows.length) created++;
      }
    }
    res.json({ clients: clients.rows.length, created });
  } catch (e) { next(e); }
});

module.exports = router;
