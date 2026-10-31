// rate-rider.js — Feature: rate your rider.
//  • After an order has been handed over, the student sees "Rate your rider" (1–5 stars + optional comment) on that order.
//  • One rating per order; the student's Orders tab then shows the stars they gave.
//  • The rider's dashboard shows the average rating and the latest comments (without the student's name).
// Run from the project main folder:  node rate-rider.js   (then restart the backend)
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
  html: "/* Feature: rate your rider */",
  server: "rider_rating",
  orders: "// Feature: rate your rider",
  riders: "rating_avg",
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
    await addColumn("orders", "rider_rating", "TINYINT NULL");            // student's 1-5 stars for the rider
    await addColumn("orders", "rider_comment", "VARCHAR(255) NULL");
    await addColumn("orders", "rider_rated_at", "DATETIME NULL");
`);
}

/* ---------------- backend/src/routes/orders.js ---------------- */
if (todo.includes("orders")) {
  // rider's name on the student's orders
  rep("orders", "mine",
`  res.json(await attachQueue(await attachFeedback(await attachItems(orders))));
}));`,
`  const mine = await attachQueue(await attachFeedback(await attachItems(orders)));
  // Feature: rate your rider — show the rider's name on each order
  const riderIds = [...new Set(mine.map((o) => o.rider_id).filter(Boolean))];
  if (riderIds.length) {
    const [riders] = await pool.query(\`SELECT id, name FROM users WHERE id IN (\${riderIds.map(() => "?").join(",")})\`, riderIds);
    const names = Object.fromEntries(riders.map((r) => [r.id, r.name]));
    for (const o of mine) o.rider_name = o.rider_id ? names[o.rider_id] || null : null;
  }
  res.json(mine);
}));`);

  // the rating endpoint
  rep("orders", "route",
`router.post("/:id/feedback", verifyToken,`,
`// POST /api/orders/:id/rate-rider  (student/teacher) — one rating per delivered order
router.post("/:id/rate-rider", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const rating = Number(req.body && req.body.rating);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid order" });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be from 1 to 5" });
  const comment = typeof req.body.comment === "string" ? (req.body.comment.trim().slice(0, 200) || null) : null;

  const [[order]] = await pool.query("SELECT id, user_id, rider_id, picked_up_at, rider_rating FROM orders WHERE id = ?", [id]);
  if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: "Order not found" });
  if (!order.rider_id) return res.status(400).json({ error: "This order did not have a rider" });
  if (!order.picked_up_at) return res.status(409).json({ error: "You can rate the rider after the order is delivered" });
  if (order.rider_rating) return res.status(409).json({ error: "You already rated this rider" });

  const [result] = await pool.query(
    "UPDATE orders SET rider_rating = ?, rider_comment = ?, rider_rated_at = NOW() WHERE id = ? AND rider_rating IS NULL",
    [rating, comment, id]);
  if (!result.affectedRows) return res.status(409).json({ error: "You already rated this rider" });
  res.json({ ok: true, rating, comment });
}));

router.post("/:id/feedback", verifyToken,`);
}

/* ---------------- backend/src/routes/riders.js: rider's average + latest comments ---------------- */
if (todo.includes("riders")) {
  const withTips = docs.riders.s.includes("tips_total");
  const oldLine = withTips
    ? `  res.json({ ...summary, tips_total: Number(tips.total), tips_today: Number(tips.today), orders: recent });`
    : `  res.json({ ...summary, orders: recent });`;
  const newLine = withTips
    ? `  res.json({ ...summary, tips_total: Number(tips.total), tips_today: Number(tips.today), rating_avg: Number(rt.avg), rating_count: Number(rt.cnt), reviews, orders: recent });`
    : `  res.json({ ...summary, rating_avg: Number(rt.avg), rating_count: Number(rt.cnt), reviews, orders: recent });`;
  rep("riders", "summary",
oldLine,
`  // Feature: rate your rider — average stars and the latest comments (the student's name is not shown)
  const [[rt]] = await pool.query("SELECT COALESCE(AVG(rider_rating), 0) AS avg, COUNT(rider_rating) AS cnt FROM orders WHERE rider_id = ? AND rider_rating IS NOT NULL", [riderId]);
  const [reviews] = await pool.query(
    "SELECT rider_rating AS rating, rider_comment AS comment, rider_rated_at AS at FROM orders WHERE rider_id = ? AND rider_rating IS NOT NULL ORDER BY rider_rated_at DESC LIMIT 5", [riderId]);
${newLine}`);
}

