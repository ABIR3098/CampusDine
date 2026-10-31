// Finance: how this month compares with the one before ("↑ 12% vs last month").

// → { text, tone } ; tone "good" / "bad" depends on whether more is good (income) or bad (expenses)
function hallDelta(now, before, moreIsGood) {
  if (!before) return { text: before === 0 && now > 0 ? "new vs last month" : "no data last month", tone: "" };
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { text: "same as last month", tone: "" };
  const up = pct > 0;
  return { text: `${up ? "↑" : "↓"} ${Math.abs(pct)}% vs last month`, tone: up === moreIsGood ? "ok" : "warn" };
}

// the month before { year, month }
function hallPrevMonth(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

// data / prev = GET /api/hall/finance/summary for this month and last month (prev may be null)
function HallFinanceCompare({ data, prev }) {
  if (!prev) return null;
  const rows = [
    { key: "plates", label: "Plates", now: data.plates, before: prev.plates, good: true },
    { key: "billed", label: "Billed", now: data.billed, before: prev.billed, good: true },
    { key: "collected", label: "Collected", now: data.collected, before: prev.collected, good: true },
    { key: "expense", label: "Expenses", now: data.expense.total, before: prev.expense.total, good: false },
  ];
  return (
    <div className="flex gap-2 flex-wrap" style={{ marginBottom: 14 }}>
      {rows.map((r) => {
        const d = hallDelta(r.now, r.before, r.good);
        return <span key={r.key} className={`hl-chip ${d.tone}`}>{r.label}: {d.text}</span>;
      })}
    </div>
  );
}
