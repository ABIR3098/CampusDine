// admin-rider-ratings.js — Feature: admin sees how each rider is rated.
//  • Admin → Feedback tab → "🛵 Rider ratings": one row per rider with average stars, number of ratings,
//    deliveries completed, and a "Low" flag when a rider averages under 3.5 stars (3+ ratings).
//  • Choose the period: All time / Last 30 days / Last 7 days.
//  • Click a rider to read their latest reviews (stars, comment, order token, student name, date).
// Needs the "rate your rider" feature (rate-rider.js) — it uses the ratings students give.
// Run from the project main folder:  node admin-rider-ratings.js   (then restart the backend)
const fs = require("fs");

const FILES = { html: "frontend/campusdine.html", riders: "backend/src/routes/riders.js", server: "backend/server.js" };
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) { console.error(`Run this from the project's main folder (${f} not found).`); process.exit(1); }
}
const load = (file) => {
  const raw = fs.readFileSync(file, "utf8");
  return { file, crlf: raw.includes("\r\n"), s: raw.replace(/\r\n/g, "\n") };
};
const docs = {};
for (const [k, f] of Object.entries(FILES)) docs[k] = load(f);

if (!docs.server.s.includes("rider_rating")) {
  console.error('This needs the "rate your rider" feature first. Run:  node rate-rider.js   (or  node apply-all.js ), then run this again.');
  process.exit(1);
}

const MARK = { html: "/* Feature: admin rider ratings */", riders: "// Feature: admin rider ratings" };
const todo = ["html", "riders"].filter((k) => !docs[k].s.includes(MARK[k]));
if (todo.length === 0) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend/src/routes/riders.js ---------------- */
if (todo.includes("riders")) {
  rep("riders", "routes",
`module.exports = router;`,
`// Feature: admin rider ratings
const RATING_DAYS = [0, 7, 30]; // 0 = all time
const ratingDays = (v) => (RATING_DAYS.includes(Number(v)) ? Number(v) : 0);

// GET /api/riders/ratings?days=0|7|30  (admin) — one row per rider
router.get("/ratings", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const days = ratingDays(req.query.days);
  const [rows] = await pool.query(
    \`SELECT u.id, u.name, u.external_id,
            COUNT(o.rider_rating) AS rating_count,
            AVG(o.rider_rating) AS rating_avg,
            COALESCE(SUM(o.rider_rating = 5), 0) AS five_star,
            COALESCE(SUM(o.rider_rating <= 2), 0) AS low_star,
            (SELECT COUNT(*) FROM orders d WHERE d.rider_id = u.id AND d.picked_up_at IS NOT NULL) AS delivered
     FROM users u
     LEFT JOIN orders o ON o.rider_id = u.id AND o.rider_rating IS NOT NULL\${days ? " AND o.rider_rated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)" : ""}
     WHERE u.role = 'rider'
     GROUP BY u.id, u.name, u.external_id
     ORDER BY (COUNT(o.rider_rating) = 0), AVG(o.rider_rating) DESC, COUNT(o.rider_rating) DESC, u.name\`,
    days ? [days] : []);
  res.json({
    days,
    riders: rows.map((r) => ({
      id: r.id, name: r.name, external_id: r.external_id,
      rating_count: Number(r.rating_count),
      rating_avg: r.rating_avg === null ? null : Math.round(Number(r.rating_avg) * 10) / 10,
      five_star: Number(r.five_star), low_star: Number(r.low_star),
      delivered: Number(r.delivered),
    })),
  });
}));

// GET /api/riders/ratings/:id?days=...  (admin) — that rider's latest reviews
router.get("/ratings/:id", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid rider" });
  const days = ratingDays(req.query.days);
  const [rows] = await pool.query(
    \`SELECT o.rider_rating AS rating, o.rider_comment AS comment, o.rider_rated_at AS at, o.token, u.name AS student
     FROM orders o JOIN users u ON u.id = o.user_id
     WHERE o.rider_id = ? AND o.rider_rating IS NOT NULL\${days ? " AND o.rider_rated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)" : ""}
     ORDER BY o.rider_rated_at DESC LIMIT 20\`,
    days ? [id, days] : [id]);
  res.json(rows);
}));

module.exports = router;`);
}

