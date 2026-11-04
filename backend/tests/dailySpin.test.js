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
const log = [];
let script = null;
const conn = {
  async beginTransaction() { log.push("begin"); },
  async commit() { log.push("commit"); },
  async rollback() { log.push("rollback"); },
  release() { log.push("release"); },
  async query(sql, params) { log.push(sql.split(" ").slice(0, 2).join(" ")); return script(sql, params); },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { getConnection: async () => conn } };
const CouponController = require("../src/controllers/couponController");

const normal = (alreadySpun) => (sql) => {
  if (sql.startsWith("SELECT id FROM users")) return [[{ id: 1 }]];
  if (sql.includes("FROM wallet_transactions")) return [alreadySpun ? [{ id: 9 }] : []];
  return [{ affectedRows: 1 }];
};
async function claim(body = {}) {
  log.length = 0;
  const res = makeRes();
  await CouponController.claimDailySpin({ body, user: { id: 1 } }, res);
  return res;
}
function withRandom(value, fn) {
  const orig = Math.random;
  Math.random = () => value;
  return fn().finally(() => { Math.random = orig; });
}

test("the prize is picked by the server, not taken from the request", () =>
  withRandom(0.99, async () => {
    script = normal(false);
    const res = await claim({ rewardType: "cash", value: 999999 });
    assert.equal(res.code, undefined);
    assert.equal(res.body.reward.value, 10);
    assert.ok(log.includes("commit"));
  }));

test("a winning spin writes a wallet entry and adds the money", () =>
  withRandom(0.99, async () => {
    script = normal(false);
    await claim();
    assert.ok(log.includes("INSERT INTO"));
    assert.ok(log.includes("UPDATE users"));
  }));

test("a zero prize is still recorded but adds no money", () =>
  withRandom(0, async () => {
    script = normal(false);
    const res = await claim();
    assert.equal(res.body.reward.value, 0);
    assert.equal(res.body.reward.rewardType, "none");
    assert.ok(log.includes("INSERT INTO"));
    assert.ok(!log.includes("UPDATE users"));
  }));

test("a second spin on the same day is refused with 429 and nothing is written", async () => {
  script = normal(true);
  const res = await claim({ rewardType: "cash", value: 50 });
  assert.equal(res.code, 429);
  assert.ok(log.includes("rollback"));
  assert.ok(!log.includes("INSERT INTO"));
  assert.ok(!log.includes("UPDATE users"));
  assert.ok(log.includes("release"));
});

test("an unknown user gets 404 and the transaction is rolled back", async () => {
  script = (sql) => (sql.startsWith("SELECT id FROM users") ? [[]] : [{}]);
  const res = await claim();
  assert.equal(res.code, 404);
  assert.ok(log.includes("rollback"));
});

test("a database error gives 500, rolls back and releases the connection", quiet(async () => {
  script = () => { throw new Error("db down"); };
  const res = await claim();
  assert.equal(res.code, 500);
  assert.ok(log.includes("rollback"));
  assert.ok(log.includes("release"));
}));
