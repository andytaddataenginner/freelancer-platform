const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// GET /api/portfolio — public, but needs freelancer context
// If ?freelancer_id is passed show that freelancer's portfolio
// Otherwise show the first/main freelancer (for public homepage)
router.get('/', async (req, res, next) => {
  try {
    let freelancerId = req.query.freelancer_id;

    // If no freelancer_id given, default to first freelancer (for homepage)
    if (!freelancerId) {
      const fl = await pool.query(
        "SELECT id FROM users WHERE role='freelancer' ORDER BY id LIMIT 1"
      );
      freelancerId = fl.rows[0]?.id;
    }

    const { rows } = await pool.query(
      `SELECT * FROM portfolio_items 
       WHERE is_published = TRUE AND freelancer_id = $1
       ORDER BY sort_order, created_at`,
      [freelancerId]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/portfolio — create item for THIS freelancer
router.post('/', requireFreelancer, async (req, res, next) => {
  try {
    const { title, description, category, emoji, url, image_url, sort_order } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO portfolio_items 
       (title, description, category, emoji, url, image_url, sort_order, freelancer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [title, description, category, emoji || '💻', url, image_url, sort_order || 0, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// PUT /api/portfolio/:id — only update if belongs to this freelancer
router.put('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { title, description, category, emoji, url, image_url, sort_order, is_published } = req.body;
    const { rows } = await pool.query(
      `UPDATE portfolio_items 
       SET title=$1, description=$2, category=$3, emoji=$4, url=$5,
           image_url=$6, sort_order=$7, is_published=$8
       WHERE id=$9 AND freelancer_id=$10 RETURNING *`,
      [title, description, category, emoji, url, image_url, 
       sort_order, is_published ?? true, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found or not yours' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// DELETE /api/portfolio/:id
router.delete('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM portfolio_items WHERE id=$1 AND freelancer_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found or not yours' });
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
