// Step 5 — admin tab: the cut-off job. It runs by itself every minute; "Run now" is for checking.
function HallAutoFill({ call, notify }) {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const r = await call("/api/hall/auto-fill", { method: "POST" });
      setResult(r);
      notify(r.totalAdded || r.totalPriced ? `Filled ${r.totalAdded} and priced ${r.totalPriced} person-meal(s)` : "Nothing to do — everything locked is already filled and priced");
    } catch (e) { notify(e, true); }
    setBusy(false);
  };
  return (
    <HallCard title="Cut-off job" icon="⚙️"
      sub="When a meal closes, everyone who never chose gets the same state as their last choice (ON if they never chose), so the day's numbers are fixed. Their price is fixed at the same moment, so changing a price later never changes a meal that has already closed. This runs automatically every minute.">
      <button className="hl-btn" disabled={busy} onClick={run}>{busy ? "Running…" : "▶ Run now"}</button>
      {result && (
        <div className="hl-scroll mt-4">
          <table className="hl-table">
            <thead><tr><th>Date</th><th>Meal</th><th>Newly filled</th><th>Prices fixed</th></tr></thead>
            <tbody>
              {result.ran.length === 0 && <tr><td colSpan="4" className="hl-muted">No meal is locked yet.</td></tr>}
              {result.ran.map((d) => (
                <tr key={d.date + d.slot}>
                  <td>{hallDateLabel(d.date)}</td><td>{HALL_SLOT_EMOJI[d.slot]} {HALL_SLOT_LABEL[d.slot]}</td><td>{d.added}</td><td>{d.priced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HallCard>
  );
}
Hall.register({ key: "autofill", label: "Cut-off job", icon: "⚙️", order: 20, roles: ["admin"], component: HallAutoFill });
