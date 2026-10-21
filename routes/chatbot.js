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

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toFixed(2); }

// Match any of these keywords anywhere in the message
function has(msg, ...terms) {
  return terms.some(t => msg.includes(t));
}

// ─── FREELANCER HANDLER ─────────────────────────────────────────────────────
async function handleFreelancer(userId, userName, lowerMsg) {

  // ── HELP / GREETING ──────────────────────────────────────────────────────
  if (has(lowerMsg, 'help', 'hello', 'hi ', 'what can', 'commands', 'menu')) {
    return `👋 Hi **${userName}**! Here's what you can ask me:\n\n` +
      `**💰 Earnings**\n` +
      `• "Total paid earnings" · "This month earnings" · "Last month earnings"\n` +
      `• "Best earning month" · "Earnings by month"\n\n` +
      `**⏳ Outstanding**\n` +
      `• "Total unpaid" · "Fixed due" · "Hourly due"\n` +
      `• "Who owes the most" · "All unpaid clients"\n\n` +
      `**👥 Clients**\n` +
      `• "How many clients" · "Active clients" · "Fixed clients" · "Hourly clients"\n` +
      `• "Client summary" · "Top client"\n\n` +
      `**📋 Logs & Work**\n` +
      `• "Total hours this month" · "Total hours logged"\n` +
      `• "Recent logs" · "Upcoming bookings"\n\n` +
      `**📊 Reports**\n` +
      `• "Payment summary" · "This month summary" · "Overdue summary"`;
  }

  // ── THIS MONTH SUMMARY ────────────────────────────────────────────────────
  if (has(lowerMsg, 'this month summary', 'monthly summary', 'summary this month', 'month overview')) {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const first = `${month}-01`;
    const last  = `${month}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}`;

    const [hours, hourlyEarned, hourlyUnpaid, fixedRes] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(hours),0)::float AS h FROM time_logs WHERE freelancer_id=$1 AND date>=$2 AND date<=$3`, [userId, first, last]),
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS t FROM time_logs WHERE freelancer_id=$1 AND date>=$2 AND date<=$3 AND payment_status='paid'`, [userId, first, last]),
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS t FROM time_logs WHERE freelancer_id=$1 AND date>=$2 AND date<=$3 AND (payment_status='unpaid' OR payment_status IS NULL)`, [userId, first, last]),
      pool.query(`SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0)::float AS p, COALESCE(SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END),0)::float AS u FROM fixed_monthly_payments WHERE freelancer_id=$1 AND month=$2`, [userId, month])
    ]);

    const fixedPaid   = fixedRes.rows[0].p;
    const fixedUnpaid = fixedRes.rows[0].u;
    const totalPaid   = hourlyEarned.rows[0].t + fixedPaid;
    const totalUnpaid = hourlyUnpaid.rows[0].t + fixedUnpaid;

    return `📊 **${month} Summary**\n\n` +
      `⏱ Hours logged: **${Number(hours.rows[0].h).toFixed(1)}h**\n` +
      `💵 Paid: **$${fmt(totalPaid)}** (hourly $${fmt(hourlyEarned.rows[0].t)} + fixed $${fmt(fixedPaid)})\n` +
      `⏳ Unpaid: **$${fmt(totalUnpaid)}** (hourly $${fmt(hourlyUnpaid.rows[0].t)} + fixed $${fmt(fixedUnpaid)})\n` +
      `📦 Expected total: **$${fmt(totalPaid + totalUnpaid)}**`;
  }

  // ── LAST MONTH EARNINGS ───────────────────────────────────────────────────
  if (has(lowerMsg, 'last month', 'previous month')) {
    const now  = new Date();
    const d    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const first = `${month}-01`;
    const last  = `${month}-${String(new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()).padStart(2,'0')}`;

    const [hPaid, hUnpaid, fixedRes] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS t FROM time_logs WHERE freelancer_id=$1 AND date>=$2 AND date<=$3 AND payment_status='paid'`, [userId, first, last]),
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS t FROM time_logs WHERE freelancer_id=$1 AND date>=$2 AND date<=$3 AND (payment_status='unpaid' OR payment_status IS NULL)`, [userId, first, last]),
      pool.query(`SELECT COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0)::float AS p, COALESCE(SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END),0)::float AS u FROM fixed_monthly_payments WHERE freelancer_id=$1 AND month=$2`, [userId, month])
    ]);

    const totalPaid   = hPaid.rows[0].t + fixedRes.rows[0].p;
    const totalUnpaid = hUnpaid.rows[0].t + fixedRes.rows[0].u;
    return `📅 **Last Month (${month})**\n` +
      `💵 Paid: **$${fmt(totalPaid)}**\n` +
      `⏳ Unpaid: **$${fmt(totalUnpaid)}**\n` +
      `📦 Total billed: **$${fmt(totalPaid + totalUnpaid)}**`;
  }

  // ── THIS MONTH EARNINGS ───────────────────────────────────────────────────
  if (has(lowerMsg, 'this month earning', 'earned this month', 'income this month')) {
    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const first = `${month}-01`;
    const last  = `${month}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}`;

    const [hPaid, fixedPaid] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS t FROM time_logs WHERE freelancer_id=$1 AND date>=$2 AND date<=$3 AND payment_status='paid'`, [userId, first, last]),
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS t FROM fixed_monthly_payments WHERE freelancer_id=$1 AND month=$2 AND status='paid'`, [userId, month])
    ]);

    const total = hPaid.rows[0].t + fixedPaid.rows[0].t;
    return `💰 **Earnings this month (${month})**: **$${fmt(total)}** received so far ` +
      `(hourly: $${fmt(hPaid.rows[0].t)}, fixed: $${fmt(fixedPaid.rows[0].t)}).`;
  }

  // ── TOTAL PAID EARNINGS (all time) ────────────────────────────────────────
  if (has(lowerMsg, 'total paid', 'total earning', 'all time earning', 'lifetime earning', 'overall earning', 'revenue')) {
    const [h, f] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM time_logs WHERE freelancer_id=$1 AND payment_status='paid'`, [userId]),
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM fixed_monthly_payments WHERE freelancer_id=$1 AND status='paid'`, [userId])
    ]);
    const total = h.rows[0].t + f.rows[0].t;
    return `💰 **All-Time Paid Earnings**: **$${fmt(total)}** total received\n` +
      `  └ Hourly: $${fmt(h.rows[0].t)} · Fixed: $${fmt(f.rows[0].t)}`;
  }

  // ── EARNINGS BY MONTH (breakdown list) ────────────────────────────────────
  if (has(lowerMsg, 'earnings by month', 'monthly breakdown', 'month by month', 'per month')) {
    const { rows } = await pool.query(`
      SELECT month_str, SUM(amount_num)::float AS earned
      FROM (
        SELECT TO_CHAR(date,'YYYY-MM') AS month_str, amount::numeric AS amount_num FROM time_logs WHERE freelancer_id=$1 AND payment_status='paid'
        UNION ALL
        SELECT month, amount::numeric FROM fixed_monthly_payments WHERE freelancer_id=$1 AND status='paid'
      ) x
      GROUP BY month_str ORDER BY month_str DESC LIMIT 6
    `, [userId]);

    if (!rows.length) return `No paid earnings on record yet.`;
    const lines = rows.map(r => `  ${r.month_str}: **$${fmt(r.earned)}**`).join('\n');
    return `📈 **Earnings by Month** (last 6 paid months):\n${lines}`;
  }

  // ── BEST EARNING MONTH ────────────────────────────────────────────────────
  if (has(lowerMsg, 'best month', 'highest earning', 'most revenue', 'best earning')) {
    const { rows } = await pool.query(`
      SELECT month_str, SUM(amount_num)::float AS earned
      FROM (
        SELECT TO_CHAR(date,'YYYY-MM') AS month_str, amount::numeric AS amount_num FROM time_logs WHERE freelancer_id=$1 AND payment_status='paid'
        UNION ALL
        SELECT month, amount::numeric FROM fixed_monthly_payments WHERE freelancer_id=$1 AND status='paid'
      ) x
      GROUP BY month_str ORDER BY earned DESC LIMIT 1
    `, [userId]);

    if (!rows.length) return `No paid earnings on record yet.`;
    return `🏆 **Best Month**: **${rows[0].month_str}** — **$${fmt(rows[0].earned)}** received.`;
  }

  // ── TOTAL UNPAID (all) ────────────────────────────────────────────────────
  if (has(lowerMsg, 'total unpaid', 'total due', 'total outstanding', 'total owed', 'how much unpaid', 'how much is owed')) {
    const [h, f] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(t.amount::numeric),0)::float AS t
        FROM time_logs t
        LEFT JOIN client_contracts cc ON cc.client_id=t.client_id AND cc.freelancer_id=t.freelancer_id
          AND cc.effective_from<=t.date AND (cc.effective_to IS NULL OR cc.effective_to>=t.date)
        WHERE t.freelancer_id=$1 AND (t.payment_status='unpaid' OR t.payment_status IS NULL)
          AND (cc.status IS NULL OR cc.status='active')
      `, [userId]),
      pool.query(`
        SELECT COALESCE(SUM(f.amount::numeric),0)::float AS t
        FROM fixed_monthly_payments f
        LEFT JOIN clients c ON c.user_id=f.client_id AND c.freelancer_id=f.freelancer_id
        LEFT JOIN client_contracts cc ON cc.client_id=c.id AND cc.freelancer_id=f.freelancer_id
          AND cc.effective_from<=(f.month||'-28')::date AND (cc.effective_to IS NULL OR cc.effective_to>=(f.month||'-01')::date)
        WHERE f.freelancer_id=$1 AND f.status='unpaid'
          AND (cc.status IS NULL OR cc.status='active')
      `, [userId])
    ]);
    const total = h.rows[0].t + f.rows[0].t;
    return `⏳ **Total Unpaid**: **$${fmt(total)}**\n` +
      `  └ Hourly: $${fmt(h.rows[0].t)} · Fixed: $${fmt(f.rows[0].t)}`;
  }

  // ── FIXED DUE ─────────────────────────────────────────────────────────────
  if (has(lowerMsg, 'fixed due', 'fixed unpaid', 'due from fixed', 'fixed outstanding')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(f.amount::numeric),0)::float AS t
      FROM fixed_monthly_payments f
      LEFT JOIN clients c ON c.user_id=f.client_id AND c.freelancer_id=f.freelancer_id
      LEFT JOIN client_contracts cc ON cc.client_id=c.id AND cc.freelancer_id=f.freelancer_id
        AND cc.effective_from<=(f.month||'-28')::date AND (cc.effective_to IS NULL OR cc.effective_to>=(f.month||'-01')::date)
      WHERE f.freelancer_id=$1 AND f.status='unpaid'
        AND (cc.status IS NULL OR cc.status='active')
    `, [userId]);
    return `📋 **Fixed Contracts Unpaid**: **$${fmt(rows[0].t)}** outstanding across active fixed monthly records.`;
  }

  // ── HOURLY DUE ────────────────────────────────────────────────────────────
  if (has(lowerMsg, 'hourly due', 'hourly unpaid', 'due from hourly', 'hourly outstanding')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(t.amount::numeric),0)::float AS t
      FROM time_logs t
      LEFT JOIN client_contracts cc ON cc.client_id=t.client_id AND cc.freelancer_id=t.freelancer_id
        AND cc.effective_from<=t.date AND (cc.effective_to IS NULL OR cc.effective_to>=t.date)
      WHERE t.freelancer_id=$1 AND (t.payment_status='unpaid' OR t.payment_status IS NULL)
        AND (cc.status IS NULL OR cc.status='active')
    `, [userId]);
    return `⏱️ **Hourly Work Unpaid**: **$${fmt(rows[0].t)}** pending from active hourly logs.`;
  }

  // ── WHO OWES THE MOST / ALL UNPAID CLIENTS ────────────────────────────────
  if (has(lowerMsg, 'who owes', 'owes the most', 'most overdue', 'most outstanding', 'highest due', 'all unpaid client', 'unpaid clients')) {
    const limit = has(lowerMsg, 'all unpaid', 'all clients') ? 20 : 5;
    const { rows } = await pool.query(`
      SELECT u.name, u.company,
        COALESCE((SELECT SUM(amount::numeric) FROM time_logs WHERE client_id=u.id AND freelancer_id=$1 AND (payment_status='unpaid' OR payment_status IS NULL)),0)::float AS hourly_due,
        COALESCE((SELECT SUM(amount::numeric) FROM fixed_monthly_payments WHERE client_id=u.id AND freelancer_id=$1 AND status='unpaid'),0)::float AS fixed_due
      FROM clients c
      JOIN users u ON u.id=c.user_id
      WHERE c.freelancer_id=$1
      HAVING (
        COALESCE((SELECT SUM(amount::numeric) FROM time_logs WHERE client_id=u.id AND freelancer_id=$1 AND (payment_status='unpaid' OR payment_status IS NULL)),0) +
        COALESCE((SELECT SUM(amount::numeric) FROM fixed_monthly_payments WHERE client_id=u.id AND freelancer_id=$1 AND status='unpaid'),0)
      ) > 0
      GROUP BY u.name, u.company
      ORDER BY (hourly_due+fixed_due) DESC
      LIMIT $2
    `, [userId, limit]);

    if (!rows.length) return `✅ All clients are fully paid up — no outstanding balances!`;
    const lines = rows.map((r,i) => {
      const total = r.hourly_due + r.fixed_due;
      const name  = r.company ? `${r.name} (${r.company})` : r.name;
      return `  ${i+1}. **${name}** — $${fmt(total)}`;
    }).join('\n');
    return `⚠️ **Clients with Outstanding Balances**:\n${lines}`;
  }

  // ── OVERDUE SUMMARY (breakdown per client) ────────────────────────────────
  if (has(lowerMsg, 'overdue summary', 'outstanding summary', 'unpaid summary')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company, c.rate_type,
        COALESCE((SELECT SUM(amount::numeric) FROM time_logs WHERE client_id=u.id AND freelancer_id=$1 AND (payment_status='unpaid' OR payment_status IS NULL)),0)::float AS hourly_due,
        COALESCE((SELECT SUM(amount::numeric) FROM fixed_monthly_payments WHERE client_id=u.id AND freelancer_id=$1 AND status='unpaid'),0)::float AS fixed_due
      FROM clients c
      JOIN users u ON u.id=c.user_id
      WHERE c.freelancer_id=$1
      ORDER BY (
        COALESCE((SELECT SUM(amount::numeric) FROM time_logs WHERE client_id=u.id AND freelancer_id=$1 AND (payment_status='unpaid' OR payment_status IS NULL)),0)+
        COALESCE((SELECT SUM(amount::numeric) FROM fixed_monthly_payments WHERE client_id=u.id AND freelancer_id=$1 AND status='unpaid'),0)
      ) DESC
    `, [userId]);

    const withDue = rows.filter(r => (r.hourly_due + r.fixed_due) > 0);
    if (!withDue.length) return `✅ No outstanding balances across any client!`;

    const lines = withDue.map(r => {
      const total = r.hourly_due + r.fixed_due;
      const name  = r.company ? `${r.name} (${r.company})` : r.name;
      const detail = r.rate_type === 'fixed'
        ? `fixed $${fmt(r.fixed_due)}`
        : `hourly $${fmt(r.hourly_due)}`;
      return `  • **${name}**: $${fmt(total)} (${detail})`;
    }).join('\n');

    const grandTotal = withDue.reduce((s,r) => s + r.hourly_due + r.fixed_due, 0);
    return `📋 **Overdue Summary** — Total: **$${fmt(grandTotal)}**\n${lines}`;
  }

  // ── TOP CLIENT (most earned) ──────────────────────────────────────────────
  if (has(lowerMsg, 'top client', 'best client', 'highest paying', 'most paid client')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company,
        COALESCE((SELECT SUM(amount::numeric) FROM time_logs WHERE client_id=u.id AND freelancer_id=$1 AND payment_status='paid'),0)::float AS h,
        COALESCE((SELECT SUM(amount::numeric) FROM fixed_monthly_payments WHERE client_id=u.id AND freelancer_id=$1 AND status='paid'),0)::float AS f
      FROM clients c
      JOIN users u ON u.id=c.user_id
      WHERE c.freelancer_id=$1
      ORDER BY (h+f) DESC LIMIT 1
    `, [userId]);

    if (!rows.length || (rows[0].h + rows[0].f) === 0)
      return `No paid earnings from clients yet.`;

    const r = rows[0];
    const name = r.company ? `${r.name} (${r.company})` : r.name;
    return `⭐ **Top Client**: **${name}** — **$${fmt(r.h+r.f)}** paid in total ` +
      `(hourly: $${fmt(r.h)}, fixed: $${fmt(r.f)}).`;
  }

  // ── CLIENT SUMMARY (all clients with totals) ──────────────────────────────
  if (has(lowerMsg, 'client summary', 'all clients summary', 'clients overview')) {
    const { rows } = await pool.query(`
      SELECT u.name, c.rate_type,
        COALESCE((SELECT SUM(amount::numeric) FROM time_logs WHERE client_id=u.id AND freelancer_id=$1 AND payment_status='paid'),0)::float AS paid,
        COALESCE((SELECT SUM(amount::numeric) FROM fixed_monthly_payments WHERE client_id=u.id AND freelancer_id=$1 AND status='paid'),0)::float AS fixed_paid,
        COALESCE((SELECT SUM(amount::numeric) FROM time_logs WHERE client_id=u.id AND freelancer_id=$1 AND (payment_status='unpaid' OR payment_status IS NULL)),0)::float AS unpaid,
        COALESCE((SELECT SUM(amount::numeric) FROM fixed_monthly_payments WHERE client_id=u.id AND freelancer_id=$1 AND status='unpaid'),0)::float AS fixed_unpaid
      FROM clients c
      JOIN users u ON u.id=c.user_id
      WHERE c.freelancer_id=$1
      ORDER BY u.name
    `, [userId]);

    if (!rows.length) return `No clients found.`;
    const lines = rows.map(r => {
      const p = r.paid + r.fixed_paid, u = r.unpaid + r.fixed_unpaid;
      return `  • **${r.name}** [${r.rate_type}] — Paid: $${fmt(p)} · Due: $${fmt(u)}`;
    }).join('\n');
    return `👥 **Client Summary**:\n${lines}`;
  }

  // ── HOW MANY CLIENTS ──────────────────────────────────────────────────────
  if (has(lowerMsg, 'how many client', 'total clients', 'number of clients', 'client count')) {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE c.rate_type='fixed')::int AS fixed,
        COUNT(*) FILTER (WHERE c.rate_type='hourly')::int AS hourly
      FROM clients c WHERE c.freelancer_id=$1
    `, [userId]);
    const r = rows[0];
    return `👥 **Your Clients**: **${r.total}** total\n  └ Fixed: ${r.fixed} · Hourly: ${r.hourly}`;
  }

  // ── ACTIVE CLIENTS ────────────────────────────────────────────────────────
  if (has(lowerMsg, 'active client', 'current client', 'active now')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company, c.rate_type
      FROM clients c
      JOIN users u ON u.id=c.user_id
      JOIN client_contracts cc ON cc.client_id=c.id AND cc.freelancer_id=c.freelancer_id
        AND cc.status='active' AND cc.effective_to IS NULL
      WHERE c.freelancer_id=$1
      ORDER BY u.name
    `, [userId]);
    if (!rows.length) return `No clients with active open-ended contracts found.`;
    const lines = rows.map(r => `  • **${r.name}**${r.company ? ` (${r.company})` : ''} [${r.rate_type}]`).join('\n');
    return `✅ **Active Clients** (${rows.length}):\n${lines}`;
  }

  // ── FIXED CLIENTS ─────────────────────────────────────────────────────────
  if (has(lowerMsg, 'fixed client', 'fixed rate client')) {
    const { rows } = await pool.query(`
      SELECT u.name, c.fixed_price
      FROM clients c JOIN users u ON u.id=c.user_id
      WHERE c.freelancer_id=$1 AND c.rate_type='fixed'
      ORDER BY u.name
    `, [userId]);
    if (!rows.length) return `No fixed-rate clients found.`;
    const lines = rows.map(r => `  • **${r.name}** — $${fmt(r.fixed_price)}/mo`).join('\n');
    return `📋 **Fixed-Rate Clients** (${rows.length}):\n${lines}`;
  }

  // ── HOURLY CLIENTS ────────────────────────────────────────────────────────
  if (has(lowerMsg, 'hourly client', 'hourly rate client')) {
    const { rows } = await pool.query(`
      SELECT u.name, c.hourly_rate
      FROM clients c JOIN users u ON u.id=c.user_id
      WHERE c.freelancer_id=$1 AND c.rate_type='hourly'
      ORDER BY u.name
    `, [userId]);
    if (!rows.length) return `No hourly-rate clients found.`;
    const lines = rows.map(r => `  • **${r.name}** — $${fmt(r.hourly_rate)}/hr`).join('\n');
    return `⏱ **Hourly-Rate Clients** (${rows.length}):\n${lines}`;
  }

  // ── HOURS THIS MONTH ──────────────────────────────────────────────────────
  if (has(lowerMsg, 'hours this month', 'logged this month', 'time this month', 'hours logged this')) {
    const now   = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const first = `${month}-01`;
    const last  = `${month}-${String(new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()).padStart(2,'0')}`;

    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(hours),0)::float AS h, COUNT(*)::int AS cnt
      FROM time_logs WHERE freelancer_id=$1 AND date>=$2 AND date<=$3
    `, [userId, first, last]);
    return `⏱ **Hours This Month (${month})**: **${Number(rows[0].h).toFixed(1)} hrs** across ${rows[0].cnt} log entries.`;
  }

  // ── TOTAL HOURS (all time) ────────────────────────────────────────────────
  if (has(lowerMsg, 'total hours', 'hours logged', 'all hours', 'hours overall')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(hours),0)::float AS h, COUNT(*)::int AS cnt
      FROM time_logs WHERE freelancer_id=$1
    `, [userId]);
    return `⏱ **Total Hours Logged**: **${Number(rows[0].h).toFixed(1)} hrs** across ${rows[0].cnt} entries.`;
  }

  // ── RECENT LOGS ───────────────────────────────────────────────────────────
  if (has(lowerMsg, 'recent log', 'latest log', 'last log', 'recent work', 'recent task')) {
    const { rows } = await pool.query(`
      SELECT t.date, u.name AS client, t.hours, t.task_description, t.payment_status
      FROM time_logs t JOIN users u ON u.id=t.client_id
      WHERE t.freelancer_id=$1
      ORDER BY t.date DESC, t.created_at DESC LIMIT 5
    `, [userId]);
    if (!rows.length) return `No time logs found yet.`;
    const lines = rows.map(r =>
      `  • **${r.date.toISOString().slice(0,10)}** — ${r.client}: ${r.hours}h — ${r.task_description?.slice(0,40)}… [${r.payment_status}]`
    ).join('\n');
    return `📋 **Recent 5 Logs**:\n${lines}`;
  }

  // ── UPCOMING BOOKINGS ─────────────────────────────────────────────────────
  if (has(lowerMsg, 'booking', 'schedule', 'upcoming', 'appointment', 'meeting')) {
    const { rows } = await pool.query(`
      SELECT b.date, b.time_slot, u.name AS client, b.note, b.status
      FROM bookings b JOIN users u ON u.id=b.client_id
      WHERE b.freelancer_id=$1 AND b.date>=NOW()::date AND b.status!='cancelled'
      ORDER BY b.date, b.time_slot LIMIT 5
    `, [userId]);
    if (!rows.length) return `📅 No upcoming bookings scheduled.`;
    const lines = rows.map(r =>
      `  • **${r.date.toISOString().slice(0,10)}** ${r.time_slot||''} — ${r.client}${r.note ? ` (${r.note})` : ''} [${r.status}]`
    ).join('\n');
    return `📅 **Upcoming Bookings** (${rows.length}):\n${lines}`;
  }

  // ── PAYMENT SUMMARY ───────────────────────────────────────────────────────
  if (has(lowerMsg, 'payment summary', 'payment status', 'payment overview')) {
    const [h, f] = await Promise.all([
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN payment_status='paid' THEN amount ELSE 0 END)::numeric,0)::float AS paid,
          COALESCE(SUM(CASE WHEN payment_status='unpaid' OR payment_status IS NULL THEN amount ELSE 0 END)::numeric,0)::float AS unpaid
        FROM time_logs WHERE freelancer_id=$1
      `, [userId]),
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END)::numeric,0)::float AS paid,
          COALESCE(SUM(CASE WHEN status='unpaid' THEN amount ELSE 0 END)::numeric,0)::float AS unpaid
        FROM fixed_monthly_payments WHERE freelancer_id=$1
      `, [userId])
    ]);

    const totalPaid   = h.rows[0].paid   + f.rows[0].paid;
    const totalUnpaid = h.rows[0].unpaid + f.rows[0].unpaid;
    const grandTotal  = totalPaid + totalUnpaid;
    const pct = grandTotal > 0 ? ((totalPaid / grandTotal) * 100).toFixed(0) : 0;

    return `💳 **Payment Summary (All Time)**\n` +
      `✅ Paid:   **$${fmt(totalPaid)}**  (hourly $${fmt(h.rows[0].paid)} + fixed $${fmt(f.rows[0].paid)})\n` +
      `⏳ Unpaid: **$${fmt(totalUnpaid)}**  (hourly $${fmt(h.rows[0].unpaid)} + fixed $${fmt(f.rows[0].unpaid)})\n` +
      `📦 Total billed: **$${fmt(grandTotal)}** — ${pct}% collected`;
  }

  // ── PAUSED / TERMINATED CLIENTS ───────────────────────────────────────────
  if (has(lowerMsg, 'paused client', 'terminated client', 'inactive client', 'paused contract', 'on hold')) {
    const { rows } = await pool.query(`
      SELECT u.name, u.company, cc.status, cc.effective_from, cc.effective_to
      FROM client_contracts cc
      JOIN clients c ON c.id=cc.client_id AND c.freelancer_id=cc.freelancer_id
      JOIN users u ON u.id=c.user_id
      WHERE cc.freelancer_id=$1 AND cc.status IN ('paused','terminated')
      ORDER BY cc.effective_from DESC
    `, [userId]);
    if (!rows.length) return `No paused or terminated contracts found.`;
    const lines = rows.map(r => {
      const name = r.company ? `${r.name} (${r.company})` : r.name;
      const since = r.effective_from ? r.effective_from.toISOString().slice(0,10) : '?';
      return `  • **${name}** — ${r.status} since ${since}`;
    }).join('\n');
    return `⏸ **Paused / Terminated Contracts** (${rows.length}):\n${lines}`;
  }

  // ── DEFAULT FALLBACK ──────────────────────────────────────────────────────
  return `🤖 I didn't quite understand that. Type **"help"** to see everything I can answer, or try:\n` +
    `• "Total unpaid" · "This month summary"\n` +
    `• "Who owes the most" · "Client summary"\n` +
    `• "Total hours this month" · "Payment summary"`;
}

