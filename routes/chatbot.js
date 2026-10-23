const router = require('express').Router();
const pool   = require('../db/pool');
const jwt    = require('jsonwebtoken');

// ── Auth middleware ───────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = n => Number(n || 0).toFixed(2);
const has = (msg, ...terms) => terms.some(t => msg.includes(t));

// ── Freelancer handler ────────────────────────────────────────────────────────
async function handleFreelancer(userId, userName, lowerMsg) {

  // 1. Client count
  if (has(lowerMsg, 'how many clients', 'total clients', 'number of clients', 'client count')) {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS count FROM clients WHERE freelancer_id=$1 AND is_active=true`,
      [userId]
    );
    return `👥 **Active Clients**: You currently have **${rows[0].count}** active clients.`;
  }

  // 2. Client summary
  if (has(lowerMsg, 'client summary', 'all clients', 'list clients')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company,
        CASE WHEN c.rate_type = 'fixed' THEN 'Fixed' ELSE 'Hourly' END AS type,
        cc.status AS contract_status
      FROM clients c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN LATERAL (
        SELECT status FROM client_contracts
        WHERE client_id = c.user_id AND freelancer_id = c.freelancer_id
          AND effective_from <= CURRENT_DATE
          AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
        ORDER BY effective_from DESC, id DESC LIMIT 1
      ) cc ON true
      WHERE c.freelancer_id = $1 AND c.is_active = true
      ORDER BY u.name
    `, [userId]);
    if (!rows.length) return '👥 No active clients found.';
    const lines = rows.map(r =>
      `• **${r.name}**${r.company ? ` (${r.company})` : ''} — ${r.type}` +
      (r.contract_status ? ` [${r.contract_status}]` : ' [active]')
    ).join('\n');
    return `👥 **Your ${rows.length} Active Client(s)**:\n${lines}`;
  }

  // 3. Active clients only
  if (has(lowerMsg, 'active clients')) {
    const { rows } = await pool.query(`
      SELECT COUNT(DISTINCT c.id)::int AS cnt
      FROM clients c
      JOIN client_contracts cc ON cc.client_id = c.user_id AND cc.freelancer_id = c.freelancer_id
      WHERE c.freelancer_id = $1 AND c.is_active = true 
        AND cc.effective_from <= CURRENT_DATE 
        AND (cc.effective_to IS NULL OR cc.effective_to >= CURRENT_DATE)
        AND cc.status = 'active'
    `, [userId]);
    return `✅ **Active Contracts**: **${rows[0].cnt}** client(s) have an active contract right now.`;
  }

  // 4. Fixed-rate clients
  if (has(lowerMsg, 'fixed clients', 'fixed-rate clients', 'fixed rate clients')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company, c.fixed_price
      FROM clients c
      JOIN users u ON u.id = c.user_id
      WHERE c.freelancer_id = $1 AND c.is_active = true AND c.rate_type = 'fixed'
      ORDER BY u.name
    `, [userId]);
    if (!rows.length) return 'No fixed-rate clients found.';
    const lines = rows.map(r => `• **${r.name}** — $${fmt(r.fixed_price)}/mo`).join('\n');
    return `📋 **Fixed-Rate Clients (${rows.length})**:\n${lines}`;
  }

  // 5. Hourly clients
  if (has(lowerMsg, 'hourly clients', 'hourly rate clients')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company, c.hourly_rate
      FROM clients c
      JOIN users u ON u.id = c.user_id
      WHERE c.freelancer_id = $1 AND c.is_active = true AND c.rate_type = 'hourly'
      ORDER BY u.name
    `, [userId]);
    if (!rows.length) return 'No hourly-rate clients found.';
    const lines = rows.map(r => `• **${r.name}** — $${fmt(r.hourly_rate)}/hr`).join('\n');
    return `⏱️ **Hourly Clients (${rows.length})**:\n${lines}`;
  }

  // 6. Top client (most paid)
  if (has(lowerMsg, 'top client', 'best client', 'highest paying')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company, SUM(amt)::float AS total
      FROM (
        SELECT t.client_id, t.amount::numeric AS amt
        FROM time_logs t WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='paid'
        UNION ALL
        SELECT f.client_id, f.amount::numeric AS amt
        FROM fixed_monthly_payments f WHERE f.freelancer_id=$1 AND LOWER(f.status)='paid'
      ) all_paid
      JOIN users u ON u.id = all_paid.client_id
      GROUP BY u.id, u.name, u.company
      ORDER BY total DESC
      LIMIT 1
    `, [userId]);
    if (!rows.length) return 'No paid records yet to determine top client.';
    const r = rows[0];
    return `🏆 **Top Client**: **${r.name}**${r.company ? ` (${r.company})` : ''} has paid a total of **$${fmt(r.total)}**.`;
  }

  // 7. Paused clients — fixed to use c.user_id correctly
  if (has(lowerMsg, 'paused clients', 'paused contracts', 'on hold')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company
      FROM clients c
      JOIN users u ON u.id = c.user_id
      JOIN LATERAL (
        SELECT status FROM client_contracts
        WHERE client_id = c.user_id AND freelancer_id = c.freelancer_id
          AND effective_from <= CURRENT_DATE
          AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
        ORDER BY effective_from DESC, id DESC LIMIT 1
      ) cc ON true
      WHERE c.freelancer_id = $1 AND c.is_active = true AND cc.status = 'paused'
      ORDER BY u.name
    `, [userId]);
    if (!rows.length) return '✅ No paused contracts right now.';
    const lines = rows.map(r => `• **${r.name}**${r.company ? ` (${r.company})` : ''}`).join('\n');
    return `⏸️ **Paused Contracts (${rows.length})**:\n${lines}`;
  }

  // 8. Fixed due
  if (has(lowerMsg, 'fixed due', 'fixed unpaid', 'total due from fixed')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(f.amount::numeric), 0)::float AS total
      FROM fixed_monthly_payments f
      JOIN client_contracts cc ON cc.client_id = f.client_id 
        AND cc.freelancer_id = f.freelancer_id
        AND cc.effective_from <= (f.month || '-01')::date
        AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
      WHERE f.freelancer_id = $1 AND LOWER(f.status) = 'unpaid'
        AND cc.status = 'active'
    `, [userId]);
    return `📋 **Fixed Monthly Due**: **$${fmt(rows[0].total)}** outstanding from active fixed contracts.`;
  }

  // 9. Hourly due
  if (has(lowerMsg, 'hourly due', 'hourly unpaid', 'total due from hourly')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(t.amount::numeric), 0)::float AS total
      FROM time_logs t
      JOIN client_contracts cc ON cc.client_id = t.client_id 
        AND cc.freelancer_id = t.freelancer_id
        AND cc.effective_from <= t.date
        AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
      WHERE t.freelancer_id = $1 AND LOWER(t.payment_status) = 'unpaid'
        AND cc.status = 'active'
    `, [userId]);
    return `⏱️ **Hourly Logs Due**: **$${fmt(rows[0].total)}** outstanding from active hourly work.`;
  }

  // 10. Total unpaid (combined)
  if (has(lowerMsg, 'total unpaid', 'total due', 'total outstanding', 'total owed')) {
    const [hr, fx] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(t.amount::numeric),0)::float AS t 
        FROM time_logs t
        JOIN client_contracts cc ON cc.client_id = t.client_id AND cc.freelancer_id = t.freelancer_id
          AND cc.effective_from <= t.date AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
        WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='unpaid' AND cc.status='active'
      `, [userId]),
      pool.query(`
        SELECT COALESCE(SUM(f.amount::numeric),0)::float AS t 
        FROM fixed_monthly_payments f
        JOIN client_contracts cc ON cc.client_id = f.client_id AND cc.freelancer_id = f.freelancer_id
          AND cc.effective_from <= (f.month || '-01')::date AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
        WHERE f.freelancer_id=$1 AND LOWER(f.status)='unpaid' AND cc.status='active'
      `, [userId]),
    ]);
    const total = hr.rows[0].t + fx.rows[0].t;
    return `⏳ **Total Outstanding**: **$${fmt(total)}**\n• Hourly unpaid: $${fmt(hr.rows[0].t)}\n• Fixed unpaid: $${fmt(fx.rows[0].t)}`;
  }

  // 11. Who owes the most
  if (has(lowerMsg, 'owes the most', 'most overdue', 'most outstanding', 'highest due')) {
    const { rows } = await pool.query(`
      SELECT name, company, hourly_due, fixed_due
      FROM (
        SELECT u.name, u.company,
          COALESCE((
            SELECT SUM(t.amount::numeric) FROM time_logs t
            JOIN client_contracts cc ON cc.client_id = t.client_id AND cc.freelancer_id = t.freelancer_id
              AND cc.effective_from <= t.date AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
            WHERE t.client_id=u.id AND t.freelancer_id=$1 AND LOWER(t.payment_status)='unpaid' AND cc.status='active'
          ), 0)::float AS hourly_due,
          COALESCE((
            SELECT SUM(f.amount::numeric) FROM fixed_monthly_payments f
            JOIN client_contracts cc ON cc.client_id = f.client_id AND cc.freelancer_id = f.freelancer_id
              AND cc.effective_from <= (f.month || '-01')::date AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
            WHERE f.client_id=u.id AND f.freelancer_id=$1 AND LOWER(f.status)='unpaid' AND cc.status='active'
          ), 0)::float AS fixed_due
        FROM clients c
        JOIN users u ON u.id = c.user_id
        WHERE c.freelancer_id = $1 AND c.is_active = true
      ) sub
      WHERE (hourly_due + fixed_due) > 0
      ORDER BY (hourly_due + fixed_due) DESC
      LIMIT 5
    `, [userId]);
    if (!rows.length) return '✅ All clients are fully paid up under active contracts!';
    const lines = rows.map((r, i) => {
      const total = r.hourly_due + r.fixed_due;
      return `${i + 1}. **${r.name}**${r.company ? ` (${r.company})` : ''} — **$${fmt(total)}** (Hourly: $${fmt(r.hourly_due)}, Fixed: $${fmt(r.fixed_due)})`;
    }).join('\n');
    return `⚠️ **Top Clients by Outstanding Balance**:\n${lines}`;
  }

  // 12. Overdue summary
  if (has(lowerMsg, 'overdue summary', 'overdue report')) {
    const { rows } = await pool.query(`
      SELECT name, company, hourly_due, fixed_due
      FROM (
        SELECT u.name, u.company,
          COALESCE((
            SELECT SUM(t.amount::numeric) FROM time_logs t
            JOIN client_contracts cc ON cc.client_id = t.client_id AND cc.freelancer_id = t.freelancer_id
              AND cc.effective_from <= t.date AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
            WHERE t.client_id=u.id AND t.freelancer_id=$1
              AND LOWER(t.payment_status)='unpaid'
              AND t.date < NOW() - INTERVAL '30 days'
              AND cc.status='active'
          ), 0)::float AS hourly_due,
          COALESCE((
            SELECT SUM(f.amount::numeric) FROM fixed_monthly_payments f
            JOIN client_contracts cc ON cc.client_id = f.client_id AND cc.freelancer_id = f.freelancer_id
              AND cc.effective_from <= (f.month || '-01')::date AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
            WHERE f.client_id=u.id AND f.freelancer_id=$1
              AND LOWER(f.status)='unpaid'
              AND (f.month || '-28')::date < NOW() - INTERVAL '30 days'
              AND cc.status='active'
          ), 0)::float AS fixed_due
        FROM clients c
        JOIN users u ON u.id = c.user_id
        WHERE c.freelancer_id = $1 AND c.is_active = true
      ) sub
      WHERE (hourly_due + fixed_due) > 0
      ORDER BY (hourly_due + fixed_due) DESC
    `, [userId]);
    if (!rows.length) return '✅ No overdue balances (older than 30 days) found.';
    const grandTotal = rows.reduce((s, r) => s + r.hourly_due + r.fixed_due, 0);
    const lines = rows.map(r => `• **${r.name}** — $${fmt(r.hourly_due + r.fixed_due)}`).join('\n');
    return `🚨 **Overdue Summary** (>30 days unpaid):\nTotal: **$${fmt(grandTotal)}**\n${lines}`;
  }

  // 13. Payment summary
  if (has(lowerMsg, 'payment summary')) {
    const [hr, fx] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='paid'   THEN t.amount::numeric END),0)::float AS paid,
          COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='unpaid' THEN t.amount::numeric END),0)::float AS unpaid
        FROM time_logs t
        LEFT JOIN client_contracts cc ON cc.client_id = t.client_id AND cc.freelancer_id = t.freelancer_id
          AND cc.effective_from <= t.date AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
        WHERE t.freelancer_id=$1 AND (LOWER(t.payment_status) = 'paid' OR cc.status = 'active')
      `, [userId]),
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(f.status)='paid'   THEN f.amount::numeric END),0)::float AS paid,
          COALESCE(SUM(CASE WHEN LOWER(f.status)='unpaid' THEN f.amount::numeric END),0)::float AS unpaid
        FROM fixed_monthly_payments f
        LEFT JOIN client_contracts cc ON cc.client_id = f.client_id AND cc.freelancer_id = f.freelancer_id
          AND cc.effective_from <= (f.month || '-01')::date AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
        WHERE f.freelancer_id=$1 AND (LOWER(f.status) = 'paid' OR cc.status = 'active')
      `, [userId]),
    ]);
    const h = hr.rows[0]; const f = fx.rows[0];
    return (
      `📊 **Payment Summary**\n` +
      `• Total Paid:   **$${fmt(h.paid + f.paid)}** (Hourly: $${fmt(h.paid)}, Fixed: $${fmt(f.paid)})\n` +
      `• Total Unpaid: **$${fmt(h.unpaid + f.unpaid)}** (Hourly: $${fmt(h.unpaid)}, Fixed: $${fmt(f.unpaid)})`
    );
  }

  // 14. This month summary
  if (has(lowerMsg, 'this month summary', 'this month', 'current month')) {
    const month = new Date().toISOString().slice(0, 7);
    const [hr, fx] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='paid'   THEN t.amount::numeric END),0)::float AS paid,
          COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='unpaid' THEN t.amount::numeric END),0)::float AS unpaid,
          COALESCE(SUM(t.hours::numeric),0)::float AS hrs
        FROM time_logs t
        JOIN client_contracts cc ON cc.client_id = t.client_id AND cc.freelancer_id = t.freelancer_id
          AND cc.effective_from <= t.date AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
        WHERE t.freelancer_id=$1 AND TO_CHAR(t.date,'YYYY-MM')=$2 AND cc.status='active'
      `, [userId, month]),
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(f.status)='paid'   THEN f.amount::numeric END),0)::float AS paid,
          COALESCE(SUM(CASE WHEN LOWER(f.status)='unpaid' THEN f.amount::numeric END),0)::float AS unpaid
        FROM fixed_monthly_payments f
        JOIN client_contracts cc ON cc.client_id = f.client_id AND cc.freelancer_id = f.freelancer_id
          AND cc.effective_from <= (f.month || '-01')::date AND (cc.effective_to IS NULL OR cc.effective_to >= (f.month || '-01')::date)
        WHERE f.freelancer_id=$1 AND f.month=$2 AND cc.status='active'
      `, [userId, month]),
    ]);
    const h = hr.rows[0]; const f = fx.rows[0];
    return (
      `📅 **${month} Summary**\n` +
      `• Paid:   **$${fmt(h.paid + f.paid)}** (Hourly: $${fmt(h.paid)}, Fixed: $${fmt(f.paid)})\n` +
      `• Unpaid: **$${fmt(h.unpaid + f.unpaid)}** (Hourly: $${fmt(h.unpaid)}, Fixed: $${fmt(f.unpaid)})\n` +
      `• Hours logged: **${fmt(h.hrs)} hrs**`
    );
  }

  // 15. Last month
  if (has(lowerMsg, 'last month earnings', 'last month')) {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const month = d.toISOString().slice(0, 7);
    const [hr, fx] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(CASE WHEN LOWER(payment_status)='paid' THEN amount::numeric END),0)::float AS paid FROM time_logs WHERE freelancer_id=$1 AND TO_CHAR(date,'YYYY-MM')=$2`, [userId, month]),
      pool.query(`SELECT COALESCE(SUM(CASE WHEN LOWER(status)='paid' THEN amount::numeric END),0)::float AS paid FROM fixed_monthly_payments WHERE freelancer_id=$1 AND month=$2`, [userId, month]),
    ]);
    const total = hr.rows[0].paid + fx.rows[0].paid;
    return `📅 **Last Month (${month})**: You earned **$${fmt(total)}** in paid income.`;
  }

  // 16. Earnings by month
  if (has(lowerMsg, 'earnings by month', 'monthly earnings', 'breakdown by month')) {
    const { rows } = await pool.query(`
      SELECT month_str AS month, SUM(amount_num)::float AS total
      FROM (
        SELECT TO_CHAR(t.date,'YYYY-MM') AS month_str, t.amount::numeric AS amount_num
        FROM time_logs t WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='paid'
        UNION ALL
        SELECT f.month AS month_str, f.amount::numeric AS amount_num
        FROM fixed_monthly_payments f WHERE f.freelancer_id=$1 AND LOWER(f.status)='paid'
      ) combined
      GROUP BY month_str
      ORDER BY month_str DESC
      LIMIT 12
    `, [userId]);
    if (!rows.length) return 'No paid earnings data found yet.';
    const lines = rows.map(r => `• **${r.month}**: $${fmt(r.total)}`).join('\n');
    return `📈 **Earnings by Month** (last 12):\n${lines}`;
  }

  // 17. Best earning month
  if (has(lowerMsg, 'best earning month', 'best month', 'highest month', 'most revenue')) {
    const { rows } = await pool.query(`
      SELECT month_str AS month, SUM(amount_num)::float AS total
      FROM (
        SELECT TO_CHAR(t.date,'YYYY-MM') AS month_str, t.amount::numeric AS amount_num
        FROM time_logs t WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='paid'
        UNION ALL
        SELECT f.month AS month_str, f.amount::numeric AS amount_num
        FROM fixed_monthly_payments f WHERE f.freelancer_id=$1 AND LOWER(f.status)='paid'
      ) combined
      GROUP BY month_str
      ORDER BY total DESC
      LIMIT 1
    `, [userId]);
    if (!rows.length) return 'No paid earnings data found yet.';
    const r = rows[0];
    return `🏆 **Best Earning Month**: **${r.month}** with **$${fmt(r.total)}** earned.`;
  }

  // 18. Total paid earnings (all-time)
  if (has(lowerMsg, 'total paid earnings', 'total paid', 'all-time paid', 'total revenue', 'total earnings', 'earnings')) {
    const [hr, fx] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM time_logs WHERE freelancer_id=$1 AND LOWER(payment_status)='paid'`, [userId]),
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM fixed_monthly_payments WHERE freelancer_id=$1 AND LOWER(status)='paid'`, [userId]),
    ]);
    const total = hr.rows[0].t + fx.rows[0].t;
    return `💰 **All-Time Paid Earnings**: **$${fmt(total)}**\n• Hourly: $${fmt(hr.rows[0].t)}\n• Fixed: $${fmt(fx.rows[0].t)}`;
  }

  // 19. Hours this month
  if (has(lowerMsg, 'hours this month', 'total hours this month')) {
    const month = new Date().toISOString().slice(0, 7);
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(t.hours::numeric),0)::float AS hrs 
       FROM time_logs t
       JOIN client_contracts cc ON cc.client_id = t.client_id AND cc.freelancer_id = t.freelancer_id
         AND cc.effective_from <= t.date AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
       WHERE t.freelancer_id=$1 AND TO_CHAR(t.date,'YYYY-MM')=$2 AND cc.status='active'`,
      [userId, month]
    );
    return `⏱️ **Hours This Month (${month})**: **${fmt(rows[0].hrs)} hours** logged.`;
  }

  // 20. Total hours logged
  if (has(lowerMsg, 'total hours logged', 'total hours', 'all hours')) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(hours::numeric),0)::float AS hrs FROM time_logs WHERE freelancer_id=$1`,
      [userId]
    );
    return `⏱️ **Total Hours Logged**: **${fmt(rows[0].hrs)} hours** across all clients.`;
  }

  // 21. Recent logs
  if (has(lowerMsg, 'recent logs', 'latest logs', 'last logs')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(t.date,'YYYY-MM-DD') AS day, u.name AS client,
             t.hours::float AS hrs, t.amount::float AS amt, t.payment_status AS status
      FROM time_logs t
      JOIN users u ON u.id = t.client_id
      WHERE t.freelancer_id = $1
      ORDER BY t.date DESC LIMIT 5
    `, [userId]);
    if (!rows.length) return 'No time logs found yet.';
    const lines = rows.map(r => `• **${r.day}** — ${r.client}: ${r.hrs}h / $${fmt(r.amt)} [${r.status}]`).join('\n');
    return `📋 **Last 5 Time Logs**:\n${lines}`;
  }

  // 22. Upcoming bookings
  if (has(lowerMsg, 'upcoming bookings', 'upcoming sessions', 'next sessions')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(t.date,'YYYY-MM-DD') AS day, u.name AS client, t.hours::float AS hrs
      FROM time_logs t
      JOIN users u ON u.id = t.client_id
      WHERE t.freelancer_id = $1 AND t.date >= CURRENT_DATE
      ORDER BY t.date ASC LIMIT 5
    `, [userId]);
    if (!rows.length) return '📅 No upcoming bookings scheduled.';
    const lines = rows.map(r => `• **${r.day}** — ${r.client}: ${r.hrs}h`).join('\n');
    return `📅 **Upcoming Sessions**:\n${lines}`;
  }

  // Default fallback
  return (
    `Hi ${userName}! 👋 Use the menu on the left to explore your data.\n\n` +
    `You can also type questions like:\n` +
    `• "Total unpaid"\n• "Earnings by month"\n• "Who owes the most"\n` +
    `• "Recent logs"\n• "Client summary"`
  );
}

