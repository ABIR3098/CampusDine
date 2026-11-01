const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const fs = require("node:fs");
const path = require("node:path");
const { DEV_STAFF, ensureDevStaffAccount } = require("../src/inventory/staffSeed");

function fakeDb(existing = []) {
  const inserts = [];
  return { inserts, query: async (sql, p) => (sql.startsWith("SELECT") ? [existing] : (inserts.push({ sql, p }), [{}])) };
}

test("dev staff account is stored as a bcrypt hash, never as plain text", async () => {
  const db = fakeDb();
  const out = await ensureDevStaffAccount(db, { log() {} });
  assert.equal(out.created, true);
  const [name, externalId, hash] = db.inserts[0].p;
  assert.equal(externalId, DEV_STAFF.externalId);
  assert.notEqual(hash, DEV_STAFF.password);
  assert.match(hash, /^\$2[aby]\$/);
  assert.ok(await bcrypt.compare(DEV_STAFF.password, hash));
  assert.ok(name);
});

test("an existing staff account is left alone", async () => {
  const db = fakeDb([{ id: 4, role: "staff" }]);
  assert.equal((await ensureDevStaffAccount(db, { log() {} })).created, false);
  assert.equal(db.inserts.length, 0);
});

test("a clashing ID that belongs to another role is not overwritten", async () => {
  const db = fakeDb([{ id: 4, role: "student" }]);
  const msgs = [];
  await ensureDevStaffAccount(db, { log: (m) => msgs.push(m) });
  assert.equal(db.inserts.length, 0);
  assert.ok(msgs.length === 1);
});
