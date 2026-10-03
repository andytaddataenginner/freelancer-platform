const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// ── GET /api/contracts/:clientId — full contract history ──────
router.get('/:clientId', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT cc.*,
             u.name AS client_name,
             u.company AS client_company
      FROM client_contracts cc
      JOIN users u ON u.id = cc.client_id
      WHERE cc.client_id = $1 AND cc.freelancer_id = $2
      ORDER BY cc.effective_from DESC, cc.id DESC
    `, [req.params.clientId, req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// ── GET /api/contracts/:clientId/current — active/current contract ────
router.get('/:clientId/current', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM client_contracts
      WHERE client_id = $1 AND freelancer_id = $2
        AND effective_to IS NULL
      ORDER BY effective_from DESC, id DESC
      LIMIT 1
    `, [req.params.clientId, req.user.id]);
    res.json(rows[0] || null);
  } catch (e) { next(e); }
});

// ── POST /api/contracts/:clientId/change — log a rate change ─
router.post('/:clientId/change', requireFreelancer, async (req, res, next) => {
  try {
    const { rate_type, hourly_rate, fixed_price, effective_from, note } = req.body;
    if (!rate_type || !effective_from)
      return res.status(400).json({ error: 'rate_type and effective_from required' });

    const clientId     = parseInt(req.params.clientId);
    const freelancerId = req.user.id;

    await pool.query('BEGIN');
    try {
      // 1. Close current open contract
      await pool.query(`
        UPDATE client_contracts
        SET effective_to = $1::date - INTERVAL '1 day'
        WHERE client_id = $2 AND freelancer_id = $3
          AND effective_to IS NULL
      `, [effective_from, clientId, freelancerId]);

      // 2. Insert new active contract
      const { rows } = await pool.query(`
        INSERT INTO client_contracts
          (client_id, freelancer_id, rate_type, hourly_rate, fixed_price, status, effective_from, note)
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
        RETURNING *
      `, [clientId, freelancerId, rate_type,
          hourly_rate || null, fixed_price || null,
          effective_from, note || null]);

      // 3. Keep base clients table synced
      await pool.query(`
        UPDATE clients
        SET rate_type=$1, hourly_rate=$2, fixed_price=$3
        WHERE user_id=$4 AND freelancer_id=$5
      `, [rate_type, hourly_rate || null, fixed_price || null, clientId, freelancerId]);

      await pool.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

// ── POST /api/contracts/:clientId/pause — pause contract ──
router.post('/:clientId/pause', requireFreelancer, async (req, res, next) => {
  try {
    const { effective_from, note } = req.body;
    const clientId     = parseInt(req.params.clientId);
    const freelancerId = req.user.id;
    const from = effective_from || new Date().toISOString().slice(0, 10);

    await pool.query('BEGIN');
    try {
      const cur = await pool.query(`
        SELECT * FROM client_contracts
        WHERE client_id=$1 AND freelancer_id=$2 AND effective_to IS NULL
        ORDER BY effective_from DESC, id DESC LIMIT 1
      `, [clientId, freelancerId]);

      if (!cur.rows.length) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'No active contract found' });
      }
      const current = cur.rows[0];
      if (current.status === 'paused' || current.status === 'terminated') {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: `Contract is already ${current.status}` });
      }

      await pool.query(`
        UPDATE client_contracts SET effective_to = $1::date - INTERVAL '1 day'
        WHERE id = $2
      `, [from, current.id]);

      const { rows } = await pool.query(`
        INSERT INTO client_contracts
          (client_id, freelancer_id, rate_type, hourly_rate, fixed_price, status, effective_from, note)
        VALUES ($1,$2,$3,$4,$5,'paused',$6,$7) RETURNING *
      `, [clientId, freelancerId, current.rate_type,
          current.hourly_rate, current.fixed_price, from,
          note || 'Contract paused']);

      await pool.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

// ── POST /api/contracts/:clientId/resume — resume contract ───
router.post('/:clientId/resume', requireFreelancer, async (req, res, next) => {
  try {
    const { effective_from, note } = req.body;
    const clientId     = parseInt(req.params.clientId);
    const freelancerId = req.user.id;
    const from = effective_from || new Date().toISOString().slice(0, 10);

    await pool.query('BEGIN');
    try {
      const cur = await pool.query(`
        SELECT * FROM client_contracts
        WHERE client_id=$1 AND freelancer_id=$2 AND effective_to IS NULL
        ORDER BY effective_from DESC, id DESC LIMIT 1
      `, [clientId, freelancerId]);

      if (!cur.rows.length || cur.rows[0].status !== 'paused') {
        await pool.query('ROLLBACK');
        return res.status(400).json({ error: 'No paused contract to resume' });
      }
      const current = cur.rows[0];

      await pool.query(`
        UPDATE client_contracts SET effective_to = $1::date - INTERVAL '1 day'
        WHERE id = $2
      `, [from, current.id]);

      const { rows } = await pool.query(`
        INSERT INTO client_contracts
          (client_id, freelancer_id, rate_type, hourly_rate, fixed_price, status, effective_from, note)
        VALUES ($1,$2,$3,$4,$5,'active',$6,$7) RETURNING *
      `, [clientId, freelancerId, current.rate_type,
          current.hourly_rate, current.fixed_price, from,
          note || 'Contract resumed']);

      await pool.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

// ── POST /api/contracts/:clientId/terminate — terminate contract ─
router.post('/:clientId/terminate', requireFreelancer, async (req, res, next) => {
  try {
    const { effective_from, note } = req.body;
    const clientId     = parseInt(req.params.clientId);
    const freelancerId = req.user.id;
    const from = effective_from || new Date().toISOString().slice(0, 10);

    await pool.query('BEGIN');
    try {
      const cur = await pool.query(`
        SELECT * FROM client_contracts
        WHERE client_id=$1 AND freelancer_id=$2 AND effective_to IS NULL
        ORDER BY effective_from DESC, id DESC LIMIT 1
      `, [clientId, freelancerId]);

      if (!cur.rows.length) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'No open contract to terminate' });
      }

      await pool.query(`
        UPDATE client_contracts SET effective_to = $1::date - INTERVAL '1 day'
        WHERE id = $2
      `, [from, cur.rows[0].id]);

      const { rows } = await pool.query(`
        INSERT INTO client_contracts
          (client_id, freelancer_id, rate_type, hourly_rate, fixed_price,
           status, effective_from, note)
        VALUES ($1,$2,$3,$4,$5,'terminated',$6,$7) RETURNING *
      `, [clientId, freelancerId, cur.rows[0].rate_type,
          cur.rows[0].hourly_rate, cur.rows[0].fixed_price,
          from, note || 'Contract terminated']);

      await pool.query('COMMIT');
      res.status(201).json(rows[0]);
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  } catch (e) { next(e); }
});

module.exports = router;
