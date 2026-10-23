// Step 2 — "Meal times" tab: when each meal closes for changes, and its price. Admin can edit.

// "21:00" → "9:00 PM"
function hallClockLabel(hhmm) {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
// slot → "Day before, 9:00 PM" / "Same day, 9:00 AM" / "2 days before, ..."
function hallCutoffLabel(s) {
  const d = s.cutoffDaysBefore;
  const when = d === 0 ? "Same day" : d === 1 ? "Day before" : `${d} days before`;
  return `${when}, ${hallClockLabel(s.cutoffTime)}`;
}

function HallSlotRow({ slot, isAdmin, onSave }) {
  const [f, setF] = useState({ cutoffTime: slot.cutoffTime, cutoffDaysBefore: slot.cutoffDaysBefore, price: slot.price, guestPrice: slot.guestPrice });
  const [busy, setBusy] = useState(false);
  const changed = f.cutoffTime !== slot.cutoffTime || Number(f.cutoffDaysBefore) !== slot.cutoffDaysBefore ||
    Number(f.price) !== slot.price || Number(f.guestPrice) !== slot.guestPrice;
  const input = "rounded-lg border px-2 py-1 text-sm w-24";
  const inputStyle = { background: "var(--input-bg)", borderColor: "var(--line)", color: "var(--ink)" };

  if (!isAdmin) {
    return (
      <tr className="border-t" style={{ borderColor: "var(--line)" }}>
        <td className="py-2 font-600">{slot.label}</td>
        <td>{hallCutoffLabel(slot)}</td>
        <td>{hallTaka(slot.price)}</td>
        <td>{hallTaka(slot.guestPrice)}</td>
      </tr>
    );
  }
  return (
    <tr className="border-t" style={{ borderColor: "var(--line)" }}>
      <td className="py-2 font-600">{slot.label}</td>
      <td>
        <div className="flex gap-1 items-center flex-wrap">
          <select className={input} style={inputStyle} value={f.cutoffDaysBefore} onChange={(e) => setF({ ...f, cutoffDaysBefore: Number(e.target.value) })}>
            <option value={0}>Same day</option><option value={1}>1 day before</option><option value={2}>2 days before</option><option value={3}>3 days before</option>
          </select>
          <input type="time" className={input} style={inputStyle} value={f.cutoffTime} onChange={(e) => setF({ ...f, cutoffTime: e.target.value })} />
        </div>
      </td>
      <td><input type="number" min="0" className={input} style={inputStyle} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></td>
      <td><input type="number" min="0" className={input} style={inputStyle} value={f.guestPrice} onChange={(e) => setF({ ...f, guestPrice: e.target.value })} /></td>
      <td>
        <button className="btn-gold px-3 py-1 rounded-lg text-xs" disabled={!changed || busy}
          onClick={async () => { setBusy(true); try { await onSave(slot.slot, f); } finally { setBusy(false); } }}>Save</button>
      </td>
    </tr>
  );
}

function HallMealTimes({ call, isAdmin, notify }) {
  const [slots, setSlots] = useState(null);
  const load = () => call("/api/hall/slots").then(setSlots).catch((e) => notify(e, true));
  useEffect(() => { load(); }, []);

  const save = async (slot, f) => {
    try {
      await call(`/api/hall/slots/${slot}`, { method: "PUT", body: { cutoffTime: f.cutoffTime, cutoffDaysBefore: Number(f.cutoffDaysBefore), price: Number(f.price), guestPrice: Number(f.guestPrice) } });
      notify("Saved");
      await load();
    } catch (e) { notify(e, true); }
  };

  return (
    <HallCard title="Meal times & prices">
      <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
        You can switch a meal on or off until its cut-off. After that it is locked and the meal is counted.
      </p>
      {!slots ? <p className="text-sm opacity-70">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead><tr style={{ color: "var(--ink-soft)" }}>
              <th className="py-1">Meal</th><th>Cut-off</th><th>Price</th><th>Guest price</th>{isAdmin && <th></th>}
            </tr></thead>
            <tbody>{slots.map((s) => <HallSlotRow key={s.slot + s.cutoffTime + s.price + s.guestPrice + s.cutoffDaysBefore} slot={s} isAdmin={isAdmin} onSave={save} />)}</tbody>
          </table>
        </div>
      )}
    </HallCard>
  );
}
Hall.register({ key: "times", label: "Meal times", order: 2, component: HallMealTimes });
