// Admin Home: what needs attention right now, one tap away.
// Numbers come from /api/hall/admin/overview and /api/hall/lastcall/manage; a chip only shows when there is something to do.

// overview = GET /api/hall/admin/overview, lastCalls = GET /api/hall/lastcall/manage (or null)
// → [{ key, icon, text, tab, tone }]
function hallAdminChipsOf(overview, lastCalls) {
  const n = (v) => Number(v) || 0;
  const s = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const chips = [];
  if (overview) {
    const open = n(overview.requests && overview.requests.open_requests);
    const visitors = n(overview.visitors && overview.visitors.pending);
    const clearance = n(overview.clearance && overview.clearance.pending);
    const low = n(overview.stock && overview.stock.low_stock);
    if (open) chips.push({ key: "requests", icon: "📨", text: s(open, "open request", "open requests"), tab: "services", tone: "warn" });
    if (visitors) chips.push({ key: "visitors", icon: "🧑‍🤝‍🧑", text: s(visitors, "visitor waiting", "visitors waiting"), tab: "advanced", tone: "warn" });
    if (clearance) chips.push({ key: "clearance", icon: "📄", text: s(clearance, "clearance to review", "clearances to review"), tab: "advanced", tone: "warn" });
    if (low) chips.push({ key: "stock", icon: "📦", text: s(low, "item low in stock", "items low in stock"), tab: "services", tone: "warn" });
  }
  if (lastCalls) {
    const live = lastCalls.items.filter((i) => i.status === "open" && i.date === lastCalls.today);
    if (live.length) {
      const left = live.reduce((a, i) => a + Math.max(0, i.plates - i.taken), 0);
      chips.push({ key: "lastcall", icon: "🍱", text: `Last call live · ${s(left, "plate", "plates")} left`, tab: "lastcall", tone: "ok" });
    }
  }
  return chips;
}

function HallAdminChipsRow({ chips, goTab }) {
  if (!chips.length) return null;
  return (
    <div className="flex gap-2 flex-wrap" style={{ marginBottom: 14 }}>
      {chips.map((c) => <button key={c.key} className={`hl-chip ${c.tone}`} style={{ cursor: "pointer" }} onClick={() => goTab(c.tab)}>{c.icon} {c.text} →</button>)}
    </div>
  );
}

function HallAdminChips({ call, goTab }) {
  const [chips, setChips] = useState([]);
  useEffect(() => {
    let dead = false;
    Promise.all([
      call("/api/hall/admin/overview").catch(() => null),
      call("/api/hall/lastcall/manage").catch(() => null),
    ]).then(([o, l]) => { if (!dead) setChips(hallAdminChipsOf(o, l)); });
    return () => { dead = true; };
  }, []);
  return <HallAdminChipsRow chips={chips} goTab={goTab} />;
}
