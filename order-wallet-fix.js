// order-wallet-fix.js — fixes 3 bugs in order + wallet (backend only)
// Run from the project main folder:  node order-wallet-fix.js
const fs = require("fs");

const ORDERS = "backend/src/routes/orders.js";
const WALLET = "backend/src/routes/wallet.js";
for (const f of [ORDERS, WALLET]) {
  if (!fs.existsSync(f)) { console.error(`Run this from the project's main folder (${f} not found).`); process.exit(1); }
}

function load(file) {
  const raw = fs.readFileSync(file, "utf8");
  return { file, crlf: raw.includes("\r\n"), s: raw.replace(/\r\n/g, "\n") };
}
function replaceOnce(doc, label, from, to) {
  const n = doc.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${doc.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  doc.s = doc.s.replace(from, () => to);
}
function save(doc) {
  fs.copyFileSync(doc.file, doc.file + ".bak5");
  fs.writeFileSync(doc.file, doc.crlf ? doc.s.replace(/\n/g, "\r\n") : doc.s);
}

const o = load(ORDERS);
const w = load(WALLET);
const doneO = o.s.includes("/* Fix: merge duplicate cart lines */");
const doneW = w.s.includes("/* Fix: wallet top-up limits */");
if (doneO && doneW) { console.log("Already applied — nothing to do."); process.exit(0); }

if (!doneO) {
  // BUG 1: same item twice in one order bypassed the stock check (oversell / negative stock)
  replaceOnce(o, "merge duplicates",
`  const requestedItems = items.map((item) => ({ id: Number(item.id), qty: Number(item.qty) }));
  if (![`,
`  /* Fix: merge duplicate cart lines */
  const mergedItems = new Map();
  for (const item of items) {
    const id = Number(item.id);
    mergedItems.set(id, (mergedItems.get(id) || 0) + Number(item.qty));
  }
  const requestedItems = [...mergedItems].map(([id, qty]) => ({ id, qty }));
  if (![`);

  // BUG 2: cancelling an order never gave the coupon back (user could never use it again)
  replaceOnce(o, "coupon restore",
`    await loyalty.refundForOrder(conn, order); // points spent on this order go back to the customer
`,
`    await loyalty.refundForOrder(conn, order); // points spent on this order go back to the customer

    /* Fix: give the coupon back when the order is cancelled */
    const [usedCoupons] = await conn.query("SELECT coupon_id FROM coupon_usage WHERE order_id = ?", [order.id]);
    for (const row of usedCoupons) {
      await conn.query("UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE id = ?", [row.coupon_id]);
    }
    if (usedCoupons.length) await conn.query("DELETE FROM coupon_usage WHERE order_id = ?", [order.id]);
`);
}

if (!doneW) {
  // BUG 3: top-up had no upper limit, no 2-decimal check, and two separate queries (not atomic)
  replaceOnce(w, "topup",
`  const label = PAY_METHOD_LABELS[method];
  if (!label) return res.status(400).json({ error: "a valid payment method is required" });

  await pool.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, req.user.id]);
  await pool.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
    req.user.id,
    \`Wallet top-up via \${label}\`,
    amount,
  ]);

  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
  res.json({ balance: user.wallet_balance });
}));`,
`  const label = PAY_METHOD_LABELS[method];
  if (!label) return res.status(400).json({ error: "a valid payment method is required" });

  /* Fix: wallet top-up limits */
  const MAX_PER_TOPUP = 10000;
  if (Math.round(amount * 100) / 100 !== amount) return res.status(400).json({ error: "Amount can have at most 2 decimal places" });
  if (amount > MAX_PER_TOPUP) return res.status(400).json({ error: \`You can top up at most ৳\${MAX_PER_TOPUP} at a time\` });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, req.user.id]);
    await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
      req.user.id,
      \`Wallet top-up via \${label}\`,
      amount,
    ]);
    const [[user]] = await conn.query("SELECT wallet_balance FROM users WHERE id = ?", [req.user.id]);
    await conn.commit();
    res.json({ balance: user.wallet_balance });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));`);
}

if (!doneO) save(o);
if (!doneW) save(w);
console.log("Done: order + wallet bugs fixed (duplicate cart lines, coupon refund on cancel, wallet top-up limits).");
