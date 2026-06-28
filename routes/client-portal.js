const express = require('express');
const router = express.Router();
const pool = require('../db');
// Replace with your actual authentication middleware if named differently
const { requireClient } = require('../middleware/auth'); 

// GET /api/client/stats - Fetch stats for client dashboard summary cards
router.get('/stats', requireClient, async (req, res, next) => {
  try {
    const clientId = req.user.id;

    // Fetch master client profiling information parameters
    const clientRes = await pool.query(
      `SELECT rate_type, hourly_rate, fixed_price, fixed_status, credit_balance 
       FROM clients 
       WHERE user_id = $1`,
      [clientId]
    );

    if (clientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Client profile not found.' });
    }

    const profile = clientRes.rows[0];

    // Initialize tracking accumulators
    let totalPaid = 0;
    let totalUnpaid = 0;

    // Pull calculations dynamically from active transaction logs to ensure high-fidelity stats
    const logsRes = await pool.query(
      `SELECT hours, amount, payment_status FROM timelogs WHERE client_id = $1`,
      [clientId]
    );

    const rate = parseFloat(profile.hourly_rate || 0);

    logsRes.rows.forEach(log => {
      let amt = parseFloat(log.amount || 0);
      if (!amt && log.hours && rate) {
        amt = parseFloat(log.hours) * rate;
      }

      if (log.payment_status === 'paid') {
        totalPaid += amt;
      } else {
        totalUnpaid += amt;
      }
    });

    res.json({
      rateType: profile.rate_type,
      hourlyRate: profile.hourly_rate,
      fixedPrice: profile.fixed_price,
      fixedStatus: profile.fixed_status,
      creditBalance: parseFloat(profile.credit_balance || 0),
      totalPaid: totalPaid,
      totalUnpaid: totalUnpaid
    });

  } catch (e) { next(e); }
});

// POST /api/client/payments/record - Submit automated payment remittance request directly
router.post('/payments/record', requireClient, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { amount, date, notes } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'A valid payment remittance amount greater than zero is required.' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Processing timestamp date value is required.' });
    }

    await client.query('BEGIN');

    // 1. Log payment event historical transaction trail
    await client.query(
      `INSERT INTO payments (client_id, amount, date, notes) 
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, parsedAmount, date, notes || null]
    );

    // 2. ✅ FIXED: Add remittance value safely to credit_balance column 
    // Removed total_paid reference so your transaction runs cleanly without crashing
    await client.query(
      `UPDATE clients 
       SET credit_balance = COALESCE(credit_balance, 0) + $1 
       WHERE user_id = $2`,
      [parsedAmount, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Remittance posting balanced successfully.' });

  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

module.exports = router;
