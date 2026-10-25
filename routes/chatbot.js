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

// Reusable SQL snippet for active contract date bounds
const activeContractCheckTime = (alias = 't') => `
  EXISTS (
    SELECT 1 FROM client_contracts cc
    WHERE cc.client_id = ${alias}.client_id 
      AND cc.freelancer_id = ${alias}.freelancer_id
      AND cc.status = 'active'
      AND ${alias}.date >= cc.effective_from
      AND (cc.effective_to IS NULL OR ${alias}.date <= cc.effective_to)
  )
`;

const activeContractCheckFixed = (alias = 'f') => `
  EXISTS (
    SELECT 1 FROM client_contracts cc
    WHERE cc.client_id = ${alias}.client_id 
      AND cc.freelancer_id = ${alias}.freelancer_id
      AND cc.status = 'active'
      AND (${alias}.month || '-01')::date >= cc.effective_from
      AND (cc.effective_to IS NULL OR (${alias}.month || '-01')::date <= cc.effective_to)
  )
`;

// ── Freelancer handler ────────────────────────────────────────────────────────
async function handleFreelancer(userId, userName, lowerMsg) {

  if (has(lowerMsg, 'how many clients', 'total clients', 'number of clients', 'client count')) {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT user_id)::int AS count FROM clients WHERE freelancer_id=$1 AND is_active=true`,
      [userId]
    );
    return `👥 **Active Clients**: You currently have **${rows[0].count}** active clients.`;
  }

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

  if (has(lowerMsg, 'top client', 'best client', 'highest paying')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company, SUM(amt)::float AS total
      FROM (
        SELECT t.client_id, t.amount::numeric AS amt
        FROM time_logs t WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='paid' AND ${activeContractCheckTime('t')}
        UNION ALL
        SELECT f.client_id, f.amount::numeric AS amt
        FROM fixed_monthly_payments f WHERE f.freelancer_id=$1 AND LOWER(f.status)='paid' AND ${activeContractCheckFixed('f')}
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

  if (has(lowerMsg, 'fixed due', 'fixed unpaid', 'total due from fixed')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(f.amount::numeric), 0)::float AS total
      FROM fixed_monthly_payments f
      WHERE f.freelancer_id = $1 AND LOWER(f.status) = 'unpaid' AND ${activeContractCheckFixed('f')}
    `, [userId]);
    return `📋 **Fixed Monthly Due**: **$${fmt(rows[0].total)}** outstanding from active contract periods.`;
  }

  if (has(lowerMsg, 'hourly due', 'hourly unpaid', 'total due from hourly')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(t.amount::numeric), 0)::float AS total
      FROM time_logs t
      WHERE t.freelancer_id = $1 AND LOWER(t.payment_status) = 'unpaid' AND ${activeContractCheckTime('t')}
    `, [userId]);
    return `⏱️ **Hourly Logs Due**: **$${fmt(rows[0].total)}** outstanding from active contract periods.`;
  }

  if (has(lowerMsg, 'total unpaid', 'total due', 'total outstanding', 'total owed')) {
    const [hr, fx] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(t.amount::numeric),0)::float AS t 
        FROM time_logs t
        WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='unpaid' AND ${activeContractCheckTime('t')}
      `, [userId]),
      pool.query(`
        SELECT COALESCE(SUM(f.amount::numeric),0)::float AS t 
        FROM fixed_monthly_payments f
        WHERE f.freelancer_id=$1 AND LOWER(f.status)='unpaid' AND ${activeContractCheckFixed('f')}
      `, [userId]),
    ]);
    const total = hr.rows[0].t + fx.rows[0].t;
    return `⏳ **Total Outstanding**: **$${fmt(total)}**\n• Hourly unpaid: $${fmt(hr.rows[0].t)}\n• Fixed unpaid: $${fmt(fx.rows[0].t)}`;
  }

  if (has(lowerMsg, 'owes the most', 'most overdue', 'most outstanding', 'highest due')) {
    const { rows } = await pool.query(`
      SELECT name, company, hourly_due, fixed_due
      FROM (
        SELECT u.name, u.company,
          COALESCE((
            SELECT SUM(t.amount::numeric) FROM time_logs t
            WHERE t.client_id=u.id AND t.freelancer_id=$1 AND LOWER(t.payment_status)='unpaid' AND ${activeContractCheckTime('t')}
          ), 0)::float AS hourly_due,
          COALESCE((
            SELECT SUM(f.amount::numeric) FROM fixed_monthly_payments f
            WHERE f.client_id=u.id AND f.freelancer_id=$1 AND LOWER(f.status)='unpaid' AND ${activeContractCheckFixed('f')}
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

  if (has(lowerMsg, 'overdue summary', 'overdue report')) {
    const { rows } = await pool.query(`
      SELECT name, company, hourly_due, fixed_due
      FROM (
        SELECT u.name, u.company,
          COALESCE((
            SELECT SUM(t.amount::numeric) FROM time_logs t
            WHERE t.client_id=u.id AND t.freelancer_id=$1
              AND LOWER(t.payment_status)='unpaid'
              AND t.date < NOW() - INTERVAL '30 days'
              AND ${activeContractCheckTime('t')}
          ), 0)::float AS hourly_due,
          COALESCE((
            SELECT SUM(f.amount::numeric) FROM fixed_monthly_payments f
            WHERE f.client_id=u.id AND f.freelancer_id=$1
              AND LOWER(f.status)='unpaid'
              AND (f.month || '-28')::date < NOW() - INTERVAL '30 days'
              AND ${activeContractCheckFixed('f')}
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

  if (has(lowerMsg, 'payment summary')) {
    const [hr, fx] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='paid'   THEN t.amount::numeric END),0)::float AS paid,
          COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='unpaid' THEN t.amount::numeric END),0)::float AS unpaid
        FROM time_logs t
        WHERE t.freelancer_id=$1 AND ${activeContractCheckTime('t')}
      `, [userId]),
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(f.status)='paid'   THEN f.amount::numeric END),0)::float AS paid,
          COALESCE(SUM(CASE WHEN LOWER(f.status)='unpaid' THEN f.amount::numeric END),0)::float AS unpaid
        FROM fixed_monthly_payments f
        WHERE f.freelancer_id=$1 AND ${activeContractCheckFixed('f')}
      `, [userId]),
    ]);
    const h = hr.rows[0]; const f = fx.rows[0];
    return (
      `📊 **Payment Summary**\n` +
      `• Total Paid:   **$${fmt(h.paid + f.paid)}** (Hourly: $${fmt(h.paid)}, Fixed: $${fmt(f.paid)})\n` +
      `• Total Unpaid: **$${fmt(h.unpaid + f.unpaid)}** (Hourly: $${fmt(h.unpaid)}, Fixed: $${fmt(f.unpaid)})`
    );
  }

  if (has(lowerMsg, 'this month summary', 'this month', 'current month')) {
    const month = new Date().toISOString().slice(0, 7);
    const [hr, fx] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='paid'   THEN t.amount::numeric END),0)::float AS paid,
          COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='unpaid' THEN t.amount::numeric END),0)::float AS unpaid,
          COALESCE(SUM(t.hours::numeric),0)::float AS hrs
        FROM time_logs t
        WHERE t.freelancer_id=$1 AND TO_CHAR(t.date,'YYYY-MM')=$2 AND ${activeContractCheckTime('t')}
      `, [userId, month]),
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN LOWER(f.status)='paid'   THEN f.amount::numeric END),0)::float AS paid,
          COALESCE(SUM(CASE WHEN LOWER(f.status)='unpaid' THEN f.amount::numeric END),0)::float AS unpaid
        FROM fixed_monthly_payments f
        WHERE f.freelancer_id=$1 AND f.month=$2 AND ${activeContractCheckFixed('f')}
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

  if (has(lowerMsg, 'last month earnings', 'last month')) {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const month = d.toISOString().slice(0, 7);
    const [hr, fx] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(CASE WHEN LOWER(t.payment_status)='paid' THEN t.amount::numeric END),0)::float AS paid 
        FROM time_logs t WHERE t.freelancer_id=$1 AND TO_CHAR(t.date,'YYYY-MM')=$2 AND ${activeContractCheckTime('t')}
      `, [userId, month]),
      pool.query(`
        SELECT COALESCE(SUM(CASE WHEN LOWER(f.status)='paid' THEN f.amount::numeric END),0)::float AS paid 
        FROM fixed_monthly_payments f WHERE f.freelancer_id=$1 AND f.month=$2 AND ${activeContractCheckFixed('f')}
      `, [userId, month]),
    ]);
    const total = hr.rows[0].paid + fx.rows[0].paid;
    return `📅 **Last Month (${month})**: You earned **$${fmt(total)}** in paid income.`;
  }

  if (has(lowerMsg, 'earnings by month', 'monthly earnings', 'breakdown by month')) {
    const { rows } = await pool.query(`
      SELECT month_str AS month, SUM(amount_num)::float AS total
      FROM (
        SELECT TO_CHAR(t.date,'YYYY-MM') AS month_str, t.amount::numeric AS amount_num
        FROM time_logs t WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='paid' AND ${activeContractCheckTime('t')}
        UNION ALL
        SELECT f.month AS month_str, f.amount::numeric AS amount_num
        FROM fixed_monthly_payments f WHERE f.freelancer_id=$1 AND LOWER(f.status)='paid' AND ${activeContractCheckFixed('f')}
      ) combined
      GROUP BY month_str
      ORDER BY month_str DESC
      LIMIT 12
    `, [userId]);
    if (!rows.length) return 'No paid earnings data found yet.';
    const lines = rows.map(r => `• **${r.month}**: $${fmt(r.total)}`).join('\n');
    return `📈 **Earnings by Month** (last 12):\n${lines}`;
  }

  if (has(lowerMsg, 'best earning month', 'best month', 'highest month', 'most revenue')) {
    const { rows } = await pool.query(`
      SELECT month_str AS month, SUM(amount_num)::float AS total
      FROM (
        SELECT TO_CHAR(t.date,'YYYY-MM') AS month_str, t.amount::numeric AS amount_num
        FROM time_logs t WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='paid' AND ${activeContractCheckTime('t')}
        UNION ALL
        SELECT f.month AS month_str, f.amount::numeric AS amount_num
        FROM fixed_monthly_payments f WHERE f.freelancer_id=$1 AND LOWER(f.status)='paid' AND ${activeContractCheckFixed('f')}
      ) combined
      GROUP BY month_str
      ORDER BY total DESC
      LIMIT 1
    `, [userId]);
    if (!rows.length) return 'No paid earnings data found yet.';
    const r = rows[0];
    return `🏆 **Best Earning Month**: **${r.month}** with **$${fmt(r.total)}** earned.`;
  }

  if (has(lowerMsg, 'total paid earnings', 'total paid', 'all-time paid', 'total revenue', 'total earnings', 'earnings')) {
    const [hr, fx] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(t.amount::numeric),0)::float AS t 
        FROM time_logs t WHERE t.freelancer_id=$1 AND LOWER(t.payment_status)='paid' AND ${activeContractCheckTime('t')}
      `, [userId]),
      pool.query(`
        SELECT COALESCE(SUM(f.amount::numeric),0)::float AS t 
        FROM fixed_monthly_payments f WHERE f.freelancer_id=$1 AND LOWER(f.status)='paid' AND ${activeContractCheckFixed('f')}
      `, [userId]),
    ]);
    const total = hr.rows[0].t + fx.rows[0].t;
    return `💰 **All-Time Paid Earnings**: **$${fmt(total)}**\n• Hourly: $${fmt(hr.rows[0].t)}\n• Fixed: $${fmt(fx.rows[0].t)}`;
  }

  if (has(lowerMsg, 'hours this month', 'total hours this month')) {
    const month = new Date().toISOString().slice(0, 7);
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(t.hours::numeric),0)::float AS hrs 
       FROM time_logs t
       WHERE t.freelancer_id=$1 AND TO_CHAR(t.date,'YYYY-MM')=$2 AND ${activeContractCheckTime('t')}`,
      [userId, month]
    );
    return `⏱️ **Hours This Month (${month})**: **${fmt(rows[0].hrs)} hours** logged.`;
  }

  if (has(lowerMsg, 'total hours logged', 'total hours', 'all hours')) {
    const { rows } = await pool.query(
      `SELECT COALESCE(SUM(t.hours::numeric),0)::float AS hrs 
       FROM time_logs t WHERE t.freelancer_id=$1 AND ${activeContractCheckTime('t')}`,
      [userId]
    );
    return `⏱️ **Total Hours Logged**: **${fmt(rows[0].hrs)} hours** across active contract periods.`;
  }

  if (has(lowerMsg, 'recent logs', 'latest logs', 'last logs')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(t.date,'YYYY-MM-DD') AS day, u.name AS client,
             t.hours::float AS hrs, t.amount::float AS amt, t.payment_status AS status
      FROM time_logs t
      JOIN users u ON u.id = t.client_id
      WHERE t.freelancer_id = $1 AND ${activeContractCheckTime('t')}
      ORDER BY t.date DESC LIMIT 5
    `, [userId]);
    if (!rows.length) return 'No time logs found yet.';
    const lines = rows.map(r => `• **${r.day}** — ${r.client}: ${r.hrs}h / $${fmt(r.amt)} [${r.status}]`).join('\n');
    return `📋 **Last 5 Time Logs**:\n${lines}`;
  }

  if (has(lowerMsg, 'upcoming bookings', 'upcoming sessions', 'next sessions')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(b.date,'YYYY-MM-DD') AS day, u.name AS client, b.duration::float AS hrs
      FROM bookings b
      JOIN users u ON u.id = b.client_id
      WHERE b.freelancer_id = $1 AND b.date >= CURRENT_DATE AND ${activeContractCheckTime('b')}
      ORDER BY b.date ASC LIMIT 5
    `, [userId]);
    if (!rows.length) return '📅 No upcoming bookings scheduled under active contracts.';
    const lines = rows.map(r => `• **${r.day}** — ${r.client}: ${r.hrs}h`).join('\n');
    return `📅 **Upcoming Sessions**:\n${lines}`;
  }

  return (
    `Hi ${userName}! 👋 Use the menu on the left to explore your data.\n\n` +
    `You can also type questions like:\n` +
    `• "Total unpaid"\n• "Earnings by month"\n• "Who owes the most"\n` +
    `• "Recent logs"\n• "Client summary"`
  );
}

