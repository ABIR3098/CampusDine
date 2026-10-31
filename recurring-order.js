// recurring-order.js — Feature: weekly (recurring) orders.
//  • On any order in the Orders tab: "🔁 Repeat weekly" -> pick the days + a reminder time.
//  • At that time the Menu tab shows "⏰ Time for your weekly order — [Add to cart] [Skip today]" (and a notification).
//  • Nothing is ordered or charged automatically — the student still checks out themselves.
//  • "My weekly orders" (top of the Orders tab) lists the plans: pause / resume / delete. Up to 5 plans.
// Run from the project main folder:  node recurring-order.js   (then restart the backend)
const fs = require("fs");

const FILES = {
  html: "frontend/campusdine.html",
  server: "backend/server.js",
};
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) { console.error(`Run this from the project's main folder (${f} not found).`); process.exit(1); }
}
const ROUTE_FILE = "backend/src/routes/recurring.js";
const load = (file) => {
  const raw = fs.readFileSync(file, "utf8");
  return { file, crlf: raw.includes("\r\n"), s: raw.replace(/\r\n/g, "\n") };
};
const docs = {};
for (const [k, f] of Object.entries(FILES)) docs[k] = load(f);

const MARK = { html: "/* Feature: recurring order */", server: "recurring_orders" };
const todo = Object.keys(docs).filter((k) => !docs[k].s.includes(MARK[k]));
const needRoute = !fs.existsSync(ROUTE_FILE);
if (todo.length === 0 && !needRoute) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend/server.js: table + route ---------------- */
if (todo.includes("server")) {
  rep("server", "table",
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
`,
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
    await db.query(\`CREATE TABLE IF NOT EXISTS recurring_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      items TEXT NOT NULL,
      days VARCHAR(20) NOT NULL,
      at_time CHAR(5) NOT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      last_done VARCHAR(10) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_recurring_user (user_id)
    )\`);   // weekly order reminders
`);
  rep("server", "require",
`const calendarRoutes = require("./src/routes/calendar");
`,
`const calendarRoutes = require("./src/routes/calendar");
const recurringRoutes = require("./src/routes/recurring");
`);
  rep("server", "mount",
`app.use("/api/calendar", calendarRoutes);
`,
`app.use("/api/calendar", calendarRoutes);
app.use("/api/recurring", recurringRoutes);
`);
}

