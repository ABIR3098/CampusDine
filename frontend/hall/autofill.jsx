// Step 5 — admin tab: the cut-off job. It runs by itself every minute; "Run now" is for checking.
function HallAutoFill({ call, notify }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await call("/api/hall/auto-fill", { method: "POST" });
      setResult(r);
      notify(r.totalAdded ? `Filled ${r.totalAdded} person-meal(s)` : "Nothing to fill — everything locked is already filled");
    } catch (e) { notify(e, true); }
    setBusy(false);
  };
  return (
    <HallCard title="Cut-off job">
      <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
        When a meal closes, everyone who never chose gets the same state as their last choice (ON if they never chose),
        so the day's numbers are fixed. This runs automatically every minute.
      </p>
      <button className="btn-gold px-4 py-2 rounded-lg text-sm" disabled={busy} onClick={run}>{busy ? "Running…" : "Run now"}</button>
      {result && (
        <table className="w-full text-sm text-left mt-4">
          <thead><tr style={{ color: "var(--ink-soft)" }}><th className="py-1">Date</th><th>Meal</th><th>Newly filled</th></tr></thead>
          <tbody>
            {result.ran.length === 0 && <tr><td colSpan="3" className="py-2 opacity-70">No meal is locked yet.</td></tr>}
            {result.ran.map((d) => (
              <tr key={d.date + d.slot} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="py-1">{hallDateLabel(d.date)}</td><td>{HALL_SLOT_LABEL[d.slot]}</td><td>{d.added}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </HallCard>
  );
}
Hall.register({ key: "autofill", label: "Cut-off job", order: 20, roles: ["admin"], component: HallAutoFill });
