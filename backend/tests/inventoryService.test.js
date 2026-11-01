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
