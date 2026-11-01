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

test("no dev account is created in production", async () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = "production";
  try {
    const db = fakeDb();
    assert.equal((await ensureDevStaffAccount(db)).skipped, true);
    assert.equal(db.inserts.length, 0);
  } finally { process.env.NODE_ENV = old; }
});

test("the users.role enum keeps 'staff' everywhere it is redefined", () => {
  const root = path.join(__dirname, "..");
  for (const f of ["server.js", "schema.sql", "migrations/20261101_staff_inventory.sql", "src/inventory/schema.js"]) {
    const text = fs.readFileSync(path.join(root, f), "utf8");
    const enums = text.match(/ENUM\('student','teacher','admin','rider','hall_admin'[^)]*\)/g) || [];
    assert.ok(enums.length > 0, f);
    for (const e of enums) assert.ok(e.includes("'staff'"), `${f}: ${e}`);
  }
