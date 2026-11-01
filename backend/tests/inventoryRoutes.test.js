const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
const { createInventoryRouter } = require("../src/routes/inventory");
const { HttpError } = require("../src/inventory/service");

const calls = [];
const record = (name) => async (...args) => { calls.push([name, ...args]); return stub[name + "Result"] ?? {}; };
const stub = {
  listItems: async () => [{ id: 1, name: "Rice", unit: "kg", currentStock: 100, minStock: 10, level: "ok" }],
  createRequest: async (staffId, v) => { calls.push(["createRequest", staffId, v]); return { id: 7, staffId, itemName: "Rice", status: "pending" }; },
  listStaffRequests: async (id) => { calls.push(["listStaffRequests", id]); return []; },
  listAllRequests: record("listAllRequests"),
  getRequest: async () => ({ id: 7, staffId: 3, status: "purchased" }),
  decide: async (adminId, id, v) => { calls.push(["decide", adminId, id, v]); if (id === 99) throw new HttpError(409, "This request is already rejected."); return { id, staffId: 3, status: v.decision, adminReply: v.reply, itemName: "Rice" }; },
  recordPurchase: async (adminId, v) => { calls.push(["recordPurchase", adminId, v]); return { purchaseId: 1, itemId: 1, stockBefore: 10, stockAfter: 20, requestId: v.requestId }; },
  adjustStock: async (adminId, id, v) => { calls.push(["adjustStock", adminId, id, v]); return { itemId: id, stockBefore: 1, stockAfter: v.newStock }; },
  addItem: async (adminId, v) => ({ id: 9, ...v }),
  recordUsage: async (staffId, v) => { calls.push(["recordUsage", staffId, v]); return { usageId: 1, stockAfter: 5, level: "ok" }; },
  listStaffUsage: async (id) => { calls.push(["listStaffUsage", id]); return []; },
  listAllUsage: async () => [],
  listPurchases: async () => [], listHistory: async () => [], summary: async () => ({ pending: 0 }),
};

const tokenFor = (role, id = 3) => jwt.sign({ id, name: role, role }, process.env.JWT_SECRET);
let server, base;
test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/inventory", createInventoryRouter(stub));
  app.use((err, req, res, next) => res.status(500).json({ error: "boom" }));
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api/inventory`;
});
test.after(() => server.close());

const req = (path, { method = "GET", role, body } = {}) => fetch(base + path, {
  method,
  headers: { "Content-Type": "application/json", ...(role ? { Authorization: `Bearer ${tokenFor(role)}` } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test("everything needs a login", async () => {
  assert.equal((await req("/items")).status, 401);
  assert.equal((await req("/admin/summary")).status, 401);
});

test("students, teachers and riders cannot use the inventory", async () => {
  for (const role of ["student", "teacher", "rider", "hall_admin"]) {
    assert.equal((await req("/items", { role })).status, 403, role);
    assert.equal((await req("/requests", { role, method: "POST", body: { itemId: 1, currentQty: 1, requiredQty: 2 } })).status, 403, role);
  }
});

test("staff can read stock and send a request; the server uses the token's id", async () => {
  assert.equal((await req("/items", { role: "staff" })).status, 200);
  calls.length = 0;
  const r = await req("/requests", { role: "staff", method: "POST", body: { itemId: 1, currentQty: "2", requiredQty: "30", staffId: 999 } });
  assert.equal(r.status, 201);
  assert.equal(calls[0][1], 3);
  assert.equal(calls[0][2].requiredQty, 30);
});

test("bad staff input is rejected before touching the database", async () => {
  calls.length = 0;
  const r = await req("/requests", { role: "staff", method: "POST", body: { itemId: 1, currentQty: "x", requiredQty: 5 } });
  assert.equal(r.status, 400);
  assert.equal(calls.length, 0);
});

test("staff can see only their own requests", async () => {
  calls.length = 0;
  assert.equal((await req("/requests/mine", { role: "staff" })).status, 200);
  assert.deepEqual(calls[0], ["listStaffRequests", 3]);
});

test("staff can never change stock, decide requests, buy or add items", async () => {
  calls.length = 0;
  const attempts = [
    ["/admin/items/1/adjust", { newStock: 5000, note: "cheat" }],
    ["/admin/purchases", { itemId: 1, quantity: 10 }],
    ["/admin/requests/7/decision", { decision: "approved" }],
    ["/admin/items", { name: "Gold", unit: "kg" }],
  ];
  for (const [path, body] of attempts) assert.equal((await req(path, { role: "staff", method: "POST", body })).status, 403, path);
  for (const path of ["/admin/summary", "/admin/requests", "/admin/purchases", "/admin/history"]) assert.equal((await req(path, { role: "staff" })).status, 403, path);
  assert.equal(calls.length, 0);
});

test("admin approves, rejects (reason required), records purchases and corrects stock", async () => {
  assert.equal((await req("/admin/requests/7/decision", { role: "admin", method: "POST", body: { decision: "rejected" } })).status, 400);
  const ok = await req("/admin/requests/7/decision", { role: "admin", method: "POST", body: { decision: "approved", reply: "Buy today" } });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).request.adminReply, "Buy today");
  const buy = await req("/admin/purchases", { role: "admin", method: "POST", body: { requestId: 7, quantity: 10, unitCost: 60 } });
  assert.equal(buy.status, 201);
  assert.equal((await buy.json()).stockAfter, 20);
  assert.equal((await req("/admin/items/1/adjust", { role: "admin", method: "POST", body: { newStock: 5 } })).status, 400);
  assert.equal((await req("/admin/items/1/adjust", { role: "admin", method: "POST", body: { newStock: 5, note: "Recount" } })).status, 200);
});

test("service errors become clean JSON responses", async () => {
  const r = await req("/admin/requests/99/decision", { role: "admin", method: "POST", body: { decision: "approved" } });
  assert.equal(r.status, 409);
  assert.match((await r.json()).error, /already rejected/);
});

test("staff records usage with the token's id; others cannot", async () => {
  calls.length = 0;
  const ok = await req("/usage", { role: "staff", method: "POST", body: { itemId: 1, quantity: "3kg" } });
  assert.equal(ok.status, 201);
  assert.equal(calls[0][1], 3);
  assert.equal(calls[0][2].quantity, 3);
