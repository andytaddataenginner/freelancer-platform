const express = require('express');
const router = express.Router();
const pool = require('../db'); // Your database connection configuration
// Replace with your actual authentication middleware if named differently
const { requireAdmin } = require('../middleware/auth'); 

// POST /api/payments/remit - Process an admin client remittance payment
router.post('/remit', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { client_id, amount_remitted, date, notes, log_ids } = req.body;
    
    const parsedAmount = parseFloat(amount_remitted);
    if (!client_id || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid client_id and numeric payment amount are required.' });
    }

    // Start database transaction
    await client.query('BEGIN');

    // 1. Record the base payment tracking entry into the ledger
    const paymentRes = await client.query(
      `INSERT INTO payments (client_id, amount, date, notes) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [client_id, parsedAmount, date || new Date().toISOString().slice(0,10), notes || null]
    );
    const paymentId = paymentRes.rows[0].id;

    let remainingCash = parsedAmount;

    // 2. Process hourly time log matchings if any were selected
    if (log_ids && Array.isArray(log_ids) && log_ids.length > 0) {
      // Fetch details of logs requested for checkout matching
      const logsRes = await client.query(
        `SELECT id, hours, amount, payment_status 
         FROM timelogs 
         WHERE id = ANY($1) AND client_id = $2 
         ORDER BY date ASC, id ASC`,
        [log_ids, client_id]
      );

      for (const log of logsRes.rows) {
        if (log.payment_status === 'paid') continue;

        // Fallback calculations if explicit total currency field is omitted
        let logCost = parseFloat(log.amount);
        if (!logCost && log.hours) {
          // Fallback to a baseline variable or metadata rate if standard column is missing
          const clientRateRes = await client.query('SELECT hourly_rate FROM clients WHERE user_id = $1', [client_id]);
          const rate = parseFloat(clientRateRes.rows[0]?.hourly_rate || 20);
          logCost = parseFloat(log.hours) * rate;
        }

        if (remainingCash >= logCost) {
          // Deduct exact log value from payment pool
          remainingCash -= logCost;

          // Update log status to Paid
          await client.query(
            `UPDATE timelogs 
             SET payment_status = 'paid', payment_id = $1 
             WHERE id = $2`,
            [paymentId, log.id]
          );
        } else {
          // If cash runs out, don't mark as paid
          break;
        }
      }
    }

    // 3. ✅ FIXED: Add leftover cash balance strictly to credit_balance column
    // Removed total_paid column reference completely to prevent schema crash errors
    await client.query(
      `UPDATE clients 
       SET credit_balance = COALESCE(credit_balance, 0) + $1 
       WHERE user_id = $2`,
      [remainingCash, client_id]
    );

    await client.query('COMMIT');
    res.status(200).json({ 
      success: true, 
      message: 'Remittance processed successfully.', 
      applied_to_credit: remainingCash 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
