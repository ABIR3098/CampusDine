// rider-tip.js — Feature: tip your rider.
//  • Student (paying by wallet) can pick a tip at checkout: No tip / ৳5 / ৳10 / ৳20.
//  • The tip is taken from the student's wallet with the order (shown as "Rider tip" in the wallet history).
//  • It is paid into the rider's account when the order is handed over (QR pickup verified).
//  • Cancelled order  -> the tip goes back to the student.
//  • No rider on the order when it is collected -> the tip goes back to the student.
//  • Rider dashboard shows the tip on each delivery and the total tips earned.
// Also fixes: the rider dashboard now shows the delivery instructions (they were saved but not listed there).
// Run from the project main folder:  node rider-tip.js   (then restart the backend)
const fs = require("fs");

const FILES = {
  html: "frontend/campusdine.html",
  server: "backend/server.js",
  orders: "backend/src/routes/orders.js",
  riders: "backend/src/routes/riders.js",
};
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) { console.error(`Run this from the project's main folder (${f} not found).`); process.exit(1); }
}
const load = (file) => {
  const raw = fs.readFileSync(file, "utf8");
  return { file, crlf: raw.includes("\r\n"), s: raw.replace(/\r\n/g, "\n") };
};
const docs = {};
for (const [k, f] of Object.entries(FILES)) docs[k] = load(f);

const MARK = {
  html: "/* Feature: rider tip */",
  server: "tip_settled",
  orders: "// Feature: rider tip",
  riders: "tips_total",
};
const todo = Object.keys(docs).filter((k) => !docs[k].s.includes(MARK[k]));
if (todo.length === 0) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend/server.js: columns ---------------- */
if (todo.includes("server")) {
  rep("server", "columns",
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
`,
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
    await addColumn("orders", "tip_amount", "DECIMAL(8,2) NOT NULL DEFAULT 0");   // rider tip
    await addColumn("orders", "tip_settled", "TINYINT(1) NOT NULL DEFAULT 0");    // 1 = tip already paid to the rider / given back
`);
}

/* ---------------- backend/src/routes/orders.js ---------------- */
if (todo.includes("orders")) {
  // 1) read + validate the tip
  rep("orders", "parse tip",
`    const pointsUsed = priced.reward ? Number(priced.reward.points_cost) : 0;
`,
`    const pointsUsed = priced.reward ? Number(priced.reward.points_cost) : 0;

    // Feature: rider tip — a fixed amount, paid from the wallet now, handed to the rider at pickup
    const TIP_OPTIONS = [0, 5, 10, 20];
    const tip = Number(req.body.tip || 0);
    if (!TIP_OPTIONS.includes(tip)) throw { status: 400, message: "Invalid tip amount" };
    if (tip > 0 && paymentMethod !== "wallet") throw { status: 400, message: "Tips are paid from your wallet" };
`);

  // 2) wallet must cover order + tip, and both are deducted
  rep("orders", "wallet check",
`      if (user.wallet_balance < total) throw { status: 402, message: "Insufficient wallet balance" };
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [total, req.user.id]);`,
`      if (user.wallet_balance < total + tip) throw { status: 402, message: "Insufficient wallet balance" };
      await conn.query("UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?", [total + tip, req.user.id]);`);
  rep("orders", "tip transaction",
`        "Order payment",
        -total,
      ]);
    }
`,
`        "Order payment",
        -total,
      ]);
      if (tip > 0) {
        await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [req.user.id, "Rider tip", -tip]);
      }
    }
`);

  // 3) remember the tip on the order
  rep("orders", "store tip",
`    await conn.query("UPDATE orders SET token = ? WHERE id = ?", [token, orderResult.insertId]);
`,
`    await conn.query("UPDATE orders SET token = ? WHERE id = ?", [token, orderResult.insertId]);
    if (tip > 0) await conn.query("UPDATE orders SET tip_amount = ? WHERE id = ?", [tip, orderResult.insertId]);
`);
  rep("orders", "response",
`      rider_id: assignedRiderId,
      rider_assignment_status: assignedRiderId ? "Assigned" : "Unassigned",`,
`      rider_id: assignedRiderId,
      tip_amount: tip,
      rider_assignment_status: assignedRiderId ? "Assigned" : "Unassigned",`);

  // 4) cancelled order: the tip goes back
  rep("orders", "cancel refund",
`        \`Refund — Order \${order.token} cancelled\`,
        order.total,
      ]);
    }
`,
`        \`Refund — Order \${order.token} cancelled\`,
        order.total,
      ]);
      if (Number(order.tip_amount) > 0 && !order.tip_settled) {
        await conn.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [order.tip_amount, req.user.id]);
        await conn.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [
          req.user.id,
          \`Tip refund — Order \${order.token} cancelled\`,
          order.tip_amount,
        ]);
        await conn.query("UPDATE orders SET tip_settled = 1 WHERE id = ?", [order.id]);
      }
    }
`);

  // 5) handed over (QR pickup verified): pay the rider, or give the tip back if no rider was on the order
  rep("orders", "pay rider",
`      await recordAuditEvent(connection, req, "ORDER_PICKUP_VERIFIED", "order", order.id, { riderId: order.rider_id });
`,
`      await recordAuditEvent(connection, req, "ORDER_PICKUP_VERIFIED", "order", order.id, { riderId: order.rider_id });
      const [[tipRow]] = await connection.query("SELECT tip_amount, tip_settled, rider_id, user_id FROM orders WHERE id = ? FOR UPDATE", [order.id]);
      if (tipRow && Number(tipRow.tip_amount) > 0 && !tipRow.tip_settled) {
        const amount = Number(tipRow.tip_amount);
        const payee = tipRow.rider_id ? tipRow.rider_id : tipRow.user_id;
        const tipLabel = tipRow.rider_id ? \`Tip received — Order \${order.token}\` : \`Tip refund — Order \${order.token} (no rider)\`;
        await connection.query("UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?", [amount, payee]);
        await connection.query("INSERT INTO wallet_transactions (user_id, label, amount) VALUES (?, ?, ?)", [payee, tipLabel, amount]);
        await connection.query("UPDATE orders SET tip_settled = 1 WHERE id = ?", [order.id]);
      }
`);
}

