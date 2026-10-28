// Step 10 — "My bill" tab: what each meal costs, day by day, and the month's total.
// Closed meals are fixed ("confirmed"); open meals are an estimate at today's price.

function HallBillCell({ cell }) {
  const dim = cell.locked ? {} : { opacity: 0.6 };
  if (cell.status === "off" && !cell.guests) return <span style={{ color: "var(--ink-soft)", ...dim }}>off</span>;
  return (
    <span style={dim} title={cell.locked ? "Fixed" : "Estimate — can still change"}>
      {cell.status === "on" ? <b>{hallTaka(cell.amount)}</b> : <span style={{ color: "var(--ink-soft)" }}>off</span>}
      {cell.guests > 0 && <span className="text-[11px] hl-muted"> +{cell.guests}👥 {hallTaka(cell.guestAmount)}</span>}
      {cell.feast && <span title={cell.feast.title}> 🎉</span>}
    </span>
  );
}

function HallBill({ call, notify, refreshWallet }) {
  const [payBusy, setPayBusy] = useState(false);
  const [ym, setYm] = useState(null); // { year, month } — null until the server tells us today's month
  const [bill, setBill] = useState(null);
  const [err, setErr] = useState(null);

  const load = async (target) => {
    try {
      setErr(null);
      const q = target ? `?year=${target.year}&month=${target.month}` : "";
      const b = await call("/api/hall/bill" + q);
      setBill(b); setYm({ year: b.year, month: b.month });
    } catch (e) { setErr(e.message || String(e)); notify(e, true); }
  };
  useEffect(() => { load(); }, []);

  const shift = (d) => {
    let y = ym.year, m = ym.month + d;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setBill(null); load({ year: y, month: m });
  };
  const pay = async () => {
    if (!window.confirm(`Pay ${hallTaka(bill.due)} from your wallet?`)) return;
    setPayBusy(true);
    try {
      const r = await call("/api/hall/bill/pay", { method: "POST", body: { year: ym.year, month: ym.month } });
      notify(`Paid ${hallTaka(r.paid)}. Wallet balance: ${hallTaka(r.balance)}`);
      await load(ym);
      if (refreshWallet) refreshWallet().catch(() => {});
    } catch (e) { notify(e, true); }
    setPayBusy(false);
  };
  const monthName = ym ? new Date(Date.UTC(ym.year, ym.month - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const s = bill && bill.summary;

  return (
    <HallCard title={`My bill — ${monthName}`} icon="🧾" right={ym && (
      <div className="flex gap-1.5">
        <button className="hl-btn sm ghost" onClick={() => shift(-1)}>‹ Prev</button>
        <button className="hl-btn sm ghost" onClick={() => shift(1)}>Next ›</button>
      </div>
    )}>
      {!bill ? (err ? <div className="hl-error">⚠️ {err}</div> : <div className="hl-empty">Loading…</div>) : (
        <>
          <div className="hl-stats">
            <HallStat icon="💰" label="Whole month" value={hallTaka(s.total)} sub="open meals at today's price" />
            <HallStat icon="🔒" label="Confirmed (closed meals)" value={hallTaka(s.confirmedTotal)} sub="can't change any more" />
            <HallStat icon="🍽" label="Meals ON" value={s.mealsOn.total} sub={`B ${s.mealsOn.breakfast} · L ${s.mealsOn.lunch} · D ${s.mealsOn.dinner}`} />
            <HallStat icon="👥" label="Guests" value={`${s.guestPlates} plate(s)`} sub={hallTaka(s.guestCost)} />
          </div>

          <div className="hl-banner" style={{ background: bill.due > 0 ? "var(--warn-bg)" : "var(--ok-bg)", borderColor: bill.due > 0 ? "var(--warn-border)" : "var(--ok-border)" }}>
            <div className="text-sm">
              <div>Paid: <b>{hallTaka(bill.paid)}</b> · Due now: <b>{hallTaka(bill.due)}</b> <span className="opacity-70">(closed meals only)</span></div>
              <div className="text-xs opacity-80 mt-0.5">👛 Wallet balance: {hallTaka(bill.walletBalance)}</div>
            </div>
            <button className="hl-btn" disabled={bill.due <= 0 || payBusy} onClick={pay}>
              {bill.due > 0 ? `Pay ${hallTaka(bill.due)} from wallet` : "✓ Nothing due"}
            </button>
          </div>
          {s.feastExtra > 0 && <p className="text-xs mb-3 hl-muted">Includes {hallTaka(s.feastExtra)} of feast extras 🎉.</p>}

          <div className="hl-scroll">
            <table className="hl-table">
              <thead><tr>
                <th>Day</th>{HALL_SLOTS.map((x) => <th key={x}>{HALL_SLOT_EMOJI[x]} {HALL_SLOT_LABEL[x]}</th>)}<th style={{ textAlign: "right" }}>Day total</th>
              </tr></thead>
              <tbody>
                {bill.days.map((d) => (
                  <tr key={d.date} className={d.date === bill.today ? "today" : ""}>
                    <td className="whitespace-nowrap font-600">{hallDateLabel(d.date)}</td>
                    {HALL_SLOTS.map((x) => <td key={x} className="whitespace-nowrap"><HallBillCell cell={d.slots[x]} /></td>)}
                    <td className="font-700" style={{ textAlign: "right" }}>{hallTaka(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-3 hl-muted">Faded amounts are estimates for meals that haven't closed yet.</p>
        </>
      )}
    </HallCard>
  );
}
Hall.register({ key: "bill", label: "My bill", icon: "🧾", order: 6, roles: ["student", "teacher"], component: HallBill });
