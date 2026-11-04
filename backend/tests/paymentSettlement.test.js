const test = require("node:test");
const assert = require("node:assert/strict");
const { settleGatewayPayment } = require("../src/services/paymentSettlement");

// A tiny in-memory stand-in for the database connection.
function fakeDb(rows) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT")) return [rows.filter((r) => r.transaction_ref === params[0])];
      if (sql.startsWith("UPDATE payment_transactions")) {
        const row = rows.find((r) => r.transaction_ref === params[1]);
        if (row && row.status !== "SUCCESS") { row.status = "SUCCESS"; return [{ affectedRows: 1 }]; }
        return [{ affectedRows: 0 }];
      }
      return [{ affectedRows: 1 }];
    },
  };
}

const row = () => ({ transaction_ref: "P1", order_id: 7, user_id: 3, amount: 120, status: "PENDING" });

test("the first callback confirms the order and logs the wallet entry", async () => {
  const db = fakeDb([row()]);
  const out = await settleGatewayPayment(db, { transactionRef: "P1", gateway: "bkash", gatewayTrxId: "TX9" });
  assert.deepEqual(out, { settled: true, orderId: 7 });
  const wallet = db.calls.find((c) => c.sql.startsWith("INSERT INTO wallet_transactions"));
  assert.deepEqual(wallet.params, [3, -120, "Order Payment via bKash - TRX: TX9"]);
  assert.ok(db.calls.some((c) => c.sql.startsWith("UPDATE orders")));
});

test("a repeated callback changes nothing", async () => {
  const db = fakeDb([row()]);
  await settleGatewayPayment(db, { transactionRef: "P1", gateway: "nagad", gatewayTrxId: "TX9" });
  const before = db.calls.length;
  const again = await settleGatewayPayment(db, { transactionRef: "P1", gateway: "nagad", gatewayTrxId: "TX9" });
  assert.deepEqual(again, { settled: false, reason: "already_settled" });
  const writes = db.calls.slice(before).filter((c) => /^(INSERT|UPDATE orders)/.test(c.sql));
  assert.equal(writes.length, 0);
});

test("an unknown transaction is reported and nothing is written", async () => {
  const db = fakeDb([row()]);
  const out = await settleGatewayPayment(db, { transactionRef: "NOPE", gateway: "bkash", gatewayTrxId: "X" });
  assert.deepEqual(out, { settled: false, reason: "not_found" });
  assert.equal(db.calls.length, 1);
});

test("an unknown gateway is rejected", async () => {
  await assert.rejects(
    settleGatewayPayment(fakeDb([row()]), { transactionRef: "P1", gateway: "paypal", gatewayTrxId: "X" }),
    /Unknown payment gateway/
  );
});
