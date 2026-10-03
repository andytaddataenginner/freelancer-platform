const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');
const { applyFundsToUnpaidLogs } = require('../utils/creditLedger');

// GET /api/timelogs — Filtered by active contract coverage
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
      LEFT JOIN client_contracts cc ON cc.client_id = t.client_id 
        AND cc.freelancer_id = t.freelancer_id
        AND cc.effective_from <= t.date
        AND (cc.effective_to IS NULL OR cc.effective_to >= t.date)
      WHERE ${where.join(' AND ')}
        AND (cc.status IS NULL OR cc.status = 'active')
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `, [...params, limit, offset]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/timelogs — auto-calculates amount using active contract on log date
router.post('/', requireFreelancer, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { client_id, date, hours, task_description, source = 'manual' } = req.body;
    if (!client_id || !date || !hours || !task_description)
      return res.status(400).json({ error: 'client_id, date, hours, task_description required' });

    // Lookup effective active contract on date
    const contractInfo = await pool.query(`
      SELECT rate_type, hourly_rate, fixed_price, status 
      FROM client_contracts
      WHERE client_id = $1 AND freelancer_id = $2
        AND effective_from <= $3::date
        AND (effective_to IS NULL OR effective_to >= $3::date)
      ORDER BY effective_from DESC, id DESC LIMIT 1
    `, [client_id, req.user.id, date]);

    let rate_type = 'hourly';
    let amount = 0;

    if (contractInfo.rows.length) {
      const c = contractInfo.rows[0];
      rate_type = c.rate_type;
      if (c.status === 'active') {
        if (rate_type === 'hourly' && c.hourly_rate) {
          amount = parseFloat(hours) * parseFloat(c.hourly_rate);
        } else if (rate_type === 'fixed' && c.fixed_price) {
          amount = parseFloat(c.fixed_price);
        }
      }
    } else {
      // Fallback to clients table base row
      const clientInfo = await pool.query(
        'SELECT c.rate_type, c.hourly_rate, c.fixed_price FROM clients c WHERE c.user_id = $1',
        [client_id]
      );
      const c = clientInfo.rows[0] || {};
      rate_type = c.rate_type || 'hourly';
      if (rate_type === 'hourly' && c.hourly_rate) {
        amount = parseFloat(hours) * parseFloat(c.hourly_rate);
      } else if (rate_type === 'fixed' && c.fixed_price) {
        amount = parseFloat(c.fixed_price);
      }
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

// PUT /api/timelogs/:id — recalculate amount with contract rate
router.put('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { hours, task_description, date, amount } = req.body;
    let finalAmount = amount;

    if (finalAmount === undefined || finalAmount === null) {
      const logRow = await pool.query('SELECT client_id, date FROM time_logs WHERE id=$1', [req.params.id]);
      if (logRow.rows.length) {
        const targetDate = date || logRow.rows[0].date;
        const contractInfo = await pool.query(`
          SELECT rate_type, hourly_rate, status 
          FROM client_contracts
          WHERE client_id = $1 AND freelancer_id = $2
            AND effective_from <= $3::date
            AND (effective_to IS NULL OR effective_to >= $3::date)
          ORDER BY effective_from DESC, id DESC LIMIT 1
        `, [logRow.rows[0].client_id, req.user.id, targetDate]);

        if (contractInfo.rows.length && contractInfo.rows[0].status === 'active') {
          const c = contractInfo.rows[0];
          if (c.rate_type === 'hourly' && c.hourly_rate) {
            finalAmount = (parseFloat(hours) * parseFloat(c.hourly_rate)).toFixed(2);
          }
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
