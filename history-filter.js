// history-filter.js — Order history filter + search (My Orders tab)
// Run from the project main folder:  node history-filter.js
const fs = require("fs");
const FILE = "frontend/campusdine.html";

if (!fs.existsSync(FILE)) {
  console.error("Run this from the project's main folder (frontend/campusdine.html not found).");
  process.exit(1);
}

const raw = fs.readFileSync(FILE, "utf8");
const crlf = raw.includes("\r\n");
let s = raw.replace(/\r\n/g, "\n");

if (s.includes("/* Feature: order history filter */")) {
  console.log("Already applied — nothing to do.");
  process.exit(0);
}

function replaceOnce(label, from, to) {
  const n = s.split(from).length - 1;
  if (n !== 1) {
    console.error(`Patch failed at "${label}" (anchor found ${n} times). File not changed.`);
    process.exit(1);
  }
  s = s.replace(from, () => to);
}

// 1) filter state
replaceOnce("state",
`  const [printOrder, setPrintOrder] = useState(null);
`,
`  const [printOrder, setPrintOrder] = useState(null);
  /* Feature: order history filter */
  const [hQuery, setHQuery] = useState("");
  const [hStatus, setHStatus] = useState("all");
  const [hRange, setHRange] = useState("all");
`);

// 2) filtering logic (after the "no orders" early return of TrackOrder only)
replaceOnce("logic",
`    return <div className="card p-10 text-center" style={{ color: "var(--ink-soft)" }}>{tx("noorders")}</div>;
  }
  return (
    <div className="space-y-6 max-w-2xl">`,
`    return <div className="card p-10 text-center" style={{ color: "var(--ink-soft)" }}>{tx("noorders")}</div>;
  }
  const hq = hQuery.trim().toLowerCase();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const filtered = orders.filter(o => {
    if (hStatus !== "all" && o.status !== hStatus) return false;
    if (hRange !== "all") {
      const t = new Date(o.created_at).getTime();
      const limit = hRange === "today" ? startOfToday.getTime() : Date.now() - (hRange === "week" ? 7 : 30) * 86400000;
      if (t < limit) return false;
    }
    if (hq) {
      const hay = [o.token, o.status, o.note, o.restaurant, o.payment_method]
        .concat((o.items || []).map(i => i.name)).join(" ").toLowerCase();
      if (!hay.includes(hq)) return false;
    }
    return true;
  });
  return (
    <div className="space-y-6 max-w-2xl">`);

// 3) filter bar + use filtered list
replaceOnce("render",
`      {orders.map(o => {
        const stepIndex = STATUSES.indexOf(o.status);`,
`      <div className="card p-4 space-y-3">
        <input type="text" value={hQuery} onChange={e => setHQuery(e.target.value)}
          placeholder="Search by token, item, note…"
          className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--line)" }} />
        <div className="flex flex-wrap gap-2">
          {[["all", "All"], ["Received", "Received"], ["Cooking", "Cooking"], ["Ready", "Ready"], ["Cancelled", "Cancelled"]].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setHStatus(v)}
              className={"chip text-xs px-3 py-1.5 rounded-full" + (hStatus === v ? " active-chip" : "")}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[["all", "Any time"], ["today", "Today"], ["week", "Last 7 days"], ["month", "Last 30 days"]].map(([v, label]) => (
            <button key={v} type="button" onClick={() => setHRange(v)}
              className={"chip text-xs px-3 py-1.5 rounded-full" + (hRange === v ? " active-chip" : "")}>{label}</button>
          ))}
          <span className="text-xs ml-auto" style={{ color: "var(--ink-soft)" }}>{filtered.length} / {orders.length}</span>
        </div>
      </div>
      {filtered.length === 0 && (
        <div className="card p-8 text-center text-sm" style={{ color: "var(--ink-soft)" }}>
          No orders match your filters.
          <div className="mt-3">
            <button type="button" className="chip text-xs px-3 py-1.5 rounded-full" onClick={() => { setHQuery(""); setHStatus("all"); setHRange("all"); }}>Clear filters</button>
          </div>
        </div>
      )}
      {filtered.map(o => {
        const stepIndex = STATUSES.indexOf(o.status);`);

fs.copyFileSync(FILE, FILE + ".bak4");
fs.writeFileSync(FILE, crlf ? s.replace(/\n/g, "\r\n") : s);
console.log("Done: order history filter + search added.");
