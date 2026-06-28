const router = require('express').Router();
const pool   = require('../db/pool');
const { requireClient } = require('../middleware/auth');

const TYPE_LABELS = { call:'Video call / meeting', review:'Project review', workshop:'Working session', other:'Other' };

// GET /api/client/stats
router.get('/stats', requireClient, async (req, res, next) => {
  try {
    const clientId = req.user.id; // This matches client_id in the time_logs table
    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

    // 1. Select credit_balance along with structural contract parameters
    const clientInfo = await pool.query(
      'SELECT rate_type, hourly_rate, fixed_price, fixed_payment_status, COALESCE(credit_balance, 0)::float AS credit_balance FROM clients WHERE user_id=$1',
      [clientId]
    );
    const c = clientInfo.rows[0] || {};
    const isFixed = c.rate_type === 'fixed';

    let totalPaid=0, totalUnpaid=0, totalHours=0, totalTasks=0, hoursThisMonth=0;

    if (isFixed) {
      const price = parseFloat(c.fixed_price || 0);
      if (c.fixed_payment_status === 'paid') totalPaid = price;
      else totalUnpaid = price;
      
      const hrs = await pool.query(
        'SELECT COALESCE(SUM(hours),0)::float AS h, COUNT(*)::int AS cnt FROM time_logs WHERE client_id=$1',
        [clientId]
      );
      const hrsMonth = await pool.query(
        'SELECT COALESCE(SUM(hours),0)::float AS h FROM time_logs WHERE client_id=$1 AND date >= $2',
        [clientId, firstOfMonth]
      );
      totalHours=hrs.rows[0].h; totalTasks=hrs.rows[0].cnt; hoursThisMonth=hrsMonth.rows[0].h;
    } else {
      const [total, monthly, tasks, paid, unpaid] = await Promise.all([
        pool.query('SELECT COALESCE(SUM(hours),0)::float AS h FROM time_logs WHERE client_id=$1',[clientId]),
        pool.query('SELECT COALESCE(SUM(hours),0)::float AS h FROM time_logs WHERE client_id=$1 AND date >= $2',[clientId, firstOfMonth]),
        pool.query('SELECT COUNT(*)::int AS cnt FROM time_logs WHERE client_id=$1',[clientId]),
        pool.query("SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs WHERE client_id=$1 AND payment_status='paid'",[clientId]),
        pool.query("SELECT COALESCE(SUM(amount),0)::float AS total FROM time_logs WHERE client_id=$1 AND (payment_status='unpaid' OR payment_status IS NULL)",[clientId]),
      ]);
      totalHours=total.rows[0].h; hoursThisMonth=monthly.rows[0].h;
      totalTasks=tasks.rows[0].cnt; totalPaid=paid.rows[0].total; totalUnpaid=unpaid.rows[0].total;
    }

    // 2. Pass data to payload response for frontend card parsing
    res.json({ 
      rateType: c.rate_type || 'hourly', 
      hourlyRate: parseFloat(c.hourly_rate || 0),
      fixedPrice: c.fixed_price || 0, 
      fixedStatus: c.fixed_payment_status || 'unpaid', 
      creditBalance: c.credit_balance || 0,
      totalHours, 
      hoursThisMonth, 
      totalTasks, 
      totalPaid, 
      totalUnpaid 
    });
  } catch (e) { next(e); }
});

// GET /api/client/timelogs
router.get('/timelogs', requireClient, async (req, res, next) => {
  try {
    const clientId = req.user.id;
    const { limit=200, offset=0, from, to } = req.query;
    
    let where=['client_id = $1'], params=[clientId], i=2;
    if (from) { where.push(`date >= $${i++}`); params.push(from); }
    if (to)   { where.push(`date <= $${i++}`); params.push(to); }
    
    const { rows } = await pool.query(
      `SELECT * FROM time_logs WHERE ${where.join(' AND ')} ORDER BY date DESC LIMIT $${i++} OFFSET $${i++}`,
      [...params, limit, offset]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/client/bookings
router.get('/bookings', requireClient, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM bookings WHERE client_id=$1 ORDER BY date DESC, time DESC',
      [req.user.id]
    );
    res.json(rows.map(r => ({ ...r, type_label: TYPE_LABELS[r.type] || r.type })));
  } catch (e) { next(e); }
});

// POST /api/client/bookings
router.post('/bookings', requireClient, async (req, res, next) => {
  try {
    const { date, time, duration, type, message } = req.body;
    if (!date || !time || !type) return res.status(400).json({ error: 'date, time, type required' });

    const clientRow = await pool.query(
      'SELECT freelancer_id FROM clients WHERE user_id=$1',
      [req.user.id]
    );

    if (!clientRow.rows.length || !clientRow.rows[0].freelancer_id) {
      return res.status(404).json({ error: 'No freelancer assigned to this client' });
    }

    const freelancerId = clientRow.rows[0].freelancer_id;

    const { rows } = await pool.query(`
      INSERT INTO bookings (client_id, freelancer_id, date, time, duration, type, message, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *
    `, [req.user.id, freelancerId, date, time, duration||1, type, message||null]);

    res.status(201).json({ ...rows[0], type_label: TYPE_LABELS[rows[0].type] });
  } catch (e) { next(e); }
});

// DELETE /api/client/bookings/:id
router.delete('/bookings/:id', requireClient, async (req, res, next) => {
  try {
    await pool.query(
      "UPDATE bookings SET status='cancelled' WHERE id=$1 AND client_id=$2",
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Cancelled' });
  } catch (e) { next(e); }
});

// GET /api/client/payments/history
router.get('/payments/history', requireClient, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, amount::float, date, notes FROM payments WHERE client_id = $1 ORDER BY date DESC, id DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/client/payments/record
router.post('/payments/record', requireClient, async (req, res, next) => {
  try {
    const { amount, date, notes } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'A valid payment remittance amount greater than zero is required.' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Processing timestamp date value is required.' });
    }

    await pool.query(
      'INSERT INTO payments (client_id, amount, date, notes) VALUES ($1, $2, $3, $4)',
      [req.user.id, parsedAmount, date, notes || null]
    );

    // Updates corporate total cash and increases their available retainer credit pool counter
    await pool.query(
      'UPDATE clients SET total_paid = COALESCE(total_paid, 0) + $1, credit_balance = COALESCE(credit_balance, 0) + $1 WHERE user_id = $2',
      [parsedAmount, req.user.id]
    );

    res.status(201).json({ success: true, message: 'Remittance posting balanced successfully.' });
  } catch (e) { next(e); }
});

module.exports = router;