/* ---------------- frontend/campusdine.html ---------------- */
if (todo.includes("html")) {
  rep("html", "component",
`function AdminFeedback({ summary }) {`,
`/* Feature: admin rider ratings */
function RiderRatingsTable({ call }) {
  const [days, setDays] = useState(0);
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);   // the rider whose reviews are showing
  const [reviews, setReviews] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    setRows(null); setOpen(null); setError("");
    call("/api/riders/ratings?days=" + days).then(d => setRows(d.riders)).catch(e => setError(e.message || "Could not load rider ratings"));
  }, [days]);
  const toggle = async (r) => {
    if (open === r.id) { setOpen(null); return; }
    setOpen(r.id); setReviews([]);
    try { setReviews(await call("/api/riders/ratings/" + r.id + "?days=" + days)); }
    catch (e) { setError(e.message || "Could not load the reviews"); }
  };
  const stars = (n) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
  const when = (d) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short" });
  return (
    <div className="card p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="font-display font-700" style={{ color: "var(--gold)" }}>🛵 Rider ratings</div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="px-2 py-1 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }}>
          <option value={0}>All time</option>
          <option value={30}>Last 30 days</option>
          <option value={7}>Last 7 days</option>
        </select>
      </div>
      {error && <p className="text-xs mb-2" style={{ color: "var(--brick)" }}>{error}</p>}
      {rows === null && !error && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Loading…</p>}
      {rows && rows.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No rider accounts yet.</p>}
      <div className="space-y-2">
        {(rows || []).map(r => {
          const low = r.rating_count >= 3 && r.rating_avg !== null && r.rating_avg < 3.5;
          return (
            <div key={r.id} className="rounded-lg border" style={{ borderColor: low ? "var(--brick)" : "var(--line)" }}>
              <button type="button" onClick={() => toggle(r)} className="w-full text-left p-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="flex-1 min-w-[150px]">
                  <div className="text-sm font-700">{r.name} <span className="text-xs font-400" style={{ color: "var(--ink-soft)" }}>({r.external_id})</span></div>
                  <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{r.delivered} deliveries completed</div>
                </div>
                {r.rating_count > 0 ? (
                  <div className="text-sm">
                    <span style={{ color: "#F59E0B" }}>{stars(r.rating_avg)}</span>{" "}
                    <strong>{r.rating_avg.toFixed(1)}</strong>{" "}
                    <span className="text-xs" style={{ color: "var(--ink-soft)" }}>({r.rating_count} {r.rating_count === 1 ? "rating" : "ratings"} · {r.five_star}×5★ · {r.low_star}×1-2★)</span>
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: "var(--ink-soft)" }}>No ratings yet</div>
                )}
                {low && <span className="text-xs font-700 px-2 py-0.5 rounded-full text-white" style={{ background: "var(--brick)" }}>⚠️ Low</span>}
                <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{open === r.id ? "▲" : "▼"}</span>
              </button>
              {open === r.id && (
                <div className="px-3 pb-3 space-y-2">
                  {reviews.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--ink-soft)" }}>No reviews in this period.</p>
                  ) : reviews.map((v, i) => (
                    <div key={i} className="text-sm border-t pt-2" style={{ borderColor: "var(--line)" }}>
                      <span style={{ color: "#F59E0B" }}>{stars(v.rating)}</span>{" "}
                      <span className="text-xs" style={{ color: "var(--ink-soft)" }}>{v.token} · {v.student} · {when(v.at)}</span>
                      {v.comment && <div className="mt-0.5" style={{ color: "var(--ink-soft)" }}>“{v.comment}”</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function AdminFeedback({ summary }) {`);

  // show it at the top of the admin Feedback tab (works with or without the problem-reports feature)
  const single = `{session.user.role === "admin" && tab === "feedback" && <AdminFeedback summary={feedbackSummary} />}`;
  if (docs.html.s.includes(single)) {
    rep("html", "placement (plain)", single,
`{session.user.role === "admin" && tab === "feedback" && (
          <>
            <RiderRatingsTable call={call} />
            <AdminFeedback summary={feedbackSummary} />
          </>
        )}`);
  } else {
    rep("html", "placement (with problem reports)",
`            <AdminFeedback summary={feedbackSummary} />`,
`            <RiderRatingsTable call={call} />
            <AdminFeedback summary={feedbackSummary} />`);
  }
}

for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak27");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: admin rider ratings added (Admin → Feedback tab).");
console.log("Restart the backend now: Ctrl+C, then cd backend, npm start. Then refresh the browser with Ctrl+Shift+R.");
