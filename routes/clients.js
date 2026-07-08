const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// GET /api/clients — returns general client stats (unaltered for other modules)
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.company,
             c.is_active, c.notes, c.rate_type, c.hourly_rate, c.fixed_price,
             c.fixed_payment_status,
             COALESCE(c.credit_balance, 0)::float AS credit_balance,
             COUNT(t.id)::int AS log_count,
             COALESCE(SUM(t.hours),0)::float AS total_hours
      FROM users u
      JOIN clients c ON c.user_id = u.id
      LEFT JOIN time_logs t ON t.client_id = u.id AND t.freelancer_id = $1
      WHERE u.role = 'client'
        AND c.freelancer_id = $1
      GROUP BY u.id, u.name, u.email, u.company,
               c.is_active, c.notes, c.rate_type, c.hourly_rate, 
               c.fixed_price, c.fixed_payment_status, c.credit_balance
      ORDER BY u.name
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// GET /api/clients/outstanding — Dedicated endpoint for invoice calculations
// Counts log records and aggregates total hours only for 'unpaid' status items
router.get('/outstanding', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.company,
             c.is_active, c.notes, c.rate_type, c.hourly_rate, c.fixed_price,
             c.fixed_payment_status,
             COALESCE(c.credit_balance, 0)::float AS credit_balance,
             COUNT(t.id)::int AS log_count,
             COALESCE(SUM(t.hours),0)::float AS total_hours
      FROM users u
      JOIN clients c ON c.user_id = u.id
      LEFT JOIN time_logs t ON t.client_id = u.id 
                           AND t.freelancer_id = $1 
                           AND t.payment_status = 'unpaid'
      WHERE u.role = 'client'
        AND c.freelancer_id = $1
      GROUP BY u.id, u.name, u.email, u.company,
               c.is_active, c.notes, c.rate_type, c.hourly_rate, 
               c.fixed_price, c.fixed_payment_status, c.credit_balance
      ORDER BY u.name
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/clients — creates client and links to THIS freelancer
router.post('/', requireFreelancer, async (req, res, next) => {
  try {
    const { name, email, company, password, notes, rate_type, hourly_rate, fixed_price } = req.body;
    if (!name || !email || !password) 
      return res.status(400).json({ error: 'name, email, password required' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('BEGIN');
    try {
      const userRow = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, company)
         VALUES ($1,$2,$3,'client',$4) RETURNING id, name, email, company`,
        [name, email.toLowerCase().trim(), hash, company || null]
      );
      await pool.query(
        `INSERT INTO clients (user_id, freelancer_id, notes, rate_type, hourly_rate, fixed_price, fixed_payment_status, credit_balance)
         VALUES ($1,$2,$3,$4,$5,$6,'unpaid', 0)`,
        [userRow.rows[0].id, req.user.id, notes || null, 
         rate_type || 'hourly', hourly_rate || null, fixed_price || null]
      );
      await pool.query('COMMIT');
      res.status(201).json(userRow.rows[0]);
    } catch (e) {
      await pool.query('ROLLBACK');
      if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
      throw e;
    }
  } catch (e) { next(e); }
});

// PUT /api/clients/:id — only update if belongs to this freelancer
router.put('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { name, company, notes, is_active, rate_type, hourly_rate, fixed_price } = req.body;
    await pool.query(
      `UPDATE users SET name=$1, company=$2, updated_at=NOW()
       WHERE id=$3 AND role='client'`,
      [name, company, req.params.id]
    );
    await pool.query(
      `UPDATE clients 
       SET notes=$1, is_active=$2, rate_type=$3, hourly_rate=$4, fixed_price=$5
       WHERE user_id=$6 AND freelancer_id=$7`,
      [notes, is_active ?? true, rate_type || 'hourly', 
       hourly_rate || null, fixed_price || null, req.params.id, req.user.id]
    );
    res.json({ message: 'Updated' });
  } catch (e) { next(e); }
});

// PATCH /api/clients/:id/fixed-payment
router.patch('/:id/fixed-payment', requireFreelancer, async (req, res, next) => {
  try {
    const { fixed_payment_status } = req.body;
    if (!['paid','unpaid'].includes(fixed_payment_status))
      return res.status(400).json({ error: 'fixed_payment_status must be paid or unpaid' });
    await pool.query(
      `UPDATE clients SET fixed_payment_status=$1 
       WHERE user_id=$2 AND freelancer_id=$3`,
      [fixed_payment_status, req.params.id, req.user.id]
    );
    res.json({ message: 'Updated' });
  } catch (e) { next(e); }
});

// DELETE /api/clients/:id
router.delete('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const check = await pool.query(
      'SELECT id FROM clients WHERE user_id=$1 AND freelancer_id=$2',
      [req.params.id, req.user.id]
    );
    if (!check.rows.length) 
      return res.status(403).json({ error: 'Not your client' });
    await pool.query(`DELETE FROM users WHERE id=$1 AND role='client'`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (e) { next(e); }
});

module.exports = router;
