const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

function validMonth(month) {
  return typeof month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

// Select the contract state effective on the first calendar day of the billing month.
// A mid-month resume becomes billable from the following month's first day.
async function generateForFreelancer(db, freelancerId, month, clientId = null) {
  const eligible = await db.query(`
    WITH month_bounds AS (
      SELECT to_date($2 || '-01', 'YYYY-MM-DD') AS month_start,
             (to_date($2 || '-01', 'YYYY-MM-DD') + INTERVAL '1 month - 1 day')::date AS month_end
    ),
    latest_contract AS (
      SELECT DISTINCT ON (cc.client_id)
             cc.client_id, cc.freelancer_id, cc.rate_type, cc.fixed_price, cc.status
      FROM client_contracts cc
      CROSS JOIN month_bounds mb
      WHERE cc.freelancer_id = $1
        AND ($3::bigint IS NULL OR cc.client_id = $3)
        AND cc.effective_from <= mb.month_start
        AND (cc.effective_to IS NULL OR cc.effective_to >= mb.month_start)
      ORDER BY cc.client_id, cc.effective_from DESC, cc.id DESC
    )
    SELECT lc.client_id, lc.fixed_price
    FROM latest_contract lc
    JOIN users u ON u.id = lc.client_id
    CROSS JOIN month_bounds mb
    WHERE lc.status = 'active'
      AND lc.rate_type = 'fixed'
      AND lc.fixed_price IS NOT NULL
      AND mb.month_start >= date_trunc('month', u.created_at)::date
  `, [freelancerId, month, clientId]);

  let created = 0;
  for (const client of eligible.rows) {
    const inserted = await db.query(`
      INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
      VALUES ($1, $2, $3, $4, 'unpaid')
      ON CONFLICT (client_id, month) DO NOTHING
      RETURNING id
    `, [client.client_id, freelancerId, month, client.fixed_price]);
    if (inserted.rowCount) created++;
  }
  return { eligible: eligible.rowCount, created };
}

// GET /api/fixed-payments/:clientId — preserve invoice history even if a contract is later paused/terminated.
router.get('/:clientId', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      WHERE f.client_id = $1 AND f.freelancer_id = $2
        AND to_date(f.month || '-01', 'YYYY-MM-DD') >= date_trunc('month', u.created_at)::date
      ORDER BY f.month DESC
    `, [req.params.clientId, req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Internal monthly scheduler endpoint. Configure FIXED_INVOICE_CRON_SECRET on the API service.
router.post('/auto-generate', async (req, res, next) => {
  try {
    const expected = process.env.FIXED_INVOICE_CRON_SECRET || '';
    const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    if (!expected || expectedBuffer.length !== suppliedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)) {
      return res.status(401).json({ error: 'Unauthorized scheduler request.' });
    }

    const month = req.body?.month || new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit'
    }).format(new Date()).slice(0, 7);
    if (!validMonth(month)) return res.status(400).json({ error: 'month must use YYYY-MM format.' });

    const freelancers = await pool.query(
      'SELECT DISTINCT freelancer_id FROM client_contracts WHERE freelancer_id IS NOT NULL'
    );
    const results = [];
    for (const row of freelancers.rows) {
      const result = await generateForFreelancer(pool, row.freelancer_id, month);
      results.push({ freelancer_id: row.freelancer_id, ...result });
    }
    res.json({ month, freelancers: results.length, created: results.reduce((sum, item) => sum + item.created, 0), results });
  } catch (e) { next(e); }
});

// POST /api/fixed-payments/generate — manual generation for one month.
router.post('/generate', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, month } = req.body;
    if (!client_id || !validMonth(month))
      return res.status(400).json({ error: 'client_id and a valid month (YYYY-MM) are required.' });

    const generated = await generateForFreelancer(pool, req.user.id, month, client_id);
    const existing = await pool.query(
      'SELECT * FROM fixed_monthly_payments WHERE client_id=$1 AND freelancer_id=$2 AND month=$3',
      [client_id, req.user.id, month]
    );
    if (existing.rowCount) return res.json(existing.rows[0]);
    return res.status(400).json({ error: 'No active fixed-price contract overlaps the selected month; no invoice was generated.', generated });
  } catch (e) { next(e); }
});

// PATCH /api/fixed-payments/:id/status — mark a month as paid or unpaid.
router.patch('/:id/status', requireFreelancer, async (req, res, next) => {
  try {
    const { status, note } = req.body;
    if (!['paid', 'unpaid'].includes(status))
      return res.status(400).json({ error: 'status must be paid or unpaid' });
    const { rows } = await pool.query(`
      UPDATE fixed_monthly_payments
      SET status=$1, paid_at=$2, note=$3
      WHERE id=$4 AND freelancer_id=$5 RETURNING *
    `, [status, status === 'paid' ? new Date() : null, note || null, req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// POST /api/fixed-payments/bulk-generate — only clients whose latest contract state is active and fixed.
router.post('/bulk-generate', requireFreelancer, async (req, res, next) => {
  try {
    const { month } = req.body;
    if (!validMonth(month)) return res.status(400).json({ error: 'A valid month (YYYY-MM) is required.' });
    const generated = await generateForFreelancer(pool, req.user.id, month);
    const { rows } = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      WHERE f.freelancer_id=$1 AND f.month=$2
      ORDER BY u.name
    `, [req.user.id, month]);
    res.json({ ...generated, rows });
  } catch (e) { next(e); }
});

// DELETE /api/fixed-payments/:id — remove a monthly record.
router.delete('/:id', requireFreelancer, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM fixed_monthly_payments WHERE id=$1 AND freelancer_id=$2', [req.params.id, req.user.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

// GET /api/fixed-payments — retain payment history regardless of current contract status.
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*, u.name AS client_name, u.company AS client_company
      FROM fixed_monthly_payments f
      JOIN users u ON u.id = f.client_id
      WHERE f.freelancer_id=$1
        AND to_date(f.month || '-01', 'YYYY-MM-DD') >= date_trunc('month', u.created_at)::date
      ORDER BY f.month DESC, u.name
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/fixed-payments/backfill-all — manual backfill using the same status-aware eligibility rule.
router.post('/backfill-all', requireFreelancer, async (req, res, next) => {
  try {
    const { start_month } = req.body;
    if (!validMonth(start_month)) return res.status(400).json({ error: 'start_month must use YYYY-MM format.' });
    const nowMonth = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit'
    }).format(new Date()).slice(0, 7);
    if (start_month > nowMonth) return res.status(400).json({ error: 'start_month cannot be in the future.' });

    let [year, month] = start_month.split('-').map(Number);
    const [endYear, endMonth] = nowMonth.split('-').map(Number);
    let created = 0;
    while (year < endYear || (year === endYear && month <= endMonth)) {
      const current = `${year}-${String(month).padStart(2, '0')}`;
      const result = await generateForFreelancer(pool, req.user.id, current);
      created += result.created;
      month++;
      if (month > 12) { month = 1; year++; }
    }
    res.json({ created, through_month: nowMonth });
  } catch (e) { next(e); }
});

module.exports = router;
