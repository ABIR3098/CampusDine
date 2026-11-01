const test = require("node:test");
const assert = require("node:assert/strict");
const { summaryFor } = require("../src/loyalty");

const NOW = new Date("2026-10-31T06:00:00Z"); // 12:00 on 31 Oct in Dhaka

// Fake database for summaryFor: one loyalty account plus empty settings, rewards and ledger.
function fakeDb(account, { rewards = [], pending = 0 } = {}) {
  return {
    query: async (sql) => {
      if (sql.startsWith("INSERT IGNORE INTO loyalty_accounts")) return [{}];
      if (sql.includes("FROM loyalty_accounts")) return [[{ user_id: 1, points: 0, lifetime_points: 0, streak: 0, best_streak: 0, last_order_date: null, ...account }]];
      if (sql.includes("FROM app_meta")) return [[]];
      if (sql.includes("COUNT(*)")) return [[{ n: pending }]];
      if (sql.includes("FROM loyalty_rewards")) return [rewards];
      if (sql.includes("FROM loyalty_ledger")) return [[]];
      throw new Error("unexpected query: " + sql.slice(0, 40));
    },
  };
}

test("a new account has no streak and 5 days to the bonus", async () => {
  const s = await summaryFor(fakeDb({}), 1, NOW);
  assert.equal(s.streak.current, 0);
  assert.equal(s.streak.orderedToday, false);
  assert.equal(s.streak.target, 5);
  assert.equal(s.streak.daysToBonus, 5);
  assert.equal(s.streak.bonus, 50);
});

test("an order today keeps the streak and marks today as done", async () => {
  const s = await summaryFor(fakeDb({ streak: 3, best_streak: 3, last_order_date: "2026-10-31" }), 1, NOW);
  assert.equal(s.streak.current, 3);
  assert.equal(s.streak.orderedToday, true);
  assert.equal(s.streak.cycleDays, 3);
  assert.equal(s.streak.daysToBonus, 2);
});

test("the last order was yesterday: the streak is still alive but today is not done", async () => {
  const s = await summaryFor(fakeDb({ streak: 4, last_order_date: "2026-10-30" }), 1, NOW);
  assert.equal(s.streak.current, 4);
  assert.equal(s.streak.orderedToday, false);
});

test("a whole day was missed: the streak is back to 0", async () => {
  const s = await summaryFor(fakeDb({ streak: 4, best_streak: 4, last_order_date: "2026-10-29" }), 1, NOW);
  assert.equal(s.streak.current, 0);
  assert.equal(s.streak.best, 4); // the best streak is kept
});

test("a full 5-day row shows all 5 dots and a fresh 5 days to the next bonus", async () => {
  const s = await summaryFor(fakeDb({ streak: 5, last_order_date: "2026-10-31" }), 1, NOW);
  assert.equal(s.streak.cycleDays, 5);
  assert.equal(s.streak.daysToBonus, 5);
});

test("a Date object from the database is read as a plain day", async () => {
  const s = await summaryFor(fakeDb({ streak: 2, last_order_date: new Date(2026, 9, 31) }), 1, NOW);
  assert.equal(s.streak.orderedToday, true);
});

test("rewards are marked affordable only when the points are enough", async () => {
  const rewards = [{ id: 1, name: "৳20 off", points_cost: 100 }, { id: 2, name: "Free tea", points_cost: 300 }];
  const s = await summaryFor(fakeDb({ points: 150 }, { rewards }), 1, NOW);
  assert.deepEqual(s.rewards.map((r) => r.affordable), [true, false]);
  assert.equal(s.points, 150);
});

test("orders still being prepared are counted as pending", async () => {
  const s = await summaryFor(fakeDb({}, { pending: 2 }), 1, NOW);
  assert.equal(s.streak.pendingOrders, 2);
});
