const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

const TYPE_LABELS = { call:'Video call / meeting', review:'Project review', workshop:'Working session', other:'Other' };

// GET /api/schedule — only THIS freelancer's bookings
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { from, to, status } = req.query;
    let where=['b.freelancer_id = $1'], params=[req.user.id], i=2;
    if (from)   { where.push(`b.date >= $${i++}`);   params.push(from); }
    if (to)     { where.push(`b.date <= $${i++}`);   params.push(to); }
    if (status) { where.push(`b.status = $${i++}`);  params.push(status); }

    const { rows } = await pool.query(`
      SELECT b.*, u.name AS client_name, u.email AS client_email, u.company AS client_company
      FROM bookings b
      JOIN users u ON u.id = b.client_id
      WHERE ${where.join(' AND ')}
      ORDER BY b.date, b.time
    `, params);
    res.json(rows.map(r => ({ ...r, type_label: TYPE_LABELS[r.type] || r.type })));
  } catch (e) { next(e); }
});

// PATCH /api/schedule/:id/status — freelancer confirms or cancels
router.patch('/:id/status', requireFreelancer, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['confirmed','cancelled','pending'].includes(status))
      return res.status(400).json({ error: 'Invalid status' });

    const { rows } = await pool.query(
      'UPDATE bookings SET status=$1 WHERE id=$2 AND freelancer_id=$3 RETURNING *',
      [status, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found or not yours' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

module.exports = router;
