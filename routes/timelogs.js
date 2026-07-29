const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer, requireClient } = require('../middleware/auth'); 
const { applyFundsToUnpaidLogs } = require('../utils/creditLedger');

// GET /api/timelogs (or /api/client/timelogs depending on your mount path)
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, from, to, limit = 200, offset = 0, payment_status } = req.query;
    
    // If a specific client_id is requested, check if they are a fixed-rate client
    let targetClientId = client_id || req.user.id;
    const clientCheck = await pool.query(
      `SELECT rate_type FROM clients WHERE user_id = $1 OR id = $1`,
      [targetClientId]
    );
    const rateType = clientCheck.rows[0]?.rate_type || 'hourly';

    // If fixed-rate, seamlessly pull from fixed_monthly_payments mapped to log schema structure
    if (rateType === 'fixed') {
      const { rows } = await pool.query(`
        SELECT f.id, f.client_id, f.month AS date, f.amount, f.status AS payment_status, 
               'Fixed Milestone' AS task_description, 0 AS hours, u.name AS client_name, u.company AS client_company
        FROM fixed_monthly_payments f
        JOIN users u ON u.id = f.client_id
        WHERE f.freelancer_id = $1 ${client_id ? 'AND f.client_id = $2' : ''}
        ORDER BY f.month DESC
      `, client_id ? [req.user.id, client_id] : [req.user.id]);
      return res.json(rows);
    }

    // Otherwise, handle regular hourly time logs
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

// GET /api/client/timelogs (Dedicated client-facing timelogs route)
router.get('/client/timelogs', requireClient, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const clientInfo = await pool.query(
      `SELECT id, rate_type FROM clients WHERE user_id = $1`,
      [userId]
    );
    
    if (clientInfo.rows.length === 0) {
      return res.status(404).json({ error: 'Client record not found' });
    }

    const rateType = clientInfo.rows[0].rate_type || 'hourly';

    if (rateType === 'fixed') {
      const { rows } = await pool.query(
        `SELECT id, client_id, month AS date, amount, status AS payment_status, 'Fixed Milestone' AS task_description, 0 AS hours 
         FROM fixed_monthly_payments 
         WHERE client_id = $1 
         ORDER BY month DESC`,
        [userId]
      );
      return res.json(rows);
    }

    const { rows } = await pool.query(
      `SELECT * FROM time_logs 
       WHERE client_id = $1 
       ORDER BY date DESC, created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// POST /api/timelogs
router.post('/', requireFreelancer, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { client_id, date, hours, task_description, source = 'manual' } = req.body;
    if (!client_id || !date || !hours || !task_description)
      return res.status(400).json({ error: 'client_id, date, hours, task_description required' });

    const clientInfo = await client.query(
      'SELECT c.rate_type, c.hourly_rate, c.fixed_price FROM clients c WHERE c.user_id = $1',
      [client_id]
    );
    const c = clientInfo.rows[0] || {};
    const rate_type = c.rate_type || 'hourly';
    let amount = 0;
    if (rate_type === 'hourly' && c.hourly_rate) {
      amount = parseFloat(hours) * parseFloat(c.hourly_rate);
    } else if (rate_type === 'fixed' && c.fixed_price) {
      amount = parseFloat(c.fixed_price);
    }

    await client.query('BEGIN');

    const { rows } = await client.query(`
      INSERT INTO time_logs (client_id, freelancer_id, date, hours, task_description, source, rate_type, amount, payment_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid') RETURNING *
    `, [client_id, req.user.id, date, hours, task_description, source, rate_type, amount.toFixed(2)]);

    await applyFundsToUnpaidLogs(client, client_id, 0);

    await client.query('COMMIT');

    const finalRes = await pool.query('SELECT * FROM time_logs WHERE id = $1', [rows[0].id]);
    res.status(201).json(finalRes.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

// PATCH /api/timelogs/:id/payment
router.patch('/:id/payment', requireFreelancer, async (req, res, next) => {
  try {
    const { payment_status } = req.body;
    if (!['paid','unpaid'].includes(payment_status))
      return res.status(400).json({ error: 'payment_status must be paid or unpaid' });
    const { rows } = await pool.query(
      'UPDATE time_logs SET payment_status=$1 WHERE id=$2 AND freelancer_id=$3 RETURNING *',
      [payment_status, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Log not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// PATCH /api/timelogs/bulk-payment
router.patch('/bulk-payment', requireFreelancer, async (req, res, next) => {
  try {
    const { ids, payment_status } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ error: 'ids required' });
    await pool.query(
      'UPDATE time_logs SET payment_status=$1 WHERE id=ANY($2) AND freelancer_id=$3',
      [payment_status || 'paid', ids, req.user.id]
    );
    res.json({ message: 'Updated' });
  } catch (e) { next(e); }
});

// PUT /api/timelogs/:id
router.put('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { hours, task_description, date, amount } = req.body;
    let finalAmount = amount;

    if (finalAmount === undefined || finalAmount === null) {
      const logRow = await pool.query('SELECT client_id FROM time_logs WHERE id=$1', [req.params.id]);
      if (logRow.rows.length) {
        const clientInfo = await pool.query(
          'SELECT c.rate_type, c.hourly_rate, c.fixed_price FROM clients c WHERE c.user_id=$1',
          [logRow.rows[0].client_id]
        );
        const c = clientInfo.rows[0] || {};
        if (c.rate_type === 'hourly' && c.hourly_rate) {
          finalAmount = (parseFloat(hours) * parseFloat(c.hourly_rate)).toFixed(2);
        }
      }
    }

    const { rows } = await pool.query(`
      UPDATE time_logs
      SET hours=$1, task_description=$2, date=$3, amount=COALESCE($4::numeric, amount)
      WHERE id=$5 AND freelancer_id=$6 RETURNING *
    `, [hours, task_description, date, finalAmount || null, req.params.id, req.user.id]);

    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/timelogs/:id
router.delete('/:id', requireFreelancer, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM time_logs WHERE id=$1 AND freelancer_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
