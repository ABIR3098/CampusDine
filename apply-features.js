#!/usr/bin/env node
/*
 * apply-features.js — adds two features to CampusDine:
 *
 *   1) ORDER NOTE     Students can write a note for the kitchen when ordering (e.g. "ঝাল কম").
 *                     It shows (highlighted) in the admin's order queue, on the student's Track Order
 *                     page and on the printed receipt.
 *   2) SOLD OUT / HIDE  In Admin > Menu there is a new "Availability" column with one-click buttons:
 *                       "Sold out" (item stays on the menu but cannot be ordered) and
 *                       "Hide" (item disappears from students' menu). Changes reach students live.
 *
 * Files it edits (all relative to the project root):
 *     frontend/campusdine.html
 *     backend/src/routes/orders.js
 *     backend/src/routes/menu.js
 *     backend/server.js            (adds the two new database columns automatically at startup)
 *     backend/schema.sql           (optional; only matters for a brand-new database)
 *
 * Usage, from the project root (the folder that contains "frontend" and "backend"):
 *     node apply-features.js
 *
 * Safe by design: it checks EVERY file first; if anything is not exactly what it expects it changes
 * NOTHING and tells you which piece did not match. Otherwise it saves a backup of each file
 * (*.before-notes.bak), edits it, and keeps your Windows/Unix line endings.
 */
const fs = require("fs");
const path = require("path");

