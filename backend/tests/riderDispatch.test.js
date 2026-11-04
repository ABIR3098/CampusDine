const test = require("node:test");
const assert = require("node:assert/strict");
const { createRiderDispatcher } = require("../src/services/riderDispatch");

function fakePool({ waiting = [], riders = [], failOn = null } = {}) {
  const free = riders.slice();
  const log = { pendingRuns: 0, audits: [] };
  const connection = {
    async query(sql, params) {
      if (failOn && sql.includes(failOn)) throw new Error("database down");
      if (sql.includes("FROM orders o JOIN users u")) { log.pendingRuns += 1; return [waiting.slice(0, free.length || 1).map((id) => ({ id }))]; }
      if (sql.includes("SELECT rider_id FROM rider_shifts")) return [[]];
      if (sql.includes("JOIN rider_locations")) return [free.length ? [{ rider_id: free[0], active_orders: 0 }] : []];
      if (sql.includes("UPDATE orders SET rider_id")) { free.shift(); return [{ affectedRows: 1 }]; }
      if (sql.includes("INSERT INTO audit_logs")) { log.audits.push(params); return [{}]; }
      throw new Error("unexpected query: " + sql.slice(0, 40));
    },
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
  };
  return { pool: { getConnection: async () => connection }, log };
}

function fakeIo() {
  const sent = [];
  return { sent, to(room) { return { emit(event, payload) { sent.push({ room, event, payload }); } }; } };
}

test("an assigned order tells the rider and is written to the audit log by the system", async () => {
  const { pool, log } = fakePool({ waiting: [7], riders: [3] });
  const io = fakeIo();
  const result = await createRiderDispatcher({ pool }).dispatch({ io });
  assert.deepEqual(result, [{ orderId: 7, riderId: 3 }]);
  assert.deepEqual(io.sent, [{ room: "rider:3", event: "rider:order-assigned", payload: { orderId: 7 } }]);
  assert.equal(log.audits.length, 1);
  assert.equal(log.audits[0][0], null);
  assert.equal(log.audits[0][1], "system");
  assert.equal(log.audits[0][2], "AUTO_RIDER_ASSIGN");
});

test("when a person caused the run, the audit log names that person", async () => {
  const { pool, log } = fakePool({ waiting: [8], riders: [4] });
  const req = { user: { id: 4, role: "rider" }, socket: { remoteAddress: "10.0.0.5" } };
  await createRiderDispatcher({ pool }).dispatch({ req });
  assert.equal(log.audits[0][0], 4);
  assert.equal(log.audits[0][1], "rider");
});

test("a call made during a run shares that run", async () => {
  const { pool, log } = fakePool({ waiting: [9], riders: [5] });
  const dispatcher = createRiderDispatcher({ pool });
  const [a, b] = await Promise.all([dispatcher.dispatch(), dispatcher.dispatch()]);
  assert.deepEqual(a, b);
  assert.equal(log.pendingRuns, 1);
});

test("minGapMs skips a run that comes too soon and allows it later", async () => {
  const { pool, log } = fakePool({ waiting: [], riders: [] });
  let clock = 1000;
  const dispatcher = createRiderDispatcher({ pool, now: () => clock });
  await dispatcher.dispatch({ minGapMs: 5000 });
  assert.equal(log.pendingRuns, 1);
  clock += 2000;
  await dispatcher.dispatch({ minGapMs: 5000 });
  assert.equal(log.pendingRuns, 1);
  clock += 4000;
  await dispatcher.dispatch({ minGapMs: 5000 });
  assert.equal(log.pendingRuns, 2);
});

test("without minGapMs every call runs", async () => {
  const { pool, log } = fakePool();
  const dispatcher = createRiderDispatcher({ pool, now: () => 1000 });
  await dispatcher.dispatch();
  await dispatcher.dispatch();
  assert.equal(log.pendingRuns, 2);
});

test("dispatchQuietly turns a database error into an empty result", async () => {
  const { pool } = fakePool({ failOn: "FROM orders o JOIN users u" });
  const original = console.error;
  const lines = [];
  console.error = (...args) => lines.push(args.join(" "));
  try {
    assert.deepEqual(await createRiderDispatcher({ pool }).dispatchQuietly(), []);
  } finally {
    console.error = original;
  }
  assert.match(lines[0], /database down/);
});

test("after an error the next run can start", async () => {
  const { pool } = fakePool({ failOn: "FROM orders o JOIN users u" });
  const dispatcher = createRiderDispatcher({ pool });
  await assert.rejects(dispatcher.dispatch(), /database down/);
  await assert.rejects(dispatcher.dispatch(), /database down/);
});
