// "My meals" tab: the next 7 days, three meals a day. Tap a meal to switch it ON / OFF until its cut-off.
// (step 3 showed the states; step 4 adds the tap-to-toggle and the countdown)

// "2026-10-22" → "Thu 22 Oct"
function hallDateLabel(key) {
  return new Date(key + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
// 200 → "3h 20m", 45 → "45m", 3000 → "2d 2h"
function hallClosesIn(mins) {
  if (mins >= 1440) return `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${Math.max(mins, 0)}m`;
}

function HallMealCell({ cell, busy, onToggle, maxGuests, onGuests }) {
  const on = cell.status === "on";
  return (
    <div>
    <button disabled={cell.locked || busy} onClick={onToggle}
      className="w-full rounded-lg border px-2 py-1.5 text-center text-xs transition"
      style={{
        cursor: cell.locked ? "not-allowed" : "pointer",
        ...(on
          ? { background: "var(--ok-bg)", color: "var(--ok-fg)", borderColor: "var(--ok-border)" }
          : { background: "var(--disabled-soft)", color: "var(--ink-soft)", borderColor: "var(--line)" }),
      }}>
      <div className="font-700 text-sm">{on ? "ON" : "OFF"}</div>
      <div className="opacity-80">
        {cell.locked ? "🔒 locked" : `closes in ${hallClosesIn(cell.closesInMinutes)}`}
      </div>
      {cell.feast && <div className="font-600 mt-0.5">🎉 {cell.feast.title}{cell.feast.extraPrice > 0 ? ` +${hallTaka(cell.feast.extraPrice)}` : ""}</div>}
    </button>
    {/* step 8: guest plates for this meal */}
    <div className="flex items-center justify-center gap-1 text-[11px] mt-1" style={{ color: "var(--ink-soft)" }}>
      <button className="px-1.5 rounded border" style={{ borderColor: "var(--line)" }} title="One guest less"
        disabled={cell.locked || busy || cell.guests <= 0} onClick={() => onGuests(cell.guests - 1)}>−</button>
      <span>👥 {cell.guests}</span>
      <button className="px-1.5 rounded border" style={{ borderColor: "var(--line)" }} title="One more guest"
        disabled={cell.locked || busy || cell.guests >= maxGuests} onClick={() => onGuests(cell.guests + 1)}>+</button>
    </div>
    </div>
  );
}

function HallMyMeals({ call, notify }) {
  const [data, setData] = useState(null);
  const [slots, setSlots] = useState([]);
  const [busyKey, setBusyKey] = useState(null);
  const [onlyThisDay, setOnlyThisDay] = useState(false);

  const load = async (quiet) => {
    try {
      const [m, s] = await Promise.all([call("/api/hall/meals"), call("/api/hall/slots")]);
      setData(m); setSlots(s);
    } catch (e) { if (!quiet) notify(e, true); }
  };
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60000); // keeps the countdowns and locks fresh
    return () => clearInterval(t);
  }, []);

  const setGuests = async (date, slot, count) => {
    const label = (slots.find((s) => s.slot === slot) || {}).label || slot;
    setBusyKey(date + slot);
    try {
      await call(`/api/hall/guests/${date}/${slot}`, { method: "PUT", body: { count } });
      notify(count ? `${count} guest(s) for ${label} on ${hallDateLabel(date)}` : `No guests for ${label} on ${hallDateLabel(date)}`);
    } catch (e) { notify(e, true); }
    setBusyKey(null);
    await load(true);
  };

  const toggle = async (date, slot) => {
    const cell = data.days.find((d) => d.date === date).slots[slot];
    const next = cell.status === "on" ? "off" : "on";
    const label = (slots.find((s) => s.slot === slot) || {}).label || slot;
    setBusyKey(date + slot);
    try {
      await call(`/api/hall/meals/${date}/${slot}`, { method: "PUT", body: { status: next, onlyThisDay } });
      notify(`${label} on ${hallDateLabel(date)} is now ${next.toUpperCase()}` + (onlyThisDay ? " (this day only)." : " — and stays that way for the days after, until you change it."));
    } catch (e) { notify(e, true); }
    setBusyKey(null);
    await load(true);
  };

  return (
    <HallCard title="My meals — next 7 days">
      <p className="text-sm mb-2" style={{ color: "var(--ink-soft)" }}>
        Tap a meal to switch it on or off before it closes. If you do nothing, a meal stays the way you last set it.
        Use 👥 − / + to book guest plates (paid at the guest price).
      </p>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={onlyThisDay} onChange={(e) => setOnlyThisDay(e.target.checked)} />
        Change only that one day (don't carry it to the days after)
      </label>
      {!data ? <p className="text-sm opacity-70">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderSpacing: "0 6px", borderCollapse: "separate" }}>
            <thead><tr style={{ color: "var(--ink-soft)" }}>
              <th className="text-left font-600 pr-2">Day</th>
              {slots.map((s) => <th key={s.slot} className="font-600 px-1">{s.label}</th>)}
            </tr></thead>
            <tbody>
              {data.days.map((day) => (
                <tr key={day.date}>
                  <td className="pr-2 whitespace-nowrap font-600">
                    {hallDateLabel(day.date)}{day.date === data.today && <span className="ml-1 text-[11px] opacity-70">(today)</span>}
                  </td>
                  {slots.map((s) => (
                    <td key={s.slot} className="px-1">
                      <HallMealCell cell={day.slots[s.slot]} busy={busyKey === day.date + s.slot} onToggle={() => toggle(day.date, s.slot)}
                        maxGuests={data.maxGuests} onGuests={(n) => setGuests(day.date, s.slot, n)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HallCard>
  );
}
Hall.register({ key: "meals", label: "My meals", order: 3, roles: ["student", "teacher"], component: HallMyMeals });
