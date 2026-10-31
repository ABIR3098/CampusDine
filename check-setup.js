// check-setup.js — read-only health check. Changes nothing.
// Run from the project MAIN folder:  node check-setup.js
const fs = require("fs");
const path = require("path");
const http = require("http");

const read = (f) => { try { return fs.readFileSync(f, "utf8"); } catch (_) { return ""; } };
let problems = 0;
const ok = (msg) => console.log("  ✅ " + msg);
const bad = (msg, fix) => { problems++; console.log("  ❌ " + msg + (fix ? "\n       → " + fix : "")); };
const warn = (msg) => console.log("  ⚠️  " + msg);

if (!fs.existsSync("backend/server.js") || !fs.existsSync("frontend/campusdine.html")) {
  console.error("Run this from the project's MAIN folder (the one that contains the backend and frontend folders).");
  process.exit(1);
}

/* ---------- 1) features: checked by what the CODE contains (so a half-installed feature is noticed) ---------- */
console.log("\n1) Features");
const F = {
  html: read("frontend/campusdine.html"),
  server: read("backend/server.js"),
  orders: read("backend/src/routes/orders.js"),
  wallet: read("backend/src/routes/wallet.js"),
  riders: read("backend/src/routes/riders.js"),
  menu: read("backend/src/routes/menu.js"),
  auth: read("backend/src/routes/auth.js"),
  summary: read("backend/src/routes/summary.js"),
};
const exists = (p) => fs.existsSync(p);
// [script, what it gives, [ [part name, true/false] ... ]]
const features = [
  ["history-filter", "order history search/filter", [["app", /hQuery/.test(F.html)]]],
  ["order-wallet-fix", "stock / coupon / top-up fixes", [["orders", /mergedItems/.test(F.orders)], ["wallet", /MAX_PER_TOPUP/.test(F.wallet)]]],
  ["profile-balance-fix", "profile = wallet balance", [["app", /liveBalance/.test(F.html)]]],
  ["checkout-fix", "checkout works if price preview fails", [["app", /quoteError/.test(F.html)]]],
  ["order-feedback-fix", "'Order placed' message", [["app", /placed\.token/.test(F.html)]]],
  ["db-fix", "pickup_time column", [["server", /pickup_time/.test(F.server)]]],
  ["delivery-note", "delivery instructions", [["app", /dnote\.label/.test(F.html)], ["orders", /delivery_note/.test(F.orders)], ["riders", /delivery_note/.test(F.riders)], ["server", /delivery_note/.test(F.server)]]],
  ["spending-months", "last 6 months chart", [["app", /sp\.months/.test(F.html)], ["summary", /monthRows/.test(F.summary)]]],
  ["stock-badge", "sold out / low stock badges", [["app", /STUDENT_LOW_STOCK/.test(F.html)]]],
  ["notify-me", "Notify me", [["app", /refreshAlerts/.test(F.html)], ["menu", /stock_alerts/.test(F.menu)], ["server", /stock_alerts/.test(F.server)], ["file", exists("backend/src/stockAlerts.js")]]],
  ["rider-tip", "rider tip", [["app", /tip\.label/.test(F.html)], ["orders", /tip_amount/.test(F.orders)], ["riders", /tips_total/.test(F.riders)], ["server", /tip_settled/.test(F.server)]]],
  ["rate-rider", "rate your rider", [["app", /RiderRating/.test(F.html)], ["orders", /rate-rider/.test(F.orders)], ["server", /rider_rating/.test(F.server)]]],
  ["cancel-tip-fix", "cancel message includes the tip", [["app", /cancelled\.tip_amount/.test(F.html)]]],
  ["note-chips", "kitchen note chips", [["app", /NOTE_CHIPS/.test(F.html)]]],
  ["your-usual", "Your usual", [["app", /UsualPanel/.test(F.html)]]],
  ["time-greeting", "time-of-day greeting", [["app", /mealSlot/.test(F.html)]]],
  ["copy-token", "Copy token button", [["app", /copyText/.test(F.html)]]],
  ["cart-topup", "Top up shortcut in the cart", [["app", /goTopUp/.test(F.html)]]],
  ["problem-report", "order problem reports", [["app", /ProblemReports/.test(F.html)], ["orders", /order_issues/.test(F.orders)], ["server", /order_issues/.test(F.server)]]],
  ["referral", "referral codes", [["app", /ReferralCard/.test(F.html)], ["auth", /referralCode/.test(F.auth)], ["orders", /rewardReferral/.test(F.orders)], ["wallet", /referral/.test(F.wallet)], ["server", /referral_code/.test(F.server)], ["file", exists("backend/src/referrals.js")]]],
  ["recurring-order", "weekly (recurring) orders", [["app", /RecurringPlans/.test(F.html)], ["server", /recurring_orders/.test(F.server)], ["file", exists("backend/src/routes/recurring.js")]]],
  ["monthly-budget", "monthly budget limit", [["app", /BudgetCard/.test(F.html)], ["summary", /budgetInfo/.test(F.summary)], ["server", /monthly_budget/.test(F.server)]]],
];
let toInstall = 0;
for (const [script, label, parts] of features) {
  const have = parts.filter((p) => p[1]).length;
  if (have === parts.length) ok(`${label}`);
  else if (have === 0) { toInstall++; bad(`${label} — not installed`, "run: node " + script + ".js   (or  node apply-all.js  for everything)"); }
  else { toInstall++; bad(`${label} — only partly installed (missing: ${parts.filter((p) => !p[1]).map((p) => p[0]).join(", ")})`, "run: node " + script + ".js   (or  node apply-all.js  for everything)"); }
}