/* ---------------- backend/src/routes/riders.js ---------------- */
if (todo.includes("riders")) {
  const hasNote = docs.riders.s.includes("o.delivery_note");   // the delivery-instructions feature is installed
  const extra = hasNote ? ", tip_amount, delivery_note" : ", tip_amount";
  rep("riders", "recent list",
`const [recent] = await pool.query(\`SELECT id, status, created_at, pickup_time, rider_assignment_status FROM orders`,
`const [recent] = await pool.query(\`SELECT id, status, created_at, pickup_time, rider_assignment_status${extra} FROM orders`);
  rep("riders", "tips summary",
`  res.json({ ...summary, orders: recent });`,
`  // Feature: rider tip — tips already paid to this rider
  const [[tips]] = await pool.query(
    \`SELECT COALESCE(SUM(tip_amount), 0) AS total,
            COALESCE(SUM(CASE WHEN picked_up_at >= CURDATE() THEN tip_amount ELSE 0 END), 0) AS today
     FROM orders WHERE rider_id = ? AND tip_settled = 1\`, [riderId]);
  res.json({ ...summary, tips_total: Number(tips.total), tips_today: Number(tips.today), orders: recent });`);
  rep("riders", "orders list",
`SELECT o.id, o.token, o.total, o.status, o.pickup_time, o.note,`,
`SELECT o.id, o.token, o.total, o.status, o.pickup_time, o.note, o.tip_amount,`);
}

