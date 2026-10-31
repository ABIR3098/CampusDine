// Admin Home: look at another day with ‹ and › instead of only today.

// "2026-10-29" + 1 → "2026-10-30"
function hallShiftDate(dateKey, n) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// "Today" / "Tomorrow" / "Yesterday", otherwise the plain date
function hallDayWord(dateKey, todayKey) {
  const diff = Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${todayKey}T00:00:00Z`)) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : hallDateLabel(dateKey);
}

function HallDayNav({ date, today, onChange }) {
  const word = hallDayWord(date, today);
  const label = hallDateLabel(date);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button className="hl-btn sm ghost" aria-label="Previous day" onClick={() => onChange(hallShiftDate(date, -1))}>‹</button>
      <span className="hl-chip">📅 {word === label ? label : `${word} · ${label}`}</span>
      <button className="hl-btn sm ghost" aria-label="Next day" onClick={() => onChange(hallShiftDate(date, 1))}>›</button>
      {date !== today && <button className="hl-btn sm ghost" onClick={() => onChange(today)}>Today</button>}
    </div>
  );
}