// ── Client handler (strictly bound to active contract status & effective dates) ─
async function handleClient(userId, userName, lowerMsg) {

  if (has(lowerMsg, 'help', 'what can', 'what do')) {
    return (
      `Hi ${userName}! 👋 Here's what you can ask me:\n\n` +
      `💳 **Billing**\n• "Total unpaid" • "Total paid" • "Billing history"\n• "Fixed invoices" • "Last invoice"\n\n` +
      `⏱️ **Time & Hours**\n• "My hours this month" • "Total hours" • "Recent logs"\n\n` +
      `📅 **Bookings**\n• "Upcoming bookings" • "Booking history"\n\n` +
      `📊 **Reports**\n• "Month I paid most" • "Payment by month" • "My contract"\n\n` +
      `🗂️ **Activity**\n• "Recent activity" • "My tasks"`
    );
  }

  if (has(lowerMsg, 'total unpaid', 'total due', 'how much do i owe', 'outstanding', 'what do i owe')) {
    const [hr, fx] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(t.amount::numeric),0)::float AS t
         FROM time_logs t
         WHERE t.client_id=$1 AND LOWER(t.payment_status)='unpaid' AND ${activeContractCheckTime('t')}`,
        [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(f.amount::numeric),0)::float AS t
         FROM fixed_monthly_payments f
         WHERE f.client_id=$1 AND LOWER(f.status)='unpaid' AND ${activeContractCheckFixed('f')}`,
        [userId]
      ),
    ]);
    const total = hr.rows[0].t + fx.rows[0].t;
    if (total === 0) return `✅ **${userName}**, you have no outstanding balance right now!`;
    return (
      `⏳ **Your Outstanding Balance**: **$${fmt(total)}**\n` +
      `• Hourly work unpaid: $${fmt(hr.rows[0].t)}\n` +
      `• Fixed invoices unpaid: $${fmt(fx.rows[0].t)}`
    );
  }

  if (has(lowerMsg, 'total paid', 'how much have i paid', 'paid so far', 'paid history', 'paid to date')) {
    const [hr, fx] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(t.amount::numeric),0)::float AS t
         FROM time_logs t
         WHERE t.client_id=$1 AND LOWER(t.payment_status)='paid' AND ${activeContractCheckTime('t')}`,
        [userId]
      ),
      pool.query(
        `SELECT COALESCE(SUM(f.amount::numeric),0)::float AS t
         FROM fixed_monthly_payments f
         WHERE f.client_id=$1 AND LOWER(f.status)='paid' AND ${activeContractCheckFixed('f')}`,
        [userId]
      ),
    ]);
    const total = hr.rows[0].t + fx.rows[0].t;
    return (
      `✅ **Total Paid to Date**: **$${fmt(total)}**\n` +
      `• From hourly work: $${fmt(hr.rows[0].t)}\n` +
      `• From fixed invoices: $${fmt(fx.rows[0].t)}`
    );
  }

  if (has(lowerMsg, 'billing history', 'invoice history', 'payment history', 'all invoices')) {
    const { rows } = await pool.query(`
      SELECT day, type, amount, status FROM (
        SELECT TO_CHAR(t.date,'YYYY-MM-DD') AS day, 'Hourly' AS type,
               t.amount::float AS amount, t.payment_status AS status
        FROM time_logs t
        WHERE t.client_id=$1 AND ${activeContractCheckTime('t')}
        UNION ALL
        SELECT (f.month || '-01') AS day, 'Fixed' AS type,
               f.amount::float AS amount, f.status AS status
        FROM fixed_monthly_payments f
        WHERE f.client_id=$1 AND ${activeContractCheckFixed('f')}
      ) all_bills
      ORDER BY day DESC
      LIMIT 10
    `, [userId]);
    if (!rows.length) return 'No billing records found yet.';
    const lines = rows.map(r =>
      `• **${r.day}** [${r.type}] — $${fmt(r.amount)} [${r.status}]`
    ).join('\n');
    return `🧾 **Billing History** (last 10):\n${lines}`;
  }

  if (has(lowerMsg, 'fixed invoice', 'monthly invoice', 'fixed bill', 'fixed invoices')) {
    const { rows } = await pool.query(`
      SELECT f.month, f.amount::float AS amt, f.status
      FROM fixed_monthly_payments f
      WHERE f.client_id=$1 AND ${activeContractCheckFixed('f')}
      ORDER BY f.month DESC LIMIT 12
    `, [userId]);
    if (!rows.length) return 'No fixed invoices found.';
    const lines = rows.map(r => `• **${r.month}** — $${fmt(r.amt)} [${r.status}]`).join('\n');
    return `📋 **Fixed Monthly Invoices** (last 12):\n${lines}`;
  }

  if (has(lowerMsg, 'last invoice', 'latest invoice', 'recent invoice', 'my invoice')) {
    const { rows } = await pool.query(`
      SELECT day, type, amount, status FROM (
        SELECT TO_CHAR(t.date,'YYYY-MM-DD') AS day, 'Hourly' AS type,
               t.amount::float AS amount, t.payment_status AS status
        FROM time_logs t
        WHERE t.client_id=$1 AND ${activeContractCheckTime('t')}
        UNION ALL
        SELECT (f.month || '-01') AS day, 'Fixed' AS type,
               f.amount::float AS amount, f.status AS status
        FROM fixed_monthly_payments f
        WHERE f.client_id=$1 AND ${activeContractCheckFixed('f')}
      ) all_bills
      ORDER BY day DESC LIMIT 1
    `, [userId]);
    if (!rows.length) return 'No invoices found yet.';
    const r = rows[0];
    return `🧾 **Last Invoice**: ${r.day} [${r.type}] — **$${fmt(r.amount)}** [${r.status}]`;
  }

  if (has(lowerMsg, 'hours this month', 'my hours this month')) {
    const month = new Date().toISOString().slice(0, 7);
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(t.hours::numeric),0)::float AS hrs,
             COALESCE(SUM(t.amount::numeric),0)::float AS amt
      FROM time_logs t
      WHERE t.client_id=$1 AND TO_CHAR(t.date,'YYYY-MM')=$2 AND ${activeContractCheckTime('t')}
    `, [userId, month]);
    return (
      `⏱️ **Your Hours — ${month}**:\n` +
      `• Hours logged: **${fmt(rows[0].hrs)} hrs**\n` +
      `• Billed amount: $${fmt(rows[0].amt)}`
    );
  }

  if (has(lowerMsg, 'total hours', 'all hours', 'hours logged', 'my hours')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(t.hours::numeric),0)::float AS hrs,
             COALESCE(SUM(t.amount::numeric),0)::float AS amt
      FROM time_logs t
      WHERE t.client_id=$1 AND ${activeContractCheckTime('t')}
    `, [userId]);
    return (
      `⏱️ **Total Hours on Your Account**:\n` +
      `• Hours logged: **${fmt(rows[0].hrs)} hrs**\n` +
      `• Total billed: $${fmt(rows[0].amt)}`
    );
  }

  if (has(lowerMsg, 'recent logs', 'latest logs', 'time logs', 'my logs')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(t.date,'YYYY-MM-DD') AS day,
             t.hours::float AS hrs, t.amount::float AS amt,
             t.payment_status AS status
      FROM time_logs t
      WHERE t.client_id=$1 AND ${activeContractCheckTime('t')}
      ORDER BY t.date DESC LIMIT 8
    `, [userId]);
    if (!rows.length) return 'No time logs found yet.';
    const lines = rows.map(r =>
      `• **${r.day}** — ${r.hrs}h / $${fmt(r.amt)} [${r.status}]`
    ).join('\n');
    return `📋 **Recent Time Logs**:\n${lines}`;
  }

  if (has(lowerMsg, 'upcoming bookings', 'upcoming sessions', 'next session', 'scheduled')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(b.date,'YYYY-MM-DD') AS day, b.time,
             b.duration::float AS hrs, b.type, b.message
      FROM bookings b
      WHERE b.client_id=$1 AND b.date >= CURRENT_DATE AND ${activeContractCheckTime('b')}
      ORDER BY b.date ASC, b.time ASC LIMIT 5
    `, [userId]);
    if (!rows.length) return '📅 No upcoming sessions scheduled under active contracts.';
    const lines = rows.map(r =>
      `• **${r.day}** at ${r.time} (${r.hrs}h) [${r.type}]` + (r.message ? ` — _${r.message}_` : '')
    ).join('\n');
    return `📅 **Upcoming Sessions**:\n${lines}`;
  }

  if (has(lowerMsg, 'booking history', 'past sessions', 'session history', 'all sessions')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(b.date,'YYYY-MM-DD') AS day, b.time,
             b.duration::float AS hrs, b.type, b.message, b.status
      FROM bookings b
      WHERE b.client_id=$1 AND b.date < CURRENT_DATE AND ${activeContractCheckTime('b')}
      ORDER BY b.date DESC, b.time DESC LIMIT 10
    `, [userId]);
    if (!rows.length) return 'No past sessions found.';
    const lines = rows.map(r =>
      `• **${r.day}** (${r.hrs}h) [${r.type}] — Status: ${r.status}` + (r.message ? ` — _${r.message}_` : '')
    ).join('\n');
    return `📅 **Session History** (last 10):\n${lines}`;
  }

  if (has(lowerMsg, 'month i paid most', 'highest payment month', 'most paid month', 'best month')) {
    const { rows } = await pool.query(`
      SELECT month_str AS month, SUM(amount_num)::float AS total
      FROM (
        SELECT TO_CHAR(t.date,'YYYY-MM') AS month_str, t.amount::numeric AS amount_num
        FROM time_logs t
        WHERE t.client_id=$1 AND LOWER(t.payment_status)='paid' AND ${activeContractCheckTime('t')}
        UNION ALL
        SELECT f.month AS month_str, f.amount::numeric AS amount_num
        FROM fixed_monthly_payments f
        WHERE f.client_id=$1 AND LOWER(f.status)='paid' AND ${activeContractCheckFixed('f')}
      ) combined
      GROUP BY month_str
      ORDER BY total DESC
      LIMIT 1
    `, [userId]);
    if (!rows.length) return 'No paid records found yet.';
    const r = rows[0];
    return `🏆 **Month You Paid Most**: **${r.month}** — total of **$${fmt(r.total)}** paid.`;
  }

  if (has(lowerMsg, 'payment by month', 'monthly payments', 'payments by month', 'month breakdown')) {
    const { rows } = await pool.query(`
      SELECT month_str AS month,
             SUM(CASE WHEN status='paid'   THEN amount_num ELSE 0 END)::float AS paid,
             SUM(CASE WHEN status='unpaid' THEN amount_num ELSE 0 END)::float AS unpaid
      FROM (
        SELECT TO_CHAR(t.date,'YYYY-MM') AS month_str, t.amount::numeric AS amount_num,
               LOWER(t.payment_status) AS status
        FROM time_logs t
        WHERE t.client_id=$1 AND ${activeContractCheckTime('t')}
        UNION ALL
        SELECT f.month AS month_str, f.amount::numeric AS amount_num,
               LOWER(f.status) AS status
        FROM fixed_monthly_payments f
        WHERE f.client_id=$1 AND ${activeContractCheckFixed('f')}
      ) combined
      GROUP BY month_str
      ORDER BY month_str DESC
      LIMIT 12
    `, [userId]);
    if (!rows.length) return 'No payment records found yet.';
    const lines = rows.map(r =>
      `• **${r.month}** — Paid: $${fmt(r.paid)}${r.unpaid > 0 ? ` / Unpaid: $${fmt(r.unpaid)}` : ''}`
    ).join('\n');
    return `📈 **Payments by Month** (last 12):\n${lines}`;
  }

  // C14. My contract details (Fixed JOIN)
  if (has(lowerMsg, 'my contract', 'contract details', 'contract status', 'my rate', 'my plan')) {
    const { rows } = await pool.query(`
      SELECT cc.rate_type, cc.fixed_price, cc.effective_from,
             cc.effective_to, cc.status,
             c.hourly_rate
      FROM client_contracts cc
      JOIN clients c ON c.user_id = cc.client_id
      WHERE cc.client_id = $1
      ORDER BY cc.effective_from DESC
      LIMIT 1
    `, [userId]);
    if (!rows.length) return 'No contract information found for your account.';
    const r = rows[0];
    const rate = r.rate_type === 'fixed'
      ? `Fixed — $${fmt(r.fixed_price)}/month`
      : `Hourly — $${fmt(r.hourly_rate)}/hr`;
    const since = r.effective_from ? r.effective_from.toISOString().slice(0,10) : '—';
    const until = r.effective_to   ? r.effective_to.toISOString().slice(0,10)   : 'ongoing';
    return (
      `📄 **Your Contract**:\n` +
      `• Rate: **${rate}**\n` +
      `• Status: **${r.status}**\n` +
      `• Active from: ${since} → ${until}`
    );
  }

  if (has(lowerMsg, 'recent activity', 'my tasks', 'task history', 'work done', 'activities')) {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(b.date,'YYYY-MM-DD') AS day, b.duration::float AS hrs, b.type, b.message
      FROM bookings b
      WHERE b.client_id=$1 AND b.message IS NOT NULL AND b.message <> '' AND ${activeContractCheckTime('b')}
      ORDER BY b.date DESC LIMIT 8
    `, [userId]);
    if (!rows.length) return 'No task activity messages found yet.';
    const lines = rows.map(r => `• **${r.day}** [${r.type}] (${r.hrs}h) — ${r.message}`).join('\n');
    return `🗂️ **Recent Work Activity**:\n${lines}`;
  }

  return `Hi ${userName}! 👋 Type **"help"** to see everything I can answer about your account.`;
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
