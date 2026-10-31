// monthly-budget.js — Feature: monthly budget limit.
//  • Spending tab: "🎯 Monthly budget" card — set a limit, see a progress bar (green → amber at 80% → red when over).
//  • Cart: a gentle warning when the order would take you to 80%+ of the budget or over it (never blocks the order).
//  • A notification the first time you pass 80% and again when you pass 100% (once per month).
//  • "Spent" is the same number the Spending tab shows (cancelled orders are not counted).
// Run from the project main folder:  node monthly-budget.js   (then restart the backend)
const fs = require("fs");

const FILES = {
  html: "frontend/campusdine.html",
  server: "backend/server.js",
  summary: "backend/src/routes/summary.js",
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

const MARK = { html: "/* Feature: monthly budget */", server: "monthly_budget", summary: "// Feature: monthly budget" };
const todo = Object.keys(docs).filter((k) => !docs[k].s.includes(MARK[k]));
if (todo.length === 0) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend/server.js: column ---------------- */
if (todo.includes("server")) {
  rep("server", "column",
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
`,
`    await addColumn("orders", "picked_up_at", "DATETIME NULL");
    await addColumn("users", "monthly_budget", "DECIMAL(10,2) NULL");   // the user's own monthly spending limit
`);
}

/* ---------------- backend/src/routes/summary.js: endpoints ---------------- */
if (todo.includes("summary")) {
  rep("summary", "routes",
`module.exports = router;`,
`// Feature: monthly budget — the limit the user set and how much of this month they have spent (same rule as the Spending tab)
async function budgetInfo(uid) {
  const now = new Date();
  const start = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, "0")}-01\`;
  const [[u]] = await pool.query("SELECT monthly_budget FROM users WHERE id = ?", [uid]);
  const [[s]] = await pool.query(
    \`SELECT COALESCE(SUM(total), 0) AS spent FROM orders
     WHERE user_id = ? AND status != 'Cancelled' AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 MONTH)\`, [uid, start, start]);
  return { limit: u && u.monthly_budget !== null ? Number(u.monthly_budget) : null, spent: Number(s.spent), month: start.slice(0, 7) };
}

// GET /api/summary/budget
router.get("/budget", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  res.json(await budgetInfo(req.user.id));
}));

// PUT /api/summary/budget  { limit: number | null }  — null removes the limit
router.put("/budget", verifyToken, requireRole("student", "teacher"), catchAsync(async (req, res) => {
  const raw = req.body ? req.body.limit : undefined;
  if (raw === null || raw === "") {
    await pool.query("UPDATE users SET monthly_budget = NULL WHERE id = ?", [req.user.id]);
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 50 || n > 100000) return res.status(400).json({ error: "Budget must be between ৳50 and ৳100,000" });
    await pool.query("UPDATE users SET monthly_budget = ? WHERE id = ?", [Math.round(n), req.user.id]);
  }
  res.json(await budgetInfo(req.user.id));
}));

module.exports = router;`);
}

