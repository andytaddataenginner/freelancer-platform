const router = require('express').Router();
const pool   = require('../db/pool');
const { requireClient } = require('../middleware/auth');

// GET /api/client/stats
router.get('/stats', requireClient, async (req, res, next) => {
  try {
    const userId = req.user.id; // users.id

    const clientRes = await pool.query(
      `SELECT id, user_id, rate_type, hourly_rate, fixed_price, credit_balance, total_paid 
       FROM clients WHERE user_id = $1`,
      [userId]
    );

    if (clientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Client record not found' });
    }

    const clientRow = clientRes.rows[0];
    const rateType = clientRow.rate_type || 'hourly';
    const creditBalance = parseFloat(clientRow.credit_balance || 0);

    // Fixed-Rate Logic
    if (rateType === 'fixed') {
      const fixedPaymentsRes = await pool.query(
        `SELECT amount, status FROM fixed_monthly_payments WHERE client_id = $1`,
        [userId]
      );

      let totalPaid = 0;
      let totalUnpaid = 0;

      fixedPaymentsRes.rows.forEach(p => {
        const amt = parseFloat(p.amount || 0);
        if (p.status === 'paid') totalPaid += amt;
        else totalUnpaid += amt;
      });

      return res.json({
        rate_type: 'fixed',
        rateType: 'fixed',
        fixed_price: parseFloat(clientRow.fixed_price || 0),
        credit_balance: creditBalance,
        total_paid: totalPaid,
        total_unpaid: totalUnpaid,
        totalPaid: totalPaid,
        totalUnpaid: totalUnpaid,
        total_hours: 0,
        hourly_rate: 0
      });
    }

    // Hourly Logic
    const hourlyLogsRes = await pool.query(
      `SELECT hours, amount, payment_status FROM time_logs WHERE client_id = $1`,
      [userId]
    );

    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalHours = 0;

    hourlyLogsRes.rows.forEach(l => {
      const h = parseFloat(l.hours || 0);
      const amt = parseFloat(l.amount || (h * (clientRow.hourly_rate || 0)));
      totalHours += h;
      if (l.payment_status === 'paid') {
        totalPaid += amt;
      } else {
        totalUnpaid += amt;
      }
    });

    res.json({
      rate_type: 'hourly',
      rateType: 'hourly',
      hourly_rate: parseFloat(clientRow.hourly_rate || 0),
      credit_balance: creditBalance,
      total_paid: totalPaid,
      total_unpaid: totalUnpaid,
      totalPaid: totalPaid,
      totalUnpaid: totalUnpaid,
      total_hours: totalHours
    });

  } catch (e) {
    next(e);
  }
});

// GET /api/client/timelogs
router.get('/timelogs', requireClient, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const clientInfo = await pool.query(
      `SELECT id, rate_type FROM clients WHERE user_id = $1`,
      [userId]
    );
    
    if (clientInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Client record not found' });
    }

    const rateType = clientInfo.rows[0].rate_type || 'hourly';

    // Fixed-Rate logs mapping to match table column expectations
    if (rateType === 'fixed') {
      const { rows } = await pool.query(
        `SELECT id, client_id, month AS date, amount, status AS payment_status, 'Fixed Monthly Payment' AS task_description, 0 AS hours 
         FROM fixed_monthly_payments 
         WHERE client_id = $1 
         ORDER BY month DESC`,
        [userId]
      );
      return res.json(rows);
    }

    // Hourly logs
    const { rows } = await pool.query(
      `SELECT * FROM time_logs 
       WHERE client_id = $1 
       ORDER BY date DESC, created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

module.exports = router;
