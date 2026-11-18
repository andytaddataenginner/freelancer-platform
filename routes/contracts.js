const router = require('express').Router();
const pool = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function validateChange(body) {
  const { rate_type, hourly_rate, fixed_price, effective_from, note } = body;
  if (!['hourly', 'fixed'].includes(rate_type)) return 'Choose a valid rate type.';
  if (!effective_from || !/^\d{4}-\d{2}-\d{2}$/.test(effective_from) || Number.isNaN(Date.parse(effective_from))) return 'A valid effective date is required.';
  if (!note || !String(note).trim()) return 'Please provide a reason for this contract change.';
  const amount = rate_type === 'hourly' ? hourly_rate : fixed_price;
  if (amount == null || amount === '' || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return rate_type === 'hourly' ? 'Enter a valid hourly rate.' : 'Enter a valid fixed monthly price.';
  }
  return null;
}

function validateAction(body) {
  const { effective_from, note } = body;
  if (!effective_from || !/^\d{4}-\d{2}-\d{2}$/.test(effective_from) || Number.isNaN(Date.parse(effective_from))) return 'A valid effective date is required.';
  if (!note || !String(note).trim()) return 'Please provide a reason for this contract action.';
  return null;
}

router.get('/:clientId', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT cc.*, u.name AS client_name, u.company AS client_company
      FROM client_contracts cc
      JOIN users u ON u.id = cc.client_id
      JOIN clients c ON c.user_id = cc.client_id AND c.freelancer_id = cc.freelancer_id
      WHERE cc.client_id = $1 AND cc.freelancer_id = $2
      ORDER BY cc.effective_from DESC, cc.id DESC
    `, [req.params.clientId, req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/:clientId/current', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM client_contracts
      WHERE client_id = $1 AND freelancer_id = $2 AND effective_to IS NULL
      ORDER BY effective_from DESC, id DESC LIMIT 1
    `, [req.params.clientId, req.user.id]);
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

