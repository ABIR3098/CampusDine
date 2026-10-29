// Small charts drawn with plain divs (no library), so they also print cleanly.

// horizontal bars: rows = [{ key, label, value, text, color? }]
function HallHBars({ rows, color }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.key} style={{ marginBottom: 8 }}>
          <div className="flex justify-between text-xs"><span>{r.label}</span><b>{r.text}</b></div>
          <div style={{ height: 10, borderRadius: 6, overflow: "hidden", marginTop: 3, background: "var(--line)" }}>
            <div style={{ width: `${r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`, height: "100%", background: r.color || color || "var(--gold)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// one bar per day: days = [{ date, ... }], field = which number to draw, fmt = how to show it in the tooltip
function HallDayBars({ days, field, color, fmt }) {
  const show = fmt || String;
  const max = Math.max(1, ...days.map((d) => d[field]));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 90 }}>
        {days.map((d) => (
          <div key={d.date} title={`${hallDateLabel(d.date)}: ${show(d[field])}`}
            style={{ flex: 1, minWidth: 3, height: `${d[field] ? Math.max(4, (d[field] / max) * 100) : 1}%`, borderRadius: "3px 3px 0 0", background: d[field] ? color : "var(--line)" }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] hl-muted" style={{ marginTop: 3 }}>
        <span>{Number(days[0].date.slice(8))}</span><span>{Number(days[days.length - 1].date.slice(8))}</span>
      </div>
    </div>
  );
}
