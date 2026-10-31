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

  return (
    <>
      <HallCard title="Meals per day" icon="📊" right={
        <div className="flex gap-1.5 flex-wrap items-center">
          <HallDayCsvButton day={day} />
          <HallReportPrintButton />
          <input type="date" className="hl-input" style={{ width: "auto" }} value={date} onChange={(e) => { setDate(e.target.value); if (e.target.value) load(e.target.value); }} />
        </div>
      }>
        {!day ? <div className="hl-empty">Loading…</div> : (
          <div className="hl-grid3">
            {day.slots.map((s) => (
              <div key={s.slot} className="hl-tile">
                <div className="flex justify-between items-center gap-2">
                  <div className="font-700">{HALL_SLOT_EMOJI[s.slot]} {s.label}</div>
                  <span className={`hl-chip ${s.locked ? "plain" : "ok"}`}>{s.locked ? "🔒 final" : "open"}</span>
                </div>
                <div className="hl-big font-display my-2" style={{ color: "var(--gold-deep)" }}>{s.plates}</div>
                <div className="text-xs hl-muted">plates = {s.on} ON + {s.guests} guest · {s.off} OFF of {s.members}</div>
                {s.feast && <div className="text-xs mt-1.5 hl-chip warn">🎉 {s.feast.title}</div>}
                {s.off > 0 && (
                  <div className="mt-2">
                    <button className="hl-btn sm ghost" onClick={() => setOpen(open === s.slot ? null : s.slot)}>{open === s.slot ? "Hide" : "Who is off?"}</button>
                  </div>
                )}
                {open === s.slot && <ul className="text-xs mt-2 list-disc pl-4">{s.offList.map((p) => <li key={p.externalId}>{p.name} ({p.externalId})</li>)}</ul>}
              </div>
            ))}
          </div>
        )}
      </HallCard>

      <HallCard title="Who changed a meal for this date" icon="📝">
        {changes.length === 0 ? <div className="hl-empty">No changes recorded for this date.</div> : (
          <div className="hl-scroll">
            <table className="hl-table">
              <thead><tr><th>Student</th><th>Meal</th><th>Change</th><th>When</th></tr></thead>
              <tbody>{changes.map((c, i) => (
                <tr key={i}>
                  <td>{c.name} <span className="hl-muted">({c.externalId})</span></td>
                  <td>{HALL_SLOT_EMOJI[c.slot]} {HALL_SLOT_LABEL[c.slot]}</td>
                  <td><span className="hl-chip plain">{(c.fromStatus || "—").toUpperCase()}</span> → <span className={`hl-chip ${c.toStatus === "on" ? "ok" : "plain"}`}>{c.toStatus.toUpperCase()}</span></td>
                  <td className="whitespace-nowrap">{c.at}</td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      </HallCard>

      <HallCard title="Next 7 days — plates" icon="📅" right={<HallRangeCsvButton range={range} />}>
        <div className="hl-scroll">
          <table className="hl-table">
            <thead><tr><th>Day</th>{HALL_SLOTS.map((x) => <th key={x}>{HALL_SLOT_EMOJI[x]} {HALL_SLOT_LABEL[x]}</th>)}<th>Total</th></tr></thead>
            <tbody>{range.map((r) => (
              <tr key={r.date}>
                <td className="whitespace-nowrap">{hallDateLabel(r.date)}</td><td>{r.breakfast}</td><td>{r.lunch}</td><td>{r.dinner}</td><td className="font-700">{r.total}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </HallCard>
    </>
  );
}
Hall.register({ key: "report", label: "Reports", icon: "📊", order: 10, roles: ["admin"], component: HallReports });