// ── Client handler ------------------------------------------------------------
async function handleClient(userId, userName, lowerMsg) {

  if (has(lowerMsg, 'help', 'what can')) {
    return `Hi ${userName}! You can ask me:\n• "Total due"\n• "Paid history"\n• "My hours"\n• "Last invoice"`;
  }

  if (has(lowerMsg, 'total due', 'unpaid', 'invoice', 'how much do i owe')) {
    const [hr, fx] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM time_logs WHERE client_id=$1 AND LOWER(payment_status)='unpaid'`, [userId]),
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM fixed_monthly_payments WHERE client_id=$1 AND LOWER(status)='unpaid'`, [userId]),
    ]);
    const total = hr.rows[0].t + fx.rows[0].t;
    return `⏳ **Your Outstanding Balance**: **$${fmt(total)}**\n• Hourly: $${fmt(hr.rows[0].t)}\n• Fixed: $${fmt(fx.rows[0].t)}`;
  }

  if (has(lowerMsg, 'paid history', 'total paid', 'how much have i paid')) {
    const [hr, fx] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM time_logs WHERE client_id=$1 AND LOWER(payment_status)='paid'`, [userId]),
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM fixed_monthly_payments WHERE client_id=$1 AND LOWER(status)='paid'`, [userId]),
    ]);
    const total = hr.rows[0].t + fx.rows[0].t;
    return `✅ **Total Paid to Date**: **$${fmt(total)}**\n• Hourly: $${fmt(hr.rows[0].t)}\n• Fixed: $${fmt(fx.rows[0].t)}`;
  }

  if (has(lowerMsg, 'my hours', 'hours logged', 'time logged')) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(hours::numeric),0)::float AS hrs FROM time_logs WHERE client_id=$1`,
      [userId]
    );
    return `⏱️ **Hours Logged for Your Account**: **${fmt(rows[0].hrs)} hours** total.`;
  }

  if (has(lowerMsg, 'last invoice', 'latest invoice', 'recent invoice')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(date,'YYYY-MM-DD') AS day, amount::float AS amt, payment_status AS status
      FROM time_logs WHERE client_id=$1 ORDER BY date DESC LIMIT 1
    `, [userId]);
    if (!rows.length) return 'No invoices found yet.';
    const r = rows[0];
    return `🧾 **Last Invoice**: ${r.day} — **$${fmt(r.amt)}** [${r.status}]`;
  }

  return `Hi ${userName}! Ask me about your balance, paid history, hours, or invoices.`;
}

// ── Route ---------------------------------------------------------------------
router.post('/', verifyUserToken, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const userId   = req.user.id;
    const userRole = req.user.role;
    const userName = req.user.name || 'User';
    const lowerMsg = message.toLowerCase().trim();

    let reply;
    if (userRole === 'freelancer') {
      reply = await handleFreelancer(userId, userName, lowerMsg);
    } else {
      reply = await handleClient(userId, userName, lowerMsg);
    }

    res.json({ success: true, reply });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
