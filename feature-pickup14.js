#!/usr/bin/env node
/*
 * feature-pickup14.js — "Change pickup time" for an order that is still "Received".
 *
 * Student/teacher side: on the Track tab, every order that is still "Received" gets a
 * "🕒 Change pickup time" button. It opens a small time box; Save moves the pickup time.
 *
 * Rules (checked on the server, so they cannot be skipped):
 *   - only the owner of the order, and only while the status is still "Received"
 *   - the new time must be 10 minutes to 4 hours from now (same rule as when ordering)
 *   - happy-hour prices are judged at the PICKUP moment, so a new time is refused when it would change
 *     this order's happy-hour discount (otherwise the discount could be gamed). The message tells the
 *     person to pick a time with the same price, or to cancel and order again.
 *   - the change is written to the audit log
 *
 * Live updates: the admin's order list and notification bell update at once, and an assigned rider's
 * list refreshes.
 *
 * Files it edits (all relative to the project root):
 *     backend/src/routes/orders.js   -> new route  PATCH /api/orders/:id/pickup
 *     frontend/campusdine.html       -> button + editor, live update, English + Bangla texts
 *
 * Usage, from the project root (the folder that contains "frontend" and "backend"):
 *     node feature-pickup14.js
 *
 * Safe by design: it checks everything first; if a REQUIRED piece does not match it changes NOTHING and
 * tells you which one. Otherwise it saves backups (*.bak14), edits, and keeps your line endings.
 * Running it twice is harmless.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

// ───────────────────────────── backend ─────────────────────────────
const ROUTE = `// PATCH /api/orders/:id/pickup  (student/teacher) — move the pickup time while the order is still "Received"
// Fix 14: happy-hour prices are judged at the pickup moment, so a new time is only accepted when it leaves
// this order's happy-hour discount unchanged (otherwise: cancel it and order again at the new time).
router.patch("/:id/pickup", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const wanted = String((req.body && req.body.pickupTime) || "").trim();
  if (!wanted) return res.status(400).json({ error: "Choose a pickup time" });
  let newTime = null;
  try { newTime = resolvePickupTime(wanted); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (!newTime) return res.status(400).json({ error: "Choose a pickup time" });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [req.params.id]);
    if (!order) throw { status: 404, message: "Order not found" };
    if (order.user_id !== req.user.id) throw { status: 403, message: "This isn't your order" };
    if (order.status !== "Received") {
      throw { status: 400, message: "The pickup time can only be changed while the order is still 'Received'" };
    }
    if (order.pickup_time && Math.abs(new Date(order.pickup_time).getTime() - newTime.getTime()) < 60000) {
      throw { status: 400, message: "That is already your pickup time" };
    }

    // Would the happy-hour price of THIS order differ between the old and the new time? (same prices, same rules)
    const [rows] = await conn.query(
      \`SELECT oi.menu_item_id, oi.name, oi.price, oi.qty, m.category
       FROM order_items oi LEFT JOIN menu_items m ON m.id = oi.menu_item_id WHERE oi.order_id = ?\`, [order.id]);
    const snapshot = rows.map((r, i) => ({ id: r.menu_item_id || -(i + 1), name: r.name, price: r.price, qty: r.qty, category: r.category }));
    const oldWhen = order.pickup_time ? new Date(order.pickup_time) : new Date(order.created_at);
    const before = await pricing.priceCart(conn, snapshot, oldWhen);
    const after = await pricing.priceCart(conn, snapshot, newTime);
    if (Math.abs(Number(before.happyHourDiscount) - Number(after.happyHourDiscount)) > 0.005) {
      throw {
        status: 409,
        message: "Happy-hour pricing depends on the pickup time, and that time would change this order's price. "
          + "Pick a time with the same price, or cancel this order and order again.",
      };
    }

    const [updated] = await conn.query("UPDATE orders SET pickup_time = ? WHERE id = ? AND status = 'Received'", [newTime, order.id]);
    if (!updated.affectedRows) throw { status: 409, message: "This order has just been updated. Please refresh." };
    await recordAuditEvent(conn, req, "ORDER_PICKUP_CHANGE", "order", order.id, { from: order.pickup_time || null, to: newTime });
    await conn.commit();

    const payload = { id: order.id, token: order.token, pickup_time: newTime.toISOString() };
    const io = req.app.get("io");
    if (io) {
      io.to("admins").emit("order:pickup", payload);
      io.to(\`user:\${order.user_id}\`).emit("order:pickup", payload);
      if (order.rider_id) io.to(\`rider:\${order.rider_id}\`).emit("rider:order-assigned", { orderId: order.id });
    }
    res.json(payload);
  } catch (err) {
    await conn.rollback();
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? "Failed to change the pickup time" : err.message });
  } finally {
    conn.release();
  }
}));

// PATCH /api/orders/:id/cancel`;

// ───────────────────────────── frontend ─────────────────────────────
const EDITOR = `// Fix 14: change the pickup time of an order that is still "Received"
function PickupEditor({ order, onSave, busy }) {
  const toHHMM = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return \`\${String(d.getHours()).padStart(2, "0")}:\${String(d.getMinutes()).padStart(2, "0")}\`;
  };
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <>
      <button type="button" disabled={busy}
        onClick={() => { setValue(toHHMM(order.pickup_time)); setOpen(o => !o); }}
        className="text-xs px-3 py-1.5 rounded-lg border font-600"
        style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
        🕒 {tx("pickup.change")}
      </button>
      {open && (
        <div className="w-full flex flex-wrap items-center gap-2">
          <input type="time" value={value} onChange={e => setValue(e.target.value)}
            className="px-3 py-1.5 rounded-lg border font-mono text-sm" style={{ borderColor: "var(--line)" }} />
          <button type="button" disabled={busy || !value}
            onClick={async () => { if (await onSave(order.id, value)) setOpen(false); }}
            className="text-xs px-3 py-1.5 rounded-lg font-600"
            style={{ background: "var(--teal)", color: "#fff", opacity: busy || !value ? 0.5 : 1 }}>
            {tx("pickup.save")}
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="text-xs px-3 py-1.5 rounded-lg border font-600"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            {tx("pickup.close")}
          </button>
          <span className="w-full text-xs" style={{ color: "var(--ink-soft)" }}>{tx("pickup.hint")}</span>
        </div>
      )}
    </>
  );
}

function TrackOrder({`;

const CHANGE_PICKUP = `  // Fix 14: move the pickup time of an order that is still "Received" (the server re-checks every rule)
  const changePickup = async (id, hhmm) => {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const r = await call(\`/api/orders/\${id}/pickup\`, { method: "PATCH", body: { pickupTime: hhmm } });
      await refreshMyOrders();
      showSuccess(tx("pickup.saved", { t: r.token, h: new Date(r.pickup_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }));
      return true;
    } catch (e) { showError(e); return false; } finally { setBusy(false); }
  };

  const cancelOrder = async (id) => {`;

const SOCKET = `    // Fix 14: a customer moved their pickup time — keep the order list (and the admin's bell) up to date
    socket.on("order:pickup", (p) => {
      setOrders(prev => prev.map(o => o.id === p.id ? { ...o, pickup_time: p.pickup_time } : o));
      if (session.user.role === "admin") {
        pushNotification("order", "Pickup time changed", \`Order \${p.token} is now for \${new Date(p.pickup_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.\`);
      }
    });
    socket.on("order:update", (order) => {`;

const EN_KEYS = `    "reorder.left": " left",
    "pickup.change": "Change pickup time",
    "pickup.save": "Save",
    "pickup.close": "Close",
    "pickup.hint": "Between 10 minutes and 4 hours from now",
    "pickup.saved": "Pickup time for {t} is now {h}.",
`;

const BN_KEYS = `    "reorder.left": "টি আছে",
    "pickup.change": "পিকআপের সময় বদলান",
    "pickup.save": "সংরক্ষণ",
    "pickup.close": "বন্ধ",
    "pickup.hint": "এখন থেকে ১০ মিনিট থেকে ৪ ঘণ্টার মধ্যে",
    "pickup.saved": "{t}-এর পিকআপের সময় এখন {h}।",
`;

const CANCEL_BLOCK_OLD = `                {o.status === "Received" && (
                  <button disabled={cancelBusy} onClick={() => onCancel(o.id)}`;
const CANCEL_BLOCK_NEW = `                {o.status === "Received" && onChangePickup && (
                  <PickupEditor order={o} onSave={onChangePickup} busy={cancelBusy} />
                )}
                {o.status === "Received" && (
                  <button disabled={cancelBusy} onClick={() => onCancel(o.id)}`;

const FILES = [
  {
    file: "backend/src/routes/orders.js",
    required: true,
    patches: [
      {
        name: "orders.js: new route PATCH /api/orders/:id/pickup",
        done: "router.patch(\"/:id/pickup\"",
        find: "// PATCH /api/orders/:id/cancel",
        replace: ROUTE,
      },
    ],
  },
  {
    file: "frontend/campusdine.html",
    required: true,
    patches: [
      { name: "html: PickupEditor component", done: "function PickupEditor(", find: "function TrackOrder({", replace: EDITOR },
      {
        name: "html: TrackOrder receives onChangePickup",
        done: "onCancel, onChangePickup, cancelBusy",
        find: "onCancel, cancelBusy, onReorder, apiBase, token })",
        replace: "onCancel, onChangePickup, cancelBusy, onReorder, apiBase, token })",
      },
      { name: "html: button on every \"Received\" order card", done: "<PickupEditor order={o}", find: CANCEL_BLOCK_OLD, replace: CANCEL_BLOCK_NEW },
      { name: "html: changePickup() in the app", done: "const changePickup = async", find: "  const cancelOrder = async (id) => {", replace: CHANGE_PICKUP },
      {
        name: "html: pass changePickup to the Track tab",
        done: "onChangePickup={changePickup}",
        find: "onCancel={cancelOrder} cancelBusy={busy}",
        replace: "onCancel={cancelOrder} onChangePickup={changePickup} cancelBusy={busy}",
      },
      {
        name: "html: live update when a pickup time changes (admin list + bell)",
        optional: true,
        done: "socket.on(\"order:pickup\"",
        find: "    socket.on(\"order:update\", (order) => {",
        replace: SOCKET,
      },
      { name: "html: English texts", done: "\"pickup.change\": \"Change pickup time\"", find: "    \"reorder.left\": \" left\",\n", replace: EN_KEYS },
      { name: "html: Bangla texts", done: "\"pickup.change\": \"পিকআপের সময় বদলান\"", find: "    \"reorder.left\": \"টি আছে\",\n", replace: BN_KEYS },
    ],
  },
];

const countOf = (text, piece) => text.split(piece).length - 1;
const problems = [];
const warnings = [];
const plan = [];

for (const f of FILES) {
  const full = path.join(ROOT, f.file);
  if (!fs.existsSync(full)) {
    if (f.required) problems.push(`${f.file}: file not found (run this from the project root)`);
    continue;
  }
  const raw = fs.readFileSync(full, "utf8");
  const crlf = raw.includes("\r\n");
  let text = raw.replace(/\r\n/g, "\n");
  const applied = [];
  const skipped = [];

  for (const p of f.patches) {
    if (text.includes(p.done)) { skipped.push(p.name); continue; }
    const n = countOf(text, p.find);
    if (n !== 1) {
      const msg = `${p.name}: expected the anchor text exactly once, found ${n}`;
      if (p.optional) warnings.push(`skipped (optional) — ${msg}`);
      else problems.push(msg);
      continue;
    }
    text = text.replace(p.find, () => p.replace);
    applied.push(p.name);
  }
  plan.push({ full, crlf, text, changed: applied.length > 0, applied, skipped });
}

if (problems.length) {
  console.log("\n❌ Nothing was changed. These pieces did not match:\n");
  for (const p of problems) console.log("  - " + p);
  console.log("\nSend this message back to Claude and it will adjust the script.");
  process.exit(1);
}

for (const item of plan) {
  for (const s of item.skipped) console.log(`↷ already in place: ${s}`);
  if (!item.changed) continue;
  const backup = item.full + ".bak14";
  if (!fs.existsSync(backup)) fs.copyFileSync(item.full, backup);
  fs.writeFileSync(item.full, item.crlf ? item.text.replace(/\n/g, "\r\n") : item.text, "utf8");
  for (const a of item.applied) console.log(`✅ ${a}`);
}
for (const w of warnings) console.log(`⚠️  ${w}`);

console.log(plan.some((p) => p.changed)
  ? "\nDone. Restart the server, hard-refresh the page (Ctrl+Shift+R) and test."
  : "\nNothing to do — everything was already applied.");
