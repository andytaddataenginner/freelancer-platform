const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// Public stats
router.get('/public', async (req, res, next) => {
  try {
    const [clients, projects] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS cnt FROM users WHERE role='client'"),
      pool.query('SELECT COUNT(*)::int AS cnt FROM portfolio_items WHERE is_published=TRUE')
    ]);
    res.json({ clients: clients.rows[0].cnt, projects: projects.rows[0].cnt });
  } catch (e) { next(e); }
});

// Freelancer dashboard stats — filtered by THIS freelancer only
router.get('/freelancer', requireFreelancer, async (req, res, next) => {
  try {
    const freelancerId = req.user.id;
    const monthParam = req.query.month;
    let firstOfMonth, lastOfMonth;

    if (monthParam) {
      firstOfMonth = `${monthParam}-01`;
      const [y, m] = monthParam.split('-').map(Number);
      const last = new Date(y, m, 0);
      lastOfMonth = `${monthParam}-${String(last.getDate()).padStart(2,'0')}`;
    } else {
      const now = new Date();
      firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      const last = new Date(now.getFullYear(), now.getMonth()+1, 0);
      lastOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`;
    }

    // Hourly stats from time_logs — filtered by this freelancer
    const [hours, tasks, hourlyEarned, hourlyUnpaid, monthClients, bookings] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(hours),0)::float AS h FROM time_logs
        WHERE freelancer_id=$1 AND date >= $2::date AND date <= $3::date
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COUNT(*)::int AS cnt FROM time_logs
        WHERE freelancer_id=$1 AND date >= $2::date AND date <= $3::date
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs
        WHERE freelancer_id=$1 AND date >= $2::date AND date <= $3::date
          AND payment_status='paid'
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs
        WHERE freelancer_id=$1 AND date >= $2::date AND date <= $3::date
          AND (payment_status='unpaid' OR payment_status IS NULL)
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COUNT(DISTINCT client_id)::int AS cnt FROM time_logs
        WHERE freelancer_id=$1 AND date >= $2::date AND date <= $3::date
      `, [freelancerId, firstOfMonth, lastOfMonth]),

      pool.query(`
        SELECT COUNT(*)::int AS cnt FROM bookings
        WHERE freelancer_id=$1 AND date >= NOW()::date AND status != 'cancelled'
      `, [freelancerId]),
    ]);

    // Fixed rate clients — only THIS freelancer's fixed clients
    const fixedClients = await pool.query(`
      SELECT u.id, u.name AS client_name, u.company,
             c.fixed_price, c.fixed_payment_status
      FROM clients c
      JOIN users u ON u.id = c.user_id
      WHERE c.rate_type = 'fixed'
        AND c.fixed_price IS NOT NULL
        AND c.fixed_price > 0
        AND c.freelancer_id = $1
    `, [freelancerId]);

    let fixedPaid = 0, fixedUnpaid = 0;
    fixedClients.rows.forEach(fc => {
      if (fc.fixed_payment_status === 'paid') {
        fixedPaid += parseFloat(fc.fixed_price);
      } else {
        fixedUnpaid += parseFloat(fc.fixed_price);
      }
    });

    const totalEarned   = parseFloat(hourlyEarned.rows[0].total) + fixedPaid;
    const totalUnpaid   = parseFloat(hourlyUnpaid.rows[0].total) + fixedUnpaid;
    const totalExpected = (totalEarned + totalUnpaid).toFixed(2);

    // Total clients for THIS freelancer only
    const allClients = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM clients WHERE freelancer_id=$1`,
      [freelancerId]
    );

    const clientsThisMonth = monthClients.rows[0].cnt + fixedClients.rows.length;

    // Per-client breakdown — hourly
    const hourlyBreakdown = await pool.query(`
      SELECT u.name AS client_name, u.company, 'hourly' AS rate_type,
             COALESCE(SUM(t.hours),0)::float AS hours,
             COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.amount ELSE 0 END),0)::float AS paid,
             COALESCE(SUM(CASE WHEN t.payment_status='unpaid' OR t.payment_status IS NULL THEN t.amount ELSE 0 END),0)::float AS unpaid,
             COALESCE(SUM(t.amount),0)::float AS total
      FROM time_logs t
      JOIN users u ON u.id = t.client_id
      JOIN clients c ON c.user_id = t.client_id AND c.freelancer_id = $1
      WHERE t.freelancer_id=$1
        AND t.date >= $2::date AND t.date <= $3::date
      GROUP BY u.name, u.company
      ORDER BY total DESC
    `, [freelancerId, firstOfMonth, lastOfMonth]);

    // Fixed clients breakdown
    const fixedBreakdown = fixedClients.rows.map(fc => ({
      client_name: fc.client_name,
      company:     fc.company,
      rate_type:   'fixed',
      hours:       0,
      paid:        fc.fixed_payment_status === 'paid' ? parseFloat(fc.fixed_price) : 0,
      unpaid:      fc.fixed_payment_status === 'paid' ? 0 : parseFloat(fc.fixed_price),
      total:       parseFloat(fc.fixed_price)
    }));

    const clientBreakdown = [...hourlyBreakdown.rows, ...fixedBreakdown]
      .sort((a, b) => b.total - a.total);

    res.json({
      month:            monthParam || new Date().toISOString().slice(0,7),
      hoursThisMonth:   hours.rows[0].h,
      tasksThisMonth:   tasks.rows[0].cnt,
      totalEarned:      totalEarned.toFixed(2),
      totalUnpaid:      totalUnpaid.toFixed(2),
      totalExpected,
      activeClients:    allClients.rows[0].cnt,
      clientsThisMonth,
      upcomingBookings: bookings.rows[0].cnt,
      clientBreakdown
    });

  } catch (e) {
    console.error('Stats error:', e);
    next(e);
  }
});

module.exports = router;
