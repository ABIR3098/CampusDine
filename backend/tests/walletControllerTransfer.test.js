const test = require("node:test");
const assert = require("node:assert/strict");

// WalletController needs the database module; give it a fake pool that records what happens.
const dbPath = require.resolve("../src/db");
let script = null;
const log = [];
function makeConn() {
  return {
    async beginTransaction() { log.push("begin"); },
    async commit() { log.push("commit"); },
    async rollback() { log.push("rollback"); },
    release() { log.push("release"); },
    async query(sql, params) {
      log.push(sql.split(" ").slice(0, 2).join(" "));
      return script(sql, params);
    },
  };
}
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getConnection: async () => makeConn() } };
// The controller does `const pool = require("../db")` and calls pool.getConnection().
const WalletController = require("../src/controllers/walletController");

function call(body, userId = 1) {
  log.length = 0;
  const res = { status(c) { this.code = c; return this; }, json(p) { this.body = p; return this; } };
  return WalletController.transfer({ body, user: { id: userId } }, res).then(() => res);
}

const richSender = (amount = 500) => (sql, params) => {
  if (sql.startsWith("SELECT id FROM users")) return [[{ id: 2 }]];
  if (sql.startsWith("SELECT id, wallet_balance")) return [[{ id: 1, wallet_balance: amount }, { id: 2, wallet_balance: 0 }]];
  return [{ affectedRows: 1 }];
};

test("a valid transfer commits and releases the connection", async () => {
  script = richSender();
  const res = await call({ recipientId: "2107002", amount: 100 });
  assert.equal(res.body.transferred, 100);
  assert.ok(log.includes("commit"));
  assert.equal(log.at(-1), "release");
  assert.equal(log.filter((l) => l === "UPDATE users").length, 2);
});

test("a text amount is rejected before any database work", async () => {
  script = richSender();
  const res = await call({ recipientId: "2107002", amount: "abc" });
  assert.equal(res.code, 400);
  assert.deepEqual(log, []);
});

test("zero, negative and Infinity amounts are rejected", async () => {
  script = richSender();
  for (const amount of [0, -5, Infinity, "Infinity", null]) {
    const res = await call({ recipientId: "2107002", amount });
    assert.equal(res.code, 400, String(amount));
  }
});

test("a missing recipient is rejected", async () => {
  script = richSender();
  assert.equal((await call({ amount: 10 })).code, 400);
  assert.equal((await call(undefined)).code, 400);
});

test("insufficient balance rolls back, writes nothing and releases", async () => {
  script = richSender(50);
  const res = await call({ recipientId: "2107002", amount: 100 });
  assert.equal(res.code, 400);
  assert.match(res.body.error, /Insufficient/);
  assert.ok(log.includes("rollback"));
  assert.equal(log.filter((l) => l === "UPDATE users").length, 0);
  assert.equal(log.at(-1), "release");
});

test("transferring to yourself rolls back the open transaction", async () => {
  script = (sql) => (sql.startsWith("SELECT id FROM users") ? [[{ id: 1 }]] : [{ affectedRows: 1 }]);
  const res = await call({ recipientId: "1", amount: 10 }, 1);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /yourself/);
  assert.ok(log.includes("rollback"));
  assert.equal(log.filter((l) => l === "UPDATE users").length, 0);
});

test("an unknown recipient is a 404 and the transaction is rolled back", async () => {
  script = (sql) => (sql.startsWith("SELECT id FROM users") ? [[]] : [{ affectedRows: 1 }]);
  const res = await call({ recipientId: "nobody", amount: 10 });
  assert.equal(res.code, 404);
  assert.ok(log.includes("rollback"));
});

test("both wallets are locked together in id order", async () => {
  let lockSql = null;
  script = (sql, params) => {
    if (sql.includes("FOR UPDATE")) lockSql = sql;
    return richSender()(sql, params);
  };
  await call({ recipientId: "2107002", amount: 10 });
  assert.match(lockSql, /ORDER BY id FOR UPDATE/);
});

test("the recipient lookup prefers the campus ID over a matching database id", async () => {
  let lookupSql = null;
  script = (sql, params) => {
    if (sql.startsWith("SELECT id FROM users")) lookupSql = sql;
    return richSender()(sql, params);
  };
  await call({ recipientId: "5", amount: 10 });
  assert.match(lookupSql, /ORDER BY \(external_id = \?\) DESC LIMIT 1/);
});

test("a database error rolls back, answers 500 and still releases", async () => {
  script = (sql) => { if (sql.startsWith("UPDATE")) throw new Error("boom"); return richSender()(sql); };
  const origError = console.error; console.error = () => {};
  try {
    const res = await call({ recipientId: "2107002", amount: 10 });
    assert.equal(res.code, 500);
    assert.ok(log.includes("rollback"));
    assert.equal(log.at(-1), "release");
  } finally { console.error = origError; }
});
