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
