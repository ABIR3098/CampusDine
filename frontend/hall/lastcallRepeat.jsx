// Last call (admin): fill the form from the last time, in one tap.

// items = GET /api/hall/lastcall/manage items (newest first) → the latest one from an earlier day, or null
function hallLastCallToRepeat(items, today) {
  return (items || []).find((i) => i.date < today) || null;
}

function HallLastCallRepeat({ items, today, onPick }) {
  const last = hallLastCallToRepeat(items, today);
  if (!last) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <button className="hl-btn sm ghost" onClick={() => onPick(last)}>
        ↻ Repeat last time: {last.label}, {last.plates} plates at {hallTaka(last.price)}
      </button>
    </div>
  );
}
