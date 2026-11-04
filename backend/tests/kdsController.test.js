const test = require("node:test");
const assert = require("node:assert/strict");

function makeRes() {
  return { status(c) { this.code = c; return this; }, json(p) { this.body = p; return this; } };
}
function quiet(fn) {
  return async () => {
    const orig = console.error;
    console.error = () => {};
    try { await fn(); } finally { console.error = orig; }
  };
}

const dbPath = require.resolve("../src/db");
const queries = [];
let affected = 1;
let fail = false;
const pool = {
  async query(sql, params) {
    queries.push(sql);
    if (fail) throw new Error("db down");
    if (sql.startsWith("UPDATE")) return [{ affectedRows: affected }];
    if (sql.includes("FROM orders")) return [[{ id: 1, token: "T1" }]];
    return [[{ name: "Tea", qty: 2, price: 10 }]];
  },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
const KDS = require("../src/controllers/kdsController");

test("the queue lists orders with their items", async () => {
  queries.length = 0; fail = false;
  const res = makeRes();
  await KDS.getLiveKitchenQueue({}, res);
  assert.equal(res.body[0].items[0].name, "Tea");
  assert.equal(res.body[0].items[0].qty, 2);
});

test("the queue only asks for columns that exist", async () => {
  queries.length = 0; fail = false;
  await KDS.getLiveKitchenQueue({}, makeRes());
  const all = queries.join(" ");
  assert.ok(!all.includes("total_amount"));
  assert.ok(!all.includes("item_name"));
  assert.ok(!all.includes("quantity"));
  assert.ok(!all.includes("updated_at"));
});

test("marking Received or Cooking orders ready works", async () => {
  affected = 1; fail = false;
  const res = makeRes();
  await KDS.markOrderReady({ params: { id: "5" } }, res);
  assert.equal(res.body.status, "Ready");
});

test("an unknown, ready or cancelled order is a 404", async () => {
  affected = 0; fail = false;
  const res = makeRes();
  await KDS.markOrderReady({ params: { id: "5" } }, res);
  assert.equal(res.code, 404);
});

test("a database error gives 500", quiet(async () => {
  fail = true;
  const res = makeRes();
  await KDS.markOrderReady({ params: { id: "5" } }, res);
  assert.equal(res.code, 500);
  fail = false;
}));
