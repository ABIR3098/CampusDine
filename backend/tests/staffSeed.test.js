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
