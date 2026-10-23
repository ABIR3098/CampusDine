// Step 10 — "My bill" tab: what each meal costs, day by day, and the month's total.
// Closed meals are fixed ("confirmed"); open meals are an estimate at today's price.

function HallStat({ label, value, sub }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
      <div className="text-xs" style={{ color: "var(--ink-soft)" }}>{label}</div>
      <div className="font-display font-700 text-lg">{value}</div>
      {sub && <div className="text-[11px] opacity-70">{sub}</div>}
    </div>
  );
}

function HallBillCell({ cell }) {
  const dim = cell.locked ? {} : { opacity: 0.6 };
  if (cell.status === "off" && !cell.guests) return <span style={{ color: "var(--ink-soft)", ...dim }}>off</span>;
  return (
    <span style={dim} title={cell.locked ? "Fixed" : "Estimate — can still change"}>
      {cell.status === "on" ? hallTaka(cell.amount) : <span style={{ color: "var(--ink-soft)" }}>off</span>}
      {cell.guests > 0 && <span className="text-[11px]"> +{cell.guests}👥 {hallTaka(cell.guestAmount)}</span>}
      {cell.feast && <span title={cell.feast.title}> 🎉</span>}
    </span>
  );
}

function HallBill({ call, notify }) {
  const [ym, setYm] = useState(null); // { year, month } — null until the server tells us today's month
  const [bill, setBill] = useState(null);

  const load = async (target) => {
    try {
      const q = target ? `?year=${target.year}&month=${target.month}` : "";
      const b = await call("/api/hall/bill" + q);
      setBill(b); setYm({ year: b.year, month: b.month });
    } catch (e) { notify(e, true); }
  };
  useEffect(() => { load(); }, []);

  const shift = (d) => {
    let y = ym.year, m = ym.month + d;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setBill(null); load({ year: y, month: m });
  };
  const monthName = ym ? new Date(Date.UTC(ym.year, ym.month - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : "";
  const s = bill && bill.summary;

  return (
    <HallCard title={`My bill — ${monthName}`} right={ym && (
      <div className="flex gap-1">
        <button className="btn-gold px-2 py-1 rounded-lg text-xs" onClick={() => shift(-1)}>‹ Prev</button>
        <button className="btn-gold px-2 py-1 rounded-lg text-xs" onClick={() => shift(1)}>Next ›</button>
      </div>
    )}>
      {!bill ? <p className="text-sm opacity-70">Loading…</p> : (
        <>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-4 mb-4">
            <HallStat label="Whole month" value={hallTaka(s.total)} sub="open meals at today's price" />
            <HallStat label="Confirmed (closed meals)" value={hallTaka(s.confirmedTotal)} sub="can't change any more" />
            <HallStat label="Meals ON" value={s.mealsOn.total} sub={`B ${s.mealsOn.breakfast} · L ${s.mealsOn.lunch} · D ${s.mealsOn.dinner}`} />
            <HallStat label="Guests" value={`${s.guestPlates} plate(s)`} sub={hallTaka(s.guestCost)} />
          </div>
          {s.feastExtra > 0 && <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>Includes {hallTaka(s.feastExtra)} of feast extras 🎉.</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead><tr style={{ color: "var(--ink-soft)" }}>
                <th className="py-1">Day</th>{HALL_SLOTS.map((x) => <th key={x}>{HALL_SLOT_LABEL[x]}</th>)}<th className="text-right">Day total</th>
              </tr></thead>
              <tbody>
                {bill.days.map((d) => (
                  <tr key={d.date} className="border-t" style={{ borderColor: "var(--line)", background: d.date === bill.today ? "var(--gold-soft)" : "transparent" }}>
                    <td className="py-1.5 pr-2 whitespace-nowrap font-600">{hallDateLabel(d.date)}</td>
                    {HALL_SLOTS.map((x) => <td key={x} className="pr-2 whitespace-nowrap"><HallBillCell cell={d.slots[x]} /></td>)}
                    <td className="text-right font-600">{hallTaka(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-3" style={{ color: "var(--ink-soft)" }}>Faded amounts are estimates for meals that haven't closed yet.</p>
        </>
      )}
    </HallCard>
  );
}
Hall.register({ key: "bill", label: "My bill", order: 6, roles: ["student", "teacher"], component: HallBill });
