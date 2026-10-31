// Menu (admin): copy one meal to the same meal on every other day with one click.
// writes `items` to `slot` on the other six days (0 = Sunday ... 6 = Saturday) → how many days were written
async function hallCopyMealToAllDays(call, slot, dow, items) {
  let done = 0;
  for (let d = 0; d < 7; d++) {
    if (d === dow) continue;
    await call(`/api/hall/menu/${d}/${slot}`, { method: "PUT", body: { items } });
    done++;
  }
  return done;
}

function HallMenuCopyButton({ call, notify, slot, dow, items, onDone }) {
  const [busy, setBusy] = useState(false);
  if (!items) return null;
  const run = async () => {
    if (!window.confirm(`Copy "${items}" to ${HALL_SLOT_LABEL[slot]} on all other days?`)) return;
    setBusy(true);
    try {
      await hallCopyMealToAllDays(call, slot, dow, items);
      notify(`${HALL_SLOT_LABEL[slot]} copied to all days.`);
      if (onDone) await onDone();
    } catch (e) { notify(e, true); }
    setBusy(false);
  };
  return <button type="button" className="hl-btn sm ghost" style={{ marginTop: 4 }} disabled={busy} title="Copy this meal to every other day" onClick={run}>{busy ? "Copying…" : "⧉ Copy to all days"}</button>;
}
