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
      // 🛡️ ADMIN (Anduamlak) — Precise Table Queries

      // 1. Total Number of Clients
      if (lowerMsg.includes('total number of clients') || lowerMsg.includes('how many clients') || lowerMsg.includes('total clients')) {
        const resDb = await pool.query(`SELECT COUNT(*)::int AS count FROM clients WHERE freelancer_id = $1`, [userId]);
        reply = `👥 **Total Clients**: You have **${resDb.rows[0].count}** registered clients in your agency.`;

      } 
      // 2. Total Due from Fixed (fixed_monthly_payments table where status = 'unpaid')
      else if (lowerMsg.includes('total due from fixed') || lowerMsg.includes('fixed unpaid') || lowerMsg.includes('fixed due')) {
        const resDb = await pool.query(`
          SELECT COALESCE(SUM(amount), 0)::float AS total 
          FROM fixed_monthly_payments fmp
          JOIN clients c ON c.id = fmp.client_id
          WHERE c.freelancer_id = $1 AND fmp.status = 'unpaid'
        `, [userId]);
        reply = `⏳ **Total Due from Fixed Clients**: **$${resDb.rows[0].total.toFixed(2)}** is currently unpaid across fixed monthly records.`;

      } 
      // 3. Total Due from Hourly (time_logs table where payment_status = 'unpaid')
      else if (lowerMsg.includes('total due from hourly') || lowerMsg.includes('hourly unpaid') || lowerMsg.includes('hourly due')) {
        const resDb = await pool.query(`
          SELECT COALESCE(SUM(tl.amount), 0)::float AS total 
          FROM time_logs tl
          JOIN clients c ON c.id = tl.client_id
          WHERE c.freelancer_id = $1 AND tl.payment_status = 'unpaid'
        `, [userId]);
        reply = `⏱️ **Total Due from Hourly Logs**: **$${resDb.rows[0].total.toFixed(2)}** is currently pending from hourly work.`;

      } 
      // 4. Client with Most Overdue / Outstanding Balance
      else if (lowerMsg.includes('most overdue') || lowerMsg.includes('most outstanding') || lowerMsg.includes('owes the most') || lowerMsg.includes('highest due')) {
        const resDb = await pool.query(`
          SELECT c.name, c.company,
            (
              COALESCE((SELECT SUM(tl.amount) FROM time_logs tl WHERE tl.client_id = c.id AND tl.payment_status = 'unpaid'), 0) +
              COALESCE((SELECT SUM(fmp.amount) FROM fixed_monthly_payments fmp WHERE fmp.client_id = c.id AND fmp.status = 'unpaid'), 0)
            )::float AS total_due
          FROM clients c
          WHERE c.freelancer_id = $1
          ORDER BY total_due DESC
          LIMIT 1
        `, [userId]);

        if (resDb.rows.length > 0 && resDb.rows[0].total_due > 0) {
          const row = resDb.rows[0];
          reply = `⚠️ **Top Overdue Client**: **${row.name}**${row.company ? ` (${row.company})` : ''} has the highest outstanding balance of **$${row.total_due.toFixed(2)}**.`;
        } else {
          reply = `✅ Excellent! All clients are fully paid with zero overdue balances.`;
        }

      } 
      // 5. Month with Highest Earnings
      else if (lowerMsg.includes('month') && (lowerMsg.includes('earn') || lowerMsg.includes('highest') || lowerMsg.includes('most revenue') || lowerMsg.includes('best month'))) {
        const resDb = await pool.query(`
          SELECT month, SUM(amount)::float AS total_earned
          FROM (
            SELECT TO_CHAR(date, 'YYYY-MM') AS month, amount FROM time_logs WHERE payment_status = 'paid'
            UNION ALL
            SELECT month, amount FROM fixed_monthly_payments WHERE status = 'paid'
          ) combined
          GROUP BY month
          ORDER BY total_earned DESC
          LIMIT 1
        `);

        if (resDb.rows.length > 0) {
          const row = resDb.rows[0];
          reply = `🏆 **Best Earning Month**: Your highest earning month was **${row.month}** with a total of **$${row.total_earned.toFixed(2)}** received.`;
        } else {
          reply = `No paid earnings records found across months yet.`;
        }

      } 
      // 6. Total Paid Earnings (Across both tables)
      else if (lowerMsg.includes('total paid') || lowerMsg.includes('earnings') || lowerMsg.includes('revenue')) {
        const [hourlyPaid, fixedPaid] = await Promise.all([
          pool.query(`SELECT COALESCE(SUM(tl.amount), 0)::float AS total FROM time_logs tl JOIN clients c ON c.id = tl.client_id WHERE c.freelancer_id = $1 AND tl.payment_status = 'paid'`, [userId]),
          pool.query(`SELECT COALESCE(SUM(fmp.amount), 0)::float AS total FROM fixed_monthly_payments fmp JOIN clients c ON c.id = fmp.client_id WHERE c.freelancer_id = $1 AND fmp.status = 'paid'`, [userId])
        ]);
        const grandTotal = hourlyPaid.rows[0].total + fixedPaid.rows[0].total;
        reply = `💰 **Total Paid Earnings**: **$${grandTotal.toFixed(2)}** received across hourly logs and fixed payments.`;

      } 
      // Default Menu Guide
      else {
        reply = `Hello ${userName}! I am your QFA database assistant. You can ask me advanced stats such as:\n` +
                `• "Total due from fixed"\n` +
                `• "Total due from hourly"\n` +
                `• "Which client has the most overdue"\n` +
                `• "Which month did I earn the most"\n` +
                `• "Total number of clients"`;
      }

    } else {
      // 🔒 CLIENT ISOLATION
      const [clientLogs, clientInvoices] = await Promise.all([
        pool.query(`SELECT SUM(amount)::float AS total FROM time_logs WHERE client_id = $1 AND payment_status = 'unpaid'`, [userId]),
        pool.query(`SELECT SUM(amount)::float AS total FROM fixed_monthly_payments WHERE client_id = $1 AND status = 'unpaid'`, [userId])
      ]);
      
      const unpaidHourly = clientLogs.rows[0].total || 0;
      const unpaidFixed = clientInvoices.rows[0].total || 0;

      if (lowerMsg.includes('due') || lowerMsg.includes('unpaid')) {
        reply = `⏳ Hello ${userName}! Your total outstanding due is **$${(unpaidHourly + unpaidFixed).toFixed(2)}**.`;
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
