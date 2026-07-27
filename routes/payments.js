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

    // 1. Fetch the client record by checking BOTH clients.id or clients.user_id to ensure synchronization with frontend payloads
    const clientRecordRes = await client.query(
      `SELECT id, user_id, credit_balance FROM clients WHERE id = $1 OR user_id = $1`,
      [client_id]
    );

    if (clientRecordRes.rows.length === 0) {
      throw new Error('Client record not found.');
    }

    const clientRow = clientRecordRes.rows[0];
    const actualClientId = clientRow.id; // Primary key of clients table
    const targetUserId = clientRow.user_id; // Primary key of users table (used in payments & time_logs)

    // 2. Insert into payments using targetUserId (since payments.client_id references users.id)
    const paymentRes = await client.query(
      `INSERT INTO payments (client_id, amount, date, notes) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [targetUserId, parsedAmount, date || new Date().toISOString().slice(0,10), notes || null]
    );
    const paymentId = paymentRes.rows[0].id;

    let remainingCash = parsedAmount;

    // 3. Allocate funds using targetUserId for time_logs lookup
    if (log_ids && Array.isArray(log_ids) && log_ids.length > 0) {
      const logsRes = await client.query(
        `SELECT id, hours, amount, payment_status 
         FROM time_logs 
         WHERE id = ANY($1) AND client_id = $2 
         ORDER BY date ASC, id ASC`,
        [log_ids, targetUserId]
      );

      for (const log of logsRes.rows) {
        if (log.payment_status === 'paid') continue;
        let logCost = parseFloat(log.amount);
        
        if (remainingCash >= logCost) {
          remainingCash -= logCost;
          await client.query(
            `UPDATE time_logs 
             SET payment_status = 'paid', payment_id = $1 
             WHERE id = $2`,
            [paymentId, log.id]
          );
        } else {
          break;
        }
      }
    }

    // 4. Update the client's credit balance and total paid using the resolved clients table primary key (actualClientId)
    await client.query(
      `UPDATE clients 
       SET credit_balance = COALESCE(credit_balance, 0) + $1,
           total_paid = COALESCE(total_paid, 0) + $2 
       WHERE id = $3`,
      [remainingCash, parsedAmount, actualClientId]
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
