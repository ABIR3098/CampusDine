// Auto-pay, member side: one switch on My bill.
// When it is ON, the server takes last month's unpaid Hall bill from the wallet between the 1st and the 10th of every month.

// "2026-10" → "October 2026"
function hallYmLabel(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// one line of history: what happened the last times auto-pay ran
function HallAutoPayRun({ run }) {
  const text = run.status === "paid" ? `Paid ${hallTaka(run.amount)} from your wallet`
    : run.status === "short" ? `Wallet too low: needed ${hallTaka(run.due)}, had ${hallTaka(run.balance)}`
    : "Nothing was due";
  const tone = run.status === "paid" ? "ok" : run.status === "short" ? "warn" : "";
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap text-sm" style={{ marginTop: 6 }}>
      <span><b>{hallYmLabel(run.ym)}</b> <span className="hl-muted text-xs">· {run.createdAt}</span></span>
      <span className={`hl-chip ${tone}`}>{text}</span>
    </div>
  );
}

// info = GET /api/hall/autopay
function HallAutoPayView({ info, busy, onToggle }) {
  return (
    <div className="hl-tile" style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div style={{ flex: "1 1 260px" }}>
          <div className="font-700">🔁 Auto-pay</div>
          <div className="text-xs hl-muted mt-0.5">
            {info.enabled
              ? `ON — between the 1st and the ${info.graceDays}th of each month, last month's unpaid bill is taken from your wallet.`
              : `Turn it on and last month's bill is paid from your wallet automatically (1st–${info.graceDays}th). If the wallet is short you get a notification and it tries again the next day.`}
          </div>
        </div>
        <HallSwitch on={info.enabled} disabled={busy} onChange={onToggle} label="Auto-pay" />
      </div>
      {info.history.length > 0 && (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
          <div className="text-xs hl-muted">Recent runs</div>
          {info.history.map((r, i) => <HallAutoPayRun key={i} run={r} />)}
        </div>
      )}
    </div>
  );
}

function HallAutoPayCard({ call, notify }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let dead = false;
    call("/api/hall/autopay").then((r) => { if (!dead) setInfo(r); }).catch(() => { /* optional card: stay hidden */ });
    return () => { dead = true; };
  }, []);
  const toggle = async (enabled) => {
    setBusy(true);
    try {
      await call("/api/hall/autopay", { method: "PUT", body: { enabled } });
      setInfo((i) => ({ ...i, enabled }));
      notify(enabled ? "Auto-pay is ON. Keep enough balance in your wallet." : "Auto-pay is OFF.");
    } catch (e) { notify(e, true); }
    setBusy(false);
  };
  if (!info) return null;
  return <HallAutoPayView info={info} busy={busy} onToggle={toggle} />;
}
