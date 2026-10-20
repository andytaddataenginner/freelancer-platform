const router = require('express').Router();
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');

const verifyUserToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

router.post('/', verifyUserToken, async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role; 
    const userName = req.user.name || 'User';

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let contextSummary = {};
    let dynamicReply = "";
    const lowerMsg = message.toLowerCase();

    if (userRole === 'freelancer') {
      // 🛡️ ADMIN (Anduamlak): Fetch full agency metrics
      const [clientsRes, logsRes, fixedRes, earningsRes] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS cnt FROM clients WHERE freelancer_id = $1`, [userId]),
        pool.query(`SELECT COALESCE(SUM(hours),0)::float AS total_hours FROM time_logs WHERE freelancer_id = $1`, [userId]),
        pool.query(`SELECT COUNT(*)::int AS cnt FROM fixed_monthly_payments WHERE freelancer_id = $1 AND status = 'unpaid'`, [userId]),
        pool.query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs WHERE freelancer_id = $1 AND payment_status = 'paid'`, [userId])
      ]);

      contextSummary = {
        role: 'admin',
        totalClients: clientsRes.rows[0].cnt,
        totalHoursLogged: logsRes.rows[0].cnt ? logsRes.rows[0].total_hours : 0,
        unpaidInvoices: fixedRes.rows[0].cnt,
        totalEarnings: earningsRes.rows[0].total
      };

      // 🧠 Dynamic Answer Builder for Admin
      if (lowerMsg.includes('client') || lowerMsg.includes('how many client')) {
        dynamicReply = `Hello ${userName}! You currently have ${contextSummary.totalClients} registered active clients in your agency database.`;
      } else if (lowerMsg.includes('hour') || lowerMsg.includes('logged')) {
        dynamicReply = `You have logged a total of ${contextSummary.totalHoursLogged} hours across your projects.`;
      } else if (lowerMsg.includes('earning') || lowerMsg.includes('paid') || lowerMsg.includes('revenue')) {
        dynamicReply = `Your total paid earnings recorded are $${contextSummary.totalEarnings.toFixed(2)}, with ${contextSummary.unpaidInvoices} unpaid fixed invoices pending.`;
      } else {
        dynamicReply = `Hello ${userName}! I checked your agency records: You have ${contextSummary.totalClients} clients, ${contextSummary.totalHoursLogged} logged hours, and $${contextSummary.totalEarnings.toFixed(2)} in paid earnings.`;
      }

    } else {
      // 🔒 CLIENT ISOLATION: Fetch respective client data
      const [clientLogs, clientInvoices] = await Promise.all([
        pool.query(`SELECT date, hours, task_description, payment_status, amount FROM time_logs WHERE client_id = $1 ORDER BY date DESC LIMIT 10`, [userId]),
        pool.query(`SELECT month, amount, status FROM fixed_monthly_payments WHERE client_id = $1 ORDER BY month DESC`, [userId])
      ]);

      contextSummary = {
        role: 'client',
        timeLogs: clientLogs.rows,
        invoices: clientInvoices.rows
      };

      // 🧠 Dynamic Answer Builder for Client
      const totalInvoices = clientInvoices.rows.length;
      const unpaidInvoices = clientInvoices.rows.filter(inv => inv.status === 'unpaid').length;

      if (lowerMsg.includes('invoice') || lowerMsg.includes('payment')) {
        dynamicReply = `Hello ${userName}! You have ${totalInvoices} total invoice records, with ${unpaidInvoices} currently showing as unpaid.`;
      } else if (lowerMsg.includes('hour') || lowerMsg.includes('log') || lowerMsg.includes('work')) {
        dynamicReply = `You have ${clientLogs.rows.length} recent time log entries recorded on your account.`;
      } else {
        dynamicReply = `Hello ${userName}! I looked up your client portal records. You have ${totalInvoices} invoice items and ${clientLogs.rows.length} logged task sessions.`;
      }
    }

    res.json({ success: true, reply: dynamicReply, contextSummary });

  } catch (e) { 
    next(e); 
  }
});

module.exports = router;