/* ---------------- frontend/campusdine.html ---------------- */
if (todo.includes("html")) {
  rep("html", "en text",
`    "note.show": "Note",
`,
`    "note.show": "Note",
    "bud.title": "Monthly budget",
    "bud.none": "Set a monthly limit and we'll warn you before you go over it.",
    "bud.left": "{a} left this month",
    "bud.overmsg": "You are {a} over your budget this month",
    "bud.set": "Set budget",
    "bud.change": "Change",
    "bud.remove": "Remove",
    "bud.save": "Save",
    "bud.ph": "e.g. 3000",
    "bud.cart.near": "After this order you will have used {p}% of your {l} monthly budget",
    "bud.cart.over": "This order takes you {o} over your monthly budget of {l}",
    "bud.near.t": "Budget alert",
    "bud.near": "You have used {s} of your {l} monthly budget (80% or more).",
    "bud.over.t": "Budget exceeded",
    "bud.over": "You have gone over your monthly budget: {s} of {l}.",
`);
  rep("html", "bn text",
`    "note.show": "নোট",
`,
`    "note.show": "নোট",
    "bud.title": "মাসিক বাজেট",
    "bud.none": "মাসিক একটি সীমা ঠিক করুন, সীমা পার হওয়ার আগেই আমরা জানিয়ে দেব।",
    "bud.left": "এই মাসে আর {a} বাকি",
    "bud.overmsg": "এই মাসে আপনি বাজেটের চেয়ে {a} বেশি খরচ করেছেন",
    "bud.set": "বাজেট ঠিক করুন",
    "bud.change": "বদলান",
    "bud.remove": "মুছুন",
    "bud.save": "সংরক্ষণ",
    "bud.ph": "যেমন ৩০০০",
    "bud.cart.near": "এই অর্ডারের পর আপনার {l} মাসিক বাজেটের {p}% খরচ হয়ে যাবে",
    "bud.cart.over": "এই অর্ডারে আপনার {l} মাসিক বাজেট {o} ছাড়িয়ে যাবে",
    "bud.near.t": "বাজেট সতর্কতা",
    "bud.near": "আপনি {l} মাসিক বাজেটের {s} খরচ করেছেন (৮০% বা তার বেশি)।",
    "bud.over.t": "বাজেট ছাড়িয়ে গেছে",
    "bud.over": "আপনি মাসিক বাজেট ছাড়িয়ে গেছেন: {l} এর মধ্যে {s}।",
`);

  // the card (Spending tab)
  rep("html", "card component",
`function SpendingTab({ call, user }) {`,
`/* Feature: monthly budget */
function BudgetCard({ budget, onSave }) {
  const [val, setVal] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!budget) return null;
  const limit = budget.limit;
  const raw = limit ? (budget.spent / limit) * 100 : 0;
  const color = raw >= 100 ? "#DC2626" : raw >= 80 ? "#F59E0B" : "var(--leaf)";
  const save = async (v) => {
    setBusy(true); setError("");
    try { await onSave(v); setEditing(false); setVal(""); }
    catch (e) { setError(e.message || "Could not save"); }
    finally { setBusy(false); }
  };
  const showForm = editing || !limit;
  return (
    <div className="card p-5">
      <div className="font-display font-700 mb-3" style={{ color: "var(--gold)" }}>🎯 {tx("bud.title")}</div>
      {limit ? (
        <>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="font-mono font-700 text-lg">{taka(budget.spent)} <span className="text-sm font-400" style={{ color: "var(--ink-soft)" }}>/ {taka(limit)}</span></span>
            <span className="text-sm font-700" style={{ color }}>{num(Math.round(raw))}%</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--line)" }}>
            <div className="h-full rounded-full" style={{ width: Math.min(100, Math.round(raw)) + "%", background: color }} />
          </div>
          <p className="text-xs mt-2 font-600" style={{ color: raw >= 100 ? "#B91C1C" : "var(--ink-soft)" }}>
            {raw >= 100 ? tx("bud.overmsg", { a: taka(budget.spent - limit) }) : tx("bud.left", { a: taka(limit - budget.spent) })}
          </p>
        </>
      ) : (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{tx("bud.none")}</p>
      )}
      {showForm ? (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input type="number" min="50" max="100000" value={val} onChange={e => setVal(e.target.value)} placeholder={tx("bud.ph")}
            className="w-36 px-3 py-1.5 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }} />
          <button type="button" disabled={busy || !val} onClick={() => save(Number(val))} className="btn-primary text-xs px-3 py-1.5 rounded-lg">{tx("bud.save")}</button>
          {limit && <button type="button" onClick={() => { setEditing(false); setError(""); }} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)" }}>×</button>}
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => { setEditing(true); setVal(String(limit)); }} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)" }}>{tx("bud.change")}</button>
          <button type="button" disabled={busy} onClick={() => save(null)} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--line)", color: "var(--brick)" }}>{tx("bud.remove")}</button>
        </div>
      )}
      {error && <p className="text-xs mt-2" style={{ color: "var(--brick)" }}>{error}</p>}
    </div>
  );
}
function SpendingTab({ call, user, budget, onSaveBudget }) {`);
  rep("html", "card placement",
`    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)}`,
`    <div className="space-y-5">
      <BudgetCard budget={budget} onSave={onSaveBudget} />
      <div className="flex items-center gap-2">
        <button onClick={() => shift(-1)}`);
  rep("html", "spending usage",
`<SpendingTab call={call} user={session.user} />`,
`<SpendingTab call={call} user={session.user} budget={budget} onSaveBudget={saveBudget} />`);

  // the cart warning
  rep("html", "menu prop",
`function MenuOrder({`,
`function MenuOrder({ budget,`);
  rep("html", "menu pass",
`sessionToken={session.token} loyaltyKey={loyaltyKey}`,
`sessionToken={session.token} loyaltyKey={loyaltyKey} budget={budget}`);
  rep("html", "cart warning",
`{payMethod === "wallet" && !canPay && (`,
`{budget && budget.limit > 0 && (() => {
                const after = budget.spent + total;
                const pct = Math.round((after / budget.limit) * 100);
                if (pct < 80) return null;
                const over = after > budget.limit;
                return (
                  <div className="mb-3 text-xs rounded-lg px-3 py-2 font-600" style={{ background: over ? "#FEF2F2" : "#FFFBEB", color: over ? "#B91C1C" : "#92400E" }}>
                    ⚠️ {over ? tx("bud.cart.over", { o: taka(after - budget.limit), l: taka(budget.limit) }) : tx("bud.cart.near", { p: num(pct), l: taka(budget.limit) })}
                  </div>
                );
              })()}
              {payMethod === "wallet" && !canPay && (`);

  // App: load, notify, save
  rep("html", "app logic",
`const placeOrder = async (`,
`/* Feature: monthly budget */
  const [budget, setBudget] = useState(null);
  const budgetNotifiedRef = useRef({});
  const refreshBudget = async () => {
    const b = await call("/api/summary/budget");
    setBudget(b);
    if (b.limit) {
      const pct = (b.spent / b.limit) * 100;
      const level = pct >= 100 ? 100 : pct >= 80 ? 80 : 0;
      if (level > (budgetNotifiedRef.current[b.month] || 0)) {
        budgetNotifiedRef.current[b.month] = level;
        pushNotification("wallet", tx(level === 100 ? "bud.over.t" : "bud.near.t"),
          tx(level === 100 ? "bud.over" : "bud.near", { s: taka(b.spent), l: taka(b.limit) }));
      }
    }
  };
  useEffect(() => {
    if (!session || (session.user.role !== "student" && session.user.role !== "teacher")) return;
    refreshBudget().catch(() => {});
  }, [orders, session && session.token]);
  const saveBudget = async (limit) => {
    const b = await call("/api/summary/budget", { method: "PUT", body: { limit } });
    setBudget(b);
  };

  const placeOrder = async (`);
}

for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak25");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: monthly budget added (Spending tab card, cart warning, notifications).");
console.log("Restart the backend now: Ctrl+C, then cd backend, npm start. Then refresh the browser with Ctrl+Shift+R.");
