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

