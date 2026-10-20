const router = require('express').Router();
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');

// Self-contained token verifier (supports both freelancers and clients without import errors)
const verifyUserToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user; // Contains id, role, name
    next();
  });
};

// POST /api/chatbot — Secure database-backed assistant with role isolation
router.post('/', verifyUserToken, async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role; // 'freelancer' (Anduamlak) or 'client'
    const userName = req.user.name || 'User';

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let contextSummary = {};

    if (userRole === 'freelancer') {
      // 🛡️ ADMIN (Anduamlak): Full agency metrics across all clients
      const [clientsRes, logsRes, fixedRes, earningsRes] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS cnt FROM clients WHERE freelancer_id = $1`, [userId]),
        pool.query(`SELECT COALESCE(SUM(hours),0)::float AS total_hours FROM time_logs WHERE freelancer_id = $1`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS cnt FROM fixed_monthly_payments WHERE freelancer_id = $1 AND status = 'unpaid'`, [userId]),
        pool.query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs WHERE freelancer_id = $1 AND payment_status = 'paid'`, [userId])
      ]);

      contextSummary = {
        role: 'admin',
        totalClients: clientsRes.rows[0].cnt,
        totalHoursLogged: logsRes.rows[0].total_hours,
        unpaidInvoices: fixedRes.rows[0].cnt,
        totalEarnings: earningsRes.rows[0].total
      };
    } else {
      // 🔒 CLIENT ISOLATION: Strictly respective to this specific client's ID
      const [clientLogs, clientInvoices] = await Promise.all([
        pool.query(`SELECT date, hours, task_description, payment_status, amount FROM time_logs WHERE client_id = $1 ORDER BY date DESC LIMIT 10`, [userId]),
        pool.query(`SELECT month, amount, status FROM fixed_monthly_payments WHERE client_id = $1 ORDER BY month DESC`, [userId])
      ]);

      contextSummary = {
        role: 'client',
        timeLogs: clientLogs.rows,
        invoices: clientInvoices.rows
      };
    }

    const reply = `Hello ${userName}! As your secure QFA assistant, I checked your ${userRole} records. You asked: "${message}". [Data successfully isolated and retrieved].`;

    res.json({ success: true, reply, contextSummary });

  } catch (e) { 
    next(e); 
  }
});

module.exports = router;
