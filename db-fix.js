// db-fix.js — fixes "Unknown column 'pickup_time' in 'field list'" for good.
// The server now adds the missing orders.pickup_time column by itself every time it starts.
// Run from the project main folder:  node db-fix.js   (then restart the backend)
const fs = require("fs");
const FILE = "backend/server.js";

if (!fs.existsSync(FILE)) {
  console.error("Run this from the project's main folder (backend/server.js not found).");
  process.exit(1);
}

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes('await addColumn("orders", "pickup_time"')) {
  console.log("Already applied — nothing to do.");
  process.exit(0);
}

const from = `    await addColumn("orders", "picked_up_at", "DATETIME NULL");\n`;
const n = s.split(from).length - 1;
if (n !== 1) {
  console.error(`Patch failed (anchor found ${n} times). File not changed.`);
  process.exit(1);
}
s = s.replace(from, () => from + `    await addColumn("orders", "pickup_time", "DATETIME NULL");   // scheduled pickup (older databases don't have it)\n`);

fs.copyFileSync(FILE, FILE + ".bak9");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: server.js will now add orders.pickup_time automatically. Restart the backend (Ctrl+C, then npm start).");
