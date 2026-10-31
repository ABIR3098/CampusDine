// problem-report.js — Feature: report a problem with an order.
//  • Student: on an order that is Ready / handed over, "⚠️ Report a problem" -> pick a reason (cold food, wrong item,
//    missing item, very late, poor quality, other) + optional details. One report per order.
//  • Admin: Feedback tab -> "Reported problems" list: reply to the student and/or mark it Resolved.
//  • The student is notified when the admin replies, and sees the reply on the order.
// Run from the project main folder:  node problem-report.js   (then restart the backend)
const fs = require("fs");

const FILES = {
  html: "frontend/campusdine.html",
  server: "backend/server.js",
  orders: "backend/src/routes/orders.js",
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
  html: "/* Feature: order problem report */",
  server: "order_issues",
  orders: "// Feature: order problem report",
};
const todo = Object.keys(docs).filter((k) => !docs[k].s.includes(MARK[k]));
if (todo.length === 0) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend/server.js: table ---------------- */
if (todo.includes("server")) {
  rep("server", "table",
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
`,
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
    await db.query(\`CREATE TABLE IF NOT EXISTS order_issues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      user_id INT NOT NULL,
      reason VARCHAR(20) NOT NULL,
      details VARCHAR(300) NULL,
      status ENUM('Open','Resolved') NOT NULL DEFAULT 'Open',
      admin_reply VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME NULL,
      UNIQUE KEY uq_issue_order (order_id)
    )\`);   // problem reports on orders
`);
}

/* ---------------- backend/src/routes/orders.js: the endpoints ---------------- */
if (todo.includes("orders")) {
  rep("orders", "routes",
`module.exports = router;`,
`// Feature: order problem report
const ISSUE_REASONS = { cold: "Cold food", wrong: "Wrong item", missing: "Missing item", late: "Very late", quality: "Poor quality", other: "Other" };

// POST /api/orders/:id/report  (student/teacher) — one report per order, once it is ready or handed over
router.post("/:id/report", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  const reason = req.body && req.body.reason;
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid order" });
  if (!Object.prototype.hasOwnProperty.call(ISSUE_REASONS, reason)) return res.status(400).json({ error: "Please choose what went wrong" });
  const details = typeof req.body.details === "string" ? (req.body.details.trim().slice(0, 300) || null) : null;

  const [[order]] = await pool.query("SELECT id, user_id, token, status, picked_up_at FROM orders WHERE id = ?", [id]);
  if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: "Order not found" });
  if (order.status === "Cancelled") return res.status(400).json({ error: "A cancelled order can't be reported" });
  if (order.status !== "Ready" && !order.picked_up_at) return res.status(409).json({ error: "You can report a problem once your order is ready" });

  try {
    await pool.query("INSERT INTO order_issues (order_id, user_id, reason, details) VALUES (?, ?, ?, ?)", [id, req.user.id, reason, details]);
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "You already reported a problem for this order" });
    throw e;
  }
  const [[issue]] = await pool.query(
    "SELECT id, order_id, reason, details, status, admin_reply, created_at, resolved_at FROM order_issues WHERE order_id = ?", [id]);
  const io = req.app.get("io");
  if (io) io.to("admins").emit("issue:new", { id: issue.id, order_id: id, token: order.token, reason: reason, reason_label: ISSUE_REASONS[reason] });
  res.status(201).json({ issue });
}));

// GET /api/orders/issues/mine  (student/teacher) — my reports, with the admin's reply
router.get("/issues/mine", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, order_id, reason, details, status, admin_reply, created_at, resolved_at FROM order_issues WHERE user_id = ? ORDER BY id DESC", [req.user.id]);
  res.json(rows);
}));

// GET /api/orders/issues  (admin) — all reports, open ones first
router.get("/issues", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const [rows] = await pool.query(
    \`SELECT i.id, i.order_id, i.reason, i.details, i.status, i.admin_reply, i.created_at, i.resolved_at,
            o.token, o.total, u.name AS user_name, u.external_id
     FROM order_issues i
     JOIN orders o ON o.id = i.order_id
     JOIN users u ON u.id = i.user_id
     ORDER BY (i.status = 'Open') DESC, i.id DESC LIMIT 200\`);
  res.json(rows);
}));

// PATCH /api/orders/issues/:id  (admin) — { reply?, resolve? }
router.patch("/issues/:id", verifyToken, requireRole("admin"), catchAsync(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid report" });
  const reply = typeof req.body.reply === "string" ? (req.body.reply.trim().slice(0, 500) || null) : null;
  const resolve = req.body.resolve === true;
  if (!reply && !resolve) return res.status(400).json({ error: "Write a reply or mark it resolved" });

  const [[issue]] = await pool.query("SELECT i.id, i.user_id, i.order_id, o.token FROM order_issues i JOIN orders o ON o.id = i.order_id WHERE i.id = ?", [id]);
  if (!issue) return res.status(404).json({ error: "Report not found" });

  await pool.query(
    "UPDATE order_issues SET admin_reply = COALESCE(?, admin_reply), status = IF(?, 'Resolved', status), resolved_at = IF(?, NOW(), resolved_at) WHERE id = ?",
    [reply, resolve ? 1 : 0, resolve ? 1 : 0, id]);
  const [[updated]] = await pool.query("SELECT id, order_id, status, admin_reply FROM order_issues WHERE id = ?", [id]);
  const io = req.app.get("io");
  if (io) io.to(\`user:\${issue.user_id}\`).emit("issue:update", { order_id: issue.order_id, token: issue.token, status: updated.status, admin_reply: updated.admin_reply });
  res.json({ ok: true, issue: updated });
}));

module.exports = router;`);
}

