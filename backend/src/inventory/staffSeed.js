const bcrypt = require("bcryptjs");

// Development staff login. The password is stored only as a bcrypt hash; this plain text exists
// here (and in the README) so a developer can sign in on a fresh local database.
// Never created when NODE_ENV=production.
const DEV_STAFF = { name: "Kitchen Staff (Dev)", externalId: "staff01", password: "Staff@2026-Temp" };

