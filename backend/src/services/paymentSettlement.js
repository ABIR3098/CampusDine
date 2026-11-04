// Confirms a gateway payment (bKash / Nagad) exactly once.
// The gateway may call the callback again (retry, double click, replay). Only the call that
// flips the transaction to SUCCESS confirms the order and writes the wallet log; every later
// call is told the payment was already settled and changes nothing.
const GATEWAYS = {
  bkash: { column: "bkash_trx_id", label: "bKash" },
  nagad: { column: "nagad_trx_id", label: "Nagad" },
};

async function settleGatewayPayment(db, { transactionRef, gateway, gatewayTrxId }) {
  const cfg = GATEWAYS[gateway];
  if (!cfg) throw new Error(`Unknown payment gateway: ${gateway}`);

  const [found] = await db.query(
    "SELECT order_id, user_id, amount FROM payment_transactions WHERE transaction_ref = ?",
    [transactionRef]
  );
  if (!found.length) return { settled: false, reason: "not_found" };
  const tx = found[0];

  // The status check lives in the UPDATE itself, so two callbacks at the same moment cannot both win.
  const [updated] = await db.query(
    `UPDATE payment_transactions SET status = 'SUCCESS', ${cfg.column} = ?
     WHERE transaction_ref = ? AND (status IS NULL OR status <> 'SUCCESS')`,
    [gatewayTrxId, transactionRef]
  );
  if (!updated.affectedRows) return { settled: false, reason: "already_settled" };

  await db.query("UPDATE orders SET status = 'Confirmed' WHERE id = ?", [tx.order_id]);
  await db.query(
    "INSERT INTO wallet_transactions (user_id, amount, label) VALUES (?, ?, ?)",
    [tx.user_id, -tx.amount, `Order Payment via ${cfg.label} - TRX: ${gatewayTrxId}`]
  );
  return { settled: true, orderId: tx.order_id };
}

module.exports = { settleGatewayPayment };
