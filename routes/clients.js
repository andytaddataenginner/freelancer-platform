const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// ── UNIVERSAL CHANGE PASSWORD ROUTE ────────────────────────
// Handles password changes securely via token identification and current password validation
router.post('/change-password', async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized session.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      return res.status(400).json({ error: 'New password must be at least 8 characters and include a number.' });
    }

    const userResult = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = userResult.rows[0];

    // Safely validates current password (prevents "Illegal arguments: undefined, string" crash)
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashedNewPassword, userId]);

    res.json({ message: 'Password updated successfully.' });
  } catch (e) { next(e); }
});

// GET /api/clients — returns THIS freelancer's clients with current contract status[cite: 2]
router.get('/', requireFreelancer, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.company,
             c.is_active, c.notes, c.phone,
             COALESCE(cc.rate_type, c.rate_type, 'hourly') AS rate_type,
             COALESCE(cc.hourly_rate, c.hourly_rate, 0)::float AS hourly_rate,
             COALESCE(cc.fixed_price, c.fixed_price, 0)::float AS fixed_price,
             COALESCE(cc.status, CASE WHEN c.is_active THEN 'active' ELSE 'terminated' END) AS contract_status,
             c.fixed_payment_status,
             COALESCE(c.credit_balance, 0)::float AS credit_balance,
             COUNT(t.id)::int AS log_count,
             COALESCE(SUM(t.hours),0)::float AS total_hours
      FROM users u
      JOIN clients c ON c.user_id = u.id
      LEFT JOIN client_contracts cc ON cc.client_id = c.user_id 
        AND cc.freelancer_id = c.freelancer_id 
        AND cc.effective_to IS NULL
      LEFT JOIN time_logs t ON t.client_id = u.id AND t.freelancer_id = $1
      WHERE u.role = 'client'
        AND c.freelancer_id = $1
      GROUP BY u.id, u.name, u.email, u.company,
               c.is_active, c.notes, c.phone, c.fixed_payment_status, c.credit_balance,
               cc.rate_type, c.rate_type, cc.hourly_rate, c.hourly_rate, cc.fixed_price, c.fixed_price, cc.status
      ORDER BY u.name
    `, [req.user.id]);
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/clients — creates client and active contract link[cite: 2]
router.post('/', requireFreelancer, async (req, res, next) => {
  try {
    const { name, email, company, password, notes, rate_type, hourly_rate, fixed_price, phone } = req.body;
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

      const clientId = userRow.rows[0].id;

      await pool.query(
        `INSERT INTO clients (user_id, freelancer_id, notes, rate_type, hourly_rate, fixed_price, fixed_payment_status, credit_balance, phone)
         VALUES ($1,$2,$3,$4,$5,$6,'unpaid', 0, $7)`,
        [clientId, req.user.id, notes || null, 
         rate_type || 'hourly', hourly_rate || null, fixed_price || null, phone || null]
      );

      await pool.query(
        `INSERT INTO client_contracts (client_id, freelancer_id, rate_type, hourly_rate, fixed_price, status, effective_from)
         VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_DATE)`,
        [clientId, req.user.id, rate_type || 'hourly', hourly_rate || null, fixed_price || null]
      );

      if (rate_type === 'fixed' && fixed_price) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        await pool.query(
          `INSERT INTO fixed_monthly_payments (client_id, freelancer_id, month, amount, status)
           VALUES ($1, $2, $3, $4, 'unpaid')
           ON CONFLICT (client_id, month) DO NOTHING`,
          [clientId, req.user.id, currentMonth, fixed_price]
        );
      }

      await pool.query('COMMIT');
      res.status(201).json(userRow.rows[0]);
    } catch (e) {
      await pool.query('ROLLBACK');
      if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
      throw e;
    }
  } catch (e) { next(e); }
});

// PUT /api/clients/:id — update user details and sync contract changes[cite: 2]
router.put('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { name, company, notes, is_active, rate_type, hourly_rate, fixed_price, phone, status } = req.body;
    
    await pool.query('BEGIN');

    await pool.query(
      `UPDATE users SET name=$1, company=$2, updated_at=NOW()
       WHERE id=$3 AND role='client'`,
      [name, company, req.params.id]
    );

    await pool.query(
      `UPDATE clients 
       SET notes=$1, is_active=$2, rate_type=$3, hourly_rate=$4, fixed_price=$5, phone=$6
       WHERE user_id=$7 AND freelancer_id=$8`,
      [notes, is_active ?? true, rate_type || 'hourly', 
       hourly_rate || null, fixed_price || null, phone || null, req.params.id, req.user.id]
    );

    const contractStatus = status || (is_active === false ? 'terminated' : 'active');
    await pool.query(
      `UPDATE client_contracts 
       SET rate_type=$1, hourly_rate=$2, fixed_price=$3, status=$4
       WHERE client_id=$5 AND freelancer_id=$6 AND effective_to IS NULL`,
      [rate_type || 'hourly', hourly_rate || null, fixed_price || null, contractStatus, req.params.id, req.user.id]
    );

    await pool.query('COMMIT');
    res.json({ message: 'Updated' });
  } catch (e) { 
    await pool.query('ROLLBACK');
    next(e); 
  }
});

// PATCH /api/clients/:id/fixed-payment[cite: 2]
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

// DELETE /api/clients/:id[cite: 2]
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
