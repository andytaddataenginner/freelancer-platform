const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// GET /api/fixed-payments/:clientId — get records filtered by active contract status
router.get('/:clientId', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.* 
      FROM fixed_monthly_payments f
      LEFT JOIN client_contracts cc ON cc.client_id = f.client_id 
        AND cc.freelancer_id = f.freelancer_id
        AND cc.effective_from <= (f.month || '-01')::date
        AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
      WHERE f.client_id = $1 AND f.freelancer_id = $2
        AND (cc.status IS NULL OR cc.status = 'active')
      ORDER BY f.month DESC
    `, [req.params.clientId, req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/fixed-payments/generate — generate single monthly record
router.post('/generate', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, month } = req.body;
    if (!client_id || !month)
      return res.status(400).json({ error: 'client_id and month required' });

    const firstOfMonth = `${month}-01`;

    // Verify client has an active fixed-rate contract for this month
    const contractCheck = await pool.query(`
      SELECT cc.fixed_price, cc.status, to_char(c.created_at, 'YYYY-MM') AS start_month
      FROM client_contracts cc
      JOIN clients c ON c.user_id = cc.client_id AND c.freelancer_id = cc.freelancer_id
      WHERE cc.client_id = $1 AND cc.freelancer_id = $2
        AND cc.effective_from <= $3::date
        AND (cc.effective_to IS NULL OR cc.effective_to >= $3::date)
      ORDER BY cc.effective_from DESC, cc.id DESC LIMIT 1
    `, [client_id, req.user.id, firstOfMonth]);

    if (!contractCheck.rows.length || contractCheck.rows[0].status !== 'active') {
      return res.status(400).json({ error: 'Client contract is not active for the selected month.' });
    }

    const amount = contractCheck.rows[0].fixed_price;

    const { rows } = await pool.query(`
      INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
      VALUES ($1, $2, $3, $4, 'unpaid')
      ON CONFLICT (client_id, month) DO NOTHING
      RETURNING *
    `, [client_id, req.user.id, month, amount]);

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

// POST /api/fixed-payments/bulk-generate — bulk generation (skips non-active contracts)
router.post('/bulk-generate', requireFreelancer, async (req, res, next) => {
  try {
    const { month } = req.body;
    if (!month) return res.status(400).json({ error: 'month required' });
    const firstOfMonth = `${month}-01`;

    const clients = await pool.query(`
      SELECT DISTINCT cc.client_id AS id, cc.fixed_price
      FROM client_contracts cc
      WHERE cc.freelancer_id = $1 
        AND cc.rate_type = 'fixed' 
        AND cc.status = 'active'
        AND cc.fixed_price IS NOT NULL
        AND cc.effective_from <= $2::date
        AND (cc.effective_to IS NULL OR cc.effective_to >= $2::date)
    `, [req.user.id, firstOfMonth]);

    await Promise.all(clients.rows.map(cl =>
      pool.query(`
        INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
        VALUES ($1, $2, $3, $4, 'unpaid')
        ON CONFLICT (client_id, month) DO NOTHING
      `, [cl.id, req.user.id, month, cl.fixed_price])
    ));

    const { rows } = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      LEFT JOIN client_contracts cc ON cc.client_id = f.client_id 
        AND cc.freelancer_id = f.freelancer_id
        AND cc.effective_from <= ($2 || '-01')::date
        AND (cc.effective_to IS NULL OR cc.effective_to >= ($2 || '-01')::date)
      WHERE f.freelancer_id = $1 AND f.month = $2
        AND (cc.status IS NULL OR cc.status = 'active')
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

// GET /api/fixed-payments — fetch all active contract fixed payments
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      LEFT JOIN client_contracts cc ON cc.client_id = f.client_id 
        AND cc.freelancer_id = f.freelancer_id
        AND cc.effective_from <= (f.month || '-01')::date
        AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
      WHERE f.freelancer_id = $1
        AND (cc.status IS NULL OR cc.status = 'active')
      ORDER BY f.month DESC, u.name
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/fixed-payments/backfill-all
router.post('/backfill-all', requireFreelancer, async (req, res, next) => {
  try {
    const { start_month } = req.body;
    if (!start_month) return res.status(400).json({ error: 'start_month required (YYYY-MM)' });

    const contracts = await pool.query(`
      SELECT cc.client_id, cc.fixed_price, to_char(cc.effective_from, 'YYYY-MM') AS start_month
      FROM client_contracts cc
      WHERE cc.freelancer_id = $1 AND cc.rate_type = 'fixed' AND cc.status = 'active' AND cc.fixed_price IS NOT NULL
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
    for (const cl of contracts.rows) {
      const effectiveStart = cl.start_month > start_month ? cl.start_month : start_month;
      const months = monthsFrom(effectiveStart);
      for (const mo of months) {
        const r = await pool.query(`
          INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
          VALUES ($1, $2, $3, $4, 'unpaid')
          ON CONFLICT (client_id, month) DO NOTHING
          RETURNING id
        `, [cl.client_id, req.user.id, mo, cl.fixed_price]);
        if (r.rows.length) created++;
      }
    }
    res.json({ clients: contracts.rows.length, created });
  } catch (e) { next(e); }
});

module.exports = router;
