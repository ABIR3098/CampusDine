const test = require("node:test");
const assert = require("node:assert/strict");
const { assignOrderToBestRider } = require("../src/utils/riderAssignment");

// A connection that answers the three queries of one assignment and remembers them.
function fakeConnection({ riders = [], updated = 1 }) {
  const seen = [];
  return {
    seen,
    async query(sql, params) {
      seen.push({ sql, params });
      if (sql.includes("SELECT rider_id FROM rider_shifts")) return [[]];
      if (sql.includes("JOIN rider_locations")) return [riders];
      if (sql.includes("UPDATE orders SET rider_id")) return [{ affectedRows: updated }];
      throw new Error("unexpected query");
    },
  };
}

test("the rider search only counts positions from the last 90 seconds", async () => {
  const connection = fakeConnection({ riders: [] });
  await assignOrderToBestRider(connection, 1);
  const search = connection.seen.find((q) => q.sql.includes("JOIN rider_locations"));
  assert.match(search.sql, /INTERVAL 90 SECOND/);
  assert.match(search.sql, /shift\.status = 'ON_DUTY'/);
  assert.match(search.sql, /HAVING COUNT\(o\.id\) < shift\.max_orders/);
});

test("with no free rider the order is left alone", async () => {
  const connection = fakeConnection({ riders: [] });
  assert.equal(await assignOrderToBestRider(connection, 4), null);
  assert.equal(connection.seen.some((q) => q.sql.includes("UPDATE orders")), false);
});

test("the first rider of the search is chosen and the order is updated for that rider", async () => {
  const connection = fakeConnection({ riders: [{ rider_id: "8", active_orders: 0 }, { rider_id: "9", active_orders: 1 }] });
  assert.equal(await assignOrderToBestRider(connection, 4), 8);
  const update = connection.seen.find((q) => q.sql.includes("UPDATE orders"));
  assert.deepEqual(update.params, [8, 4]);
  assert.match(update.sql, /rider_assignment_status = 'Unassigned'/);
});

test("if someone else took the order first, nobody is reported as assigned", async () => {
  const connection = fakeConnection({ riders: [{ rider_id: 8, active_orders: 0 }], updated: 0 });
  assert.equal(await assignOrderToBestRider(connection, 4), null);
});
