// Step 3 — "My meals" tab: the next 7 days, three meals a day, ON / OFF for each (read-only here;
// step 4 adds the buttons).

// "2026-10-22" → "Thu 22 Oct"
function hallDateLabel(key) {
  return new Date(key + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function HallMealCell({ cell }) {
  const on = cell.status === "on";
  return (
    <div className="rounded-lg border px-2 py-1.5 text-center text-xs"
      style={on
        ? { background: "var(--ok-bg)", color: "var(--ok-fg)", borderColor: "var(--ok-border)" }
        : { background: "var(--disabled-soft)", color: "var(--ink-soft)", borderColor: "var(--line)" }}>
      <div className="font-700 text-sm">{on ? "ON" : "OFF"}</div>
      <div className="opacity-80">
        {cell.locked ? "🔒 locked" : cell.source === "manual" ? "you chose" : "same as before"}
      </div>
    </div>
  );
}

function HallMyMeals({ call, notify }) {
  const [data, setData] = useState(null);
  const [slots, setSlots] = useState([]);
  const load = async () => {
    try {
      const [m, s] = await Promise.all([call("/api/hall/meals"), call("/api/hall/slots")]);
      setData(m); setSlots(s);
    } catch (e) { notify(e, true); }
  };
  useEffect(() => { load(); }, []);

  return (
    <HallCard title="My meals — next 7 days">
      <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
        If you do nothing, a meal stays the way you last set it.
      </p>
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
                  {slots.map((s) => <td key={s.slot} className="px-1"><HallMealCell cell={day.slots[s.slot]} /></td>)}
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