/* ---------------- frontend/campusdine.html ---------------- */
if (todo.includes("html")) {
  rep("html", "en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "rr.title": "Rate your rider",
    "rr.ph": "How was the delivery? (optional)",
    "rr.send": "Submit rating",
    "rr.done": "You rated your rider",
`);
  rep("html", "bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "rr.title": "আপনার রাইডারকে রেটিং দিন",
    "rr.ph": "ডেলিভারি কেমন ছিল? (ঐচ্ছিক)",
    "rr.send": "রেটিং দিন",
    "rr.done": "আপনি রাইডারকে রেটিং দিয়েছেন",
`);

  // the rating box (new component)
  rep("html", "component",
`function StarPicker({ value, onChange, size = "w-6 h-6", readOnly = false }) {`,
`/* Feature: rate your rider */
function RiderRating({ order, apiBase, token }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(order.rider_rating ? { rating: Number(order.rider_rating), comment: order.rider_comment } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    if (rating < 1) return;
    setBusy(true); setError("");
    try {
      await api(apiBase, "/api/orders/" + order.id + "/rate-rider", { method: "POST", token, body: { rating, comment } });
      setSaved({ rating, comment: comment.trim() });
    } catch (e) { setError(e.message || "Could not save your rating"); }
    finally { setBusy(false); }
  };
  if (saved) {
    return (
      <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <StarPicker value={saved.rating} readOnly size="w-4 h-4" />
          <span className="text-xs" style={{ color: "var(--ink-soft)" }}>✓ {tx("rr.done")}{order.rider_name ? " (" + order.rider_name + ")" : ""}</span>
        </div>
        {saved.comment && <p className="text-xs italic mt-1.5" style={{ color: "var(--ink-soft)" }}>"{saved.comment}"</p>}
      </div>
    );
  }
  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
      <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-soft)" }}>🛵 {tx("rr.title")}{order.rider_name ? " — " + order.rider_name : ""}</div>
      <StarPicker value={rating} onChange={setRating} />
      <input type="text" value={comment} onChange={e => setComment(e.target.value.slice(0, 200))} placeholder={tx("rr.ph")}
        className="w-full mt-2 px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }} />
      {error && <p className="text-xs mt-1.5" style={{ color: "var(--brick)" }}>{error}</p>}
      <button type="button" disabled={busy || rating < 1} onClick={send} className="btn-primary text-xs px-3 py-1.5 rounded-lg mt-2">{tx("rr.send")}</button>
    </div>
  );
}
function StarPicker({ value, onChange, size = "w-6 h-6", readOnly = false }) {`);

  // show it on delivered orders that had a rider
  rep("html", "show in orders",
`                <OrderFeedback order={o} onSubmit={onSubmitFeedback} busy={feedbackBusy} />
              )}
`,
`                <OrderFeedback order={o} onSubmit={onSubmitFeedback} busy={feedbackBusy} />
              )}
              {o.rider_id && o.picked_up_at && o.status !== "Cancelled" && (
                <RiderRating order={o} apiBase={apiBase} token={token} />
              )}
`);

  // rider dashboard card
  rep("html", "rider card",
`<div className="card p-5"><div className="flex flex-wrap items-center justify-between gap-3 mb-3"><div className="text-lg font-display font-800">Assigned Deliveries</div>`,
`{summary.rating_count > 0 && <div className="card p-5"><div className="flex flex-wrap items-center gap-3"><div className="text-lg font-display font-800">Your rating</div><div className="text-2xl font-display font-800">⭐ {Number(summary.rating_avg).toFixed(1)}</div><div className="text-sm" style={{color:"var(--ink-soft)"}}>({summary.rating_count} {summary.rating_count === 1 ? "rating" : "ratings"})</div></div>{(summary.reviews || []).filter(r => r.comment).map((r, i) => <div key={i} className="text-sm mt-2" style={{color:"var(--ink-soft)"}}>{"⭐".repeat(r.rating)} “{r.comment}”</div>)}</div>}
    <div className="card p-5"><div className="flex flex-wrap items-center justify-between gap-3 mb-3"><div className="text-lg font-display font-800">Assigned Deliveries</div>`);
}

for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak15");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: rate-your-rider added (student rating box, rider dashboard rating).");
console.log("Restart the backend now: Ctrl+C, then npm start. Then refresh the browser with Ctrl+Shift+R.");
