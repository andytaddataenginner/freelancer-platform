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

// POST /api/fixed-payments/generate — auto-generate monthly records
// Call this to create a record for a specific month if it doesn't exist yet
router.post('/generate', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, month } = req.body; // month = '2025-06'
    if (!client_id || !month)
      return res.status(400).json({ error: 'client_id and month required' });

    // Get client's fixed price
    const clientInfo = await pool.query(
      'SELECT fixed_price FROM clients WHERE user_id=$1 AND freelancer_id=$2',
      [client_id, req.user.id]
    );
    if (!clientInfo.rows.length)
      return res.status(404).json({ error: 'Client not found' });

    const amount = clientInfo.rows[0].fixed_price;

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

// POST /api/fixed-payments/bulk-generate — generate records for all fixed clients
// for a given month (call from dashboard when viewing a new month)
router.post('/bulk-generate', requireFreelancer, async (req, res, next) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ error: 'month required' });

    // Get all fixed clients for this freelancer
    const clients = await pool.query(`
      SELECT u.id, c.fixed_price FROM clients c
      JOIN users u ON u.id = c.user_id
      WHERE c.freelancer_id = $1 AND c.rate_type = 'fixed' AND c.fixed_price IS NOT NULL
    `, [req.user.id]);

    // Generate a record for each fixed client for this month
    const results = await Promise.all(clients.rows.map(cl =>
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

module.exports = router;
