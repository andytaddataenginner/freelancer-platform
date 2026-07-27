const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); 
const { requireFreelancer } = require('../middleware/auth'); 

// POST /api/payments/remit
router.post('/remit', requireFreelancer, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { client_id, amount_remitted, date, notes, log_ids } = req.body;
    
    const parsedAmount = parseFloat(amount_remitted);
    if (!client_id || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid client_id and numeric payment amount are required.' });
    }

    await client.query('BEGIN');

    // 1. Fetch the client record including current credit_balance
    const clientRecordRes = await client.query(
      `SELECT id, user_id, credit_balance FROM clients WHERE id = $1 OR user_id = $1`,
      [client_id]
    );

    if (clientRecordRes.rows.length === 0) {
      throw new Error('Client record not found.');
    }

    const clientRow = clientRecordRes.rows[0];
    const actualClientId = clientRow.id; 
    const targetUserId = clientRow.user_id; 
    
    let existingCredit = parseFloat(clientRow.credit_balance || 0);
    let remainingCash = parsedAmount;

    // 2. Insert into payments table (tracks the actual fresh money sent)
    const paymentRes = await client.query(
      `INSERT INTO payments (client_id, amount, date, notes) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [targetUserId, parsedAmount, date || new Date().toISOString().slice(0,10), notes || null]
    );

    // 3. Time Log Allocation: Fetch target logs (explicit IDs or oldest unpaid)
    let logsRes;
    if (log_ids && Array.isArray(log_ids) && log_ids.length > 0) {
      logsRes = await client.query(
        `SELECT id, hours, amount, payment_status 
         FROM time_logs 
         WHERE id = ANY($1::integer[]) AND (client_id = $2 OR client_id = $3) 
         ORDER BY date ASC, id ASC`,
        [log_ids, targetUserId, actualClientId]
      );
    } else {
      logsRes = await client.query(
        `SELECT id, hours, amount, payment_status 
         FROM time_logs 
         WHERE (client_id = $1 OR client_id = $2) AND payment_status = 'unpaid' 
         ORDER BY date ASC, id ASC`,
        [targetUserId, actualClientId]
      );
    }

    // 4. Allocation Phase: Pay logs using new cash first, then existing credit if needed
    for (const log of logsRes.rows) {
      if (log.payment_status === 'paid') continue;
      let logCost = parseFloat(log.amount || 0);
      
      if (remainingCash >= logCost) {
        // Covered fully by new remittance cash
        remainingCash -= logCost;
        await client.query(
          `UPDATE time_logs SET payment_status = 'paid' WHERE id = $1`,
          [log.id]
        );
      } else if ((remainingCash + existingCredit) >= logCost) {
        // New cash ran out, but existing credit covers the rest of this log
        let deficit = logCost - remainingCash;
        remainingCash = 0; // all new cash is spent
        existingCredit -= deficit; // draw down from existing credit balance

        await client.query(
          `UPDATE time_logs SET payment_status = 'paid' WHERE id = $1`,
          [log.id]
        );
      } else {
        // Neither remaining cash nor credit is enough to cover this log
        break; 
      }
    }

    // 5. Finalize the new credit balance
    // If there is still unspent cash left over, add it to the existing credit pool.
    // If logs completely drained both cash and credit, existingCredit will naturally drop into negative (debit).
    const finalCreditBalance = existingCredit + remainingCash;

    // 6. Update the client's ledger
    await client.query(
      `UPDATE clients 
       SET credit_balance = $1,
           total_paid = COALESCE(total_paid, 0) + $2 
       WHERE id = $3`,
      [finalCreditBalance, parsedAmount, actualClientId]
    );

    await client.query('COMMIT');
    res.status(200).json({ 
      success: true, 
      message: 'Remittance processed logically with cash and credit breakdown.', 
      new_credit_balance: finalCreditBalance 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;

