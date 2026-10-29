// Diet, admin side: for one day, which meals contain what, and how many people who have that meal ON
// avoid it or are allergic (the allergic ones by name, so the kitchen can look after them).

// data = GET /api/hall/diet/summary
function HallDietSummaryView({ data }) {
  const withPrefs = data.byTag.filter((t) => t.avoid || t.allergy);
  return (
    <>
      <p className="text-xs hl-muted mb-3">{data.people} {data.people === 1 ? "person has" : "people have"} told the hall about their diet.</p>
      <div className="hl-grid3" style={{ marginBottom: 16 }}>
        {data.slots.map((s) => (
          <div key={s.slot} className="hl-tile" style={s.allergy.length ? { borderColor: "var(--danger-border)", background: "var(--danger-bg)" } : undefined}>
            <div className="font-700">{HALL_SLOT_EMOJI[s.slot]} {s.label}</div>
            <div className="text-sm mt-1">{s.items || <span className="hl-muted">No menu set</span>}</div>
            <div className="flex gap-1 flex-wrap mt-1">
              {s.tags.map((t) => <span key={t.key} className="hl-chip" style={{ padding: "2px 8px", fontSize: ".68rem" }}>{t.label}</span>)}
            </div>
            <div className="text-xs mt-2">{s.avoidCount} {s.avoidCount === 1 ? "person avoids" : "people avoid"} this meal</div>
            {s.allergy.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-700" style={{ color: "var(--danger-fg)" }}>⚠️ {s.allergy.length} allergic — keep this meal away from:</div>
                {s.allergy.map((a, i) => (
                  <div key={i} className="text-sm" style={{ marginTop: 4 }}>
                    <b>{a.name}</b> <span className="hl-muted">{a.externalId || ""}</span> · {a.matches.join(", ")}
                    {a.note && <div className="text-xs hl-muted">“{a.note}”</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="font-700 mb-2">Across the hall</div>
      {withPrefs.length === 0 ? <div className="hl-empty">Nobody has set a diet yet.</div> : (
        <div className="hl-scroll">
          <table className="hl-table">
            <thead><tr><th>Food</th><th style={{ textAlign: "right" }}>Avoid</th><th style={{ textAlign: "right" }}>Allergic</th></tr></thead>
            <tbody>{withPrefs.map((t) => <tr key={t.key}><td>{t.label}</td><td style={{ textAlign: "right" }}>{t.avoid}</td><td className="font-700" style={{ textAlign: "right", color: t.allergy ? "var(--danger-fg)" : undefined }}>{t.allergy}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </>
  );
}

function HallDietAdmin({ call, notify }) {
  const [date, setDate] = useState(null);   // null = tomorrow (the server picks it)
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = async (d) => {
    try {
      setErr(null);
      const r = await call("/api/hall/diet/summary" + (d ? `?date=${d}` : ""));
      setData(r); setDate(r.date);
    } catch (e) { setErr(e.message || String(e)); notify(e, true); }
  };
  useEffect(() => { load(); }, []);
  const shift = (n) => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    setData(null); load(d.toISOString().slice(0, 10));
  };
  return (
    <HallCard title={`Diet & allergies${date ? " — " + hallDateLabel(date) : ""}`} icon="🥗" sub="Who has told the hall about food they avoid or are allergic to, for the meals of one day." right={date && (
      <div className="flex gap-1.5">
        <button className="hl-btn sm ghost" onClick={() => shift(-1)}>‹ Prev day</button>
        <button className="hl-btn sm ghost" onClick={() => shift(1)}>Next day ›</button>
      </div>
    )}>
      {err ? <div className="hl-error">⚠️ {err}</div> : !data ? <div className="hl-empty">Loading…</div> : <HallDietSummaryView data={data} />}
    </HallCard>
  );
}
