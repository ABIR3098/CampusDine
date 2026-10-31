// Step 6 — "Menu" tab: the fixed weekly menu, 7 days x 3 meals. Admin can edit any cell.
const HALL_WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5]; // Saturday first

function HallMenuCell({ value, isAdmin, onSave }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  if (!isAdmin) return <div className="font-600">{value || "—"}</div>;
  return (
    <input className="hl-input" value={text} maxLength={255} onChange={(e) => setText(e.target.value)}
      onBlur={() => { if (text.trim() && text.trim() !== value) onSave(text.trim()); else setText(value); }} />
  );
}

function HallMenu({ call, isAdmin, notify }) {
  const [menu, setMenu] = useState(null);
  const [today, setToday] = useState(null); // today's weekday, 0 = Sunday
  const [refreshing, setRefreshing] = useState(false);
  const load = async () => {
    setRefreshing(true);
    try {
      const [m, info] = await Promise.all([call("/api/hall/menu"), call("/api/hall/info")]);
      setMenu(m.days);
      setToday(hallDow(info.today));
    } catch (e) { notify(e, true); }
    finally { setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);

  const save = async (dow, slot, items) => {
    try { await call(`/api/hall/menu/${dow}/${slot}`, { method: "PUT", body: { items } }); notify("Menu saved"); }
    catch (e) { notify(e, true); }
    await load();
  };

  return (
    <HallCard title="Weekly menu" icon="📋"
      right={!isAdmin && <button className="hl-btn sm ghost" onClick={load} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh menu"}</button>}
      sub={`The same every week.${isAdmin ? " Click a meal, change the text and click outside to save." : ""}`}>
      {!menu ? <div className="hl-empty">Loading…</div> : (
        <div className="hl-week">
          {HALL_WEEK_ORDER.map((dow) => {
            const day = menu.find((d) => d.dow === dow);
            return (
              <div key={dow} className={`hl-dayc ${dow === today ? "today" : ""}`}>
                <div className="hl-dayc-head font-display">
                  <span>{day.name}</span>
                  {dow === today && <span className="text-[11px] font-800 uppercase tracking-wide">Today</span>}
                </div>
                {HALL_SLOTS.map((s) => (
                  <div key={s} className="hl-dayc-row">
                    <span className="em">{HALL_SLOT_EMOJI[s]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="tl">{HALL_SLOT_LABEL[s]}</div>
                      <HallMenuCell value={day.slots[s]} isAdmin={isAdmin} onSave={(items) => save(dow, s, items)} />
                      {isAdmin && <HallMenuCopyButton call={call} notify={notify} slot={s} dow={dow} items={day.slots[s]} onDone={load} />}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </HallCard>
  );
}
Hall.register({ key: "menu", label: "Menu", icon: "📋", order: 4, component: HallMenu });
