const test = require("node:test");
const assert = require("node:assert/strict");
const { assignPendingTeacherOrders, LOCATION_FRESH_SECONDS } = require("../src/utils/riderAssignment");

// A tiny stand-in for a MySQL pool: it answers the four queries the assignment code runs.
// `riders` is the list of riders that are free, in the order the best one comes first.
function fakePool({ waiting = [], riders = [] }) {
  const log = { begin: 0, commit: 0, rollback: 0, released: 0, pendingParams: null, updates: [] };
  const free = riders.slice();
  const connection = {
    async query(sql, params) {
      if (sql.includes("FROM orders o JOIN users u")) { log.pendingParams = params; return [waiting.map((id) => ({ id }))]; }
      if (sql.includes("SELECT rider_id FROM rider_shifts")) return [[]];
      if (sql.includes("JOIN rider_locations")) return [free.length ? [{ rider_id: free[0], active_orders: 0 }] : []];
      if (sql.includes("UPDATE orders SET rider_id")) { log.updates.push(params); free.shift(); return [{ affectedRows: 1 }]; }
      throw new Error("unexpected query: " + sql.slice(0, 40));
    },
    async beginTransaction() { log.begin += 1; },
    async commit() { log.commit += 1; },
    async rollback() { log.rollback += 1; },
    release() { log.released += 1; },
  };
  return { pool: { getConnection: async () => connection }, log };
}

test("the position window is 90 seconds", () => {
  assert.equal(LOCATION_FRESH_SECONDS, 90);
});

test("waiting orders go to the free riders, oldest order first", async () => {
  const { pool, log } = fakePool({ waiting: [11, 12], riders: [5, 6] });
  const result = await assignPendingTeacherOrders(pool);
  assert.deepEqual(result, [{ orderId: 11, riderId: 5 }, { orderId: 12, riderId: 6 }]);
  assert.deepEqual(log.updates, [[5, 11], [6, 12]]);
  assert.equal(log.commit, 2);
  assert.equal(log.released, 1);
});

test("it stops at the first order when no rider is free", async () => {
  const { pool, log } = fakePool({ waiting: [21, 22, 23], riders: [] });
  const result = await assignPendingTeacherOrders(pool);
  assert.deepEqual(result, []);
  assert.equal(log.begin, 1);
  assert.equal(log.updates.length, 0);
});

test("with no waiting orders nothing starts a transaction", async () => {
  const { pool, log } = fakePool({ waiting: [], riders: [5] });
  assert.deepEqual(await assignPendingTeacherOrders(pool), []);
  assert.equal(log.begin, 0);
  assert.equal(log.released, 1);
});

test("onAssigned runs for each assignment before its commit", async () => {
  const { pool } = fakePool({ waiting: [31], riders: [9] });
  const seen = [];
  await assignPendingTeacherOrders(pool, { onAssigned: async (pair) => { seen.push(pair); } });
  assert.deepEqual(seen, [{ orderId: 31, riderId: 9 }]);
});

test("a failing onAssigned rolls the order back and still releases the connection", async () => {
  const { pool, log } = fakePool({ waiting: [41], riders: [9] });
  await assert.rejects(
    assignPendingTeacherOrders(pool, { onAssigned: async () => { throw new Error("audit down"); } }),
    /audit down/
  );
  assert.equal(log.rollback, 1);
  assert.equal(log.commit, 0);
  assert.equal(log.released, 1);
});

test("a bad limit falls back to 100", async () => {
  for (const limit of [0, -3, 2.5, "7", undefined]) {
    const { pool, log } = fakePool({ waiting: [] });
    await assignPendingTeacherOrders(pool, { limit });
    assert.deepEqual(log.pendingParams, [100]);
  }
  const { pool, log } = fakePool({ waiting: [] });
  await assignPendingTeacherOrders(pool, { limit: 5 });
  assert.deepEqual(log.pendingParams, [5]);
});
