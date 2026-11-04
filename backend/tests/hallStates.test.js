const test = require("node:test");
const assert = require("node:assert/strict");
const { loadStates, DEFAULT_STATE, MAX_DAYS } = require("../src/hall/states");

// A stand-in for the database: the first query is "last choice before the range", the second is "rows inside it".
function fakeDb({ before = [], inRange = [] } = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [/MAX\(the_date\)/.test(sql) ? before : inRange];
    },
  };
}

test("a person who never chose anything has every meal on", async () => {
  const days = await loadStates(fakeDb(), 7, "2026-11-02", "2026-11-03");
  assert.equal(days.length, 2);
  for (const slot of ["breakfast", "lunch", "dinner"]) {
    assert.deepEqual(days[0].slots[slot], { status: DEFAULT_STATE, source: "carry", charged: null });
  }
});

test("a choice made before the range carries into every day of it", async () => {
  const db = fakeDb({ before: [{ slot: "lunch", status: "off" }] });
  const days = await loadStates(db, 7, "2026-11-02", "2026-11-03");
  assert.equal(days[0].slots.lunch.status, "off");
  assert.equal(days[1].slots.lunch.status, "off");
  assert.equal(days[1].slots.dinner.status, "on", "other meals are not affected");
});

test("a choice inside the range changes that day and the days after it", async () => {
  const db = fakeDb({
    before: [{ slot: "lunch", status: "off" }],
    inRange: [{ d: "2026-11-03", slot: "lunch", status: "on", source: "manual", charged: null }],
  });
  const days = await loadStates(db, 7, "2026-11-02", "2026-11-04");
  assert.deepEqual(
    days.map((d) => `${d.date}:${d.slots.lunch.status}/${d.slots.lunch.source}`),
    ["2026-11-02:off/carry", "2026-11-03:on/manual", "2026-11-04:on/carry"]
  );
});

test("the price fixed at cut-off is passed through for locked meals", async () => {
  const db = fakeDb({ inRange: [{ d: "2026-11-02", slot: "dinner", status: "on", source: "auto", charged: 90 }] });
  const [day] = await loadStates(db, 7, "2026-11-02", "2026-11-02");
  assert.deepEqual(day.slots.dinner, { status: "on", source: "auto", charged: 90 });
});

test("the range is cut at MAX_DAYS and the query stops at the same day", async () => {
  const db = fakeDb();
  const days = await loadStates(db, 7, "2026-01-01", "2026-12-31");
  assert.equal(days.length, MAX_DAYS);
  assert.equal(days[days.length - 1].date, "2026-03-03");
  assert.equal(db.calls[1].params[2], "2026-03-03");
});

test("both queries are for the right person and start date", async () => {
  const db = fakeDb();
  await loadStates(db, 42, "2026-11-02", "2026-11-02");
  assert.deepEqual(db.calls[0].params, [42, "2026-11-02", 42]);
  assert.deepEqual(db.calls[1].params, [42, "2026-11-02", "2026-11-02"]);
});
