const router = require('express').Router();
const pool   = require('../db/pool');
const { requireClient } = require('../middleware/auth');

// GET /api/payments/history - Get transaction logs for the logged-in client
router.get('/history', requireClient, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, amount::float, date, notes, created_at FROM payments WHERE client_id = $1 ORDER BY date DESC, created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/payments/record - Simulate recording a cash payment transaction
router.post('/record', requireClient, async (req, res, next) => {
  try {
    const { amount, notes, date } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    // Identify freelancer owner
    const clientRow = await pool.query(
      'SELECT freelancer_id FROM clients WHERE user_id = $1',
      [req.user.id]
    );
    
    const freelancerId = clientRow.rows.length ? clientRow.rows[0].freelancer_id : null;
    const paymentDate = date || new Date().toISOString().slice(0, 10);

    const { rows } = await pool.query(
      `INSERT INTO payments (client_id, freelancer_id, amount, date, notes) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, freelancerId, amount, paymentDate, notes || null]
    );

    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
