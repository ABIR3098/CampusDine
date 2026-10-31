// cancel-tip-fix.js — after cancelling an order that had a rider tip:
//  • the green message now shows the full refund (order + tip), e.g. ৳55 instead of ৳50
//  • the order card says the tip was refunded
// Run from the project main folder:  node cancel-tip-fix.js   (frontend only — no backend restart needed)
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) { console.error("Run this from the project's main folder (frontend/campusdine.html not found)."); process.exit(1); }

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Fix: cancel refund shows tip */")) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" (anchor found ${n} times). File not changed.`); process.exit(1); }
  s = s.replace(from, () => to);
}

// 1) refund message = order total + tip
rep("message",
`a: taka(cancelled.total) })`,
`a: taka(Number(cancelled.total) + Number(cancelled.tip_amount || 0)) /* Fix: cancel refund shows tip */ })`);

// 2) the tip line on a cancelled order says it was refunded (only if the rider-tip feature is installed)
const tipLine = `🪙 {tx("tip.show")}: ৳{o.tip_amount}</div>`;
if (s.includes(tipLine)) {
  rep("tip line", tipLine, `🪙 {tx("tip.show")}: ৳{o.tip_amount}{o.status === "Cancelled" && " " + tx("refunded")}</div>`);
}

fs.copyFileSync(FILE, FILE + ".bak16");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: cancel message now includes the tip, and cancelled orders show the tip as refunded.");
