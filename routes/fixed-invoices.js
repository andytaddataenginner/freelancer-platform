const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// GET /api/fixed-invoices - Retrieve records with flexible filtering
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, payment_status, year, month } = req.query;
    let where = ['f.freelancer_id = $1'];
    let params = [req.user.id];
    let i = 2;

    if (client_id)      { where.push(`f.client_id = $${i++}`);      params.push(client_id); }
    if (payment_status) { where.push(`f.payment_status = $${i++}`); params.push(payment_status); }
    if (year)           { where.push(`f.billing_year = $${i++}`);   params.push(parseInt(year)); }
    if (month)          { where.push(`f.billing_month = $${i++}`);  params.push(parseInt(month)); }

    const { rows } = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_invoices f
      JOIN users u ON u.id = f.client_id
      WHERE ${where.join(' AND ')}
      ORDER BY f.billing_year DESC, f.billing_month DESC
    `, params);
    
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/fixed-invoices - Log a specific month/year cycle amount snapshot
router.post('/', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, billing_month, billing_year } = req.body;
    if (!client_id || !billing_month || !billing_year) {
      return res.status(400).json({ error: 'client_id, billing_month, and billing_year are required' });
    }

    // Capture the client's current base fixed rate setup parameter
    const clientInfo = await pool.query(
      "SELECT fixed_price FROM clients WHERE user_id = $1 AND rate_type = 'fixed'",
      [client_id]
    );
    if (!clientInfo.rows.length) {
      return res.status(400).json({ error: 'Selected user is not configured as a fixed-rate client.' });
    }

    const amount = parseFloat(clientInfo.rows[0].fixed_price || 0);

    const { rows } = await pool.query(`
      INSERT INTO fixed_invoices (client_id, freelancer_id, billing_month, billing_year, amount, payment_status)
      VALUES ($1, $2, $3, $4, $5, 'unpaid')
      ON CONFLICT (client_id, billing_month, billing_year) 
      DO UPDATE SET amount = EXCLUDED.amount, updated_at = NOW()
      RETURNING *
    `, [client_id, req.user.id, billing_month, billing_year, amount]);

    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/fixed-invoices/:id/payment - Update workflow status flag transitions
router.patch('/:id/payment', requireFreelancer, async (req, res, next) => {
  try {
    const { payment_status } = req.body;
    if (!['paid', 'unpaid'].includes(payment_status)) {
      return res.status(400).json({ error: 'payment_status must be paid or unpaid' });
    }

    const { rows } = await pool.query(`
      UPDATE fixed_invoices 
      SET payment_status = $1, updated_at = NOW() 
      WHERE id = $2 AND freelancer_id = $3 
      RETURNING *
    `, [payment_status, req.params.id, req.user.id]);

    if (!rows.length) return res.status(404).json({ error: 'Fixed cycle contract snapshot row item not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
