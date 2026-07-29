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

// GET /api/client/stats — Portal stats endpoint for logged-in clients
router.get('/client/stats', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const clientRes = await pool.query(
      `SELECT id, user_id, rate_type, hourly_rate, fixed_price, credit_balance, total_paid 
       FROM clients WHERE user_id = $1`,
      [userId]
    );

    if (clientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Client record not found' });
    }

    const clientRow = clientRes.rows[0];
    const rateType = clientRow.rate_type || 'hourly';
    const creditBalance = parseFloat(clientRow.credit_balance || 0);

    if (rateType === 'fixed') {
      const fixedPaymentsRes = await pool.query(
        `SELECT amount, status FROM fixed_monthly_payments WHERE client_id = $1`,
        [userId]
      );

      let totalPaid = 0;
      let totalUnpaid = 0;

      fixedPaymentsRes.rows.forEach(p => {
        const amt = parseFloat(p.amount || 0);
        if (p.status === 'paid') totalPaid += amt;
        else totalUnpaid += amt;
      });

      return res.json({
        rateType: 'fixed',
        fixedPrice: parseFloat(clientRow.fixed_price || 0),
        creditBalance: creditBalance,
        totalPaid: totalPaid,
        totalUnpaid: totalUnpaid,
        hourlyRate: 0
      });
    }

    const hourlyLogsRes = await pool.query(
      `SELECT hours, amount, payment_status FROM time_logs WHERE client_id = $1`,
      [userId]
    );

    let totalPaid = 0;
    let totalUnpaid = 0;
    let totalHours = 0;

    hourlyLogsRes.rows.forEach(l => {
      const h = parseFloat(l.hours || 0);
      const amt = parseFloat(l.amount || (h * (clientRow.hourly_rate || 0)));
      totalHours += h;
      if (l.payment_status === 'paid') {
        totalPaid += amt;
      } else {
        totalUnpaid += amt;
      }
    });

    res.json({
      rateType: 'hourly',
      hourlyRate: parseFloat(clientRow.hourly_rate || 0),
      creditBalance: creditBalance,
      totalPaid: totalPaid,
      totalUnpaid: totalUnpaid,
      totalHours: totalHours
    });

  } catch (e) {
    next(e);
  }
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

    await pool.query(`
      INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
      SELECT u.id, c.freelancer_id, $1, c.fixed_price, 'unpaid'
      FROM clients c
      JOIN users u ON u.id = c.user_id
      WHERE c.freelancer_id = $2
        AND c.rate_type = 'fixed'
        AND c.fixed_price IS NOT NULL
      ON CONFLICT (client_id, month) DO NOTHING
    `, [currentMonth, freelancerId]);

    const [hours, tasks, hourlyEarned, hourlyUnpaid, monthClients, bookings] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(hours),0)::float AS h FROM time_logs WHERE freelancer_id=$1 AND date>=$2::date AND date<=$3::date`, [freelancerId, firstOfMonth, lastOfMonth]),
      pool.query(`SELECT COUNT(*)::int AS cnt FROM time_logs WHERE freelancer_id=$1 AND date>=$2::date AND date<=$3::date`, [freelancerId, firstOfMonth, lastOfMonth]),
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs WHERE freelancer_id=$1 AND date>=$2::date AND date<=$3::date AND payment_status='paid'`, [freelancerId, firstOfMonth, lastOfMonth]),
      pool.query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs WHERE freelancer_id=$1 AND date>=$2::date AND date<=$3::date AND (payment_status='unpaid' OR payment_status IS NULL)`, [freelancerId, firstOfMonth, lastOfMonth]),
      pool.query(`SELECT COUNT(DISTINCT client_id)::int AS cnt FROM time_logs WHERE freelancer_id=$1 AND date>=$2::date AND date<=$3::date`, [freelancerId, firstOfMonth, lastOfMonth]),
      pool.query(`SELECT COUNT(*)::int AS cnt FROM bookings WHERE freelancer_id=$1 AND date>=NOW()::date AND status!='cancelled'`, [freelancerId]),
    ]);

    const fixedMonthly = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      WHERE f.freelancer_id = $1 AND f.month = $2
      ORDER BY u.name
    `, [freelancerId, currentMonth]);

    const fixedPaid   = fixedMonthly.rows.filter(r => r.status === 'paid').reduce((s,r) => s + parseFloat(r.amount), 0);
    const fixedUnpaid = fixedMonthly.rows.filter(r => r.status === 'unpaid').reduce((s,r) => s + parseFloat(r.amount), 0);

    const totalEarned   = parseFloat(hourlyEarned.rows[0].total) + fixedPaid;
    const totalUnpaid   = parseFloat(hourlyUnpaid.rows[0].total) + fixedUnpaid;
    const totalExpected = (totalEarned + totalUnpaid).toFixed(2);

    const allClients   = await pool.query(`SELECT COUNT(*)::int AS cnt FROM clients WHERE freelancer_id=$1`, [freelancerId]);
    const clientsCount = monthClients.rows[0].cnt + fixedMonthly.rows.length;

    const hourlyBreakdown = await pool.query(`
      SELECT u.name AS client_name, u.company, 'hourly' AS rate_type,
             COALESCE(SUM(t.hours),0)::float AS hours,
             COALESCE(SUM(CASE WHEN t.payment_status='paid' THEN t.amount ELSE 0 END),0)::float AS paid,
             COALESCE(SUM(CASE WHEN t.payment_status='unpaid' OR t.payment_status IS NULL THEN t.amount ELSE 0 END),0)::float AS unpaid,
             COALESCE(SUM(t.amount),0)::float AS total
      FROM time_logs t
      JOIN users u ON u.id = t.client_id
      WHERE t.freelancer_id=$1 AND t.date>=$2::date AND t.date<=$3::date
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
