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
    
    // Total purchasing power = newly remitted cash + existing credit balance
    let existingCredit = parseFloat(clientRow.credit_balance || 0);
    let totalAvailableFunds = parsedAmount + existingCredit;

    // 2. Insert into payments table
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

    // 4. Draw down from total available funds (Cash + Credit) to clear unpaid logs
    for (const log of logsRes.rows) {
      if (log.payment_status === 'paid') continue;
      let logCost = parseFloat(log.amount || 0);
      
      if (totalAvailableFunds >= logCost) {
        totalAvailableFunds -= logCost;
        await client.query(
          `UPDATE time_logs 
           SET payment_status = 'paid' 
           WHERE id = $1`,
          [log.id]
        );
      } else {
        break; // Stop if total available funds are insufficient to cover the next log
      }
    }

    // 5. Calculate new credit balance / debit state
    // totalAvailableFunds now holds whatever is left over (or becomes negative if logs exceeded funds)
    const newCreditBalance = totalAvailableFunds;

    // 6. Update the client's credit balance and total paid
    await client.query(
      `UPDATE clients 
       SET credit_balance = $1,
           total_paid = COALESCE(total_paid, 0) + $2 
       WHERE id = $3`,
      [newCreditBalance, parsedAmount, actualClientId]
    );

    await client.query('COMMIT');
    res.status(200).json({ 
      success: true, 
      message: 'Remittance processed, credit drawn down, and time logs updated.', 
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
