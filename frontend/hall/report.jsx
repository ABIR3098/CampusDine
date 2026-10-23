// Step 12 — admin "Reports" tab: plates per day and meal, who is off, who changed what and when.
function HallReports({ call, notify }) {
  const [date, setDate] = useState("");
  const [day, setDay] = useState(null);
  const [changes, setChanges] = useState([]);
  const [range, setRange] = useState([]);
  const [open, setOpen] = useState(null); // which meal's "who is off" list is open

  const load = async (d) => {
    try {
      const q = d ? `?date=${d}` : "";
      const r = await call("/api/hall/report/day" + q);
      setDay(r); setDate(r.date);
      setChanges(await call(`/api/hall/report/changes?date=${r.date}`));
      setRange(await call(`/api/hall/report/range?from=${r.date}`));
    } catch (e) { notify(e, true); }
  };
  useEffect(() => { load(); }, []);

  const input = "rounded-lg border px-2 py-1.5 text-sm";
  const style = { background: "var(--input-bg)", borderColor: "var(--line)", color: "var(--ink)" };

  return (
    <>
      <HallCard title="Meals per day" right={
        <input type="date" className={input} style={style} value={date} onChange={(e) => { setDate(e.target.value); if (e.target.value) load(e.target.value); }} />
      }>
        {!day ? <p className="text-sm opacity-70">Loading…</p> : (
          <div className="grid gap-3 md:grid-cols-3">
            {day.slots.map((s) => (
              <div key={s.slot} className="rounded-xl border p-3" style={{ borderColor: "var(--line)" }}>
                <div className="flex justify-between items-center">
                  <div className="font-700">{s.label}</div>
                  <div className="text-[11px] opacity-70">{s.locked ? "🔒 closed (final)" : "open (can change)"}</div>
                </div>
                <div className="font-display text-3xl font-800 my-1">{s.plates}</div>
                <div className="text-xs opacity-80">plates = {s.on} ON + {s.guests} guest · {s.off} OFF of {s.members}</div>
                {s.feast && <div className="text-xs mt-1">🎉 {s.feast.title}</div>}
                {s.off > 0 && (
                  <button className="text-xs underline mt-2" onClick={() => setOpen(open === s.slot ? null : s.slot)}>
                    {open === s.slot ? "Hide" : "Who is off?"}
                  </button>
                )}
                {open === s.slot && <ul className="text-xs mt-1 list-disc pl-4">{s.offList.map((p) => <li key={p.externalId}>{p.name} ({p.externalId})</li>)}</ul>}
              </div>
            ))}
          </div>
        )}
      </HallCard>

      <HallCard title="Who changed a meal for this date">
        {changes.length === 0 ? <p className="text-sm opacity-70">No changes recorded for this date.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead><tr style={{ color: "var(--ink-soft)" }}><th className="py-1">Student</th><th>Meal</th><th>Change</th><th>When</th></tr></thead>
              <tbody>{changes.map((c, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="py-1">{c.name} <span className="opacity-60">({c.externalId})</span></td>
                  <td>{HALL_SLOT_LABEL[c.slot]}</td>
                  <td>{(c.fromStatus || "—").toUpperCase()} → <b>{c.toStatus.toUpperCase()}</b></td>
                  <td className="whitespace-nowrap">{c.at}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </HallCard>

      <HallCard title="Next 7 days — plates">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead><tr style={{ color: "var(--ink-soft)" }}><th className="py-1">Day</th>{HALL_SLOTS.map((x) => <th key={x}>{HALL_SLOT_LABEL[x]}</th>)}<th>Total</th></tr></thead>
            <tbody>{range.map((r) => (
              <tr key={r.date} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="py-1 whitespace-nowrap">{hallDateLabel(r.date)}</td><td>{r.breakfast}</td><td>{r.lunch}</td><td>{r.dinner}</td><td className="font-600">{r.total}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </HallCard>
    </>
  );
}
Hall.register({ key: "report", label: "Reports", order: 10, roles: ["admin"], component: HallReports });
