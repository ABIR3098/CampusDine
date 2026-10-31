// delivery-note.js — Feature: delivery instructions ("gate-e dibe") when placing an order.
// Student writes it in the cart -> saved with the order -> shown to the student, admin and rider.
// Run from the project main folder:  node delivery-note.js   (then restart the backend)
const fs = require("fs");

const FILES = {
  html: "frontend/campusdine.html",
  orders: "backend/src/routes/orders.js",
  riders: "backend/src/routes/riders.js",
  server: "backend/server.js",
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
  html: "/* Feature: delivery instructions */",
  orders: "delivery_note",
  riders: "o.delivery_note",
  server: '"delivery_note"',
};
const todo = Object.keys(docs).filter((k) => !docs[k].s.includes(MARK[k]));
if (todo.length === 0) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend/server.js: add the column to existing databases ---------------- */
if (todo.includes("server")) {
  rep("server", "migration",
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
`,
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
    await addColumn("orders", "delivery_note", "VARCHAR(255) NULL");   // delivery instructions, e.g. "gate-e dibe"
`);
}

/* ---------------- backend/src/routes/orders.js ---------------- */
if (todo.includes("orders")) {
  rep("orders", "parse",
`  const orderNote = typeof req.body.note === "string" ? (req.body.note.trim().slice(0, 200) || null) : null;
`,
`  const orderNote = typeof req.body.note === "string" ? (req.body.note.trim().slice(0, 200) || null) : null;
  // Feature: delivery instructions (e.g. "gate-e dibe") — trimmed, at most 200 characters
  const deliveryNote = typeof req.body.deliveryNote === "string" ? (req.body.deliveryNote.trim().slice(0, 200) || null) : null;
`);
  rep("orders", "insert columns",
`pickup_time, note, delivery_lat, delivery_lng, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received')`,
`pickup_time, note, delivery_note, delivery_lat, delivery_lng, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Received')`);
  rep("orders", "insert values",
`pickupTime, orderNote, hasValidDeliveryLocation ? deliveryLat : null`,
`pickupTime, orderNote, deliveryNote, hasValidDeliveryLocation ? deliveryLat : null`);
  rep("orders", "response",
`status: "Received", pickup_time: pickupTime, note: orderNote,`,
`status: "Received", pickup_time: pickupTime, note: orderNote, delivery_note: deliveryNote,`);
  rep("orders", "verify select",
`o.payment_method, o.pickup_time, o.note, o.created_at, o.picked_up_at,`,
`o.payment_method, o.pickup_time, o.note, o.delivery_note, o.created_at, o.picked_up_at,`);
}

/* ---------------- backend/src/routes/riders.js ---------------- */
if (todo.includes("riders")) {
  rep("riders", "rider select",
`SELECT o.id, o.token, o.total, o.status, o.pickup_time, o.note,`,
`SELECT o.id, o.token, o.total, o.status, o.pickup_time, o.note, o.delivery_note,`);
}