/* ---------------- frontend/campusdine.html ---------------- */
if (todo.includes("html")) {
  rep("html", "en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "rec.repeat": "Repeat weekly",
    "rec.title": "My weekly orders",
    "rec.days": "Which days?",
    "rec.time": "Remind me at",
    "rec.hint": "You'll get a reminder with an Add-to-cart button. Nothing is ordered or charged automatically.",
    "rec.save": "Save",
    "rec.cancel": "Cancel",
    "rec.pause": "Pause",
    "rec.resume": "Resume",
    "rec.delete": "Delete",
    "rec.paused": "Paused",
    "rec.due": "Time for your weekly order",
    "rec.add": "Add to cart",
    "rec.skip": "Skip today",
    "rec.nt": "Weekly order reminder",
    "rec.nm": "Your weekly order is due — add it to your cart from the Menu tab.",
`);
  rep("html", "bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "rec.repeat": "প্রতি সপ্তাহে",
    "rec.title": "আমার সাপ্তাহিক অর্ডার",
    "rec.days": "কোন কোন দিন?",
    "rec.time": "রিমাইন্ডার সময়",
    "rec.hint": "অ্যাড-টু-কার্ট বোতামসহ একটি রিমাইন্ডার পাবেন। নিজে থেকে কিছু অর্ডার বা চার্জ হবে না।",
    "rec.save": "সংরক্ষণ",
    "rec.cancel": "বাতিল",
    "rec.pause": "বিরতি",
    "rec.resume": "চালু করুন",
    "rec.delete": "মুছুন",
    "rec.paused": "বিরতিতে",
    "rec.due": "আপনার সাপ্তাহিক অর্ডারের সময় হয়েছে",
    "rec.add": "কার্টে যোগ করুন",
    "rec.skip": "আজ বাদ",
    "rec.nt": "সাপ্তাহিক অর্ডার রিমাইন্ডার",
    "rec.nm": "আপনার সাপ্তাহিক অর্ডারের সময় হয়েছে — মেনু ট্যাব থেকে কার্টে যোগ করুন।",
`);

  // components (before TrackOrder)
  rep("html", "components",
`function TrackOrder(`,
`/* Feature: recurring order */
const REC_DAYS = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  bn: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"],
};
const recDay = (d) => REC_DAYS[CURRENT_LANG === "bn" ? "bn" : "en"][d];

// the form that opens from an order's "Repeat weekly" button
function RecurringForm({ order, apiBase, token, onClose, onSaved }) {
  const [days, setDays] = useState([new Date().getDay()]);
  const [time, setTime] = useState("12:30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toggle = (d) => setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const save = async () => {
    setBusy(true); setError("");
    try {
      await api(apiBase, "/api/recurring", { method: "POST", token, body: {
        items: order.items.map(it => ({ id: it.menu_item_id, name: it.name, qty: it.qty })), days, time } });
      onSaved();
    } catch (e) { setError(e.message || "Could not save"); }
    finally { setBusy(false); }
  };
  return (
    <div className="card p-5">
      <div className="font-display font-700 mb-1" style={{ color: "var(--gold)" }}>🔁 {tx("rec.repeat")} — {order.token}</div>
      <div className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>{order.items.map(i => dispName(i.name) + (i.qty > 1 ? " ×" + num(i.qty) : "")).join(" + ")}</div>
      <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-soft)" }}>{tx("rec.days")}</div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[0, 1, 2, 3, 4, 5, 6].map(d => (
          <button key={d} type="button" onClick={() => toggle(d)} className={"chip text-xs px-3 py-1.5 rounded-full" + (days.includes(d) ? " active-chip" : "")}>{recDay(d)}</button>
        ))}
      </div>
      <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--ink-soft)" }}>{tx("rec.time")}</div>
      <input type="time" value={time} onChange={e => setTime(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }} />
      <p className="text-xs mt-2" style={{ color: "var(--ink-soft)" }}>{tx("rec.hint")}</p>
      {error && <p className="text-xs mt-1.5" style={{ color: "var(--brick)" }}>{error}</p>}
      <div className="flex gap-2 mt-3">
        <button type="button" disabled={busy || days.length === 0 || !time} onClick={save} className="btn-primary text-xs px-3 py-1.5 rounded-lg">{tx("rec.save")}</button>
        <button type="button" onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)" }}>{tx("rec.cancel")}</button>
      </div>
    </div>
  );
}

// "My weekly orders" list
function RecurringPlans({ apiBase, token, reloadKey }) {
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState("");
  const load = () => api(apiBase, "/api/recurring", { token }).then(setPlans).catch(() => {});
  useEffect(() => { load(); }, [reloadKey]);
  const toggleActive = async (p) => {
    try { await api(apiBase, "/api/recurring/" + p.id, { method: "PATCH", token, body: { active: !p.active } }); await load(); }
    catch (e) { setError(e.message || "Could not update"); }
  };
  const remove = async (p) => {
    try { await api(apiBase, "/api/recurring/" + p.id, { method: "DELETE", token }); await load(); }
    catch (e) { setError(e.message || "Could not delete"); }
  };
  if (plans.length === 0) return null;
  return (
    <div className="card p-5">
      <div className="font-display font-700 mb-3" style={{ color: "var(--gold)" }}>🔁 {tx("rec.title")}</div>
      {error && <p className="text-xs mb-2" style={{ color: "var(--brick)" }}>{error}</p>}
      <div className="space-y-2.5">
        {plans.map(p => (
          <div key={p.id} className="rounded-lg border p-3 flex flex-wrap items-center gap-2" style={{ borderColor: "var(--line)", opacity: p.active ? 1 : 0.6 }}>
            <div className="flex-1 min-w-[180px]">
              <div className="text-sm font-600">{p.items.map(i => dispName(i.name) + (i.qty > 1 ? " ×" + num(i.qty) : "")).join(" + ")}</div>
              <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{p.days.map(recDay).join(", ")} · {p.time}{!p.active && " · " + tx("rec.paused")}</div>
            </div>
            <button type="button" onClick={() => toggleActive(p)} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: "var(--line)" }}>{p.active ? tx("rec.pause") : tx("rec.resume")}</button>
            <button type="button" onClick={() => remove(p)} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--brick)" }}>{tx("rec.delete")}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
function TrackOrder(`);

  // TrackOrder: state, the form and the list at the top, the button on each order
  rep("html", "track state",
`  const [printOrder, setPrintOrder] = useState(null);
`,
`  const [printOrder, setPrintOrder] = useState(null);
  const [planDraft, setPlanDraft] = useState(null); // the order a weekly plan is being made from
  const [plansKey, setPlansKey] = useState(0);
`);
  rep("html", "track top",
`    <div className="space-y-6 max-w-2xl">
      {printOrder && (`,
`    <div className="space-y-6 max-w-2xl">
      {planDraft && <RecurringForm order={planDraft} apiBase={apiBase} token={token} onClose={() => setPlanDraft(null)} onSaved={() => { setPlanDraft(null); setPlansKey(k => k + 1); }} />}
      <RecurringPlans apiBase={apiBase} token={token} reloadKey={plansKey} />
      {printOrder && (`);
  rep("html", "track button",
`                {o.status === "Received" && (`,
`                {o.status !== "Cancelled" && (
                  <button type="button" onClick={() => { setPlanDraft(o); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className="text-xs px-3 py-1.5 rounded-lg border font-600 flex items-center gap-1.5 transition-colors hover:bg-black/5"
                    style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>🔁 {tx("rec.repeat")}</button>
                )}
                {o.status === "Received" && (`);

  // Menu tab: the reminder banner
  rep("html", "menu props",
`function MenuOrder({`,
`function MenuOrder({ recurringDue = [], onDueAdd, onDueSkip,`);
  rep("html", "menu banner",
`        <PromoSlider slides={slides} />`,
`        {recurringDue.map(p => (
          <div key={"due-" + p.id} className="mb-4 rounded-2xl border p-4 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--gold)", background: "var(--panel-soft)" }}>
            <div className="flex-1 min-w-[200px]">
              <div className="font-display font-700" style={{ color: "var(--gold)" }}>⏰ {tx("rec.due")}</div>
              <div className="text-sm">{p.items.map(i => dispName(i.name) + (i.qty > 1 ? " ×" + num(i.qty) : "")).join(" + ")}</div>
            </div>
            <button type="button" onClick={() => onDueAdd(p)} className="btn-primary text-xs px-3 py-1.5 rounded-lg">{tx("rec.add")}</button>
            <button type="button" onClick={() => onDueSkip(p)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)" }}>{tx("rec.skip")}</button>
          </div>
        ))}
        <PromoSlider slides={slides} />`);
  rep("html", "menu pass",
`sessionToken={session.token} loyaltyKey={loyaltyKey}`,
`sessionToken={session.token} loyaltyKey={loyaltyKey} recurringDue={recurringDue} onDueAdd={addDue} onDueSkip={skipDue}`);

  // App: check every minute which weekly orders are due
  rep("html", "app logic",
`const placeOrder = async (`,
`/* Feature: recurring order */
  const [recurringDue, setRecurringDue] = useState([]);
  const notifiedDueRef = useRef(new Set());
  const refreshDue = async () => {
    const list = await call("/api/recurring/due");
    setRecurringDue(list);
    for (const p of list) {
      const key = p.id + ":" + p.today;
      if (!notifiedDueRef.current.has(key)) { notifiedDueRef.current.add(key); pushNotification("order", tx("rec.nt"), tx("rec.nm")); }
    }
  };
  useEffect(() => {
    if (!session || (session.user.role !== "student" && session.user.role !== "teacher")) return;
    refreshDue().catch(() => {});
    const timer = setInterval(() => refreshDue().catch(() => {}), 60000);
    return () => clearInterval(timer);
  }, [session && session.token]);
  const markDueDone = async (plan) => {
    await call("/api/recurring/" + plan.id + "/done", { method: "POST" });
    await refreshDue();
  };
  const addDue = async (plan) => {
    const anyAvailable = plan.items.some(i => { const m = menu.find(x => x.id === i.id); return m && m.stock > 0 && m.availability === "available"; });
    reorder({ items: plan.items.map(i => ({ menuItemId: i.id, name: i.name, qty: i.qty })) });
    if (anyAvailable) { try { await markDueDone(plan); } catch (e) { /* the cart is already filled */ } }
  };
  const skipDue = async (plan) => { try { await markDueDone(plan); } catch (e) { showError(e); } };

  const placeOrder = async (`);
}

