const express = require('express');
const router = express.Router();
const pool = require('../db/pool'); 
const { requireAdmin } = require('../middleware/auth'); 

// POST /api/payments/remit
router.post('/remit', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { client_id, amount_remitted, date, notes, log_ids } = req.body;
    
    const parsedAmount = parseFloat(amount_remitted);
    if (!client_id || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid client_id and numeric payment amount are required.' });
    }

    await client.query('BEGIN');

    const paymentRes = await client.query(
      `INSERT INTO payments (client_id, amount, date, notes) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [client_id, parsedAmount, date || new Date().toISOString().slice(0,10), notes || null]
    );
    const paymentId = paymentRes.rows[0].id;

    let remainingCash = parsedAmount;

    if (log_ids && Array.isArray(log_ids) && log_ids.length > 0) {
      const logsRes = await client.query(
        `SELECT id, hours, amount, payment_status 
         FROM time_logs 
         WHERE id = ANY($1) AND client_id = $2 
         ORDER BY date ASC, id ASC`,
        [log_ids, client_id]
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
