const test = require("node:test");
const assert = require("node:assert/strict");
const { rewardReferral, REFERRAL_BONUS, MAX_REWARDS_PER_REFERRER } = require("../src/referrals");

// Fake connection: records every statement and answers the two SELECTs.
function fakeConn({ user, paidCount = 0, failOn = null }) {
  const log = [];
  return {
    log,
    query: async (sql, params) => {
      log.push({ sql, params });
      if (failOn && sql.includes(failOn)) throw new Error("boom");
      if (sql.startsWith("SELECT id, name, referred_by")) return [[user]];
      if (sql.startsWith("SELECT COUNT(*)")) return [[{ n: paidCount }]];
      return [{}];
    },
  };
}
const sqls = (conn) => conn.log.map((l) => l.sql);
const quiet = (fn) => async () => { const old = console.error; console.error = () => {}; try { await fn(); } finally { console.error = old; } };

test("a user who was not referred gets nothing", async () => {
  const conn = fakeConn({ user: { id: 1, name: "Rahim Uddin", referred_by: null, referral_rewarded_at: null } });
  assert.equal(await rewardReferral(conn, 1), null);
  assert.ok(!sqls(conn).some((s) => s.startsWith("UPDATE")));
  assert.ok(sqls(conn).includes("RELEASE SAVEPOINT referral_reward"));
});

test("a user who was already rewarded gets nothing a second time", async () => {
  const conn = fakeConn({ user: { id: 1, name: "Rahim", referred_by: 9, referral_rewarded_at: new Date() } });
  assert.equal(await rewardReferral(conn, 1), null);
  assert.ok(!sqls(conn).some((s) => s.startsWith("UPDATE")));
});

test("an unknown user gets nothing", async () => {
  assert.equal(await rewardReferral(fakeConn({ user: undefined }), 1), null);
});

test("both the new user and the referrer are paid", async () => {
  const conn = fakeConn({ user: { id: 1, name: "Rahim Uddin", referred_by: 9, referral_rewarded_at: null }, paidCount: 3 });
  const result = await rewardReferral(conn, 1);
  assert.deepEqual(result, { userId: 1, referrerId: 9, amount: REFERRAL_BONUS, referrerPaid: true });
  const walletUpdates = conn.log.filter((l) => l.sql.includes("wallet_balance = wallet_balance + ?"));
  assert.equal(walletUpdates.length, 2);
  const txns = conn.log.filter((l) => l.sql.startsWith("INSERT INTO wallet_transactions"));
  assert.equal(txns.length, 2);
  assert.match(txns[1].params[1], /Rahim placed their first order/); // first name only
});

test("after the cap the friend is still paid but the referrer is not", async () => {
  const conn = fakeConn({
    user: { id: 1, name: "Rahim", referred_by: 9, referral_rewarded_at: null },
    paidCount: MAX_REWARDS_PER_REFERRER,
  });
  const result = await rewardReferral(conn, 1);
  assert.equal(result.referrerPaid, false);
  assert.equal(conn.log.filter((l) => l.sql.startsWith("INSERT INTO wallet_transactions")).length, 1);
});

test("a failure rolls back to the savepoint and never throws into the pickup", quiet(async () => {
  const conn = fakeConn({
    user: { id: 1, name: "Rahim", referred_by: 9, referral_rewarded_at: null },
    failOn: "UPDATE users SET referral_rewarded_at",
  });
  assert.equal(await rewardReferral(conn, 1), null);
  assert.ok(sqls(conn).includes("ROLLBACK TO SAVEPOINT referral_reward"));
}));
