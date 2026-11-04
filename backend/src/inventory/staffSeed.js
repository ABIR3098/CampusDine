const bcrypt = require("bcryptjs");

// Development staff login. The password is stored only as a bcrypt hash; this plain text exists
// here (and in the README) so a developer can sign in on a fresh local database.
// Never created when NODE_ENV=production.
const DEV_STAFF = { name: "Kitchen Staff (Dev)", externalId: "staff01", password: "Staff@2026-Temp" };

async function ensureDevStaffAccount(db, { log = console.log } = {}) {
  if (process.env.NODE_ENV === "production") return { created: false, skipped: true };
  const [existing] = await db.query("SELECT id, role FROM users WHERE external_id = ?", [DEV_STAFF.externalId]);
  if (existing.length) {
    if (existing[0].role !== "staff") {
      log(`⚠️  ID '${DEV_STAFF.externalId}' already belongs to a ${existing[0].role} account, so the dev staff login was not created.`);
    }
    return { created: false, skipped: false, existingRole: existing[0].role };
  }
  const hash = await bcrypt.hash(DEV_STAFF.password, 10);
  await db.query(
    "INSERT INTO users (name, external_id, role, password_hash, wallet_balance) VALUES (?, ?, 'staff', ?, 0)",
    [DEV_STAFF.name, DEV_STAFF.externalId, hash]
  );
  return { created: true, skipped: false };
}

function printStaffCredentials(log = console.log) {
  log("   Staff   → ID: " + DEV_STAFF.externalId + "     Password: " + DEV_STAFF.password + "   (temporary dev password)");
}

module.exports = { DEV_STAFF, ensureDevStaffAccount, printStaffCredentials };
