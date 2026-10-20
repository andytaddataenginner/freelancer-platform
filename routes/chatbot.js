const router = require('express').Router();
const pool = require('../db/pool');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');

// Initialize Gemini SDK (Ensure GEMINI_API_KEY is in your Render environment variables)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
      // 1. Total Number of Active Clients
      if (lowerMsg.includes('total number of clients') || lowerMsg.includes('how many clients') || lowerMsg.includes('total clients')) {
        const resDb = await pool.query(`SELECT COUNT(DISTINCT c.user_id)::int AS count FROM clients c WHERE c.freelancer_id = $1 AND c.is_active = true`, [userId]);
        reply = `👥 **Total Active Clients**: You have **${resDb.rows[0].count}** active clients in your agency.`;

      } 
      // 2. Total Due from Fixed
      else if (lowerMsg.includes('total due from fixed') || lowerMsg.includes('fixed unpaid') || lowerMsg.includes('fixed due')) {
        const resDb = await pool.query(`
          SELECT COALESCE(SUM(f.amount::numeric), 0)::float AS total 
          FROM fixed_monthly_payments f
          LEFT JOIN client_contracts cc ON cc.client_id = f.client_id AND cc.freelancer_id = f.freelancer_id
            AND cc.effective_from <= (f.month || '-01')::date AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
          WHERE f.freelancer_id = $1 AND f.status = 'unpaid' AND (cc.status IS NULL OR cc.status = 'active')
        `, [userId]);
        reply = `⏳ **Total Due from Fixed Contracts**: **$${resDb.rows[0].total.toFixed(2)}** is currently unpaid across active fixed monthly records.`;

      } 
      // 3. Total Due from Hourly
      else if (lowerMsg.includes('total due from hourly') || lowerMsg.includes('hourly unpaid') || lowerMsg.includes('hourly due')) {
        const resDb = await pool.query(`
          SELECT COALESCE(SUM(t.amount::numeric), 0)::float AS total 
          FROM time_logs t
          LEFT JOIN client_contracts cc ON cc.client_id = t.client_id AND cc.freelancer_id = t.freelancer_id
            AND cc.effective_from <= t.date AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
          WHERE t.freelancer_id = $1 AND t.payment_status = 'unpaid' AND (cc.status IS NULL OR cc.status = 'active')
        `, [userId]);
        reply = `⏱️ **Total Due from Hourly Logs**: **$${resDb.rows[0].total.toFixed(2)}** is currently pending from active hourly work.`;

      } 
      // 4. Client with Most Overdue
      else if (lowerMsg.includes('most overdue') || lowerMsg.includes('most outstanding') || lowerMsg.includes('owes the most') || lowerMsg.includes('highest due')) {
        const resDb = await pool.query(`
          SELECT u.name, u.company,
            (
              COALESCE((SELECT SUM(t.amount::numeric) FROM time_logs t WHERE t.client_id = u.id AND t.payment_status = 'unpaid'), 0) +
              COALESCE((SELECT SUM(f.amount::numeric) FROM fixed_monthly_payments f WHERE f.client_id = u.id AND f.status = 'unpaid'), 0)
            )::float AS total_due
          FROM clients c JOIN users u ON u.id = c.user_id
          WHERE c.freelancer_id = $1 AND c.is_active = true
          ORDER BY total_due DESC LIMIT 1
        `, [userId]);

        if (resDb.rows.length > 0 && resDb.rows[0].total_due > 0) {
          const row = resDb.rows[0];
          reply = `⚠️ **Top Overdue Client**: **${row.name}**${row.company ? ` (${row.company})` : ''} has the highest outstanding balance of **$${row.total_due.toFixed(2)}**.`;
        } else {
          reply = `✅ Excellent! All client accounts are fully settled with zero overdue balances.`;
        }

      } 
      // 5. Month with Highest Earnings
      else if (lowerMsg.includes('month') && (lowerMsg.includes('earn') || lowerMsg.includes('highest') || lowerMsg.includes('most revenue') || lowerMsg.includes('best month'))) {
        const resDb = await pool.query(`
          SELECT month_str AS month, SUM(amount_num)::float AS total_earned
          FROM (
            SELECT TO_CHAR(t.date, 'YYYY-MM')::text AS month_str, t.amount::numeric AS amount_num FROM time_logs t WHERE t.freelancer_id = $1 AND LOWER(t.payment_status) = 'paid'
            UNION ALL
            SELECT f.month::text AS month_str, f.amount::numeric AS amount_num FROM fixed_monthly_payments f WHERE f.freelancer_id = $1 AND LOWER(f.status) = 'paid'
          ) combined GROUP BY month_str ORDER BY total_earned DESC LIMIT 1
        `, [userId]);

        if (resDb.rows.length > 0) {
          const row = resDb.rows[0];
          reply = `🏆 **Best Earning Month**: Your highest earning month was **${row.month}** with a total of **$${row.total_earned.toFixed(2)}** received.`;
        } else {
          reply = `No paid earnings records found across months yet.`;
        }

      } 
      // 6. Total Paid Earnings
      else if (lowerMsg.includes('total paid') || lowerMsg.includes('earnings') || lowerMsg.includes('revenue')) {
        const [hourlyPaid, fixedPaid] = await Promise.all([
          pool.query(`SELECT COALESCE(SUM(amount::numeric), 0)::float AS total FROM time_logs WHERE freelancer_id = $1 AND LOWER(payment_status) = 'paid'`, [userId]),
          pool.query(`SELECT COALESCE(SUM(amount::numeric), 0)::float AS total FROM fixed_monthly_payments WHERE freelancer_id = $1 AND LOWER(status) = 'paid'`, [userId])
        ]);
        const grandTotal = hourlyPaid.rows[0].total + fixedPaid.rows[0].total;
        reply = `💰 **Total Paid Earnings**: **$${grandTotal.toFixed(2)}** received across hourly logs and fixed payments.`;

      } 
      // 🤖 FALLBACK TO GEMINI AI FOR UNMATCHED QUERIES
      else {
        // Gather quick stats context for the AI
        const [clientCount, totalEarned] = await Promise.all([
          pool.query(`SELECT COUNT(*)::int AS cnt FROM clients WHERE freelancer_id = $1 AND is_active = true`, [userId]),
          pool.query(`SELECT COALESCE(SUM(amount::numeric), 0)::float AS total FROM time_logs WHERE freelancer_id = $1 AND LOWER(payment_status) = 'paid'`, [userId])
        ]);

        const systemPrompt = `You are QFA Assistant, an AI built into Anduamlak's Quick Freelancing Agency dashboard. 
        Context: Active Clients: ${clientCount.rows[0].cnt}, Total Paid: $${totalEarned.rows[0].total}.
        Respond professionally, helpfully, and concisely to the user's custom question.`;

        const aiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [systemPrompt, message]
        });

        reply = aiResponse.text || `Hello ${userName}! I am your QFA assistant. For specific financial queries, try asking about "total clients", "total due from fixed", "total due from hourly", or "most overdue client".`;
      }

    } else {
      // 🔒 CLIENT ISOLATION FALLBACK
      const [clientLogs, clientInvoices] = await Promise.all([
        pool.query(`SELECT COALESCE(SUM(amount::numeric), 0)::float AS total FROM time_logs WHERE client_id = $1 AND LOWER(payment_status) = 'unpaid'`, [userId]),
        pool.query(`SELECT COALESCE(SUM(amount::numeric), 0)::float AS total FROM fixed_monthly_payments WHERE client_id = $1 AND LOWER(status) = 'unpaid'`, [userId])
      ]);
      
      const unpaidHourly = clientLogs.rows[0].total || 0;
      const unpaidFixed = clientInvoices.rows[0].total || 0;

      if (lowerMsg.includes('due') || lowerMsg.includes('unpaid') || lowerMsg.includes('invoice')) {
        reply = `⏳ Hello ${userName}! Your total outstanding due is **$${(unpaidHourly + unpaidFixed).toFixed(2)}**.`;
      } else {
        const clientAiResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [`You are QFA Client Portal Assistant. Client Name: ${userName}, Unpaid Due: $${(unpaidHourly + unpaidFixed).toFixed(2)}. Answer their question professionally.` , message]
        });
        reply = clientAiResponse.text || `Hello ${userName}! You can ask me about your account status or outstanding invoices.`;
      }
    }

    res.json({ success: true, reply });

  } catch (e) { 
    next(e); 
  }
});

module.exports = router;
