const test = require("node:test");
const assert = require("node:assert/strict");
const { acceptAssignedOrder } = require("../src/utils/riderAccept");

// The pool answers the UPDATE with `affected` rows and the SELECT with `row` (or no row).
function fakePool({ affected, row }) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes("UPDATE orders")) return [{ affectedRows: affected }];
      return [row ? [row] : []];
    },
  };
}

test("an assigned order is accepted and the teacher's id is returned", async () => {
  const pool = fakePool({ affected: 1, row: { user_id: 12, token: "T-1", status: "Cooking", rider_assignment_status: "Accepted" } });
  const result = await acceptAssignedOrder(pool, { orderId: 5, riderId: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.order.user_id, 12);
  assert.deepEqual(pool.calls[0].params, [5, 3]);
});

test("accepting an order the rider already accepted is ok but changes nothing", async () => {
  const pool = fakePool({ affected: 0, row: { user_id: 12, token: "T-1", status: "Ready", rider_assignment_status: "Accepted" } });
  const result = await acceptAssignedOrder(pool, { orderId: 5, riderId: 3 });
  assert.deepEqual([result.ok, result.changed], [true, false]);
});

test("an order that belongs to another rider is refused", async () => {
  const pool = fakePool({ affected: 0, row: null });
  assert.deepEqual(await acceptAssignedOrder(pool, { orderId: 5, riderId: 9 }), { ok: false });
});

test("a cancelled order is refused even if it was accepted before", async () => {
  const pool = fakePool({ affected: 0, row: { user_id: 12, token: "T-1", status: "Cancelled", rider_assignment_status: "Accepted" } });
  assert.deepEqual(await acceptAssignedOrder(pool, { orderId: 5, riderId: 3 }), { ok: false });
});

test("an order that is still only assigned and was not updated is refused", async () => {
  const pool = fakePool({ affected: 0, row: { user_id: 12, token: "T-1", status: "Cancelled", rider_assignment_status: "Assigned" } });
  assert.equal((await acceptAssignedOrder(pool, { orderId: 5, riderId: 3 })).ok, false);
});
