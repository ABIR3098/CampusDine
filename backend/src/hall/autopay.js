// Auto-pay: for people who turned it on, the previous month's Hall bill is taken from their wallet
// between the 1st and the GRACE_DAYS-th of every month (all meals of that month have closed by then).
//  - paid:    the unpaid amount was taken from the wallet → a notification says so
//  - short:   the wallet was too low → a notification asks them to add money; it tries again the next day
//  - nothing: nothing was due → recorded quietly
const pool = require("../db");
const { nowParts, localStamp } = require("./util");
const { computeBill } = require("./routes/bill");
const { notify } = require("./advanced");

const GRACE_DAYS = 10;
const pad = (n) => String(n).padStart(2, "0");
const ymKey = (year, month) => `${year}-${pad(month)}`;
const taka = (n) => "৳" + Math.round(Number(n) * 100) / 100;
const monthName = (year, month) => new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

// the month before today's month
function previousMonth(now) {
  const [y, m] = now.dateKey.split("-").map(Number);
  return m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 };
}

// Pays one person's bill for `target` ({ year, month }) from their wallet, all or nothing, in one transaction.
// → { status: "paid" | "short" | "nothing", due, balance, amount }
async function autoPayOne(userId, target, now = nowParts()) {
  const key = ymKey(target.year, target.month);
  const conn = await pool.getConnection();
  let out;
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE", [userId]); // also stops two payments at once
    const bill = await computeBill(conn, userId, target.year, target.month, now);
    const [[row]] = await conn.query("SELECT COALESCE(SUM(amount), 0) AS paid FROM hall_payments WHERE user_id = ? AND ym = ?", [userId, key]);
    const due = Math.max(0, Number(bill.summary.confirmedTotal) - Number(row.paid));
    const balance = Number(user.wallet_balance);
    const stamp = localStamp();
    const log = (status, amount) => conn.query(
      "INSERT INTO hall_autopay_log (user_id, ym, status, amount, due, balance, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [userId, key, status, amount, due, balance, stamp]);

    if (due <= 0) {
      await log("nothing", 0);
      out = { status: "nothing", due, balance, amount: 0 };
    } else if (balance < due) {
      await log("short", 0);
      out = { status: "short", due, balance, amount: 0 };
    } else {
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [due, userId]);
      await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [userId, `Hall bill ${key} (auto-pay)`, -due]);
      await conn.query("INSERT INTO hall_payments (user_id, ym, amount, created_at) VALUES (?, ?, ?, ?)", [userId, key, due, stamp]);
      await log("paid", due);
      out = { status: "paid", due, balance: balance - due, amount: due };
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // the notification goes out after the money part is safely committed
  const label = monthName(target.year, target.month);
  try {
    if (out.status === "paid") {
      await notify(userId, "Hall bill paid automatically", `${taka(out.amount)} for ${label} was taken from your wallet. Wallet balance now ${taka(out.balance)}.`, "autopay");
    } else if (out.status === "short") {
      await notify(userId, "Auto-pay could not run",
        `Your ${label} Hall bill is ${taka(out.due)} but your wallet has ${taka(out.balance)}. Add at least ${taka(out.due - out.balance)} — auto-pay tries again every day until the ${GRACE_DAYS}th.`, "autopay_short");
    }
  } catch (e) { console.warn("⚠️ Hall auto-pay notification failed:", e.message); }
  return out;
}

// Runs auto-pay for everyone who has it on and hasn't been settled yet.
// options: { target: {year, month}, ignoreGrace: bool, universityId }  — the defaults are what the scheduled job uses.
// → [{ userId, status, ... }] one entry per person it touched
async function runAutoPay(now = nowParts(), options = {}) {
  const day = Number(now.dateKey.slice(8, 10));
  if (!options.ignoreGrace && day > GRACE_DAYS) return [];
  const target = options.target || previousMonth(now);
  const key = ymKey(target.year, target.month);
  const uni = options.universityId || null;

  const [people] = await pool.query(
    `SELECT a.user_id AS id FROM hall_autopay a JOIN users u ON u.id = a.user_id
     WHERE a.enabled = 1 AND u.role IN ('student', 'teacher') AND (? IS NULL OR u.university_id = ?)`, [uni, uni]);
  if (!people.length) return [];
  const [logs] = await pool.query("SELECT user_id, status, DATE_FORMAT(created_at, '%Y-%m-%d') AS d FROM hall_autopay_log WHERE ym = ?", [key]);

  const done = [];
  for (const p of people) {
    const mine = logs.filter((l) => l.user_id === p.id);
    if (mine.some((l) => l.status === "paid" || l.status === "nothing")) continue;          // already settled
    if (mine.some((l) => l.status === "short" && l.d === now.dateKey)) continue;            // already tried today
    try {
      done.push({ userId: p.id, ym: key, ...(await autoPayOne(p.id, target, now)) });
    } catch (e) {
      console.warn(`⚠️ Hall auto-pay failed for user ${p.id}:`, e.message);
      done.push({ userId: p.id, ym: key, status: "error", error: e.message });
    }
  }
  return done;
}

let timer = null;
let running = false;
function startAutoPay() {
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const done = await runAutoPay();
      const paid = done.filter((d) => d.status === "paid");
      if (done.length) console.log(`💳 Hall auto-pay: ${paid.length} paid (${taka(paid.reduce((a, d) => a + d.amount, 0))}), ${done.filter((d) => d.status === "short").length} wallet too low`);
    } catch (e) {
      console.warn("⚠️ Hall auto-pay failed:", e.message);
    } finally { running = false; }
  };
  setTimeout(tick, 15 * 1000); // shortly after the server starts, then every 30 minutes
  timer = setInterval(tick, 30 * 60 * 1000);
  if (timer.unref) timer.unref();
}

module.exports = { GRACE_DAYS, previousMonth, autoPayOne, runAutoPay, startAutoPay };
