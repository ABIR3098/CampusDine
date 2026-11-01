const test = require("node:test");
const assert = require("node:assert/strict");
const { describeDbError } = require("../src/inventory/errors");

test("a MySQL error is described with its code and reason", () => {
  const msg = describeDbError({ code: "ER_DUP_ENTRY", sqlMessage: "Duplicate entry 'tea'" }, "development");
  assert.equal(msg, "Database error (ER_DUP_ENTRY): Duplicate entry 'tea'");
});

test("a missing table or column tells the admin to restart the server", () => {
  assert.match(describeDbError({ code: "ER_NO_SUCH_TABLE", sqlMessage: "Table 'x' doesn't exist" }, "development"), /restart the server/);
  assert.match(describeDbError({ code: "ER_BAD_FIELD_ERROR", sqlMessage: "Unknown column" }, "development"), /restart the server/);
});

test("nothing is revealed in production or for errors that are not from the database", () => {
  assert.equal(describeDbError({ code: "ER_DUP_ENTRY", sqlMessage: "x" }, "production"), null);
  assert.equal(describeDbError(new Error("boom"), "development"), null);
  assert.equal(describeDbError(null, "development"), null);
});
