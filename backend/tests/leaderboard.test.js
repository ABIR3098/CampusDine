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

const Module = require("module");
const dbPath = require.resolve("../src/db");

let top = [];
let mine = 0;
let ahead = 0;
let fail = false;
const pool = {
  async query(sql) {
    if (fail) throw new Error("db down");
    if (sql.includes("GROUP BY u.id")) return [top];
    if (sql.includes("HAVING")) return [[{ c: ahead }]];
    return [[{ orders: mine }]];
  },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };

// Load the route with a tiny fake router so the handler can be called directly.
const handlers = {};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === "express") return { Router: () => ({ post() {}, get(p, ...h) { handlers[p] = h[h.length - 1]; } }) };
  if (request === "../middleware/auth") return { verifyToken() {} };
  return origLoad.call(this, request, ...rest);
};
try { require("../src/routes/gamification"); } finally { Module._load = origLoad; }

async function board(user) {
  const res = makeRes();
  await handlers["/leaderboard"]({ user }, res);
  return res;
}

test("top users are ranked with a badge by order count", async () => {
  fail = false; mine = 0;
  top = [{ id: 1, name: "A", orders: 25 }, { id: 2, name: "B", orders: 12 }, { id: 3, name: "C", orders: 3 }];
  const res = await board({ id: 99, name: "Me" });
  assert.deepEqual(res.body.map((r) => [r.rank, r.badge]), [[1, "Top Diner"], [2, "Regular"], [3, "Rising Diner"]]);
});

test("the current user is marked inside the top list", async () => {
  fail = false;
  top = [{ id: 1, name: "A", orders: 5 }, { id: 2, name: "B", orders: 4 }];
  const res = await board({ id: 2, name: "B" });
  assert.deepEqual(res.body.map((r) => r.isCurrent), [false, true]);
});

test("outside the top list the user gets an extra row with the real rank", async () => {
  fail = false; mine = 2; ahead = 7;
  top = [{ id: 1, name: "A", orders: 25 }];
  const res = await board({ id: 99, name: "Me" });
  const last = res.body[res.body.length - 1];
  assert.equal(last.rank, 8);
  assert.equal(last.orders, 2);
  assert.equal(last.isCurrent, true);
});

test("a user with no orders this month gets no extra row", async () => {
  fail = false; mine = 0;
  top = [{ id: 1, name: "A", orders: 25 }];
  const res = await board({ id: 99, name: "Me" });
  assert.equal(res.body.length, 1);
});

test("a database error gives 500", quiet(async () => {
  fail = true;
  const res = await board({ id: 1, name: "A" });
  assert.equal(res.code, 500);
  fail = false;
}));