/* ---------------- frontend/campusdine.html ---------------- */
if (todo.includes("html")) {
  // texts (English + Bangla)
  rep("html", "en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "dnote.label": "Delivery instructions (optional)",
    "dnote.ph": "e.g. leave it at the gate, call when you arrive",
    "dnote.show": "Delivery",
`);
  rep("html", "bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "dnote.label": "ডেলিভারি নির্দেশনা (ঐচ্ছিক)",
    "dnote.ph": "যেমন গেটে দিবেন, এসে ফোন করবেন",
    "dnote.show": "ডেলিভারি",
`);

  // state
  rep("html", "state",
`  const [orderNote, setOrderNote] = useState("");
`,
`  const [orderNote, setOrderNote] = useState("");
  /* Feature: delivery instructions */
  const [deliveryNote, setDeliveryNote] = useState("");
`);
  rep("html", "reset",
`setOrderNote(""); setRewardId(null); setQuote(null); }`,
`setOrderNote(""); setDeliveryNote(""); setRewardId(null); setQuote(null); }`);

  // input box (under the kitchen note)
  rep("html", "input",
`                <div className="text-[10px] text-right mt-0.5" style={{ color: "var(--ink-soft)" }}>{num(orderNote.length)}/{num(200)}</div>
              </div>
`,
`                <div className="text-[10px] text-right mt-0.5" style={{ color: "var(--ink-soft)" }}>{num(orderNote.length)}/{num(200)}</div>
              </div>
              <div className="mb-4">
                <label className="text-xs uppercase tracking-wide block mb-2" style={{ color: "var(--ink-soft)" }}>{tx("dnote.label")}</label>
                <input type="text" value={deliveryNote} onChange={e => setDeliveryNote(e.target.value.slice(0, 200))} maxLength={200}
                  placeholder={tx("dnote.ph")} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }} />
              </div>
`);

  // send it with the order
  if (docs.html.s.includes("orderNote, rewardId, tip)}")) {
    // rider-tip is already installed: the delivery note goes in front of the tip
    rep("html", "checkout click", `orderNote, rewardId, tip)}`, `orderNote, rewardId, deliveryNote, tip)}`);
    rep("html", "placeOrder signature", `rewardId, tip) => {`, `rewardId, deliveryNote, tip) => {`);
  } else {
    rep("html", "checkout click", `orderNote, rewardId)}`, `orderNote, rewardId, deliveryNote)}`);
    rep("html", "placeOrder signature",
`const placeOrder = async (cartItems, paymentMethod, pickupTime, coupon, note, rewardId) => {`,
`const placeOrder = async (cartItems, paymentMethod, pickupTime, coupon, note, rewardId, deliveryNote) => {`);
  }
  rep("html", "placeOrder body",
`          rewardId: rewardId || undefined,
`,
`          rewardId: rewardId || undefined,
          deliveryNote: deliveryNote && deliveryNote.trim() ? deliveryNote.trim() : undefined,
`);

  // show it: student's Orders tab
  rep("html", "student view",
`              {o.rider_id && <RiderOrderChat apiBase={apiBase} token={token} orderId={o.id} />}`,
`              {o.delivery_note && (
                <div className="text-xs mt-2 px-2.5 py-1.5 rounded-lg" style={{ background: "var(--gold-soft)", color: "var(--teal-deep)" }}>
                  🚪 {tx("dnote.show")}: {o.delivery_note}
                </div>
              )}
              {o.rider_id && <RiderOrderChat apiBase={apiBase} token={token} orderId={o.id} />}`);

  // receipt
  rep("html", "receipt",
`            {printOrder.note && (
              <div className="receipt-row"><span>{tx("note.show")}</span><span>{printOrder.note}</span></div>
            )}
`,
`            {printOrder.note && (
              <div className="receipt-row"><span>{tx("note.show")}</span><span>{printOrder.note}</span></div>
            )}
            {printOrder.delivery_note && (
              <div className="receipt-row"><span>{tx("dnote.show")}</span><span>{printOrder.delivery_note}</span></div>
            )}
`);

  // admin queue card
  rep("html", "admin queue",
`              📝 Note: {o.note}
            </div>
          )}
`,
`              📝 Note: {o.note}
            </div>
          )}
          {o.delivery_note && (
            <div className="text-sm mb-3 px-3 py-2 rounded-lg font-600"
              style={{ background: "var(--warn-bg, #FFFBEB)", color: "var(--warn-fg, #92400E)", border: "1px solid var(--warn-border, #FDE68A)" }}>
              🚪 Delivery: {o.delivery_note}
            </div>
          )}
`);

  // admin QR / token check
  rep("html", "admin verify",
`            {o.note && <div className="text-sm px-3 py-2 rounded-lg font-600" style={{ background: "var(--warn-bg, #FFFBEB)", color: "var(--warn-fg, #92400E)" }}>📝 {o.note}</div>}
`,
`            {o.note && <div className="text-sm px-3 py-2 rounded-lg font-600" style={{ background: "var(--warn-bg, #FFFBEB)", color: "var(--warn-fg, #92400E)" }}>📝 {o.note}</div>}
            {o.delivery_note && <div className="text-sm px-3 py-2 rounded-lg font-600" style={{ background: "var(--warn-bg, #FFFBEB)", color: "var(--warn-fg, #92400E)" }}>🚪 {o.delivery_note}</div>}
`);

  // rider dashboard
  rep("html", "rider table",
`<td className="p-2">#{o.id}`,
`<td className="p-2">#{o.id}{o.delivery_note && <div className="text-xs mt-1" style={{color:"var(--ink-soft)"}}>🚪 {o.delivery_note}</div>}`);
}

/* ---------------- save (backups first) ---------------- */
for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak10");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: delivery instructions added (cart box, saved with the order, shown to student, admin and rider).");
console.log("Restart the backend now: Ctrl+C, then npm start. Then refresh the browser with Ctrl+Shift+R.");
