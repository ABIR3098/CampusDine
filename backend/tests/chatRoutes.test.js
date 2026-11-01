// Route-level checks for the two chats (canteen and hall) with a fake database.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");

process.env.JWT_SECRET = "route-test-secret";
const jwt = require("jsonwebtoken");

const calls = [];
const ADMIN = 1, HALL_ADMIN = 2, STUDENT = 3, RIDER = 4;
const roleById = { [ADMIN]: "admin", [HALL_ADMIN]: "hall_admin", [STUDENT]: "student", [RIDER]: "rider" };
const answer = (sql, params = []) => {
  calls.push({ sql, params });
  if (/Non_unique/.test(sql)) return [[]];
  if (/SHOW (COLUMNS|INDEX)/.test(sql)) return [[{}]];
  if (/^\s*CREATE TABLE/i.test(sql)) return [[]];
  if (/FROM users WHERE role = \?/.test(sql)) return [[{ id: params[0] === "hall_admin" ? HALL_ADMIN : ADMIN }]];
  if (/FROM users WHERE id = \?/.test(sql)) return [[{ id: params[0], name: "x", role: roleById[params[0]] || "student" }]];
  if (/FROM chat_conversations c\s+JOIN users/.test(sql)) return [[]];
  if (/FROM chat_conversations WHERE user_id/.test(sql)) return [[{ id: 5 }]];
  if (/INSERT INTO chat_messages/.test(sql)) return [{ insertId: 7 }];
  if (/MIN\(id\)/.test(sql)) return [[{ id: null }]];
  if (/COUNT\(\*\) AS unread/.test(sql)) return [[{ unread: 2 }]];
  if (/^\s*SELECT m\.id/.test(sql)) return [[]];
  return [[]];
};
const conn = { query: async (s, p) => answer(s, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
const fakePool = { query: async (s, p) => answer(s, p), execute: async (s, p) => answer(s, p), getConnection: async () => conn };
const dbPath = require.resolve("../src/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const express = require("express");
const chatRouter = require("../src/routes/chat");
const app = express();
app.use(express.json());
app.set("io", { to: () => ({ emit() {} }), sockets: { sockets: new Map() }, on() {} });
app.use("/api/chat", chatRouter);

let server, base;
test.before(async () => { server = http.createServer(app); await new Promise((r) => server.listen(0, r)); base = "http://127.0.0.1:" + server.address().port; });
test.after(() => server.close());

const token = (id) => jwt.sign({ id, name: roleById[id], role: roleById[id] }, process.env.JWT_SECRET);
const call = async (id, method, url, body) => {
  calls.length = 0;
  const res = await fetch(base + "/api/chat" + url, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token(id) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, calls: calls.filter((c) => !/SHOW |CREATE TABLE/.test(c.sql)) };
};

test("canteen admin opens its Hall chat (was Forbidden) and reads the hall conversation", async () => {
  const r = await call(ADMIN, "GET", "/messages?scope=hall");
  assert.equal(r.status, 200);
  assert.ok(r.calls.some((c) => /FROM chat_conversations WHERE user_id/.test(c.sql) && c.params[0] === ADMIN && c.params[1] === "hall"));
});

test("canteen admin cannot use the member view outside the Hall", async () => {
  assert.equal((await call(ADMIN, "GET", "/messages")).status, 403);
});

test("student reads canteen chat by default and hall chat with scope=hall", async () => {
  let r = await call(STUDENT, "GET", "/messages");
  assert.equal(r.status, 200);
  assert.ok(r.calls.some((c) => /FROM chat_conversations WHERE user_id/.test(c.sql) && c.params[1] === "canteen"));
  r = await call(STUDENT, "GET", "/messages?scope=hall");
  assert.ok(r.calls.some((c) => /FROM chat_conversations WHERE user_id/.test(c.sql) && c.params[1] === "hall"));
});

test("student message goes to the right admin", async () => {
  let r = await call(STUDENT, "POST", "/messages", { message: "hi" });
  assert.equal(r.status, 201);
  assert.ok(r.calls.some((c) => /FROM users WHERE role = \?/.test(c.sql) && c.params[0] === "admin"));
  r = await call(STUDENT, "POST", "/messages", { message: "hi", scope: "hall" });
  assert.equal(r.status, 201);
  assert.ok(r.calls.some((c) => /FROM users WHERE role = \?/.test(c.sql) && c.params[0] === "hall_admin"));
});

test("canteen admin writes to the Hall Admin inside the Hall", async () => {
  const r = await call(ADMIN, "POST", "/messages", { message: "hello hall admin", scope: "hall" });
  assert.equal(r.status, 201);
  assert.ok(r.calls.some((c) => /FROM users WHERE role = \?/.test(c.sql) && c.params[0] === "hall_admin"));
  assert.ok(r.calls.some((c) => /INSERT INTO chat_conversations/.test(c.sql) && c.params[0] === ADMIN && c.params[1] === "hall"));
});

test("canteen admin answering a student still uses the canteen inbox", async () => {
  const r = await call(ADMIN, "POST", "/messages", { message: "ok", userId: STUDENT });
  assert.equal(r.status, 201);
  assert.ok(r.calls.some((c) => /INSERT INTO chat_conversations/.test(c.sql) && c.params[0] === STUDENT && c.params[1] === "canteen"));
});

test("hall admin answers the canteen admin and students in the hall inbox", async () => {
  for (const target of [ADMIN, STUDENT]) {
    const r = await call(HALL_ADMIN, "POST", "/messages", { message: "reply", userId: target });
    assert.equal(r.status, 201, "target " + target);
    assert.ok(r.calls.some((c) => /INSERT INTO chat_conversations/.test(c.sql) && c.params[0] === target && c.params[1] === "hall"));
  }
});

test("inbox lists ignore a scope parameter: the canteen admin never gets the hall inbox", async () => {
  const r = await call(ADMIN, "GET", "/conversations?scope=hall");
  assert.equal(r.status, 200);
  assert.ok(r.calls.some((c) => /FROM chat_conversations c/.test(c.sql) && c.params[1] === "canteen"));
  const h = await call(HALL_ADMIN, "GET", "/conversations");
  assert.ok(h.calls.some((c) => /FROM chat_conversations c/.test(c.sql) && c.params[1] === "hall"));
});

test("rider reads the canteen conversation, even when it asks for the hall", async () => {
  for (const url of ["/messages", "/messages?scope=hall"]) {
    const r = await call(RIDER, "GET", url);
    assert.equal(r.status, 200, url);
    assert.ok(r.calls.some((c) => /FROM chat_conversations WHERE user_id/.test(c.sql) && c.params[0] === RIDER && c.params[1] === "canteen"), url);
  }
});

test("rider message goes to the canteen admin, never to the hall admin", async () => {
  for (const body of [{ message: "I am at the gate" }, { message: "I am at the gate", scope: "hall" }]) {
    const r = await call(RIDER, "POST", "/messages", body);
    assert.equal(r.status, 201);
    assert.ok(r.calls.some((c) => /FROM users WHERE role = \?/.test(c.sql) && c.params[0] === "admin"));
    assert.ok(r.calls.some((c) => /INSERT INTO chat_conversations/.test(c.sql) && c.params[0] === RIDER && c.params[1] === "canteen"));
    assert.ok(!r.calls.some((c) => /FROM users WHERE role = \?/.test(c.sql) && c.params[0] === "hall_admin"));
  }
});

test("canteen admin opens and answers a rider in the canteen inbox", async () => {
  let r = await call(ADMIN, "GET", "/" + RIDER + "/messages");
  assert.equal(r.status, 200);
  assert.ok(r.calls.some((c) => /FROM chat_conversations WHERE user_id/.test(c.sql) && c.params[0] === RIDER && c.params[1] === "canteen"));
  r = await call(ADMIN, "POST", "/messages", { message: "Please wait at the hall gate", userId: RIDER });
  assert.equal(r.status, 201);
  assert.ok(r.calls.some((c) => /INSERT INTO chat_conversations/.test(c.sql) && c.params[0] === RIDER && c.params[1] === "canteen"));
});

test("the hall admin cannot open or write to a rider", async () => {
  let r = await call(HALL_ADMIN, "GET", "/" + RIDER + "/messages");
  assert.ok(r.calls.some((c) => /FROM users WHERE id = \?/.test(c.sql) && c.params[1] === "hall" && c.params[2] === "hall"));
  assert.ok(r.calls.some((c) => /role <> 'rider'/.test(c.sql)));
  r = await call(HALL_ADMIN, "POST", "/messages", { message: "hi", userId: RIDER });
  assert.ok(r.calls.some((c) => /FROM users WHERE id = \?/.test(c.sql) && /NOT IN \('staff', 'rider'\)/.test(c.sql) && c.params[1] === "hall"));
});

test("the directory looks for riders in the canteen inbox only", async () => {
  let r = await call(ADMIN, "GET", "/directory?q=rid");
  assert.equal(r.status, 200);
  const c = r.calls.find((x) => /FROM users WHERE role IN/.test(x.sql));
  assert.ok(/'rider'/.test(c.sql));
  assert.deepEqual(c.params.slice(0, 2), ["canteen", "canteen"]);
  r = await call(HALL_ADMIN, "GET", "/directory?q=rid");
  assert.deepEqual(r.calls.find((x) => /FROM users WHERE role IN/.test(x.sql)).params.slice(0, 2), ["hall", "hall"]);
});

test("unread count: the rider counts the canteen inbox, the hall admin the hall inbox", async () => {
  let r = await call(RIDER, "GET", "/unread");
  assert.equal(r.status, 200);
  assert.ok(r.calls.some((c) => /COUNT\(\*\) AS unread/.test(c.sql) && c.params[0] === RIDER && c.params[1] === "canteen"));
  r = await call(HALL_ADMIN, "GET", "/unread");
  assert.ok(r.calls.some((c) => /COUNT\(\*\) AS unread/.test(c.sql) && c.params[1] === "hall"));
});
