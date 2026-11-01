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
