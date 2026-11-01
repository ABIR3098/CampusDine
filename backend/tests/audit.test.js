const test = require("node:test");
const assert = require("node:assert/strict");
const { recordAuditEvent } = require("../src/utils/audit");

function fakeConn() {
  const calls = [];
  return { calls, query: async (sql, params) => { calls.push({ sql, params }); return [{}]; } };
}
const req = (extra = {}) => ({ user: { id: 7, role: "admin" }, socket: { remoteAddress: "10.0.0.5" }, ...extra });

test("writes who did what to which record", async () => {
  const conn = fakeConn();
  await recordAuditEvent(conn, req(), "MENU_UPDATE", "menu_item", 12, { price: 50 });
  assert.match(conn.calls[0].sql, /INSERT INTO audit_logs/);
  assert.deepEqual(conn.calls[0].params, [7, "admin", "MENU_UPDATE", "menu_item", "12", '{"price":50}', "10.0.0.5"]);
});

test("a missing entity id is stored as null, a number as text", async () => {
  const conn = fakeConn();
  await recordAuditEvent(conn, req(), "A", "t", null);
  await recordAuditEvent(conn, req(), "A", "t", 0);
  assert.equal(conn.calls[0].params[4], null);
  assert.equal(conn.calls[1].params[4], "0");
});

test("details default to an empty object", async () => {
  const conn = fakeConn();
  await recordAuditEvent(conn, req(), "A", "t", 1);
  assert.equal(conn.calls[0].params[5], "{}");
});

test("details longer than 6000 characters are replaced by a truncated marker", async () => {
  const conn = fakeConn();
  await recordAuditEvent(conn, req(), "A", "t", 1, { big: "x".repeat(7000) });
  assert.equal(conn.calls[0].params[5], '{"truncated":true}');
});

test("details at the limit are kept as they are", async () => {
  const conn = fakeConn();
  const details = { s: "x".repeat(5980) };
  assert.ok(JSON.stringify(details).length <= 6000);
  await recordAuditEvent(conn, req(), "A", "t", 1, details);
  assert.equal(conn.calls[0].params[5], JSON.stringify(details));
});

test("the IP address is cut to 64 characters, and is empty without a socket", async () => {
  const conn = fakeConn();
  await recordAuditEvent(conn, req({ socket: { remoteAddress: "a".repeat(100) } }), "A", "t", 1);
  await recordAuditEvent(conn, { user: { id: 1, role: "admin" } }, "A", "t", 1);
  assert.equal(conn.calls[0].params[6].length, 64);
  assert.equal(conn.calls[1].params[6], "");
});
