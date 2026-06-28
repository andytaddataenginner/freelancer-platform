const router = require('express').Router();
const pool   = require('../db/pool');
const { requireFreelancer } = require('../middleware/auth');

// POST /api/payments/record-admin
// Freelancer records a client payment, auto-allocating it to wipe out outstanding debt first
router.post('/record-admin', requireFreelancer, async (req, res, next) => {
  try {
    const { client_id, amount, date, notes } = req.body;
    const parsedAmount = parseFloat(amount);

    if (!client_id || !amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'A valid client and payment amount greater than zero are required.' });
    }

    const processingDate = date || new Date().toISOString().split('T')[0];

    // 1. Insert into historical log ledger
    await pool.query(
      'INSERT INTO payments (client_id, amount, date, notes) VALUES ($1, $2, $3, $4)',
      [client_id, parsedAmount, processingDate, notes || `Freelancer manually recorded payment`]
    );

    // 2. Fetch all unpaid time logs for this specific client, sorted from OLDEST to NEWEST
    const unpaidLogs = await pool.query(
      "SELECT id, amount FROM time_logs WHERE client_id = $1 AND payment_status = 'unpaid' ORDER BY date ASC, id ASC",
      [client_id]
    );

    let remainingCash = parsedAmount;
    const logsToMarkPaid = [];

    // Loop through unpaid items and consume the cash pool
    for (const log of unpaidLogs.rows) {
      const logAmount = parseFloat(log.amount || 0);
      if (remainingCash >= logAmount) {
        remainingCash -= logAmount;
        logsToMarkPaid.push(log.id);
      } else {
        // Not enough cash left to clear this entire log item fully, break loop
        break;
      }
    }

    // 3. Batch update the fully covered logs to 'paid' status
    if (logsToMarkPaid.length > 0) {
      await pool.query(
        "UPDATE time_logs SET payment_status = 'paid' WHERE id = ANY($1)",
        [logsToMarkPaid]
      );
    }

    // 4. Update the client profile: Add to total_paid, set the remaining surplus balance into credit_balance
    await pool.query(
      'UPDATE clients SET total_paid = COALESCE(total_paid, 0) + $1, credit_balance = COALESCE(credit_balance, 0) + $2 WHERE user_id = $3',
      [parsedAmount, remainingCash, client_id]
    );

    res.json({
      success: true,
      message: `Payment balanced successfully. Cleared ${logsToMarkPaid.length} log entries.`,
      remainingCreditSurplus: remainingCash
    });
  } catch (e) { next(e); }
});

module.exports = router;
