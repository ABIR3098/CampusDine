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

function HallSlotCard({ slot, isAdmin, onSave }) {
  const [f, setF] = useState({ cutoffTime: slot.cutoffTime, cutoffDaysBefore: slot.cutoffDaysBefore, price: slot.price, guestPrice: slot.guestPrice });
  const [busy, setBusy] = useState(false);
  const changed = f.cutoffTime !== slot.cutoffTime || Number(f.cutoffDaysBefore) !== slot.cutoffDaysBefore ||
    Number(f.price) !== slot.price || Number(f.guestPrice) !== slot.guestPrice;

  return (
    <div className="hl-tile">
      <div className="flex items-center gap-3">
        <span className="hl-ico" style={{ width: 44, height: 44, fontSize: 22, borderRadius: 14 }}>{HALL_SLOT_EMOJI[slot.slot]}</span>
        <div>
          <div className="font-display font-700 text-lg leading-tight">{slot.label}</div>
          <div className="text-xs hl-muted">⏳ Closes: {hallCutoffLabel(slot)}</div>
        </div>
      </div>

      {!isAdmin ? (
        <div className="hl-kv">
          <div><div className="k">Price</div><div className="v">{hallTaka(slot.price)}</div></div>
          <div><div className="k">Guest price</div><div className="v">{hallTaka(slot.guestPrice)}</div></div>
        </div>
      ) : (
        <div className="grid gap-3 mt-4">
          <div>
            <label className="hl-label">Cut-off</label>
            <div className="flex gap-2 flex-wrap">
              <select className="hl-input" style={{ flex: "1 1 120px" }} value={f.cutoffDaysBefore} onChange={(e) => setF({ ...f, cutoffDaysBefore: Number(e.target.value) })}>
                <option value={0}>Same day</option><option value={1}>1 day before</option><option value={2}>2 days before</option><option value={3}>3 days before</option>
              </select>
              <input type="time" className="hl-input" style={{ flex: "1 1 110px" }} value={f.cutoffTime} onChange={(e) => setF({ ...f, cutoffTime: e.target.value })} />
            </div>
            <HallCutoffPreview label={slot.label} daysBefore={f.cutoffDaysBefore} time={f.cutoffTime} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="hl-label">Price (৳)</label><input type="number" min="0" className="hl-input" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></div>
            <div><label className="hl-label">Guest price (৳)</label><input type="number" min="0" className="hl-input" value={f.guestPrice} onChange={(e) => setF({ ...f, guestPrice: e.target.value })} /></div>
          </div>
          <button className="hl-btn" disabled={!changed || busy}
            onClick={async () => { setBusy(true); try { await onSave(slot.slot, f); } finally { setBusy(false); } }}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      )}
    </div>
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
    <HallCard title="Meal times & prices" icon="⏰"
      sub="You can switch a meal on or off until its cut-off. After that it is locked and the meal is counted.">
      {!slots ? <div className="hl-empty">Loading…</div> : (
        <div className="hl-grid3">
          {slots.map((s) => <HallSlotCard key={s.slot + s.cutoffTime + s.price + s.guestPrice + s.cutoffDaysBefore} slot={s} isAdmin={isAdmin} onSave={save} />)}
        </div>
      )}
    </HallCard>
  );
}
Hall.register({ key: "times", label: "Meal times", icon: "⏰", order: 2, component: HallMealTimes });