/* ---------------- save ---------------- */
if (needRoute) {
  fs.writeFileSync(ROUTE_FILE,
`// Weekly (recurring) order reminders — nothing is ordered or charged automatically.
const express = require("express");
const pool = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const catchAsync = require("../utils/catchAsync");

const router = express.Router();
router.use(verifyToken, requireRole("student", "teacher"));

const MAX_PLANS = 5;          // per person
const DUE_WINDOW_MIN = 240;   // a reminder stays on screen for 4 hours after its time

const pad = (n) => String(n).padStart(2, "0");
const todayStr = (d = new Date()) => \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}\`;
const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const shape = (row) => ({
  id: row.id,
  items: JSON.parse(row.items),
  days: String(row.days).split(",").filter((x) => x !== "").map(Number),
  time: row.at_time,
  active: !!row.active,
});

// GET /api/recurring — my plans
router.get("/", catchAsync(async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM recurring_orders WHERE user_id = ? ORDER BY id", [req.user.id]);
  res.json(rows.map(shape));
}));

// GET /api/recurring/due — plans whose reminder time has come today (and that weren't added/skipped yet)
router.get("/due", catchAsync(async (req, res) => {
  const now = new Date();
  const today = todayStr(now);
  const dow = now.getDay();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [rows] = await pool.query(
    "SELECT * FROM recurring_orders WHERE user_id = ? AND active = 1 AND (last_done IS NULL OR last_done <> ?)", [req.user.id, today]);
  const due = rows.map(shape)
    .filter((p) => p.days.includes(dow) && nowMin - minutesOf(p.time) >= 0 && nowMin - minutesOf(p.time) <= DUE_WINDOW_MIN)
    .map((p) => ({ ...p, today }));
  res.json(due);
}));

// POST /api/recurring — { items: [{ id?, name?, qty }], days: [0-6], time: "HH:MM" }
router.post("/", catchAsync(async (req, res) => {
  const rawItems = Array.isArray(req.body.items) ? req.body.items.slice(0, 8) : [];
  const days = [...new Set((Array.isArray(req.body.days) ? req.body.days : []).map(Number))]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  const time = String(req.body.time || "");
  if (days.length === 0) return res.status(400).json({ error: "Choose at least one day" });
  if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(time)) return res.status(400).json({ error: "Choose a reminder time" });

  const merged = new Map();
  for (const it of rawItems) {
    const qty = Math.min(5, Math.max(1, parseInt(it && it.qty, 10) || 1));
    let found = null;
    if (it && Number.isInteger(Number(it.id)) && it.id !== null && it.id !== undefined && it.id !== "") {
      [[found]] = await pool.query("SELECT id, name FROM menu_items WHERE id = ? AND availability <> 'hidden'", [Number(it.id)]);
    }
    if (!found && it && typeof it.name === "string" && it.name) {
      [[found]] = await pool.query("SELECT id, name FROM menu_items WHERE name = ? AND availability <> 'hidden' LIMIT 1", [it.name]);
    }
    if (found) merged.set(found.id, { id: found.id, name: found.name, qty: Math.min(5, (merged.get(found.id)?.qty || 0) + qty) });
  }
  if (merged.size === 0) return res.status(400).json({ error: "These items are not on the menu any more" });

  const [[count]] = await pool.query("SELECT COUNT(*) AS n FROM recurring_orders WHERE user_id = ?", [req.user.id]);
  if (Number(count.n) >= MAX_PLANS) return res.status(409).json({ error: \`You can keep up to \${MAX_PLANS} weekly orders — delete one first\` });

  const [result] = await pool.query(
    "INSERT INTO recurring_orders (user_id, items, days, at_time) VALUES (?, ?, ?, ?)",
    [req.user.id, JSON.stringify([...merged.values()]), days.join(","), time]);
  const [[row]] = await pool.query("SELECT * FROM recurring_orders WHERE id = ?", [result.insertId]);
  res.status(201).json(shape(row));
}));

// PATCH /api/recurring/:id — { active: true|false } pause / resume
router.patch("/:id", catchAsync(async (req, res) => {
  const [result] = await pool.query("UPDATE recurring_orders SET active = ? WHERE id = ? AND user_id = ?",
    [req.body.active === false ? 0 : 1, Number(req.params.id), req.user.id]);
  if (!result.affectedRows) {
    const [[exists]] = await pool.query("SELECT id FROM recurring_orders WHERE id = ? AND user_id = ?", [Number(req.params.id), req.user.id]);
    if (!exists) return res.status(404).json({ error: "Weekly order not found" });
  }
  res.json({ ok: true });
}));

// DELETE /api/recurring/:id
router.delete("/:id", catchAsync(async (req, res) => {
  const [result] = await pool.query("DELETE FROM recurring_orders WHERE id = ? AND user_id = ?", [Number(req.params.id), req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Weekly order not found" });
  res.json({ ok: true });
}));

// POST /api/recurring/:id/done — added to the cart or skipped: hide today's reminder
router.post("/:id/done", catchAsync(async (req, res) => {
  const [result] = await pool.query("UPDATE recurring_orders SET last_done = ? WHERE id = ? AND user_id = ?",
    [todayStr(), Number(req.params.id), req.user.id]);
  if (!result.affectedRows) return res.status(404).json({ error: "Weekly order not found" });
  res.json({ ok: true });
}));

module.exports = router;
`);
}
for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak24");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: weekly (recurring) orders added (Repeat weekly button, My weekly orders list, reminder on the Menu tab).");
console.log("Restart the backend now: Ctrl+C, then cd backend, npm start. Then refresh the browser with Ctrl+Shift+R.");