const FILES = {
 "backend/src/routes/orders.js": {
  "required": true,
  "pairs": [
   {
    "old": "  const couponRequested = Boolean(couponId || couponCode);",
    "new": "  // Feature: optional note for the kitchen (e.g. \"less spicy\") — trimmed, at most 200 characters\n  const orderNote = typeof req.body.note === \"string\" ? (req.body.note.trim().slice(0, 200) || null) : null;\n\n  const couponRequested = Boolean(couponId || couponCode);",
    "count": 1
   },
   {
    "old": "      if (menuItem.stock < reqItem.qty) throw { status: 409, message: `${menuItem.name} is out of stock` };",
    "new": "      // Feature: sold-out / hidden items cannot be ordered even if some stock is left\n      if (menuItem.availability === \"sold_out\") throw { status: 409, message: `${menuItem.name} is sold out` };\n      if (menuItem.availability === \"hidden\") throw { status: 409, message: `${menuItem.name} is not available right now` };\n      if (menuItem.stock < reqItem.qty) throw { status: 409, message: `${menuItem.name} is out of stock` };",
    "count": 1
   },
   {
    "old": "\"INSERT INTO orders (token, user_id, total, discount_amount, discount_applied, payment_method, pickup_time, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'Received')\",\n      [token, req.user.id, total, discountAmount, appliedCoupon ? 1 : 0, paymentMethod, pickupTime]",
    "new": "\"INSERT INTO orders (token, user_id, total, discount_amount, discount_applied, payment_method, pickup_time, note, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Received')\",\n      [token, req.user.id, total, discountAmount, appliedCoupon ? 1 : 0, paymentMethod, pickupTime, orderNote]",
    "count": 1
   },
   {
    "old": "status: \"Received\", pickup_time: pickupTime, items: snapshot };",
    "new": "status: \"Received\", pickup_time: pickupTime, note: orderNote, items: snapshot };",
    "count": 1
   }
  ],
  "marker": "orderNote"
 },
 "backend/src/routes/menu.js": {
  "required": true,
  "pairs": [
   {
    "old": "  const [rows] = await pool.query(\n    `SELECT m.*, IF(f.user_id IS NULL, 0, 1) AS is_favorite\n     FROM menu_items m\n     LEFT JOIN ${table} f ON f.${itemColumn} = m.id AND f.user_id = ?\n     ORDER BY m.category, m.name`,\n    [req.user.id]\n  );",
    "new": "  // Feature: hidden items are only visible to the admin (who needs them to un-hide them)\n  const hiddenFilter = req.user.role === \"admin\" ? \"\" : \"WHERE m.availability IS NULL OR m.availability <> 'hidden'\";\n  const [rows] = await pool.query(\n    `SELECT m.*, IF(f.user_id IS NULL, 0, 1) AS is_favorite\n     FROM menu_items m\n     LEFT JOIN ${table} f ON f.${itemColumn} = m.id AND f.user_id = ?\n     ${hiddenFilter}\n     ORDER BY m.category, m.name`,\n    [req.user.id]\n  );",
    "count": 1
   },
   {
    "old": "  const { price, stock, tag, isVeg } = req.body;",
    "new": "  const { price, stock, tag, isVeg, availability } = req.body;",
    "count": 1
   },
   {
    "old": "  if (isVeg !== undefined) { fields.push(\"is_veg = ?\"); values.push(isVeg ? 1 : 0); }",
    "new": "  if (isVeg !== undefined) { fields.push(\"is_veg = ?\"); values.push(isVeg ? 1 : 0); }\n  if (availability !== undefined) {\n    if (![\"available\", \"sold_out\", \"hidden\"].includes(availability)) {\n      return res.status(400).json({ error: \"availability must be available, sold_out or hidden\" });\n    }\n    fields.push(\"availability = ?\"); values.push(availability);\n  }",
    "count": 1
   },
   {
    "old": "  if (row.length === 0) return res.status(404).json({ error: \"Item not found\" });\n  res.json(row[0]);",
    "new": "  if (row.length === 0) return res.status(404).json({ error: \"Item not found\" });\n  const io = req.app.get(\"io\");\n  if (io) io.emit(\"menu:changed\"); // students' menus refresh live (sold out / hidden / price changes)\n  res.json(row[0]);",
    "count": 1
   }
  ],
  "marker": "hiddenFilter"
 },
 "backend/server.js": {
  "required": true,
  "pairs": [
   {
    "old": "async function ensureChatSchema(db) {",
    "new": "// Feature: order note + sold-out/hide. Adds the new columns to databases created before this change\n// (same SHOW COLUMNS / ALTER TABLE approach as the coupon schema check above).\nasync function ensureNoteAndAvailabilitySchema(db) {\n  try {\n    const [noteColumn] = await db.query(\"SHOW COLUMNS FROM orders LIKE 'note'\");\n    if (noteColumn.length === 0) {\n      await db.query(\"ALTER TABLE orders ADD COLUMN note VARCHAR(255) NULL\");\n      console.log(\"✅ Added orders.note column\");\n    }\n    const [availabilityColumn] = await db.query(\"SHOW COLUMNS FROM menu_items LIKE 'availability'\");\n    if (availabilityColumn.length === 0) {\n      await db.query(\"ALTER TABLE menu_items ADD COLUMN availability VARCHAR(12) NOT NULL DEFAULT 'available'\");\n      console.log(\"✅ Added menu_items.availability column\");\n    }\n  } catch (error) {\n    console.warn(\"⚠️ Order note / availability schema check failed:\", error.message);\n  }\n}\n\nasync function ensureChatSchema(db) {",
    "count": 1
   },
   {
    "old": "  await ensureChatSchema(db);\n",
    "new": "  await ensureChatSchema(db);\n  await ensureNoteAndAvailabilitySchema(db);\n",
    "count": 1
   }
  ],
  "marker": "ensureNoteAndAvailabilitySchema"
 },
 "backend/schema.sql": {
  "required": false,
  "pairs": [
   {
    "old": "  is_veg TINYINT(1) NOT NULL DEFAULT 1,   -- 1 = vegetarian, 0 = non-vegetarian\n",
    "new": "  is_veg TINYINT(1) NOT NULL DEFAULT 1,   -- 1 = vegetarian, 0 = non-vegetarian\n  availability VARCHAR(12) NOT NULL DEFAULT 'available',   -- available | sold_out | hidden\n",
    "count": 1
   },
   {
    "old": "  pickup_time DATETIME NULL,  -- NULL = ASAP; otherwise a scheduled pickup time (feature: pre-order)\n",
    "new": "  pickup_time DATETIME NULL,  -- NULL = ASAP; otherwise a scheduled pickup time (feature: pre-order)\n  note VARCHAR(255) NULL,     -- optional note for the kitchen, e.g. \"less spicy\"\n",
    "count": 1
   }
  ],
  "marker": "availability VARCHAR(12)"
 },
 "frontend/campusdine.html": {
  "required": true,
  "pairs": [
   {
    "old": "  const [couponBusy, setCouponBusy] = useState(false);\n",
    "new": "  const [couponBusy, setCouponBusy] = useState(false);\n  const [orderNote, setOrderNote] = useState(\"\");\n",
    "count": 1
   },
   {
    "old": "    if (cart.length === 0) setCouponCode(\"\");",
    "new": "    if (cart.length === 0) { setCouponCode(\"\"); setOrderNote(\"\"); }",
    "count": 1
   },
   {
    "old": "              <div className=\"mb-4\">\n                <label className=\"flex items-center gap-2 text-sm mb-2\">\n                  <input type=\"checkbox\" checked={scheduleLater}",
    "new": "              <div className=\"mb-4\">\n                <label className=\"text-xs uppercase tracking-wide block mb-2\" style={{ color: \"var(--ink-soft)\" }}>{tx(\"note.label\")}</label>\n                <textarea value={orderNote} onChange={e => setOrderNote(e.target.value.slice(0, 200))} rows={2} maxLength={200}\n                  placeholder={tx(\"note.ph\")} className=\"w-full px-3 py-2 rounded-lg border text-sm resize-none\" style={{ borderColor: \"var(--line)\" }} />\n                <div className=\"text-[10px] text-right mt-0.5\" style={{ color: \"var(--ink-soft)\" }}>{num(orderNote.length)}/{num(200)}</div>\n              </div>\n              <div className=\"mb-4\">\n                <label className=\"flex items-center gap-2 text-sm mb-2\">\n                  <input type=\"checkbox\" checked={scheduleLater}",
    "count": 1
   },
   {
    "old": "placeOrder(cart, payMethod, scheduleLater ? pickupTime : null, couponApplied)",
    "new": "placeOrder(cart, payMethod, scheduleLater ? pickupTime : null, couponApplied, orderNote)",
    "count": 1
   },
   {
    "old": "const placeOrder = async (cartItems, paymentMethod, pickupTime, coupon) => {",
    "new": "const placeOrder = async (cartItems, paymentMethod, pickupTime, coupon, note) => {",
    "count": 1
   },
   {
    "old": "          couponCode: coupon ? coupon.code : undefined,\n",
    "new": "          couponCode: coupon ? coupon.code : undefined,\n          note: note && note.trim() ? note.trim() : undefined,\n",
    "count": 1
   },
   {
    "old": "                {o.items.map(i => `${dispName(i.name)} ×${num(i.qty)}`).join(\", \")}\n              </div>\n",
    "new": "                {o.items.map(i => `${dispName(i.name)} ×${num(i.qty)}`).join(\", \")}\n              </div>\n              {o.note && (\n                <div className=\"text-xs mt-2 px-2.5 py-1.5 rounded-lg\" style={{ background: \"var(--gold-soft)\", color: \"var(--teal-deep)\" }}>\n                  {tx(\"note.show\")}: {o.note}\n                </div>\n              )}\n",
    "count": 1
   },
   {
    "old": "<div className=\"receipt-row\"><span>{tx(\"rc.payment\")}</span><span>{printOrder.payment_method === \"wallet\" ? tx(\"pay.wallet\") : tx(\"pay.cash\")}</span></div>\n",
    "new": "<div className=\"receipt-row\"><span>{tx(\"rc.payment\")}</span><span>{printOrder.payment_method === \"wallet\" ? tx(\"pay.wallet\") : tx(\"pay.cash\")}</span></div>\n            {printOrder.note && (\n              <div className=\"receipt-row\"><span>{tx(\"note.show\")}</span><span>{printOrder.note}</span></div>\n            )}\n",
    "count": 1
   },
   {
    "old": "            {o.items.map(i => `${i.name} ×${i.qty}`).join(\", \")}\n          </div>\n",
    "new": "            {o.items.map(i => `${i.name} ×${i.qty}`).join(\", \")}\n          </div>\n          {o.note && (\n            <div className=\"text-sm mb-3 px-3 py-2 rounded-lg font-600\"\n              style={{ background: \"var(--warn-bg, #FFFBEB)\", color: \"var(--warn-fg, #92400E)\", border: \"1px solid var(--warn-border, #FDE68A)\" }}>\n              📝 Note: {o.note}\n            </div>\n          )}\n",
    "count": 1
   },
   {
    "old": "const out = item.stock <= 0;",
    "new": "const out = item.stock <= 0 || item.availability === \"sold_out\";",
    "count": 2
   },
   {
    "old": "{tx(\"outstock\")}",
    "new": "{item.availability === \"sold_out\" ? tx(\"soldout\") : tx(\"outstock\")}",
    "count": 2
   },
   {
    "old": "if (!m || m.stock <= 0) { skipped.push(dispName(it.name)); continue; }",
    "new": "if (!m || m.stock <= 0 || m.availability === \"sold_out\") { skipped.push(dispName(it.name)); continue; }",
    "count": 1
   },
   {
    "old": "    socket.on(\"queue:changed\", () => {",
    "new": "    // Admin changed an item (sold out / hidden / price): refresh the menu live\n    socket.on(\"menu:changed\", () => { refreshMenu().catch(() => {}); });\n    socket.on(\"queue:changed\", () => {",
    "count": 1
   },
   {
    "old": "<th className=\"text-left p-3 font-display\" style={{ color: \"var(--teal-deep)\" }}>Stock</th>",
    "new": "<th className=\"text-left p-3 font-display\" style={{ color: \"var(--teal-deep)\" }}>Stock</th>\n              <th className=\"text-left p-3 font-display\" style={{ color: \"var(--teal-deep)\" }}>Availability</th>",
    "count": 1
   },
   {
    "old": "<tr key={item.id} style={{ borderTop: \"1px solid var(--line)\" }}>",
    "new": "<tr key={item.id} style={{ borderTop: \"1px solid var(--line)\", opacity: (item.availability || \"available\") === \"available\" ? 1 : 0.6 }}>",
    "count": 1
   },
   {
    "old": "color: item.stock <= LOW_STOCK_THRESHOLD ? \"var(--brick)\" : \"inherit\" }} />\n                </td>\n",
    "new": "color: item.stock <= LOW_STOCK_THRESHOLD ? \"var(--brick)\" : \"inherit\" }} />\n                </td>\n                <td className=\"p-3\">\n                  {(() => {\n                    const a = item.availability || \"available\";\n                    const pill = a === \"hidden\" ? \"Hidden\" : a === \"sold_out\" ? \"Sold out\" : \"Available\";\n                    const pillStyle = a === \"available\"\n                      ? { background: \"var(--ok-bg, #F0FDF4)\", color: \"var(--ok-fg, #15803D)\" }\n                      : a === \"sold_out\"\n                        ? { background: \"var(--warn-bg, #FFFBEB)\", color: \"var(--warn-fg, #92400E)\" }\n                        : { background: \"var(--danger-bg, #FEF2F2)\", color: \"var(--danger-fg, #B91C1C)\" };\n                    return (\n                      <div className=\"flex items-center gap-2 flex-wrap\">\n                        <span className=\"text-[11px] font-700 px-2 py-0.5 rounded-full\" style={pillStyle}>{pill}</span>\n                        {a !== \"hidden\" && (\n                          <button onClick={() => updateItem(item.id, { availability: a === \"sold_out\" ? \"available\" : \"sold_out\" })}\n                            className=\"text-xs px-2.5 py-1 rounded-lg border font-600\" style={{ borderColor: \"var(--line)\" }}>\n                            {a === \"sold_out\" ? \"Mark available\" : \"Sold out\"}\n                          </button>\n                        )}\n                        <button onClick={() => updateItem(item.id, { availability: a === \"hidden\" ? \"available\" : \"hidden\" })}\n                          className=\"text-xs px-2.5 py-1 rounded-lg border font-600\" style={{ borderColor: \"var(--line)\" }}>\n                          {a === \"hidden\" ? \"Show\" : \"Hide\"}\n                        </button>\n                      </div>\n                    );\n                  })()}\n                </td>\n",
    "count": 1
   },
   {
    "old": "Edit a price or stock number and click outside the box to save.",
    "new": "Edit a price or stock number and click outside the box to save. \"Sold out\" keeps an item on the menu but blocks ordering; \"Hide\" removes it from students' menu until you show it again.",
    "count": 1
   },
   {
    "old": "\n  },\n  bn: {",
    "new": ",\n    \"note.label\": \"Note for the kitchen (optional)\",\n    \"note.ph\": \"e.g. less spicy, no onion\",\n    \"note.show\": \"Note\",\n    \"soldout\": \"Sold out\"\n  },\n  bn: {",
    "count": 1
   },
   {
    "old": "\n  }\n};\nconst tx = ",
    "new": ",\n    \"note.label\": \"রান্নাঘরের জন্য নোট (ঐচ্ছিক)\",\n    \"note.ph\": \"যেমন ঝাল কম, পেঁয়াজ ছাড়া\",\n    \"note.show\": \"নোট\",\n    \"soldout\": \"বিক্রি শেষ\"\n  }\n};\nconst tx = ",
    "count": 1
   }
  ],
  "marker": "note.label"
 }
};