/* ---------------- frontend/campusdine.html ---------------- */
if (todo.includes("html")) {
  // texts
  rep("html", "en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "tip.label": "Tip your rider (optional, paid from your wallet)",
    "tip.none": "No tip",
    "tip.total": "Total with tip: {t}",
    "tip.show": "Rider tip",
`);
  rep("html", "bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "tip.label": "রাইডারকে টিপ দিন (ঐচ্ছিক, ওয়ালেট থেকে কাটা হবে)",
    "tip.none": "টিপ নয়",
    "tip.total": "টিপসহ মোট: {t}",
    "tip.show": "রাইডার টিপ",
`);

  // cart: state, wallet must cover order + tip
  rep("html", "state",
`const [orderNote, setOrderNote] = useState("");
`,
`const [orderNote, setOrderNote] = useState("");
  /* Feature: rider tip */
  const [tip, setTip] = useState(0);
`);
  rep("html", "canPay",
`  const canPay = payMethod === "cash" || walletBalance >= total;`,
`  useEffect(() => { if (payMethod !== "wallet" || cart.length === 0) setTip(0); }, [payMethod, cart.length]);
  const canPay = payMethod === "cash" || walletBalance >= total + tip;`);

  // cart: tip buttons (only for wallet payments)
  rep("html", "tip buttons",
`              {payMethod === "wallet" && !canPay && (`,
`              {payMethod === "wallet" && (
                <div className="mb-3">
                  <div className="text-xs mb-1.5" style={{ color: "var(--ink-soft)" }}>{tx("tip.label")}</div>
                  <div className="flex flex-wrap gap-2">
                    {[0, 5, 10, 20].map(v => (
                      <button key={v} type="button" onClick={() => setTip(v)}
                        className={"chip text-xs px-3 py-1.5 rounded-full" + (tip === v ? " active-chip" : "")}>{v === 0 ? tx("tip.none") : "৳" + v}</button>
                    ))}
                  </div>
                  {tip > 0 && <div className="text-xs mt-1.5 font-600">{tx("tip.total", { t: taka(total + tip) })}</div>}
                </div>
              )}
              {payMethod === "wallet" && !canPay && (`);

  // send the tip with the order (works with or without the delivery-instructions feature)
  const withNote = docs.html.s.includes("rewardId, deliveryNote) => {");
  if (withNote) {
    rep("html", "click", `orderNote, rewardId, deliveryNote)}`, `orderNote, rewardId, deliveryNote, tip)}`);
    rep("html", "signature", `rewardId, deliveryNote) => {`, `rewardId, deliveryNote, tip) => {`);
  } else {
    rep("html", "click", `orderNote, rewardId)}`, `orderNote, rewardId, tip)}`);
    rep("html", "signature", `const placeOrder = async (cartItems, paymentMethod, pickupTime, coupon, note, rewardId) => {`, `const placeOrder = async (cartItems, paymentMethod, pickupTime, coupon, note, rewardId, tip) => {`);
  }
  rep("html", "body",
`          rewardId: rewardId || undefined,
`,
`          rewardId: rewardId || undefined,
          tip: tip > 0 ? tip : undefined,
`);

  // student's Orders tab: show the tip
  rep("html", "student order card",
`              {o.rider_id && <RiderOrderChat apiBase={apiBase} token={token} orderId={o.id} />}`,
`              {Number(o.tip_amount) > 0 && (
                <div className="text-xs mt-2 font-600" style={{ color: "var(--ink-soft)" }}>🪙 {tx("tip.show")}: ৳{o.tip_amount}</div>
              )}
              {o.rider_id && <RiderOrderChat apiBase={apiBase} token={token} orderId={o.id} />}`);

  // rider dashboard: tip on each delivery + "Tips earned" tile
  rep("html", "rider row",
`<td className="p-2">#{o.id}`,
`<td className="p-2">#{o.id}{Number(o.tip_amount) > 0 && <span className="ml-2 text-xs font-700 px-2 py-0.5 rounded-full" style={{background:"var(--gold-soft)",color:"var(--teal-deep)"}}>🪙 Tip ৳{o.tip_amount}</span>}`);
  rep("html", "rider tile",
`<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{[{label:"Active orders",value:summary.total},{label:"Received",value:summary.received},{label:"Cooking",value:summary.cooking},{label:"Ready",value:summary.ready}]`,
`<div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">{[{label:"Active orders",value:summary.total},{label:"Received",value:summary.received},{label:"Cooking",value:summary.cooking},{label:"Ready",value:summary.ready},{label:"Tips earned (today / total)",value:"৳" + (summary.tips_today || 0) + " / ৳" + (summary.tips_total || 0)}]`);
}

for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak14");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: rider tip added (checkout tip buttons, wallet charge, rider payout, refunds, rider dashboard).");
console.log("Restart the backend now: Ctrl+C, then npm start. Then refresh the browser with Ctrl+Shift+R.");
