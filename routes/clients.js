const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// GET /api/clients — only returns THIS freelancer's clients
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

// POST /api/clients — create a client profile + user login
router.post('/', requireFreelancer, async (req, res, next) => {
  try {
    const { name, email, company, password, rate_type, hourly_rate, fixed_price, prepaid_credits, notes } = req.body;
    
    // Check if user account already exists
    const userCheck = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (userCheck.rows.length) return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password || '123456', 10);
    
    // Insert into users table
    const userRes = await pool.query(
      `INSERT INTO users (name, email, company, password, role) 
       VALUES ($1, $2, $3, $4, 'client') RETURNING id`,
      [name, email, company || null, hash]
    );
    const clientUserId = userRes.rows[0].id;

    // Convert potential string numbers safely
    const hRate = hourly_rate ? parseFloat(hourly_rate) : null;
    const fPrice = fixed_price ? parseFloat(fixed_price) : null;
    const credits = prepaid_credits ? parseFloat(prepaid_credits) : 0;

    // Insert structural client parameters
    await pool.query(
      `INSERT INTO clients (user_id, freelancer_id, rate_type, hourly_rate, fixed_price, credit_balance, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [clientUserId, req.user.id, rate_type || 'hourly', hRate, fPrice, credits, notes || '']
    );

    res.status(201).json({ message: 'Client profile successfully generated', id: clientUserId });
  } catch (e) { next(e); }
});

// PUT /api/clients/:id — update structural options
router.put('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const { notes, is_active, rate_type, hourly_rate, fixed_price } = req.body;
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

// PATCH /api/clients/:id/fixed-payment — UPDATED FOR MONTH-SPECIFIC RECORDING
router.patch('/:id/fixed-payment', requireFreelancer, async (req, res, next) => {
  try {
    const { fixed_payment_status, month } = req.body;
    const client_id = req.params.id;
    const freelancer_id = req.user.id;

    if (!['paid', 'unpaid'].includes(fixed_payment_status)) {
      return res.status(400).json({ error: 'fixed_payment_status must be paid or unpaid' });
    }

    // Capture explicit year-month or fall back safely to current local runtime scope
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const trackingDate = `${targetMonth}-01`;

    // Extract designated pricing models
    const clientCheck = await pool.query(
      'SELECT fixed_price FROM clients WHERE user_id=$1 AND freelancer_id=$2',
      [client_id, freelancer_id]
    );
    if (!clientCheck.rows.length) return res.status(404).json({ error: 'Client profile not found' });
    const fixedPrice = parseFloat(clientCheck.rows[0].fixed_price || 0);

    if (fixed_payment_status === 'paid') {
      // Safely register an analytical log transaction row if missing
      await pool.query(`
        INSERT INTO time_logs (freelancer_id, client_id, date, hours, amount, payment_status, task_description, source)
        SELECT $1, $2, $3, 0, $4, 'paid', $5, 'fixed_billing'
        WHERE NOT EXISTS (
          SELECT 1 FROM time_logs 
          WHERE client_id = $2 AND freelancer_id = $1 AND date = $3 AND source = 'fixed_billing'
        )
      `, [freelancer_id, client_id, trackingDate, fixedPrice, `Fixed Price Project Remittance — Period: ${targetMonth}`]);
    } else {
      // Clear log rows matching tracking keys if project status returns to unpaid
      await pool.query(`
        DELETE FROM time_logs 
        WHERE freelancer_id = $1 AND client_id = $2 AND date = $3 AND source = 'fixed_billing'
      `, [freelancer_id, client_id, trackingDate]);
    }

    // Keep legacy parent record columns retro-compatible
    await pool.query(
      `UPDATE clients SET fixed_payment_status=$1 WHERE user_id=$2 AND freelancer_id=$3`,
      [fixed_payment_status, client_id, freelancer_id]
    );

    res.json({ message: 'Monthly fixed status updated successfully', month: targetMonth });
  } catch (e) { next(e); }
});

// DELETE /api/clients/:id
router.delete('/:id', requireFreelancer, async (req, res, next) => {
  try {
    const check = await pool.query(
      'SELECT user_id FROM clients WHERE user_id=$1 AND freelancer_id=$2',
      [req.params.id, req.user.id]
    );
    if (!check.rows.length) return res.status(403).json({ error: 'Access Denied' });

    // Cascading delete across relationships
    await pool.query('DELETE FROM time_logs WHERE client_id=$1', [req.params.id]);
    await pool.query('DELETE FROM clients WHERE user_id=$1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);

    res.json({ message: 'Deleted successfully' });
  } catch (e) { next(e); }
});

module.exports = router;
