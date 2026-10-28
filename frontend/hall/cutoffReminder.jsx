// Home: reminder for meals that are about to close ("Dinner closes in 40m — it is ON").
// It also offers browser notifications, which work while the Hall page is open in a tab.

// days = data.days from GET /api/hall/meals → today's and tomorrow's open meals closing within `withinMinutes`
function hallClosingSoon(days, withinMinutes) {
  const limit = withinMinutes || 120;
  const out = [];
  (days || []).slice(0, 2).forEach((d) => HALL_SLOTS.forEach((slot) => {
    const c = d.slots[slot];
    if (c && !c.locked && c.closesInMinutes != null && c.closesInMinutes > 0 && c.closesInMinutes <= limit) {
      out.push({ key: d.date + "|" + slot, date: d.date, slot, status: c.status, mins: c.closesInMinutes });
    }
  }));
  return out.sort((a, b) => a.mins - b.mins);
}

function HallReminderBanner({ soon, todayKey, goTab }) {
  return (
    <div className="hl-banner" style={{ background: "var(--warn-bg)", borderColor: "var(--warn-border)", display: "block" }}>
      <div className="font-700 text-sm mb-1">⏰ Closing soon</div>
      {soon.map((x) => (
        <div key={x.key} className="flex items-center justify-between gap-2 flex-wrap text-sm" style={{ marginTop: 6 }}>
          <span>
            {HALL_SLOT_EMOJI[x.slot]} <b>{HALL_SLOT_LABEL[x.slot]}</b> {x.date === todayKey ? "today" : "tomorrow"} closes in <b>{hallClosesIn(x.mins)}</b>
            {" · "}it is <b>{x.status.toUpperCase()}</b>
          </span>
          <button className="hl-btn sm ghost" onClick={() => goTab("meals")}>Change</button>
        </div>
      ))}
    </div>
  );
}

function HallCutoffReminder({ days, goTab }) {
  const soon = hallClosingSoon(days);
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [perm, setPerm] = useState(supported ? Notification.permission : "denied");
  const keys = soon.map((x) => x.key).join(",");

  // one browser notification per meal (remembered in localStorage so a refresh doesn't repeat it)
  useEffect(() => {
    if (perm !== "granted") return;
    soon.forEach((x) => {
      const mark = "hall_reminded_" + x.key;
      try {
        if (localStorage.getItem(mark)) return;
        localStorage.setItem(mark, "1");
        new Notification(`${HALL_SLOT_LABEL[x.slot]} closes in ${hallClosesIn(x.mins)}`, {
          body: `It is ${x.status.toUpperCase()} for you. Change it now if your plan has changed.`,
        });
      } catch (e) { /* notifications blocked or storage full — the banner still shows */ }
    });
  }, [keys, perm]);

  return (
    <>
      {soon.length > 0 && <HallReminderBanner soon={soon} todayKey={days[0].date} goTab={goTab} />}
      {supported && perm === "default" && (
        <div className="text-right" style={{ marginBottom: 12 }}>
          <button className="hl-btn sm ghost" onClick={() => Notification.requestPermission().then(setPerm)}>🔔 Get cut-off alerts</button>
        </div>
      )}
    </>
  );
}
