const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// GET /api/timelogs — Returns filtered logs
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, from, to, limit = 200, offset = 0, payment_status } = req.query;
    let where = ['t.freelancer_id = $1'];
    let params = [req.user.id];
    let i = 2;

    if (client_id)      { where.push(`t.client_id = $${i++}`);       params.push(client_id); }
    if (from)           { where.push(`t.date >= $${i++}::date`);      params.push(from); }
    if (to)             { where.push(`t.date <= $${i++}::date`);      params.push(to); }
    if (payment_status) { where.push(`t.payment_status = $${i++}`);   params.push(payment_status); }
    
    const { rows } = await pool.query(`
      SELECT t.*, u.name AS client_name, u.company AS client_company
      FROM time_logs t
      JOIN users u ON u.id = t.client_id
      WHERE ${where.join(' AND ')}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limit, offset]);

    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/timelogs — Write a single transactional tracking row
router.post('/', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, hours, task_description, date, source } = req.body;
    const hrs = parseFloat(hours || 0);

    // Fetch account terms
    const clientRes = await pool.query(
      'SELECT rate_type, hourly_rate, credit_balance FROM clients WHERE user_id=$1 AND freelancer_id=$2',
      [client_id, req.user.id]
    );
    if (!clientRes.rows.length) return res.status(404).json({ error: 'Client relationship profile target missed' });
    const c = clientRes.rows[0];

    let amount = 0;
    let payment_status = 'unpaid';

    if (c.rate_type === 'credit') {
      amount = 0; 
      payment_status = 'paid'; // Deductions bypass manual invoicing metrics
      
      // Update credit ledger pools
      await pool.query(
        'UPDATE clients SET credit_balance = credit_balance - $1 WHERE user_id=$2',
        [hrs, client_id]
      );
    } else if (c.rate_type === 'hourly') {
      amount = hrs * parseFloat(c.hourly_rate || 0);
    } else if (c.rate_type === 'fixed') {
      amount = 0; // Fixed amounts are mapped directly via invoicing route hooks
    }

    const logRes = await pool.query(`
      INSERT INTO time_logs (freelancer_id, client_id, date, hours, amount, payment_status, task_description, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [req.user.id, client_id, date || new Date(), hrs, amount, payment_status, task_description || '', source || 'manual']);

    res.status(201).json(logRes.rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/timelogs/:id/payment — Single-row flag updates
router.patch('/:id/payment', requireFreelancer, async (req, res, next) => {
  try {
    const { payment_status } = req.body;
    await pool.query(
      'UPDATE time_logs SET payment_status=$1 WHERE id=$2 AND freelancer_id=$3',
      [payment_status || 'paid', req.params.id, req.user.id]
    );
    res.json({ message: 'Payment status modified successfully' });
  } catch (e) { next(e); }
});

// PATCH /api/timelogs/bulk-payment — Bulk processing hook
router.patch('/bulk-payment', requireFreelancer, async (req, res, next) => {
  try {
    const { ids, payment_status } = req.body;
    await pool.query(
      'UPDATE time_logs SET payment_status=$1 WHERE id=ANY($2) AND freelancer_id=$3',
      [payment_status || 'paid', ids, req.user.id]
    );
    res.json({ message: 'Updated' });
  } catch (e) { next(e); }
});

// PUT /api/timelogs/:id — Modify structural data parameters and balance sheets
router.put('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { hours, task_description, date, amount } = req.body;

    const oldLog = await pool.query('SELECT client_id, amount, hours FROM time_logs WHERE id=$1', [req.params.id]);
    if (!oldLog.rows.length) return res.status(404).json({ error: 'Not found' });
    
    const client_id = oldLog.rows[0].client_id;
    const oldHours = parseFloat(oldLog.rows[0].hours || 0);

    let finalAmount = amount;
    
    // Auto-calculate billing amounts for standard hourly configurations if not specified
    if (finalAmount === undefined || finalAmount === null) {
      const clientInfo = await pool.query(
        'SELECT c.rate_type, c.hourly_rate FROM clients c WHERE c.user_id=$1',
        [client_id]
      );
      const c = clientInfo.rows[0] || {};
      if (c.rate_type === 'hourly' && c.hourly_rate) {
        finalAmount = parseFloat(hours) * parseFloat(c.hourly_rate);
      } else if (c.rate_type === 'credit') {
        finalAmount = 0;
        const diff = parseFloat(hours) - oldHours;
        // Adjust the client's prepaid credit balance based on the updated time value
        await pool.query(
          'UPDATE clients SET credit_balance = credit_balance - $1 WHERE user_id=$2',
          [diff, client_id]
        );
      } else {
        finalAmount = 0;
      }
    }

    await pool.query(
      `UPDATE time_logs 
       SET hours=$1, task_description=$2, date=$3, amount=$4 
       WHERE id=$5 AND freelancer_id=$6`,
      [hours, task_description, date, finalAmount, req.params.id, req.user.id]
    );
    res.json({ message: 'Updated' });
  } catch (e) { next(e); }
});

module.exports = router;