const root = path.resolve(process.argv[2] || ".");
const plan = [];       // files that will be written
const problems = [];   // reasons to stop
const notes = [];      // harmless remarks
let alreadyDone = 0;

for (const [rel, spec] of Object.entries(FILES)) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    (spec.required ? problems : notes).push(rel + ": file not found" + (spec.required ? "" : " (optional, skipped)"));
    continue;
  }
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let text = raw.replace(/\r\n/g, "\n");
  if (text.includes(spec.marker)) { alreadyDone++; notes.push(rel + ": already has this feature, left as is"); continue; }

  const missing = [];
  spec.pairs.forEach((p, i) => {
    const found = text.split(p.old).length - 1;
    if (found !== p.count) { missing.push("  edit #" + (i + 1) + ": expected " + p.count + " match(es), found " + found + "  ->  " + JSON.stringify(p.old.slice(0, 80))); return; }
    text = text.split(p.old).join(p.new);
  });
  if (missing.length) {
    if (spec.required) problems.push(rel + " is different from what this script expects:\n" + missing.join("\n"));
    else notes.push(rel + ": optional file does not match, skipped (" + missing.length + " edit(s))");
    continue;
  }
  plan.push({ rel, file, crlf, text });
}

if (problems.length) {
  console.error("NOTHING WAS CHANGED.\n\n" + problems.join("\n\n"));
  console.error("\nSend this message back (and the file it mentions) and the script will be adjusted.");
  process.exit(2);
}
if (plan.length === 0) {
  console.log(alreadyDone ? "Both features are already in your files — nothing to do." : "Nothing to do.");
  notes.forEach(n => console.log("  - " + n));
  process.exit(0);
}

for (const f of plan) {
  fs.copyFileSync(f.file, f.file + ".before-notes.bak");
  fs.writeFileSync(f.file, f.crlf ? f.text.replace(/\n/g, "\r\n") : f.text, "utf8");
  console.log("edited  " + f.rel);
}
notes.forEach(n => console.log("note:   " + n));
console.log("\nDone. Backups: <file>.before-notes.bak next to each edited file (you can delete them later).");
console.log("Next: stop the backend (Ctrl+C), start it again (npm run dev) — it adds the new database columns by itself —");
console.log("then hard-refresh the browser (Ctrl+Shift+R).");
