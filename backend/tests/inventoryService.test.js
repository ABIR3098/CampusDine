const test = require("node:test");
const assert = require("node:assert/strict");
const { createService, HttpError } = require("../src/inventory/service");

// A tiny in-memory stand-in for the MySQL pool. It understands only the statements the service issues,
// supports begin/commit/rollback (rollback restores a snapshot) and lets a test force a failure.
function fakePool() {
  const st = {
    items: [{ id: 1, name: "Rice", name_bn: "চাল", category: "Grains", unit: "kg", current_stock: 10, min_stock: 5 }],
    requests: [
      { id: 1, staff_id: 3, item_id: 1, request_type: "request", current_qty: 10, required_qty: 50, status: "pending", admin_id: null, admin_reply: null },
      { id: 2, staff_id: 3, item_id: 1, request_type: "request", current_qty: 10, required_qty: 5, status: "approved", admin_id: 1, admin_reply: "ok" },
    ],
    purchases: [], history: [], failOn: null, commits: 0, rollbacks: 0,
  };
  let seq = 100;
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const run = (sql, p = []) => {
    const q = sql.replace(/\s+/g, " ").trim();
    if (st.failOn && q.includes(st.failOn)) throw new Error("db down");
    if (q.startsWith("SELECT id, status FROM inventory_requests")) return [st.requests.filter((r) => r.id === p[0]).map(({ id, status }) => ({ id, status }))];
    if (q.startsWith("SELECT id, item_id, status FROM inventory_requests")) return [st.requests.filter((r) => r.id === p[0]).map(({ id, item_id, status }) => ({ id, item_id, status }))];
    if (q.startsWith("SELECT id, current_stock FROM inventory_items")) return [st.items.filter((i) => i.id === Number(p[0])).map(({ id, current_stock }) => ({ id, current_stock }))];
    if (q.startsWith("UPDATE inventory_requests SET status = ?, admin_id")) { const r = st.requests.find((x) => x.id === p[3]); Object.assign(r, { status: p[0], admin_id: p[1], admin_reply: p[2] }); return [{}]; }
    if (q.startsWith("UPDATE inventory_requests SET status = 'purchased'")) { const r = st.requests.find((x) => x.id === p[1]); r.status = "purchased"; r.admin_id = r.admin_id ?? p[0]; return [{}]; }
    if (q.startsWith("INSERT INTO inventory_purchases")) { const id = ++seq; st.purchases.push({ id, request_id: p[0], item_id: p[1], quantity: p[3] }); return [{ insertId: id }]; }
    if (q.startsWith("UPDATE inventory_items SET current_stock")) { st.items.find((i) => i.id === Number(p[1])).current_stock = p[0]; return [{}]; }
    if (q.startsWith("INSERT INTO inventory_stock_history")) { st.history.push(p); return [{ insertId: ++seq }]; }
    if (q.includes("FROM inventory_requests q")) {
      const r = st.requests.find((x) => x.id === p[0]);
      const i = st.items.find((x) => x.id === r.item_id);
      const pur = st.purchases.find((x) => x.request_id === r.id);
      return [[{ ...r, item_name: i.name, item_name_bn: i.name_bn, unit: i.unit, official_stock: i.current_stock, staff_name: "Staff", purchased_qty: pur ? pur.quantity : null, stock_after: pur ? i.current_stock : null }]];
    }
    throw new Error("Unhandled SQL in test: " + q.slice(0, 80));
  };
  let snapshot;
  const conn = {
    query: async (s, p) => run(s, p),
    beginTransaction: async () => { snapshot = clone({ items: st.items, requests: st.requests, purchases: st.purchases, history: st.history }); },
    commit: async () => { st.commits++; },
    rollback: async () => { st.rollbacks++; Object.assign(st, clone(snapshot)); },
    release: () => {},
  };
  return { st, query: async (s, p) => run(s, p), getConnection: async () => conn };
}

test("approving a pending request stores the admin reply", async () => {
  const pool = fakePool(); const svc = createService(pool);
  const r = await svc.decide(1, 1, { decision: "approved", reply: "Buy 50 kg" });
  assert.equal(r.status, "approved");
  assert.equal(r.adminReply, "Buy 50 kg");
  assert.equal(pool.st.commits, 1);
});

test("a request cannot be decided twice", async () => {
  const svc = createService(fakePool());
  await svc.decide(1, 1, { decision: "rejected", reply: "No budget" });
  await assert.rejects(svc.decide(1, 1, { decision: "approved", reply: "" }), (e) => e instanceof HttpError && e.status === 409);
});

test("unknown request gives 404", async () => {
  await assert.rejects(createService(fakePool()).decide(1, 55, { decision: "approved", reply: "" }), (e) => e.status === 404);
});

test("recording a purchase for an approved request updates stock, history and status together", async () => {
  const pool = fakePool(); const svc = createService(pool);
  const out = await svc.recordPurchase(1, { requestId: 2, itemId: null, quantity: 5, unitCost: 60, totalCost: 300, supplier: "Karim", note: "" });
  assert.equal(out.stockBefore, 10);
  assert.equal(out.stockAfter, 15);
  assert.equal(pool.st.items[0].current_stock, 15);
  assert.equal(pool.st.requests[1].status, "purchased");
  assert.equal(pool.st.history.length, 1);
  assert.equal(pool.st.history[0][4], out.purchaseId);
});

test("a pending request must be approved before it can be bought", async () => {
  const pool = fakePool();
  await assert.rejects(createService(pool).recordPurchase(1, { requestId: 1, quantity: 5 }), (e) => e.status === 409 && /Approve/.test(e.message));
  assert.equal(pool.st.items[0].current_stock, 10);
});

test("a request cannot be purchased twice", async () => {
  const svc = createService(fakePool());
  await svc.recordPurchase(1, { requestId: 2, quantity: 5, unitCost: null, totalCost: null });
  await assert.rejects(svc.recordPurchase(1, { requestId: 2, quantity: 5 }), (e) => e.status === 409);
});

