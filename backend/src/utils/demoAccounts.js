// Decides whether the server may create the demo logins (admin/admin123, student1, teacher1, rider1).
// Their passwords are public, so a real deployment must not get them by accident.
//   SEED_DEMO_ACCOUNTS=true   always create them
//   SEED_DEMO_ACCOUNTS=false  never create them
//   not set                   create them unless NODE_ENV is "production"
function shouldSeedDemoAccounts(env = process.env) {
  const flag = String(env.SEED_DEMO_ACCOUNTS || "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return String(env.NODE_ENV || "").trim().toLowerCase() !== "production";
}

module.exports = { shouldSeedDemoAccounts };
