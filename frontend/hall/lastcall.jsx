// Last call, member side: at the end of a meal the canteen puts leftover plates up at a low price.
// You take one with your wallet and show the code at the counter. Less food is thrown away.

function HallLastCallPlate({ plate }) {
  const tone = plate.status === "served" ? "ok" : plate.status === "cancelled" ? "" : "warn";
  const text = plate.status === "served" ? "Collected ✓" : plate.status === "cancelled" ? "Refunded" : "Show this code at the counter";
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, border: "1px dashed var(--accent-border)" }}>
      <span className="font-display font-700" style={{ fontSize: 20, letterSpacing: ".08em" }}>{plate.code}</span>
      <span className={`hl-chip ${tone}`}>{text}</span>
    </div>
  );
}

// data = GET /api/hall/lastcall
function HallLastCallView({ data, busyId, onClaim }) {
  if (!data.items.length) {
    return <div className="hl-empty">No last call right now. When the canteen has leftover plates at the end of a meal, they show up here at a low price.</div>;
  }
  return (
    <>
      {data.items.map((it) => {
        const mineCount = it.mine.filter((m) => m.status !== "cancelled").length;
        const canTake = it.open && it.remaining > 0 && mineCount < data.maxPerPerson;
        return (
          <div key={it.id} className="hl-tile" style={{ marginBottom: 12 }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="font-700">{HALL_SLOT_EMOJI[it.slot]} {it.label} leftovers</div>
                <div className="text-xs hl-muted mt-0.5">{!it.open ? "Closed" : it.remaining > 0 ? `${it.remaining} of ${it.plates} plates left` : "All plates are taken"}{it.note ? ` · ${it.note}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="font-display font-700" style={{ fontSize: 22 }}>{hallTaka(it.price)}</div>
                {it.normalPrice > it.price && <div className="text-xs hl-muted"><s>{hallTaka(it.normalPrice)}</s> normally</div>}
              </div>
            </div>
            <div className="mt-2">
              <button className="hl-btn" disabled={!canTake || busyId === it.id} onClick={() => onClaim(it)}>
                {canTake ? `Take 1 plate · ${hallTaka(it.price)}` : mineCount >= data.maxPerPerson ? `You have ${mineCount} plates (the limit)` : !it.open ? "Closed" : "Sold out"}
              </button>
            </div>
            {it.mine.map((m) => <HallLastCallPlate key={m.id} plate={m} />)}
          </div>
        );
      })}
      <p className="text-xs hl-muted">The price is taken from your wallet when you take a plate. You can take up to {data.maxPerPerson} per last call.</p>
    </>
  );
}

function HallLastCallStudent({ call, notify, refreshWallet }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const load = async () => {
    try { setErr(null); setData(await call("/api/hall/lastcall")); }
    catch (e) { setErr(e.message || String(e)); }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);   // plates run out, so keep the numbers fresh
    return () => clearInterval(t);
  }, []);
  const claim = async (it) => {
    setBusyId(it.id);
    try {
      const r = await call(`/api/hall/lastcall/${it.id}/claim`, { method: "POST" });
      notify(`Plate taken! Your code is ${r.code}. Wallet balance: ${hallTaka(r.balance)}`);
      await load();
      if (refreshWallet) refreshWallet().catch(() => {});
    } catch (e) { notify(e, true); await load(); }
    setBusyId(null);
  };
  return (
    <HallCard title="Last call" icon="🍱" sub="Leftover plates at a low price, first come first served.">
      {err ? <div className="hl-error">⚠️ {err}</div> : !data ? <div className="hl-empty">Loading…</div> : <HallLastCallView data={data} busyId={busyId} onClaim={claim} />}
    </HallCard>
  );
}

// Home: a banner while plates are available
function HallLastCallBanner({ call, goTab }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    let dead = false;
    const load = () => call("/api/hall/lastcall").then((r) => { if (!dead) setItems(r.items.filter((i) => i.open && i.remaining > 0)); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { dead = true; clearInterval(t); };
  }, []);
  if (!items.length) return null;
  const it = items[0];
  return (
    <div className="hl-banner" style={{ background: "var(--ok-bg)", borderColor: "var(--ok-border)" }}>
      <div className="text-sm">
        <div className="font-700">🍱 Last call: {it.remaining} {it.label} plate{it.remaining === 1 ? "" : "s"} at {hallTaka(it.price)}</div>
        <div className="text-xs opacity-80 mt-0.5">Leftover food, first come first served{items.length > 1 ? ` (+${items.length - 1} more)` : ""}.</div>
      </div>
      <button className="hl-btn sm" onClick={() => goTab("lastcall")}>Take a plate</button>
    </div>
  );
}

function HallLastCall(props) {
  return props.isAdmin ? <HallLastCallAdmin {...props} /> : <HallLastCallStudent {...props} />;
}
Hall.register({ key: "lastcall", label: "Last call", icon: "🍱", order: 5.5, component: HallLastCall });
