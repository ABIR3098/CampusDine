const test = require("node:test");
const assert = require("node:assert/strict");
const { recordFraudEvent } = require("../src/utils/fraud");

test("records an event with the details stored as JSON", async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push({ sql, params }); } };
  await recordFraudEvent(db, { userId: 5, eventType: "BAD_QR", severity: "HIGH", details: { code: "C-105" }, ipAddress: "10.0.0.1" });
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO fraud_events/);
  assert.deepEqual(calls[0].params, [5, "BAD_QR", "HIGH", '{"code":"C-105"}', "10.0.0.1"]);
});

test("uses MEDIUM severity, no user, no address and empty details by default", async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push(params); } };
  await recordFraudEvent(db, { eventType: "ODD_ORDER" });
  assert.deepEqual(calls[0], [null, "ODD_ORDER", "MEDIUM", "{}", null]);
});

test("a database failure is logged but never thrown, so the request that triggered it still works", async () => {
  const db = { query: async () => { throw new Error("db down"); } };
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args.join(" "));
  try {
    await assert.doesNotReject(recordFraudEvent(db, { eventType: "X" }));
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
  assert.match(logged[0], /Failed to record fraud event X/);
});
