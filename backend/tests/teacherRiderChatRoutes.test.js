// Route-level checks for the teacher <-> rider chat. The database is a small in-memory fake.
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

process.env.JWT_SECRET = "route-test-secret";
const jwt = require("jsonwebtoken");

const TEACHER = 1, RIDER = 2, STUDENT = 3, RIDER_B = 4, TEACHER_B = 5, ADMIN = 6;
const users = {
  [TEACHER]: { id: TEACHER, name: "Dr. Karim", role: "teacher", external_id: "T-100" },
  [RIDER]: { id: RIDER, name: "Rahim Rider", role: "rider", external_id: "R-200" },
  [STUDENT]: { id: STUDENT, name: "Sadia Student", role: "student", external_id: "S-300" },
  [RIDER_B]: { id: RIDER_B, name: "Babul Rider", role: "rider", external_id: "R-201" },
  [TEACHER_B]: { id: TEACHER_B, name: "Dr. Selina", role: "teacher", external_id: "T-101" },
  [ADMIN]: { id: ADMIN, name: "Canteen Admin", role: "admin", external_id: "A-1" },
};
const db = { orders: [], threads: [], messages: [] };
const reset = () => { db.orders = [{ id: 10, user_id: TEACHER, rider_id: RIDER }]; db.threads = []; db.messages = []; };
const sent = []; // every live event the server emitted
const lastWord = (sql) => sql.replace(/\s+/g, " ").trim();

