const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireClient } = require('../middleware/auth'); 

// GET /api/client/stats - Fetch dashboard summary
router.get('/stats', requireClient, async (req, res, next) => {
  try {
    const clientId = req.user.id;
    const clientRes = await pool.query(
      `SELECT rate_type, hourly_rate, fixed_price, fixed_payment_status, credit_balance 
       FROM clients WHERE user_id = $1`, [clientId]
    );

    if (clientRes.rows.length === 0) return res.status(404).json({ error: 'Client not found.' });

    const profile = clientRes.rows[0];
    const logsRes = await pool.query(
      `SELECT hours, amount, payment_status FROM time_logs WHERE client_id = $1`, [clientId]
    );

    let totalPaid = 0;
    let totalUnpaid = 0;
    const rate = parseFloat(profile.hourly_rate || 0);

    logsRes.rows.forEach(log => {
      let amt = parseFloat(log.amount || 0);
      if (!amt && log.hours) amt = parseFloat(log.hours) * rate;
      if (log.payment_status === 'paid') totalPaid += amt;
      else totalUnpaid += amt;
    });

    res.json({
      rateType: profile.rate_type,
      hourlyRate: profile.hourly_rate,
      fixedPrice: profile.fixed_price,
      fixedStatus: profile.fixed_payment_status,
      creditBalance: parseFloat(profile.credit_balance || 0),
      totalPaid,
      totalUnpaid
    });
  } catch (e) { next(e); }
});

// GET /api/client/timelogs - Fixes your 404 error
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

module.exports = router;
