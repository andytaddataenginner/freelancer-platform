const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');
const { applyFundsToUnpaidLogs } = require('../utils/creditLedger');

// POST /api/payments/remit
router.post('/remit', requireFreelancer, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { client_id, amount_remitted, date, notes } = req.body;

    const parsedAmount = parseFloat(amount_remitted);
    if (!client_id || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid client_id and numeric payment amount are required.' });
    }

    await client.query('BEGIN');

    // The front-end dropdown sends clients.id, but time_logs.client_id (and
    // clients.user_id) is actually users.id — resolve whichever id we got
    // down to the users.id value everything else keys off of.
    const clientRowRes = await client.query(
      `SELECT id, user_id FROM clients WHERE id = $1 OR user_id = $1`,
      [client_id]
    );
    if (!clientRowRes.rows.length) throw new Error('Client record not found.');
    const targetUserId = clientRowRes.rows[0].user_id;

    // Record the actual money received
    await client.query(
      `INSERT INTO payments (client_id, amount, date, notes)
       VALUES ($1, $2, $3, $4)`,
      [targetUserId, parsedAmount, date || new Date().toISOString().slice(0, 10), notes || null]
    );

    // Settle oldest unpaid logs using this cash + any existing credit;
    // whatever's left over becomes the new credit_balance.
    const { newCreditBalance } = await applyFundsToUnpaidLogs(client, targetUserId, parsedAmount);

    await client.query(
      `UPDATE clients SET total_paid = COALESCE(total_paid, 0) + $1 WHERE user_id = $2`,
      [parsedAmount, targetUserId]
    );

    await client.query('COMMIT');
    res.status(200).json({
      success: true,
      message: 'Remittance processed successfully.',
      new_credit_balance: newCreditBalance
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
