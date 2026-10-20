const router = require('express').Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth'); // Ensure this matches your auth.js export
router.post('/chat', verifyToken, async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role; 
    const userName = req.user.name;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let contextData = {};

    if (userRole === 'freelancer') {
      const [clientsRes, logsRes, fixedRes, earningsRes] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS cnt FROM clients WHERE freelancer_id = $1`, [userId]),
        pool.query(`SELECT COALESCE(SUM(hours),0)::float AS total_hours FROM time_logs WHERE freelancer_id = $1`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS cnt FROM fixed_monthly_payments WHERE freelancer_id = $1 AND status = 'unpaid'`, [userId]),
        pool.query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs WHERE freelancer_id = $1 AND payment_status = 'paid'`, [userId])
      ]);

      contextData = {
        role: 'admin',
        adminName: userName,
        totalClients: clientsRes.rows[0].cnt,
        totalHoursLogged: logsRes.rows[0].total_hours,
        unpaidFixedInvoicesCount: fixedRes.rows[0].cnt,
        totalPaidEarnings: earningsRes.rows[0].total
      };
    } else {
      const [clientLogs, clientInvoices, clientContracts] = await Promise.all([
        pool.query(`SELECT date, hours, task_description, payment_status, amount FROM time_logs WHERE client_id = $1 ORDER BY date DESC LIMIT 15`, [userId]),
        pool.query(`SELECT month, amount, status FROM fixed_monthly_payments WHERE client_id = $1 ORDER BY month DESC`, [userId]),
        pool.query(`SELECT rate_type, fixed_price, hourly_rate, status FROM client_contracts WHERE client_id = $1`, [userId])
      ]);

      contextData = {
        role: 'client',
        clientName: userName,
        timeLogs: clientLogs.rows,
        invoices: clientInvoices.rows,
        contracts: clientContracts.rows
      };
    }

    const reply = `Hello ${userName}! As your secure QFA assistant, I've checked your ${userRole} records. You asked: "${message}".`;

    res.json({ success: true, reply, contextSummary: contextData });

  } catch (e) {
    next(e);
  }
});

module.exports = router;
