// spending-months.js — Spending tab: adds a "Last 6 months" bar chart (tap a bar to open that month).
// Your Spending tab already has the daily chart, "Most ordered" (top items), categories and payment split.
// Run from the project main folder:  node spending-months.js   (then restart the backend)
const fs = require("fs");

const FILES = { html: "frontend/campusdine.html", summary: "backend/src/routes/summary.js" };
for (const f of Object.values(FILES)) {
  if (!fs.existsSync(f)) { console.error(`Run this from the project's main folder (${f} not found).`); process.exit(1); }
}
const load = (file) => {
  const raw = fs.readFileSync(file, "utf8");
  return { file, crlf: raw.includes("\r\n"), s: raw.replace(/\r\n/g, "\n") };
};
const docs = { html: load(FILES.html), summary: load(FILES.summary) };

const MARK = { html: "/* Feature: spending last 6 months */", summary: "// Feature: spending — last 6 months" };
const todo = Object.keys(docs).filter((k) => !docs[k].s.includes(MARK[k]));
if (todo.length === 0) { console.log("Already applied — nothing to do."); process.exit(0); }

function rep(k, label, from, to) {
  const d = docs[k];
  const n = d.s.split(from).length - 1;
  if (n !== 1) { console.error(`Patch failed at "${label}" in ${d.file} (anchor found ${n} times). Nothing was changed.`); process.exit(1); }
  d.s = d.s.replace(from, () => to);
}

/* ---------------- backend: months[] in /api/summary ---------------- */
if (todo.includes("summary")) {
  rep("summary", "months query",
`  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [uid]);
`,
`  // Feature: spending — last 6 months (the selected month and the 5 before it), cancelled orders left out
  const [monthRows] = await pool.query(
    \`SELECT YEAR(o.created_at) AS y, MONTH(o.created_at) AS m, COALESCE(SUM(o.total), 0) AS spent, COUNT(*) AS orders
     FROM orders o
     WHERE o.user_id = ? AND o.status != 'Cancelled'
       AND o.created_at >= DATE_SUB(?, INTERVAL 5 MONTH) AND o.created_at < DATE_ADD(?, INTERVAL 1 MONTH)
     GROUP BY y, m\`, [uid, start, start]);
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const idx = year * 12 + (month - 1) - i;
    const y = Math.floor(idx / 12), m = (idx % 12) + 1;
    const row = monthRows.find((r) => Number(r.y) === y && Number(r.m) === m);
    months.push({ year: y, month: m, spent: row ? Number(row.spent) : 0, orders: row ? Number(row.orders) : 0 });
  }
  const [[user]] = await pool.query("SELECT wallet_balance FROM users WHERE id = ?", [uid]);
`);
  rep("summary", "months in response",
`    byDay, topItems, byCategory, byPayment,
`,
`    byDay, topItems, byCategory, byPayment, months,
`);
}

/* ---------------- frontend: the chart ---------------- */
if (todo.includes("html")) {
  rep("html", "en text",
`  "sp.daily": "Spending by day",
`,
`  "sp.daily": "Spending by day",
  "sp.months": "Last 6 months (tap a bar to open that month)",
`);
  rep("html", "bn text",
`  "sp.daily": "দিন অনুযায়ী খরচ",
`,
`  "sp.daily": "দিন অনুযায়ী খরচ",
  "sp.months": "গত ৬ মাস (বারে চাপ দিলে সেই মাস খুলবে)",
`);

  rep("html", "chart card",
`        <div className="grid md:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="font-display font-700 mb-3" style={{ color: "var(--gold)" }}>{tx("sp.top")}</div>`,
`        {/* Feature: spending last 6 months */}
        {data.months && (
          <div className="card p-5">
            <div className="font-display font-700 mb-4" style={{ color: "var(--gold)" }}>{tx("sp.months")}</div>
            {(() => {
              const mMax = Math.max(1, ...data.months.map(m => m.spent));
              return (
                <div className="flex items-end gap-2 h-40">
                  {data.months.map(m => {
                    const sel = m.year === ym.year && m.month === ym.month;
                    const label = new Date(m.year, m.month - 1).toLocaleString(CURRENT_LANG === "bn" ? "bn-BD" : "default", { month: "short" });
                    return (
                      <button key={m.year + "-" + m.month} type="button" onClick={() => setYm({ year: m.year, month: m.month })}
                        className="flex-1 flex flex-col items-center justify-end" title={label + " " + m.year + ": " + taka(m.spent) + " · " + m.orders}>
                        <div className="text-[10px] font-mono mb-1" style={{ color: "var(--ink-soft)" }}>{m.spent ? taka(Math.round(m.spent)) : ""}</div>
                        <div className="w-full rounded-t" style={{ height: m.spent ? Math.max(4, (m.spent / mMax) * 110) + "px" : "2px", background: m.spent ? "var(--gold)" : "var(--line)", opacity: sel || !m.spent ? 1 : 0.5 }}></div>
                        <div className="text-[11px] mt-1" style={{ color: sel ? "var(--gold)" : "var(--ink-soft)", fontWeight: sel ? 700 : 400 }}>{label}</div>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <div className="card p-5">
            <div className="font-display font-700 mb-3" style={{ color: "var(--gold)" }}>{tx("sp.top")}</div>`);
}

for (const k of todo) {
  const d = docs[k];
  fs.copyFileSync(d.file, d.file + ".bak11");
  fs.writeFileSync(d.file, d.crlf ? d.s.replace(/\n/g, "\r\n") : d.s);
}
console.log("Done: Spending tab now has a 'Last 6 months' chart.");
console.log("Restart the backend now: Ctrl+C, then npm start. Then refresh the browser with Ctrl+Shift+R.");
