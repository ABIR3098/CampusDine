// apply-all.js — runs every CampusDine patch, in the right order, one after the other.
// Safe to run again and again: a patch that is already installed just says "Already applied".
// Run from the project MAIN folder (with all the patch .js files next to it):   node apply-all.js
const fs = require("fs");
const { spawnSync } = require("child_process");

const ORDER = [
  "history-filter", "order-wallet-fix", "profile-balance-fix", "checkout-fix", "order-feedback-fix", "db-fix",
  "delivery-note", "spending-months", "stock-badge", "notify-me", "rider-tip", "rate-rider", "cancel-tip-fix",
  "note-chips", "your-usual", "time-greeting", "copy-token", "cart-topup", "problem-report", "referral", "recurring-order", "monthly-budget",
];

if (!fs.existsSync("frontend/campusdine.html") || !fs.existsSync("backend/server.js")) {
  console.error("Run this from the project's MAIN folder (the one that contains the backend and frontend folders).");
  process.exit(1);
}

let installed = 0, already = 0;
const problems = [];
console.log("");
for (const name of ORDER) {
  const file = name + ".js";
  if (!fs.existsSync(file)) { problems.push([name, "the file " + file + " is not in this folder"]); console.log(`  ⚠️  ${name.padEnd(20)} missing file`); continue; }
  const r = spawnSync(process.execPath, [file], { encoding: "utf8" });
  const first = ((r.stdout || "") + (r.stderr || "")).trim().split("\n")[0] || "(no output)";
  if (r.status === 0 && first.startsWith("Done")) { installed++; console.log(`  ✅ ${name.padEnd(20)} installed now`); }
  else if (r.status === 0 && first.startsWith("Already")) { already++; console.log(`  ✔  ${name.padEnd(20)} was already installed`); }
  else { problems.push([name, first]); console.log(`  ❌ ${name.padEnd(20)} FAILED: ${first}`); }
}
console.log(`\n${installed} installed now, ${already} were already installed, ${problems.length} problem(s).`);
if (installed > 0) console.log("\nNext: restart the backend (Ctrl+C, then cd backend, npm start) and refresh the browser with Ctrl+Shift+R.");
if (problems.length) {
  console.log("\nThese need a look — send me this whole output:");
  for (const [n, why] of problems) console.log(`   • ${n}: ${why}`);
  process.exit(1);
}
console.log("\nTip: run  node check-setup.js  to check that everything is in place.");
