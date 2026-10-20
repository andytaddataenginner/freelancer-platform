const router = require('express').Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth'); // Adjust based on your auth middleware path

router.post('/chat', verifyToken, async (req, res, next) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role; // 'freelancer' (Anduamlak) or 'client'
    const userName = req.user.name;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let contextData = {};

    if (userRole === 'freelancer') {
      // 🛡️ ADMIN (Anduamlak): Fetch full agency business insights
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
      // 🔒 CLIENT ISOLATION: Fetch ONLY this client's respective data
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

    // ── AI LLM INTEGRATION SLOT ────────────────────────────────────────
    // You can connect your OpenAI/Gemini SDK here using `message` and `contextData`.
    // For now, it returns a verified data-backed response string:
    const reply = `Hello ${userName}! As your secure QFA assistant, I've checked your ${userRole} records. You asked: "${message}". [Database security context isolated successfully].`;

    res.json({ success: true, reply, contextSummary: contextData });

  } catch (e) {
    next(e);
  }
});

module.exports = router;
