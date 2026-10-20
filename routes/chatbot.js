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
    const userRole = req.user.role; // 'freelancer' (Anduamlak) or 'client'
    const userName = req.user.name || 'User';

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let reply = "";
    const lowerMsg = message.toLowerCase().trim();

    if (userRole === 'freelancer') {
      // 🛡️ ADMIN (Anduamlak) Metrics

      if (lowerMsg.includes('total number of clients') || lowerMsg.includes('how many clients') || lowerMsg.includes('total clients')) {
        const resDb = await pool.query(`SELECT COUNT(*)::int AS count FROM clients WHERE freelancer_id = $1`, [userId]);
        reply = `👥 **Total Number of Clients**: You have **${resDb.rows[0].count}** registered clients in your agency database.`;

      } else if (lowerMsg.includes('total due from fixed') || lowerMsg.includes('fixed unpaid')) {
        const resDb = await pool.query(`
          SELECT COALESCE(SUM(amount), 0)::float AS total 
          FROM fixed_monthly_payments 
          WHERE freelancer_id = $1 AND status = 'unpaid'
        `, [userId]);
        reply = `⏳ **Total Due from Fixed Contracts**: **$${resDb.rows[0].total.toFixed(2)}** is currently unpaid.`;

      } else if (lowerMsg.includes('total due from hourly') || lowerMsg.includes('hourly unpaid')) {
        const resDb = await pool.query(`
          SELECT COALESCE(SUM(amount), 0)::float AS total 
          FROM time_logs 
          WHERE freelancer_id = $1 AND payment_status = 'unpaid'
        `, [userId]);
        reply = `⏱️ **Total Due from Hourly Logs**: **$${resDb.rows[0].total.toFixed(2)}** is currently pending payment.`;

      } else if (lowerMsg.includes('total paid') || lowerMsg.includes('earnings') || lowerMsg.includes('revenue')) {
        const [hourlyPaid, fixedPaid] = await Promise.all([
          pool.query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM time_logs WHERE freelancer_id = $1 AND payment_status = 'paid'`, [userId]),
          pool.query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM fixed_monthly_payments WHERE freelancer_id = $1 AND status = 'paid'`, [userId])
        ]);
        const grandTotal = hourlyPaid.rows[0].total + fixedPaid.rows[0].total;
        reply = `💰 **Total Paid Earnings**: **$${grandTotal.toFixed(2)}** received across your agency.`;

      } else if (lowerMsg.includes('unpaid') || lowerMsg.includes('outstanding')) {
        const [hourlyUnpaid, fixedUnpaid] = await Promise.all([
          pool.query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM time_logs WHERE freelancer_id = $1 AND payment_status = 'unpaid'`, [userId]),
          pool.query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM fixed_monthly_payments WHERE freelancer_id = $1 AND status = 'unpaid'`, [userId])
        ]);
        const grandUnpaid = hourlyUnpaid.rows[0].total + fixedUnpaid.rows[0].total;
        reply = `⚠️ **Total Outstanding / Unpaid**: **$${grandUnpaid.toFixed(2)}** is currently pending across all client accounts.`;

      } else {
        // Default Help Prompt if query isn't matched
        reply = `Hello ${userName}! I am your QFA database assistant. You can ask me structured queries like:\n` +
                `• "Total number of clients"\n` +
                `• "Total due from fixed"\n` +
                `• "Total due from hourly"\n` +
                `• "Total paid"\n` +
                `• "Total unpaid"`;
      }

    } else {
      // 🔒 CLIENT ISOLATION
      const [clientLogs, clientInvoices] = await Promise.all([
        pool.query(`SELECT SUM(amount)::float AS total FROM time_logs WHERE client_id = $1 AND payment_status = 'unpaid'`, [userId]),
        pool.query(`SELECT SUM(amount)::float AS total FROM fixed_monthly_payments WHERE client_id = $1 AND status = 'unpaid'`, [userId])
      ]);
      
      const unpaidLogs = clientLogs.rows[0].total || 0;
      const unpaidInvoices = clientInvoices.rows[0].total || 0;

      if (lowerMsg.includes('due') || lowerMsg.includes('unpaid')) {
        reply = `⏳ Hello ${userName}! Your total outstanding due is **$${(unpaidLogs + unpaidInvoices).toFixed(2)}**.`;
      } else {
        reply = `Hello ${userName}! You can ask me about your account status, such as "Total due" or "My invoices".`;
      }
    }

    res.json({ success: true, reply });

  } catch (e) { 
    next(e); 
  }
});

module.exports = router;