router.post('/:clientId/change', requireFreelancer, async (req, res, next) => {
  const invalid = validateChange(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const { rate_type, hourly_rate, fixed_price, effective_from, note } = req.body;
  const clientId = Number.parseInt(req.params.clientId, 10);
  if (!Number.isInteger(clientId)) return res.status(400).json({ error: 'Invalid client ID.' });
  try {
    const record = await withTransaction(async db => {
      const owned = await db.query('SELECT user_id FROM clients WHERE user_id=$1 AND freelancer_id=$2 FOR UPDATE', [clientId, req.user.id]);
      if (!owned.rowCount) { const err = new Error('Client not found.'); err.status = 404; throw err; }
      const current = await db.query(`
        SELECT * FROM client_contracts
        WHERE client_id=$1 AND freelancer_id=$2 AND effective_to IS NULL
        ORDER BY effective_from DESC, id DESC LIMIT 1 FOR UPDATE
      `, [clientId, req.user.id]);
      if (!current.rowCount) { const err = new Error('No current contract found to change.'); err.status = 400; throw err; }
      const from = new Date(effective_from + 'T00:00:00Z');
      const start = new Date(current.rows[0].effective_from);
      if (from < new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))) {
        const err = new Error('The effective date cannot be earlier than the current contract start date.'); err.status = 400; throw err;
      }
      await db.query(`
        UPDATE client_contracts SET effective_to = $1::date - INTERVAL '1 day'
        WHERE id=$2
      `, [effective_from, current.rows[0].id]);
      const inserted = await db.query(`
        INSERT INTO client_contracts
          (client_id, freelancer_id, rate_type, hourly_rate, fixed_price, status, effective_from, note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [clientId, req.user.id, rate_type, rate_type === 'hourly' ? Number(hourly_rate) : null, rate_type === 'fixed' ? Number(fixed_price) : null, current.rows[0].status, effective_from, String(note).trim()]);
      await db.query(`
        UPDATE clients SET rate_type=$1, hourly_rate=$2, fixed_price=$3, is_active=$4
        WHERE user_id=$4 AND freelancer_id=$5
      `, [rate_type, rate_type === 'hourly' ? Number(hourly_rate) : null, rate_type === 'fixed' ? Number(fixed_price) : null, current.rows[0].status === 'active', clientId, req.user.id]);
      if (rate_type === 'hourly') {
        await db.query(`
          DELETE FROM fixed_monthly_payments
          WHERE client_id=$1 AND freelancer_id=$2
            AND month >= $3 AND status='unpaid'
        `, [clientId, req.user.id, effective_from.slice(0, 7)]);
      }
      return inserted.rows[0];
    });
    res.status(201).json(record);
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); next(e); }
});

async function changeStatus(req, res, next, action) {
  const invalid = validateAction(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  const clientId = Number.parseInt(req.params.clientId, 10);
  if (!Number.isInteger(clientId)) return res.status(400).json({ error: 'Invalid client ID.' });
  const { effective_from, note } = req.body;
  try {
    const record = await withTransaction(async db => {
      const owned = await db.query('SELECT user_id FROM clients WHERE user_id=$1 AND freelancer_id=$2 FOR UPDATE', [clientId, req.user.id]);
      if (!owned.rowCount) { const err = new Error('Client not found.'); err.status = 404; throw err; }
      const currentResult = action === 'resume'
        ? await db.query(`
            SELECT * FROM client_contracts
            WHERE client_id=$1 AND freelancer_id=$2
            ORDER BY effective_from DESC, id DESC LIMIT 1 FOR UPDATE
          `, [clientId, req.user.id])
        : await db.query(`
            SELECT * FROM client_contracts
            WHERE client_id=$1 AND freelancer_id=$2 AND effective_to IS NULL
            ORDER BY effective_from DESC, id DESC LIMIT 1 FOR UPDATE
          `, [clientId, req.user.id]);
      if (!currentResult.rowCount) { const err = new Error(action === 'resume' ? 'No contract history exists for this client.' : 'No current contract found.'); err.status = 404; throw err; }
      const current = currentResult.rows[0];
      if (action === 'pause' && current.status !== 'active') { const err = new Error('Only an active contract can be paused.'); err.status = 400; throw err; }
      if (action === 'resume' && current.status !== 'paused') { const err = new Error(`The latest contract record is ${current.status}, not paused. Refresh the contract history and check the latest entry before resuming.`); err.status = 400; throw err; }
      if (action === 'terminate' && current.status === 'terminated') { const err = new Error('This contract is already terminated.'); err.status = 400; throw err; }
      const from = new Date(effective_from + 'T00:00:00Z');
      const start = new Date(current.effective_from);
      if (from < new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))) {
        const err = new Error('The effective date cannot be earlier than the current contract period.'); err.status = 400; throw err;
      }
      if (current.effective_to == null) {
        await db.query('UPDATE client_contracts SET effective_to=$1::date - INTERVAL \'1 day\' WHERE id=$2', [effective_from, current.id]);
      }
      const nextStatus = action === 'terminate' ? 'terminated' : action === 'pause' ? 'paused' : 'active';
      const inserted = await db.query(`
        INSERT INTO client_contracts
          (client_id, freelancer_id, rate_type, hourly_rate, fixed_price, status, effective_from, note)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
      `, [clientId, req.user.id, current.rate_type, current.hourly_rate, current.fixed_price, nextStatus, effective_from, String(note).trim()]);
      if (action === 'pause' || action === 'terminate') {
        await db.query(`
          DELETE FROM fixed_monthly_payments
          WHERE client_id=$1 AND freelancer_id=$2
            AND month >= $3 AND status='unpaid'
        `, [clientId, req.user.id, effective_from.slice(0, 7)]);
      }
      await db.query('UPDATE clients SET is_active=$1 WHERE user_id=$2 AND freelancer_id=$3', [nextStatus === 'active', clientId, req.user.id]);
      return inserted.rows[0];
    });
    return res.status(201).json(record);
  } catch (e) { if (e.status) return res.status(e.status).json({ error: e.message }); return next(e); }
}

router.post('/:clientId/pause', requireFreelancer, (req, res, next) => changeStatus(req, res, next, 'pause'));
router.post('/:clientId/resume', requireFreelancer, (req, res, next) => changeStatus(req, res, next, 'resume'));
router.post('/:clientId/terminate', requireFreelancer, (req, res, next) => changeStatus(req, res, next, 'terminate'));

module.exports = router;