// ─── CLIENT HANDLER ──────────────────────────────────────────────────────────
async function handleClient(userId, userName, lowerMsg) {
  if (has(lowerMsg, 'help', 'hello', 'hi ', 'what can', 'commands')) {
    return `👋 Hi **${userName}**! You can ask me:\n` +
      `• "My total due" — all outstanding balance\n` +
      `• "My unpaid invoices" — itemized unpaid\n` +
      `• "My paid history" — what you've paid\n` +
      `• "My hours" — logged work hours\n` +
      `• "My last invoice" — most recent entry`;
  }

  if (has(lowerMsg, 'total due', 'how much do i owe', 'outstanding', 'balance', 'unpaid')) {
    const [h, f] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM time_logs WHERE client_id=$1 AND (payment_status='unpaid' OR payment_status IS NULL)`, [userId]),
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM fixed_monthly_payments WHERE client_id=$1 AND status='unpaid'`, [userId])
    ]);
    const total = h.rows[0].t + f.rows[0].t;
    if (total === 0) return `✅ **${userName}**, you have no outstanding balance. All paid up!`;
    return `⏳ **${userName}**, your total outstanding is **$${fmt(total)}**\n` +
      `  └ Hourly work: $${fmt(h.rows[0].t)} · Fixed: $${fmt(f.rows[0].t)}`;
  }

  if (has(lowerMsg, 'paid', 'payment history', 'what i paid', 'already paid')) {
    const [h, f] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM time_logs WHERE client_id=$1 AND payment_status='paid'`, [userId]),
      pool.query(`SELECT COALESCE(SUM(amount::numeric),0)::float AS t FROM fixed_monthly_payments WHERE client_id=$1 AND status='paid'`, [userId])
    ]);
    const total = h.rows[0].t + f.rows[0].t;
    return `✅ **Total Paid**: **$${fmt(total)}** to date\n` +
      `  └ Hourly: $${fmt(h.rows[0].t)} · Fixed: $${fmt(f.rows[0].t)}`;
  }

  if (has(lowerMsg, 'my hours', 'hours logged', 'how many hours')) {
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(hours),0)::float AS h, COUNT(*)::int AS cnt
      FROM time_logs WHERE client_id=$1
    `, [userId]);
    return `⏱ **Your Hours**: **${Number(rows[0].h).toFixed(1)} hrs** logged across ${rows[0].cnt} entries.`;
  }

  if (has(lowerMsg, 'last invoice', 'recent invoice', 'latest log', 'last log')) {
    const { rows } = await pool.query(`
      SELECT date, hours, amount, task_description, payment_status
      FROM time_logs WHERE client_id=$1
      ORDER BY date DESC, created_at DESC LIMIT 1
    `, [userId]);
    if (!rows.length) return `No log entries found yet.`;
    const r = rows[0];
    return `🧾 **Last Log Entry**:\n` +
      `  Date: ${r.date.toISOString().slice(0,10)}\n` +
      `  Hours: ${r.hours}h — $${fmt(r.amount)}\n` +
      `  Status: ${r.payment_status}\n` +
      `  Task: ${r.task_description?.slice(0,60)}`;
  }

  return `🤖 I didn't quite catch that. Type **"help"** for what I can answer, or ask "Total due" or "My paid history".`;
}

// ─── MAIN ROUTE ──────────────────────────────────────────────────────────────
router.post('/', verifyUserToken, async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const userId   = req.user.id;
    const userRole = req.user.role;
    const userName = req.user.name || 'User';
    const lowerMsg = message.toLowerCase().trim();

    const reply = userRole === 'freelancer'
      ? await handleFreelancer(userId, userName, lowerMsg)
      : await handleClient(userId, userName, lowerMsg);

    res.json({ success: true, reply });
  } catch (e) {
    console.error('[chatbot]', e);
    next(e);
  }
});

module.exports = router;
