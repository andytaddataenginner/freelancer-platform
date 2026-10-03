const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

router.get('/public', async (req, res, next) => {
  try {
    const [clients, projects] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS cnt FROM users WHERE role='client'"),
      pool.query('SELECT COUNT(*)::int AS cnt FROM portfolio_items WHERE is_published=TRUE')
    ]);
    res.json({ clients: clients.rows[0].cnt, projects: projects.rows[0].cnt });
  } catch (e) { next(e); }
});

router.get('/freelancer', requireFreelancer, async (req, res, next) => {
  try {
    const freelancerId = req.user.id;
    const monthParam   = req.query.month;
    let firstOfMonth, lastOfMonth;

    if (monthParam) {
      firstOfMonth = `${monthParam}-01`;
      const [y, m] = monthParam.split('-').map(Number);
      const last   = new Date(y, m, 0);
      lastOfMonth  = `${monthParam}-${String(last.getDate()).padStart(2,'0')}`;
    } else {
      const now    = new Date();
      firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const last   = new Date(now.getFullYear(), now.getMonth()+1, 0);
      lastOfMonth  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`;
    }

    const currentMonth = monthParam || new Date().toISOString().slice(0, 7);

    // ── Auto-generate fixed monthly payments for ACTIVE contracts only ──
    try {
      await pool.query(`
        INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
        SELECT u.id, c.freelancer_id, $1, COALESCE(cc.fixed_price, c.fixed_price), 'unpaid'
        FROM clients c
        JOIN users u ON u.id = c.user_id
        JOIN client_contracts cc ON cc.client_id = c.user_id AND cc.freelancer_id = c.freelancer_id
        WHERE c.freelancer_id = $2
          AND cc.status = 'active'
          AND cc.rate_type = 'fixed'
          AND COALESCE(cc.fixed_price, c.fixed_price) IS NOT NULL
          AND cc.effective_from <= $3::date
          AND (cc.effective_to IS NULL OR cc.effective_to >= $3::date)
        ON CONFLICT (client_id, month) DO NOTHING
      `, [currentMonth, freelancerId, firstOfMonth]);
    } catch (genErr) {
      console.error('[stats/freelancer] fixed-monthly auto-generate failed (non-fatal):', genErr);
    }

    // ── Hourly stats from time_logs (Filter out logs during paused/terminated contracts) ────
    const [hours, tasks, hourlyEarned, hourlyUnpaid, monthClients, bookings] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(t.hours),0)::float AS h 
        FROM time_logs t
        LEFT JOIN client_contracts cc ON cc.client_id = t.client_id 
          AND cc.freelancer_id = t.freelancer_id
          AND cc.effective_from <= t.date
          AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
        WHERE t.freelancer_id=$1 AND t.date>=$2::date AND t.date<=$3::date
          AND (cc.status IS NULL OR cc.status = 'active')
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COUNT(*)::int AS cnt 
        FROM time_logs t
        LEFT JOIN client_contracts cc ON cc.client_id = t.client_id 
          AND cc.freelancer_id = t.freelancer_id
          AND cc.effective_from <= t.date
          AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
        WHERE t.freelancer_id=$1 AND t.date>=$2::date AND t.date<=$3::date
          AND (cc.status IS NULL OR cc.status = 'active')
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COALESCE(SUM(t.amount),0)::float AS total 
        FROM time_logs t
        LEFT JOIN client_contracts cc ON cc.client_id = t.client_id 
          AND cc.freelancer_id = t.freelancer_id
          AND cc.effective_from <= t.date
          AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
        WHERE t.freelancer_id=$1 AND t.date>=$2::date AND t.date<=$3::date AND t.payment_status='paid'
          AND (cc.status IS NULL OR cc.status = 'active')
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COALESCE(SUM(t.amount),0)::float AS total 
        FROM time_logs t
        LEFT JOIN client_contracts cc ON cc.client_id = t.client_id 
          AND cc.freelancer_id = t.freelancer_id
          AND cc.effective_from <= t.date
          AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
        WHERE t.freelancer_id=$1 AND t.date>=$2::date AND t.date<=$3::date 
          AND (t.payment_status='unpaid' OR t.payment_status IS NULL)
          AND (cc.status IS NULL OR cc.status = 'active')
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COUNT(DISTINCT t.client_id)::int AS cnt 
        FROM time_logs t
        LEFT JOIN client_contracts cc ON cc.client_id = t.client_id 
          AND cc.freelancer_id = t.freelancer_id
          AND cc.effective_from <= t.date
          AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
        WHERE t.freelancer_id=$1 AND t.date>=$2::date AND t.date<=$3::date
          AND (cc.status IS NULL OR cc.status = 'active')
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`SELECT COUNT(*)::int AS cnt FROM bookings WHERE freelancer_id=$1 AND date>=NOW()::date AND status!='cancelled'`, [freelancerId]),
    ]);

    // ── Fixed monthly payments for THIS month (Filtered by Active Contract) ──
    const fixedMonthly = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      LEFT JOIN client_contracts cc ON cc.client_id = f.client_id 
        AND cc.freelancer_id = f.freelancer_id
        AND cc.effective_from <= ($2 || '-01')::date
        AND (cc.effective_to IS NULL OR cc.effective_to >= ($2 || '-01')::date)
      WHERE f.freelancer_id = $1 AND f.month = $2
        AND (cc.status IS NULL OR cc.status = 'active')
      ORDER BY u.name
    `, [freelancerId, currentMonth]);

    const fixedPaid   = fixedMonthly.rows.filter(r => r.status === 'paid').reduce((s,r) => s + parseFloat(r.amount), 0);
    const fixedUnpaid = fixedMonthly.rows.filter(r => r.status === 'unpaid').reduce((s,r) => s + parseFloat(r.amount), 0);

    // ── Totals ────────────────────────────────────────────────
    const totalEarned   = parseFloat(hourlyEarned.rows[0].total) + fixedPaid;
    const totalUnpaid   = parseFloat(hourlyUnpaid.rows[0].total) + fixedUnpaid;
    const totalExpected = (totalEarned + totalUnpaid).toFixed(2);

    const allClients   = await pool.query(`SELECT COUNT(*)::int AS cnt FROM clients WHERE freelancer_id=$1`, [freelancerId]);
    const clientsCount = monthClients.rows[0].cnt + fixedMonthly.rows.length;

    // ── Client breakdown ──────────────────────────────────────
    const hourlyBreakdown = await pool.query(`
      SELECT u.name AS client_name, u.company, 'hourly' AS rate_type,
             COALESCE(SUM(t.hours),0)::float AS hours,
             COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.amount ELSE 0 END),0)::float AS paid,
             COALESCE(SUM(CASE WHEN t.payment_status='unpaid' OR t.payment_status IS NULL THEN t.amount ELSE 0 END),0)::float AS unpaid,
             COALESCE(SUM(t.amount),0)::float AS total
      FROM time_logs t
      JOIN users u ON u.id = t.client_id
      LEFT JOIN client_contracts cc ON cc.client_id = t.client_id 
        AND cc.freelancer_id = t.freelancer_id
        AND cc.effective_from <= t.date
        AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
      WHERE t.freelancer_id=$1 AND t.date>=$2::date AND t.date<=$3::date
        AND (cc.status IS NULL OR cc.status = 'active')
      GROUP BY u.name, u.company
      ORDER BY total DESC
    `, [freelancerId, firstOfMonth, lastOfMonth]);

    const fixedBreakdown = fixedMonthly.rows.map(r => ({
      client_name: r.client_name,
      company:     r.client_company,
      rate_type:   'fixed',
      hours:       0,
      paid:        r.status === 'paid'   ? parseFloat(r.amount) : 0,
      unpaid:      r.status === 'unpaid' ? parseFloat(r.amount) : 0,
      total:       parseFloat(r.amount),
      fixed_record_id:     r.id,
      fixed_record_status: r.status,
      fixed_amount:        parseFloat(r.amount),
      paid_at:     r.paid_at,
      note:        r.note
    }));

    const clientBreakdown = [...hourlyBreakdown.rows, ...fixedBreakdown]
      .sort((a, b) => b.total - a.total);

    res.json({
      month:            currentMonth,
      hoursThisMonth:   hours.rows[0].h,
      tasksThisMonth:   tasks.rows[0].cnt,
      totalEarned:      totalEarned.toFixed(2),
      totalUnpaid:      totalUnpaid.toFixed(2),
      totalExpected,
      activeClients:    allClients.rows[0].cnt,
      clientsThisMonth: clientsCount,
      upcomingBookings: bookings.rows[0].cnt,
      clientBreakdown,
      fixedMonthlyRecords: fixedMonthly.rows
    });

  } catch (e) { console.error('Stats error:', e); next(e); }
});

module.exports = router;
