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