function answer(rawSql, p = []) {
  const sql = lastWord(rawSql);
  if (/^CREATE TABLE/i.test(sql)) return [[]];
  if (/FROM users WHERE id = \? AND role = \?/.test(sql)) { const u = users[p[0]]; return [u && u.role === p[1] ? [u] : []]; }
  if (/FROM users WHERE role = \? AND \(name LIKE/.test(sql)) {
    const needle = String(p[1]).replace(/[%\\]/g, "").toLowerCase();
    const linked = /rider_id = \?/.test(sql) ? db.orders.filter((o) => o.rider_id === p[3]).map((o) => o.user_id) : null;
    return [Object.values(users).filter((u) => u.role === p[0] && u.name.toLowerCase().includes(needle) && (!linked || linked.includes(u.id)))];
  }
  if (/FROM orders o JOIN users u/.test(sql)) {
    const teacherSide = /ON u\.id = o\.rider_id/.test(sql);
    const ids = db.orders.filter((o) => (teacherSide ? o.user_id : o.rider_id) === p[0]).map((o) => (teacherSide ? o.rider_id : o.user_id));
    return [[...new Set(ids)].map((id) => ({ ...users[id], last_order_id: 10 }))];
  }
  if (/FROM orders WHERE user_id = \? AND rider_id = \?/.test(sql)) return [db.orders.filter((o) => o.user_id === p[0] && o.rider_id === p[1]).slice(0, 1)];
  if (/FROM teacher_rider_threads WHERE teacher_id = \? AND rider_id = \?/.test(sql)) return [db.threads.filter((t) => t.teacher_id === p[0] && t.rider_id === p[1])];
  if (/^INSERT INTO teacher_rider_threads/.test(sql)) {
    if (!db.threads.some((t) => t.teacher_id === p[0] && t.rider_id === p[1])) db.threads.push({ id: db.threads.length + 1, teacher_id: p[0], rider_id: p[1] });
    return [{}];
  }
  if (/^UPDATE teacher_rider_threads/.test(sql)) return [{}];
  if (/^INSERT INTO teacher_rider_messages/.test(sql)) {
    const m = { id: db.messages.length + 1, thread_id: p[0], sender_id: p[1], recipient_id: p[2], message: p[3], read_at: null, deleted_at: null, created_at: "now" };
    db.messages.push(m);
    return [{ insertId: m.id }];
  }
  if (/SELECT MIN\(id\) AS id FROM teacher_rider_messages/.test(sql)) {
    const ids = db.messages.filter((m) => m.thread_id === p[0] && m.recipient_id === p[1] && !m.read_at && !m.deleted_at).map((m) => m.id);
    return [[{ id: ids.length ? Math.min(...ids) : null }]];
  }
  if (/^UPDATE teacher_rider_messages SET read_at/.test(sql)) { db.messages.filter((m) => m.thread_id === p[0] && m.recipient_id === p[1] && !m.read_at).forEach((m) => { m.read_at = "now"; }); return [{}]; }
  if (/FROM \(SELECT \* FROM teacher_rider_messages WHERE thread_id = \?/.test(sql)) {
    return [db.messages.filter((m) => m.thread_id === p[0]).map((m) => ({ ...m, message: m.deleted_at ? "" : m.message, sender_name: users[m.sender_id].name, sender_role: users[m.sender_id].role }))];
  }
  if (/SELECT recipient_id, thread_id FROM teacher_rider_messages WHERE id = \? AND sender_id = \?/.test(sql)) {
    return [db.messages.filter((m) => m.id === p[0] && m.sender_id === p[1] && !m.deleted_at)];
  }
  if (/^UPDATE teacher_rider_messages SET deleted_at/.test(sql)) { db.messages.find((m) => m.id === p[0]).deleted_at = "now"; return [{}]; }
  if (/COUNT\(\*\) AS unread FROM teacher_rider_messages WHERE recipient_id/.test(sql)) return [[{ unread: db.messages.filter((m) => m.recipient_id === p[0] && !m.read_at && !m.deleted_at).length }]];
  if (/FROM teacher_rider_threads t JOIN users u/.test(sql)) {
    const mineCol = /WHERE t\.teacher_id = \?/.test(sql) ? "teacher_id" : "rider_id";
    const theirCol = mineCol === "teacher_id" ? "rider_id" : "teacher_id";
    return [db.threads.filter((t) => t[mineCol] === p[1]).map((t) => {
      const mine = db.messages.filter((m) => m.thread_id === t.id);
      const last = mine[mine.length - 1];
      return { thread_id: t.id, ...users[t[theirCol]], peer_id: t[theirCol], updated_at: "now", last_message: last ? last.message : null, last_deleted: last && last.deleted_at ? 1 : 0, unread_count: mine.filter((m) => m.recipient_id === p[0] && !m.read_at && !m.deleted_at).length };
    })];
  }
  throw new Error("Unexpected query in the fake database: " + sql);
}
const conn = { query: async (s, p) => answer(s, p), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
const fakePool = { query: async (s, p) => answer(s, p), getConnection: async () => conn };
const dbPath = require.resolve("../src/db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const express = require("express");
const router = require("../src/routes/teacherRiderChat");
const app = express();
app.use(express.json());
app.set("io", { to: (room) => ({ emit: (event, payload) => sent.push({ room, event, payload }) }) });
app.use("/api/teacher-rider-chat", router);

let server, base;
test.before(async () => { server = http.createServer(app); await new Promise((r) => server.listen(0, r)); base = "http://127.0.0.1:" + server.address().port; });
test.after(() => server.close());
test.beforeEach(() => { reset(); sent.length = 0; });

const token = (id) => jwt.sign({ id, name: users[id].name, role: users[id].role }, process.env.JWT_SECRET);
const call = async (id, method, url, body) => {
  const headers = { "Content-Type": "application/json" };
  if (id) headers.Authorization = "Bearer " + token(id);
  const res = await fetch(base + "/api/teacher-rider-chat" + url, { method, headers, body: body && method !== "GET" ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

test("a request without a login token is refused", async () => {
  assert.equal((await call(null, "GET", "/threads")).status, 401);
});

test("students and the canteen admin cannot use this chat", async () => {
  for (const id of [STUDENT, ADMIN]) {
    for (const [method, url] of [["GET", "/threads"], ["GET", "/contacts"], ["GET", "/unread"], ["GET", "/directory?q=ra"], ["GET", "/" + RIDER + "/messages"], ["POST", "/" + RIDER + "/messages"], ["DELETE", "/messages/1"]]) {
      assert.equal((await call(id, method, url, { message: "hi" })).status, 403, users[id].role + " " + method + " " + url);
    }
  }
});

test("a bad user id is a 400", async () => {
  assert.equal((await call(TEACHER, "GET", "/abc/messages")).status, 400);
  assert.equal((await call(TEACHER, "POST", "/0/messages", { message: "hi" })).status, 400);
});

test("a teacher cannot chat with a teacher, a student or someone who does not exist", async () => {
  for (const id of [TEACHER_B, STUDENT, 999]) {
    assert.equal((await call(TEACHER, "GET", "/" + id + "/messages")).status, 404, "read " + id);
    assert.equal((await call(TEACHER, "POST", "/" + id + "/messages", { message: "hi" })).status, 404, "write " + id);
  }
});

test("a rider cannot chat with another rider", async () => {
  assert.equal((await call(RIDER, "POST", "/" + RIDER_B + "/messages", { message: "hi" })).status, 404);
});

test("the directory needs two letters", async () => {
  assert.deepEqual((await call(TEACHER, "GET", "/directory?q=r")).body, { users: [] });
});