/* ---------------- frontend/campusdine.html ---------------- */
if (todo.includes("html")) {
  // texts
  rep("html", "en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "iss.report": "Report a problem",
    "iss.title": "What went wrong?",
    "iss.ph": "Tell us more (optional)",
    "iss.send": "Send report",
    "iss.cancel": "Cancel",
    "iss.open": "Reported — waiting for the admin",
    "iss.resolved": "Resolved",
    "iss.reply": "Admin's reply",
    "iss.r.cold": "Food was cold",
    "iss.r.wrong": "Wrong item",
    "iss.r.missing": "Missing item",
    "iss.r.late": "Very late",
    "iss.r.quality": "Poor quality",
    "iss.r.other": "Other",
    "iss.upd.t": "Problem report updated",
    "iss.upd": "Order {o}: the admin replied to your problem report.",
`);
  rep("html", "bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "iss.report": "সমস্যা জানান",
    "iss.title": "কী সমস্যা হয়েছে?",
    "iss.ph": "আরও কিছু লিখুন (ঐচ্ছিক)",
    "iss.send": "রিপোর্ট পাঠান",
    "iss.cancel": "বাতিল",
    "iss.open": "জানানো হয়েছে — অ্যাডমিনের উত্তরের অপেক্ষায়",
    "iss.resolved": "সমাধান হয়েছে",
    "iss.reply": "অ্যাডমিনের উত্তর",
    "iss.r.cold": "খাবার ঠান্ডা ছিল",
    "iss.r.wrong": "ভুল আইটেম",
    "iss.r.missing": "আইটেম বাদ পড়েছে",
    "iss.r.late": "অনেক দেরি হয়েছে",
    "iss.r.quality": "মান ভালো ছিল না",
    "iss.r.other": "অন্যান্য",
    "iss.upd.t": "সমস্যার রিপোর্ট আপডেট হয়েছে",
    "iss.upd": "অর্ডার {o}: আপনার সমস্যার রিপোর্টে অ্যাডমিন উত্তর দিয়েছেন।",
`);

  // student: state + loading + sending (inside TrackOrder, before its early return)
  rep("html", "student state",
`  const [printOrder, setPrintOrder] = useState(null);
`,
`  const [printOrder, setPrintOrder] = useState(null);
  /* Feature: order problem report */
  const [issues, setIssues] = useState({});          // order id -> my report
  const [reporting, setReporting] = useState(null);  // order id whose form is open
  const [rForm, setRForm] = useState({ reason: "", details: "" });
  const [rBusy, setRBusy] = useState(false);
  const [rError, setRError] = useState("");
  useEffect(() => {
    let dead = false;
    api(apiBase, "/api/orders/issues/mine", { token })
      .then(list => { if (!dead) setIssues(Object.fromEntries(list.map(i => [i.order_id, i]))); })
      .catch(() => {});
    return () => { dead = true; };
  }, [orders]);
  const submitIssue = async (orderId) => {
    if (!rForm.reason) return;
    setRBusy(true); setRError("");
    try {
      const r = await api(apiBase, "/api/orders/" + orderId + "/report", { method: "POST", token, body: { reason: rForm.reason, details: rForm.details } });
      setIssues(prev => ({ ...prev, [orderId]: r.issue }));
      setReporting(null); setRForm({ reason: "", details: "" });
    } catch (e) { setRError(e.message || "Could not send your report"); }
    finally { setRBusy(false); }
  };
`);

  // student: the box on each order
  rep("html", "student box",
`              {o.rider_id && <RiderOrderChat apiBase={apiBase} token={token} orderId={o.id} />}`,
`              {(o.status === "Ready" || o.picked_up_at) && o.status !== "Cancelled" && (
                <div className="mt-3">
                  {issues[o.id] ? (
                    <div className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--line)", background: "var(--panel-soft)" }}>
                      <div className="font-700">{issues[o.id].status === "Resolved" ? "✅ " + tx("iss.resolved") : "⏳ " + tx("iss.open")} — {tx("iss.r." + issues[o.id].reason)}</div>
                      {issues[o.id].details && <div className="mt-1" style={{ color: "var(--ink-soft)" }}>“{issues[o.id].details}”</div>}
                      {issues[o.id].admin_reply && <div className="mt-1.5 font-600">💬 {tx("iss.reply")}: {issues[o.id].admin_reply}</div>}
                    </div>
                  ) : reporting === o.id ? (
                    <div className="rounded-lg border p-3" style={{ borderColor: "var(--line)" }}>
                      <div className="text-xs uppercase tracking-wide mb-2" style={{ color: "var(--ink-soft)" }}>⚠️ {tx("iss.title")}</div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {["cold", "wrong", "missing", "late", "quality", "other"].map(r => (
                          <button key={r} type="button" onClick={() => setRForm(f => ({ ...f, reason: r }))}
                            className={"chip text-xs px-2.5 py-1 rounded-full" + (rForm.reason === r ? " active-chip" : "")}>{tx("iss.r." + r)}</button>
                        ))}
                      </div>
                      <input type="text" value={rForm.details} onChange={e => setRForm(f => ({ ...f, details: e.target.value.slice(0, 300) }))}
                        placeholder={tx("iss.ph")} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }} />
                      {rError && <p className="text-xs mt-1.5" style={{ color: "var(--brick)" }}>{rError}</p>}
                      <div className="flex gap-2 mt-2">
                        <button type="button" disabled={rBusy || !rForm.reason} onClick={() => submitIssue(o.id)} className="btn-primary text-xs px-3 py-1.5 rounded-lg">{tx("iss.send")}</button>
                        <button type="button" onClick={() => { setReporting(null); setRError(""); }} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)" }}>{tx("iss.cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setReporting(o.id); setRError(""); setRForm({ reason: "", details: "" }); }}
                      className="text-xs px-3 py-1.5 rounded-lg border font-600 transition-colors hover:bg-black/5" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
                      ⚠️ {tx("iss.report")}
                    </button>
                  )}
                </div>
              )}
              {o.rider_id && <RiderOrderChat apiBase={apiBase} token={token} orderId={o.id} />}`);

  // admin: the list (new component, shown on top of the Feedback tab)
  rep("html", "admin component",
`function AdminFeedback({ summary }) {`,
`const ISSUE_LABELS = { cold: "Food was cold", wrong: "Wrong item", missing: "Missing item", late: "Very late", quality: "Poor quality", other: "Other" };
function ProblemReports({ apiBase, token, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [replies, setReplies] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const load = () => api(apiBase, "/api/orders/issues", { token }).then(setRows).catch(e => setError(e.message || "Could not load problem reports"));
  useEffect(() => { load(); }, [refreshKey]);
  const act = async (row, resolve) => {
    setBusyId(row.id); setError("");
    try {
      const reply = (replies[row.id] || "").trim();
      await api(apiBase, "/api/orders/issues/" + row.id, { method: "PATCH", token, body: { reply: reply || undefined, resolve } });
      setReplies(r => ({ ...r, [row.id]: "" }));
      await load();
    } catch (e) { setError(e.message || "Could not save"); }
    finally { setBusyId(null); }
  };
  const when = (d) => new Date(d).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const openCount = rows.filter(r => r.status === "Open").length;
  return (
    <div className="card p-5 mb-6">
      <div className="font-display font-700 mb-3" style={{ color: "var(--gold)" }}>⚠️ Reported problems {openCount > 0 && <span className="ml-2 text-xs px-2 py-0.5 rounded-full text-white" style={{ background: "var(--brick)" }}>{openCount} open</span>}</div>
      {error && <p className="text-xs mb-2" style={{ color: "var(--brick)" }}>{error}</p>}
      {rows.length === 0 && <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No problems reported 🎉</p>}
      <div className="space-y-3">
        {rows.map(r => (
          <div key={r.id} className="rounded-lg border p-3" style={{ borderColor: "var(--line)", background: r.status === "Open" ? "var(--panel-soft)" : "transparent" }}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono font-700">{r.token}</span>
              <span style={{ color: "var(--ink-soft)" }}>{r.user_name}{r.external_id ? " (" + r.external_id + ")" : ""}</span>
              <span className="font-600">· {ISSUE_LABELS[r.reason] || r.reason}</span>
              <span className="text-xs ml-auto" style={{ color: "var(--ink-soft)" }}>{when(r.created_at)} · {r.status === "Open" ? "⏳ Open" : "✅ Resolved"}</span>
            </div>
            {r.details && <div className="text-sm mt-1.5" style={{ color: "var(--ink-soft)" }}>“{r.details}”</div>}
            {r.admin_reply && <div className="text-sm mt-1.5 font-600">💬 {r.admin_reply}</div>}
            {r.status === "Open" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input type="text" value={replies[r.id] || ""} onChange={e => setReplies(p => ({ ...p, [r.id]: e.target.value.slice(0, 500) }))}
                  placeholder="Reply to the student (optional)" className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }} />
                <button type="button" disabled={busyId === r.id || !(replies[r.id] || "").trim()} onClick={() => act(r, false)}
                  className="text-xs px-3 py-1.5 rounded-lg border font-600" style={{ borderColor: "var(--line)" }}>Send reply</button>
                <button type="button" disabled={busyId === r.id} onClick={() => act(r, true)} className="btn-primary text-xs px-3 py-1.5 rounded-lg">Resolve</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function AdminFeedback({ summary }) {`);

  rep("html", "admin placement",
`{session.user.role === "admin" && tab === "feedback" && <AdminFeedback summary={feedbackSummary} />}`,
`{session.user.role === "admin" && tab === "feedback" && (
          <>
            <ProblemReports apiBase={apiBase} token={session.token} refreshKey={issueTick} />
            <AdminFeedback summary={feedbackSummary} />
          </>
        )}`);

  // App: counter + live notifications
  rep("html", "app state",
`const placeOrder = async (`,
`const [issueTick, setIssueTick] = useState(0); // bumps when a new problem report arrives (admin list reloads)

  const placeOrder = async (`);
  rep("html", "socket",
`    socket.on("disconnect", () => setConnected(false));
`,
`    socket.on("disconnect", () => setConnected(false));
    socket.on("issue:new", (p) => {
      if (session.user.role !== "admin") return;
      pushNotification("order", "New problem report", \`Order \${p.token}: \${p.reason_label}\`);
      setIssueTick(t => t + 1);
    });
    socket.on("issue:update", (p) => {
      pushNotification("order", tx("iss.upd.t"), tx("iss.upd", { o: p.token || "#" + p.order_id }));
      refreshMyOrders().catch(() => {});
    });
`);
}

for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak22");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: order problem reports added (student report box, admin list + reply, live notifications).");
console.log("Restart the backend now: Ctrl+C, then cd backend, npm start. Then refresh the browser with Ctrl+Shift+R.");
