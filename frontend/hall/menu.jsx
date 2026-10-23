// Step 6 — "Menu" tab: the fixed weekly menu, 7 days x 3 meals. Admin can edit any cell.
const HALL_WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // Saturday first

function HallMenuCell({ value, isAdmin, onSave }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  if (!isAdmin) return <>{value || "—"}</>;
  return (
    <input className="rounded-lg border px-2 py-1 text-sm w-full" style={{ background: "var(--input-bg)", borderColor: "var(--line)", color: "var(--ink)", minWidth: 150 }}
      value={text} maxLength={255} onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text.trim() && text.trim() !== value) onSave(text.trim()); else setText(value); }} />
  );
}

function HallMenu({ call, isAdmin, notify }) {
  const [menu, setMenu] = useState(null);
  const [today, setToday] = useState(null); // today's weekday, 0 = Sunday
  const load = async () => {
    try {
      const [m, info] = await Promise.all([call("/api/hall/menu"), call("/api/hall/info")]);
      setMenu(m.days);
      setToday(new Date(info.today + "T00:00:00Z").getUTCDay());
    } catch (e) { notify(e, true); }
  };
  useEffect(() => { load(); }, []);

  const save = async (dow, slot, items) => {
    try { await call(`/api/hall/menu/${dow}/${slot}`, { method: "PUT", body: { items } }); notify("Menu saved"); }
    catch (e) { notify(e, true); }
    await load();
  };

  return (
    <HallCard title="Weekly menu">
      <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
        The same every week.{isAdmin ? " Click a meal, change the text and click outside to save." : ""}
      </p>
      {!menu ? <p className="text-sm opacity-70">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead><tr style={{ color: "var(--ink-soft)" }}><th className="py-1">Day</th>{HALL_SLOTS.map((s) => <th key={s}>{HALL_SLOT_LABEL[s]}</th>)}</tr></thead>
            <tbody>
              {HALL_WEEK_ORDER.map((dow) => {
                const day = menu.find((d) => d.dow === dow);
                return (
                  <tr key={dow} className="border-t align-top" style={{ borderColor: "var(--line)", background: dow === today ? "var(--gold-soft)" : "transparent" }}>
                    <td className="py-2 pr-2 font-600 whitespace-nowrap">{day.name}{dow === today && <span className="ml-1 text-[11px] opacity-70">(today)</span>}</td>
                    {HALL_SLOTS.map((s) => (
                      <td key={s} className="py-1 pr-2"><HallMenuCell value={day.slots[s]} isAdmin={isAdmin} onSave={(items) => save(dow, s, items)} /></td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </HallCard>
  );
}
Hall.register({ key: "menu", label: "Menu", order: 4, component: HallMenu });
