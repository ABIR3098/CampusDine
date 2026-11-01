const test = require("node:test");
const assert = require("node:assert/strict");
const { getSettings, saveSettings } = require("../src/loyalty");

const dbWith = (rows) => ({ query: async () => [rows] });
const meta = (earnPer, streakDays, streakBonus) => [
  { meta_key: "loyalty_earn_per", meta_value: String(earnPer) },
  { meta_key: "loyalty_streak_days", meta_value: String(streakDays) },
  { meta_key: "loyalty_streak_bonus", meta_value: String(streakBonus) },
];

test("with nothing saved the defaults are 1 point per ৳10, 5-day streak, 50 bonus", async () => {
  assert.deepEqual(await getSettings(dbWith([])), { earnPer: 10, streakDays: 5, streakBonus: 50 });
});

test("saved values replace the defaults", async () => {
  assert.deepEqual(await getSettings(dbWith(meta(20, 7, 100))), { earnPer: 20, streakDays: 7, streakBonus: 100 });
});

test("values that are not whole numbers are ignored", async () => {
  assert.deepEqual(await getSettings(dbWith(meta("abc", "2.5", "-5"))), { earnPer: 10, streakDays: 5, streakBonus: 50 });
});

test("earnPer below 1 and streakDays below 2 fall back to the defaults", async () => {
  const s = await getSettings(dbWith(meta(0, 1, 0)));
  assert.equal(s.earnPer, 10);
  assert.equal(s.streakDays, 5);
  assert.equal(s.streakBonus, 0); // a bonus of 0 is allowed
});

test("if the settings table is missing the defaults are used", async () => {
  const db = { query: async () => { throw new Error("no such table"); } };
  assert.deepEqual(await getSettings(db), { earnPer: 10, streakDays: 5, streakBonus: 50 });
});

test("saveSettings writes only the keys it was given, as text", async () => {
  const calls = [];
  const db = { query: async (sql, params) => { calls.push(params); return [{}]; } };
  await saveSettings(db, { earnPer: 15, streakBonus: 80 });
  assert.deepEqual(calls, [["loyalty_earn_per", "15"], ["loyalty_streak_bonus", "80"]]);
});