/* ---------- 2) .env + database ---------- */
console.log("\n2) Database");
const env = {};
for (const line of read("backend/.env").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!fs.existsSync("backend/.env")) bad("backend/.env not found", "copy backend/.env.example to backend/.env");
else ok("backend/.env found");

async function checkDb() {
  let mysql;
  try { mysql = require(path.resolve("backend/node_modules/mysql2/promise")); }
  catch (_) { bad("backend packages not installed", "run: cd backend && npm install"); return; }
  let db;
  try {
    db = await mysql.createConnection({
      host: env.DB_HOST || "localhost", port: Number(env.DB_PORT || 3306),
      user: env.DB_USER || "root", password: env.DB_PASSWORD || "", database: env.DB_NAME || "campusdine",
    });
  } catch (e) {
    bad("cannot connect to MySQL: " + e.message, "open XAMPP and press Start next to MySQL (it must be green)");
    return;
  }
  ok("MySQL is running and database '" + (env.DB_NAME || "campusdine") + "' opens");
  const hasCol = async (table, col) => (await db.query("SHOW COLUMNS FROM " + table + " LIKE ?", [col]))[0].length > 0;
  const want = {
    orders: ["pickup_time", "delivery_note", "tip_amount", "tip_settled", "rider_rating", "rider_comment", "rider_rated_at"],
    users: ["referral_code", "referred_by", "referral_rewarded_at", "monthly_budget"],
  };
  const missing = [];
  for (const [table, cols] of Object.entries(want)) for (const c of cols) if (!(await hasCol(table, c))) missing.push(table + "." + c);
  if (missing.length === 0) ok("all the new database columns are there");
  else warn("missing columns: " + missing.join(", ") + "  — they are created when the backend starts: restart it, then run this check again");
  const missingTables = [];
  for (const t of ["stock_alerts", "order_issues", "recurring_orders"]) if ((await db.query("SHOW TABLES LIKE ?", [t]))[0].length === 0) missingTables.push(t);
  if (missingTables.length === 0) ok("all the new tables are there");
  else warn("missing tables: " + missingTables.join(", ") + "  — created when the backend starts: restart it, then run this check again");
  await db.end();
}

/* ---------- 3) server ---------- */
function checkServer() {
  return new Promise((resolve) => {
    const port = Number(env.PORT || 5000);
    const req = http.get({ host: "localhost", port, path: "/api/menu", timeout: 3000 }, (res) => {
      ok("backend is running on http://localhost:" + port + " (answered with HTTP " + res.statusCode + ")");
      res.resume(); resolve();
    });
    req.on("timeout", () => { req.destroy(); });
    req.on("error", () => {
      bad("backend is NOT running on port " + port, "open a terminal and run:  cd backend  then  npm start   (keep that terminal open)");
      resolve();
    });
  });
}

(async () => {
  await checkDb().catch((e) => bad("database check crashed: " + e.message));
  console.log("\n3) Server");
  await checkServer();
  console.log("\n" + (problems === 0 ? "✅ Everything looks fine. Refresh the browser with Ctrl+Shift+R and try the app." : `❌ ${problems} thing(s) need attention (see the → hints above).`));
  if (toInstall > 0) console.log("   After installing, restart the backend (Ctrl+C, cd backend, npm start) and refresh the browser.");
})();
