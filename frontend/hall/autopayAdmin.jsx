// Auto-pay, admin side: run it right now for one month (it also runs by itself between the 1st and the 10th).
function HallAutoPayRunner({ call, notify, year, month, onDone }) {
  const [busy, setBusy] = useState(false);
  const label = hallYmLabel(`${year}-${String(month).padStart(2, "0")}`);
  const run = async () => {
    if (!window.confirm(`Take the unpaid ${label} bill from the wallet of everyone who turned auto-pay on?`)) return;
    setBusy(true);
    try {
      const r = await call("/api/hall/autopay/run", { method: "POST", body: { year, month } });
      notify(r.people === 0
        ? "Nobody has auto-pay waiting for that month."
        : `Auto-pay: ${r.paid} paid (${hallTaka(r.totalTaken)}), ${r.short} wallet too low, ${r.nothing} nothing due${r.failed ? `, ${r.failed} failed` : ""}.`);
      if (onDone) onDone();
    } catch (e) { notify(e, true); }
    setBusy(false);
  };
  return <button className="hl-btn sm ghost" disabled={busy} onClick={run} title="Normally runs by itself between the 1st and 10th of the month">🔁 Run auto-pay for {label}</button>;
}
