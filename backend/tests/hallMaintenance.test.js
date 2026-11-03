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
let last = null;
let fail = false;
const pool = {
  async query(sql, params) {
    if (fail) throw new Error("db down");
    last = { sql, params };
    return [{ insertId: 42 }];
  },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
const HallController = require("../src/controllers/hallController");

async function submit(body) {
  last = null;
  const res = makeRes();
  await HallController.submitMaintenance({ body, user: { id: 7 } }, res);
  return res;
}

test("a request is saved in hall_requests as type maintenance", async () => {
  fail = false;
  const res = await submit({ title: "Fan broken", category: "electrical", description: "not working" });
  assert.equal(res.code, 201);
  assert.equal(res.body.id, 42);
  assert.ok(last.sql.includes("INSERT INTO hall_requests"));
  assert.ok(last.sql.includes("'maintenance'"));
  assert.equal(last.params[0], 7);
});

test("the category is kept at the start of the description", async () => {
  fail = false;
  await submit({ title: "Leak", category: "plumbing", description: "tap" });
  assert.equal(last.params[2], "[plumbing] tap");
});

test("a missing title is a 400 and nothing is saved", async () => {
  fail = false;
  const res = await submit({ description: "no title" });
  assert.equal(res.code, 400);
  assert.equal(last, null);
});

test("a very long title is cut to 180 characters", async () => {
  fail = false;
  await submit({ title: "x".repeat(500) });
  assert.equal(last.params[1].length, 180);
});

test("a database error gives 500", quiet(async () => {
  fail = true;
  const res = await submit({ title: "Fan" });
  assert.equal(res.code, 500);
  fail = false;
}));
