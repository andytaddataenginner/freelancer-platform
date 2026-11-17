/**
 * Shared credit-ledger logic used by both the payments route (/remit) and the
 * time logs route (POST /timelogs). Keeping this in one place avoids the two
 * routes drifting out of sync the way payment.js's old inline copy did.
 *
 * Applies `cashAmount` (pass 0 if there's no fresh money, e.g. when just
 * auto-settling against existing credit) plus the client's current
 * credit_balance against their unpaid time_logs, oldest date first.
 *
 * A log is only ever marked 'paid' if funds fully cover it — no partial
 * payments, and credit_balance never goes negative from this function.
 * Logs are still tried oldest-first, so an older log gets first claim on
 * limited funds — but if funds can't cover it, that log is SKIPPED (not a
 * hard stop), so a smaller, newer log further down the list can still be
 * settled instead of getting stuck waiting behind one big unpaid log.
 * Whatever funds are left over becomes the new credit_balance.
 *
 * IMPORTANT: `client` must be a pg client already inside an open transaction
 * (caller has already run BEGIN). `clientUserId` is the id used in
 * time_logs.client_id — i.e. users.id / clients.user_id, NOT clients.id.
 */
async function applyFundsToUnpaidLogs(client, clientUserId, cashAmount = 0) {
  const clientRes = await client.query(
    `SELECT id, credit_balance FROM clients WHERE user_id = $1 FOR UPDATE`,
    [clientUserId]
  );
  if (!clientRes.rows.length) {
    throw new Error('Client record not found for user_id ' + clientUserId);
  }

  const clientsRowId = clientRes.rows[0].id;
  let availableFunds = parseFloat(cashAmount || 0) + parseFloat(clientRes.rows[0].credit_balance || 0);

  const logsRes = await client.query(
    `SELECT id, amount FROM time_logs
     WHERE client_id = $1 AND payment_status = 'unpaid'
     ORDER BY date ASC, id ASC`,
    [clientUserId]
  );

  const paidLogIds = [];
  for (const log of logsRes.rows) {
    const logCost = parseFloat(log.amount || 0);
    if (availableFunds >= logCost) {
      availableFunds -= logCost;
      paidLogIds.push(log.id);
    }
    // else: can't cover this one right now — skip it and keep checking the
    // rest, rather than stopping the whole pass here. It stays unpaid.
  }

  if (paidLogIds.length) {
    await client.query(
      `UPDATE time_logs SET payment_status = 'paid' WHERE id = ANY($1)`,
      [paidLogIds]
    );
  }

  await client.query(
    `UPDATE clients SET credit_balance = $1 WHERE id = $2`,
    [availableFunds, clientsRowId]
  );

  return { newCreditBalance: availableFunds, paidLogIds };
}

module.exports = { applyFundsToUnpaidLogs };
