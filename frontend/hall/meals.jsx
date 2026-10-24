// "My meals" tab: the next 7 days, three meals a day. Switch a meal ON / OFF until its cut-off.
// The data logic lives in useHallMeals so the Home tab can use the very same switches.

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
// the weekly-menu text for a date + meal ("" while the menu is loading)
function hallMenuFor(menu, dateKey, slot) {
  const day = menu && menu.find((d) => d.dow === hallDow(dateKey));
  return day ? day.slots[slot] : "";
}

function useHallMeals(call, notify) {
  const [data, setData] = useState(null);
  const [slots, setSlots] = useState([]);
  const [menu, setMenu] = useState(null);
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
    call("/api/hall/menu").then((r) => setMenu(r.days)).catch(() => {});
    const t = setInterval(() => load(true), 60000); // keeps the countdowns and locks fresh
    return () => clearInterval(t);
  }, []);

  const setGuests = async (date, slot, count) => {
    const label = HALL_SLOT_LABEL[slot] || slot;
    setBusyKey(date + slot);
    try {
      await call(`/api/hall/guests/${date}/${slot}`, { method: "PUT", body: { count } });
      notify(count ? `${count} guest(s) for ${label} on ${hallDateLabel(date)}` : `No guests for ${label} on ${hallDateLabel(date)}`);
    } catch (e) { notify(e, true); }
    setBusyKey(null);
    await load(true);
    window.dispatchEvent(new Event("hall-changed"));
  };

  const toggle = async (date, slot) => {
    const cell = data.days.find((d) => d.date === date).slots[slot];
    const next = cell.status === "on" ? "off" : "on";
    const label = HALL_SLOT_LABEL[slot] || slot;
    setBusyKey(date + slot);
    try {
      await call(`/api/hall/meals/${date}/${slot}`, { method: "PUT", body: { status: next, onlyThisDay } });
      notify(`${label} on ${hallDateLabel(date)} is now ${next.toUpperCase()}` + (onlyThisDay ? " (this day only)." : " — and stays that way for the days after, until you change it."));
    } catch (e) { notify(e, true); }
    setBusyKey(null);
    await load(true);
    window.dispatchEvent(new Event("hall-changed"));
  };

  return { data, slots, menu, busyKey, onlyThisDay, setOnlyThisDay, toggle, setGuests };
}

// One meal: picture, what is cooked, price, ON/OFF switch, closing time and guest plates
function HallMealCard({ slot, cell, items, price, busy, onToggle, maxGuests, onGuests }) {
  const on = cell.status === "on";
  return (
    <div className={`hl-meal ${on ? "on" : ""}`}>
      <div className="hl-meal-img">
        <img src={hallFoodImg(items, slot)} alt="" loading="lazy" onError={(e) => { e.target.style.display = "none"; }} />
        <span className="hl-meal-slot">{HALL_SLOT_EMOJI[slot]} {HALL_SLOT_LABEL[slot]}</span>
        {cell.feast && <span className="hl-meal-feast">🎉 {cell.feast.title}</span>}
      </div>
      <div className="hl-meal-body">
        <div className="hl-meal-info">
          <div className="hl-meal-items font-display">{items || "—"}</div>
          {price != null && <div className="text-xs hl-muted mt-1">{hallTaka(price)} per plate{cell.feast && cell.feast.extraPrice > 0 ? ` + ${hallTaka(cell.feast.extraPrice)} feast` : ""}</div>}
        </div>
        <div className="hl-meal-row">
          <div className="hl-meal-state">
            <b>{on ? "Meal is ON" : "Meal is OFF"}</b>
            {cell.locked ? "🔒 Locked — can't change" : `⏳ Closes in ${hallClosesIn(cell.closesInMinutes)}`}
          </div>
          <HallSwitch on={on} disabled={cell.locked || busy} onChange={onToggle} label={`${HALL_SLOT_LABEL[slot]} ${on ? "on" : "off"}`} />
        </div>
        <div className="hl-guests">
          <span>👥 Guest plates</span>
          <span className="hl-step">
            <button type="button" title="One guest less" disabled={cell.locked || busy || cell.guests <= 0} onClick={() => onGuests(cell.guests - 1)}>−</button>
            <span>{cell.guests}</span>
            <button type="button" title="One more guest" disabled={cell.locked || busy || cell.guests >= maxGuests} onClick={() => onGuests(cell.guests + 1)}>+</button>
          </span>
        </div>
      </div>
    </div>
  );
}

function HallMyMeals({ call, notify }) {
  const m = useHallMeals(call, notify);
  const { data } = m;
  const [sel, setSel] = useState(null);
  const selDate = sel || (data && data.today);
  const day = data && data.days.find((d) => d.date === selDate);

  return (
    <HallCard title="My meals — next 7 days" icon="🍽"
      sub="Pick a day, then switch each meal ON or OFF before it closes. If you do nothing, a meal stays the way you last set it. Guest plates are paid at the guest price.">
      {!data ? <div className="hl-empty">Loading…</div> : (
        <>
          <div className="hl-days">
            {data.days.map((d) => {
              const dt = new Date(d.date + "T00:00:00Z");
              return (
                <button key={d.date} type="button" onClick={() => setSel(d.date)} className={`hl-day ${d.date === selDate ? "sel" : ""}`}>
                  <div className="dn">{dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</div>
                  <div className="dd font-display">{dt.getUTCDate()}</div>
                  <div className="dm">{dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</div>
                  <div className="dots">{HALL_SLOTS.map((s) => <i key={s} className={`${d.slots[s].status === "on" ? "on" : ""} ${d.slots[s].locked ? "lock" : ""}`} />)}</div>
                  {d.date === data.today && <span className="hl-today-tag">Today</span>}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] hl-muted mb-3 text-center">● dots = breakfast · lunch · dinner (filled colour = ON)</div>

          <div className="hl-opt">
            <HallSwitch small on={m.onlyThisDay} onChange={m.setOnlyThisDay} label="Change only that one day" />
            <span>Change <b>only that one day</b> <span className="hl-muted">(don't carry it to the days after)</span></span>
          </div>

          {day && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-display font-700">{hallDateLabel(day.date)}</h3>
                {day.date === data.today && <span className="hl-chip">Today</span>}
              </div>
              <div className="hl-meals">
                {HALL_SLOTS.map((s) => (
                  <HallMealCard key={s} slot={s} cell={day.slots[s]} items={hallMenuFor(m.menu, day.date, s)}
                    price={(m.slots.find((x) => x.slot === s) || {}).price} busy={m.busyKey === day.date + s}
                    onToggle={() => m.toggle(day.date, s)} maxGuests={data.maxGuests} onGuests={(n) => m.setGuests(day.date, s, n)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </HallCard>
  );
}
Hall.register({ key: "meals", label: "My meals", icon: "🍽", order: 3, roles: ["student", "teacher"], component: HallMyMeals });
