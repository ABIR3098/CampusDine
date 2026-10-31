// Hall core: shared helpers + small UI pieces (card, ON/OFF switch, hero slider), the page shell
// (top bar, hero, tabs) and the Hall home tab. Styles are in hall/hall.css.
// Naming rule: every top-level name in hall/*.jsx is shared, so keep names unique across files.
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const HALL_SLOTS = ["breakfast", "lunch", "dinner"];
const HALL_SLOT_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const HALL_SLOT_EMOJI = { breakfast: "🌅", lunch: "☀️", dinner: "🌙" };
const hallTaka = (n) => "৳" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

// Picks one of the food pictures in /images/food from the words of a menu line ("Rice, Dal, Fish curry" → fish-curry)
function hallFoodImg(text, slot) {
  const t = String(text || "").toLowerCase();
  const rules = [["tehari", "tehari"], ["biryani", "chicken-biryani"], ["khichuri", "khichuri"], ["porota", "porota-vaji"], ["ruti", "porota-vaji"],
    ["beef", "beef-bhuna"], ["fish", "fish-curry"], ["egg", "egg-curry"], ["chicken", "chicken-biryani"], ["veg", "mixed-veg-rice"], ["polao", "chicken-biryani"]];
  const hit = rules.find(([k]) => t.includes(k));
  return `/images/food/${hit ? hit[1] : slot === "breakfast" ? "porota-vaji" : "rice-dal"}.svg`;
}

const hallDow = (dateKey) => new Date(dateKey + "T00:00:00Z").getUTCDay(); // 0 = Sunday

// ---------- small shared UI ----------
function HallCard({ title, children, right, icon, sub }) {
  return (
    <section className="hl-sec">
      {(title || right) && (
        <div className="hl-sec-head">
          <h2 className="hl-sec-title font-display">{icon && <span className="hl-ico">{icon}</span>}{title}</h2>
          {right}
        </div>
      )}
      {sub && <p className="hl-sub">{sub}</p>}
      {children}
    </section>
  );
}

// The ON / OFF button (a real switch: tap, and the knob slides)
function HallSwitch({ on, onChange, disabled, small, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={label || (on ? "ON" : "OFF")} disabled={disabled}
      onClick={() => onChange && onChange(!on)} className={`hl-switch ${on ? "on" : ""} ${small ? "sm" : ""}`}>
      <span className="t">{on ? "ON" : "OFF"}</span><span className="k" />
    </button>
  );
}

function HallStat({ label, value, sub, icon }) {
  return (
    <div className="hl-stat">
      {icon && <span className="hl-ico">{icon}</span>}
      <div className="min-w-0">
        <div className="l">{label}</div>
        <div className="v font-display">{value}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
    </div>
  );
}

// ---------- hero slider (same idea as the restaurants' offer slider) ----------
// slides: [{ key, tag, title, text, cta?, onCta?, img?, tone? }]
const HALL_TONES = {
  green: "linear-gradient(135deg, var(--teal) 0%, var(--teal-deep) 100%)",
  warm: "linear-gradient(135deg, #F59E0B 0%, #B45309 100%)",
  rose: "linear-gradient(135deg, #E11D48 0%, #881337 100%)",
  blue: "linear-gradient(135deg, #2563EB 0%, #1E3A8A 100%)",
  violet: "linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)",
};
function HallHero({ slides }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const n = slides.length;
  useEffect(() => { if (i >= n) setI(0); }, [n]);
  useEffect(() => {
    if (n < 2 || paused) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 5000);
    return () => clearInterval(t);
  }, [n, paused]);
  if (n === 0) return null;
  const go = (d) => setI((x) => (x + d + n) % n);
  return (
    <div className="hl-hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}>
      <div className="hl-hero-track" style={{ width: `${n * 100}%`, transform: `translateX(-${(i * 100) / n}%)` }}>
        {slides.map((sl) => (
          <div key={sl.key} className="hl-hero-slide" style={{ width: `${100 / n}%`, background: HALL_TONES[sl.tone] || HALL_TONES.green }}>
            <div className="hl-hero-copy">
              <span className="hl-hero-tag">{sl.tag}</span>
              <div className="hl-hero-title font-display">{sl.title}</div>
              {sl.text && <div className="hl-hero-text">{sl.text}</div>}
              {sl.cta && <button type="button" className="hl-hero-cta" onClick={sl.onCta}>{sl.cta}</button>}
            </div>
            {sl.img && <img className="hl-hero-img" src={sl.img} alt="" onError={(e) => { e.target.style.display = "none"; }} />}
          </div>
        ))}
      </div>
      {n > 1 && (
        <>
          <button type="button" aria-label="Previous" className="hl-hero-arrow" style={{ left: 10 }} onClick={() => go(-1)}>‹</button>
          <button type="button" aria-label="Next" className="hl-hero-arrow" style={{ right: 10 }} onClick={() => go(1)}>›</button>
          <div className="hl-hero-dots">
            {slides.map((sl, k) => <button type="button" key={sl.key} aria-label={"Slide " + (k + 1)} onClick={() => setI(k)} style={{ width: k === i ? 18 : 6, opacity: k === i ? 1 : 0.5 }} />)}
          </div>
        </>
      )}
    </div>
  );
}

// Collects what the hero shows: today's three meals, a "closing soon" warning, upcoming feasts and a week summary.
// Reloads when the tab changes and whenever a meal is switched (meals.jsx fires "hall-changed").
function useHallHeroSlides(call, user, goTab, refreshKey) {
  const [d, setD] = useState({});
  const isMember = user.role !== "admin";
  useEffect(() => {
    let dead = false;
    const safe = (p) => p.catch(() => null);
    const load = async () => {
      const [info, menu, feasts, meals, slots] = await Promise.all([
        safe(call("/api/hall/info")), safe(call("/api/hall/menu")), safe(call("/api/hall/feasts")),
        isMember ? safe(call("/api/hall/meals")) : Promise.resolve(null), safe(call("/api/hall/slots")),
      ]);
      if (!dead) setD({ info, menu, feasts, meals, slots });
    };
    load();
    const onChange = () => load();
    window.addEventListener("hall-changed", onChange);
    return () => { dead = true; window.removeEventListener("hall-changed", onChange); };
  }, [refreshKey]);

  return useMemo(() => {
    const { info, menu, feasts, meals, slots } = d;
    const out = [];
    const today = info && info.today;
    const todayCells = meals && today ? (meals.days.find((x) => x.date === today) || {}).slots : null;

    if (meals) { // member: the meal that closes first, within a day
      let soon = null;
      meals.days.forEach((day) => HALL_SLOTS.forEach((s) => {
        const c = day.slots[s];
        if (c && !c.locked && c.closesInMinutes <= 1440 && (!soon || c.closesInMinutes < soon.c.closesInMinutes)) soon = { c, date: day.date, slot: s };
      }));
      if (soon) out.push({
        key: "soon", tone: "warm", tag: "⏰ Closing soon",
        title: `${HALL_SLOT_LABEL[soon.slot]} closes in ${hallClosesIn(soon.c.closesInMinutes)}`,
        text: `${hallDateLabel(soon.date)} · it is ${soon.c.status.toUpperCase()} for you right now. Change it before it locks.`,
        cta: "Change now", onCta: () => goTab("meals"), img: "/images/food/" + (soon.slot === "breakfast" ? "porota-vaji" : "rice-dal") + ".svg",
      });
    }
    if (menu && today) {
      const day = menu.days.find((x) => x.dow === hallDow(today));
      const tones = { breakfast: "green", lunch: "blue", dinner: "violet" };
      const todays = HALL_SLOTS.filter((s) => day && day.slots[s]).map((s) => {
        const c = todayCells && todayCells[s];
        const price = slots && (slots.find((x) => x.slot === s) || {}).price;
        const bits = [];
        if (price != null) bits.push(`${hallTaka(price)} per plate`);
        if (c) bits.push((c.status === "on" ? "✅ ON" : "⛔ OFF") + (c.locked ? " · locked" : ` · closes in ${hallClosesIn(c.closesInMinutes)}`));
        return {
          locked: !!(c && c.locked), key: "t" + s, tone: tones[s], tag: `${HALL_SLOT_EMOJI[s]} Today · ${HALL_SLOT_LABEL[s]}`,
          title: day.slots[s], text: bits.join("  ·  "), img: hallFoodImg(day.slots[s], s),
          cta: c && !c.locked ? "Change" : null, onCta: () => goTab("meals"),
        };
      });
      todays.sort((a, b) => Number(a.locked) - Number(b.locked)).forEach((x) => out.push(x));
    }
    (feasts || []).slice(0, 2).forEach((x) => out.push({
      key: "f" + x.id, tone: "rose", tag: "🎉 Feast", title: x.title,
      text: `${hallDateLabel(x.date)} · ${HALL_SLOT_LABEL[x.slot]} — ${x.items}`, img: hallFoodImg(x.items, x.slot),
    }));
    if (meals) {
      let on = 0, total = 0;
      meals.days.forEach((day) => HALL_SLOTS.forEach((s) => { total++; if (day.slots[s].status === "on") on++; }));
      out.push({ key: "week", tone: "blue", tag: "📅 Next 7 days", title: `${on} of ${total} meals are ON`,
        text: "Tap a meal to switch it on or off before it closes.", cta: "Manage meals", onCta: () => goTab("meals") });
    }
    return out;
  }, [d]);
}

// ---------- top bar (same bar as the restaurants: logo, tabs, theme, avatar, log out) ----------
function HallTopBar({
  user, tabs, active, setActive, onLogout, ui,
  sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen,
  searchTerm, setSearchTerm
}) {
  const filteredTabs = tabs.filter(t => !searchTerm || t.label.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <>
      {/* ─── 1. BUP PORTAL STYLE VERTICAL SIDEBAR FOR HALL ─── */}
      <aside className={`portal-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileMenuOpen ? "mobile-open" : ""}`}>
        {/* Brand & Toggle Header */}
        <div className="portal-sidebar-head">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span role="img" aria-label="CampusDine logo" className="cd-logo shrink-0"></span>
            {!sidebarCollapsed && (
              <div className="leading-tight">
                <span className="font-display gold-text font-800 text-base tracking-tight block">Hall Dining</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Student Portal</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? "Expand Menu" : "Collapse Menu"}
            className="w-8 h-8 rounded-xl border grid place-items-center text-xs hover:bg-black/5 transition-colors shrink-0"
            style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            {sidebarCollapsed ? "▶" : "◀"}
          </button>
        </div>

        {/* Sidebar Search Bar */}
        {!sidebarCollapsed && (
          <div className="portal-search-box">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs opacity-50">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search hall..."
                className="portal-search-input"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Vertical Tab Navigation List */}
        <nav className="portal-nav-list no-scrollbar">
          {filteredTabs.map(t => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActive(t.key);
                  if (setMobileMenuOpen) setMobileMenuOpen(false);
                }}
                title={t.label}
                aria-label={t.label}
                className={`portal-nav-item ${isActive ? "active" : ""}`}>
                <span className="portal-nav-icon font-emoji" style={{ fontSize: 16 }}>
                  {t.icon || "•"}
                </span>
                <span className="portal-nav-label">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Bottom Status */}
        {!sidebarCollapsed && (
          <div className="p-3 border-t flex items-center justify-between text-xs" style={{ borderColor: "var(--line)", color: "var(--ink-soft)" }}>
            <div className="flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Hall Resident</span>
            </div>
            <span className="text-[10px] font-mono opacity-60">Meal Active</span>
          </div>
            </button>
          </div>
        </div>
      </div>
      <div className="mobile-nav sm:hidden">{renderTabs(mobRef)}</div>
    </>
  );
}

// ---------- Home tab ----------
function HallMemberHome({ call, user, notify, goTab }) {
  const m = useHallMeals(call, notify);
  const today = m.data && m.data.today;
  const cells = m.data && m.data.days.find((d) => d.date === today);
  const first = String(user.name || "").split(" ")[0];
  return (
    <>
      <div className="hl-greet">
        <div>
          <div className="font-display font-800 text-xl">Hello, {first} 👋</div>
          <div className="text-sm hl-muted">Here are today's meals — switch any of them on or off until it closes.</div>
        </div>
        {today && <span className="hl-chip">📅 {hallDateLabel(today)}</span>}
      </div>
      <HallHomeAlerts call={call} goTab={goTab} days={m.data && m.data.days} />
      {!cells ? (m.error ? <div className="hl-error">⚠️ {m.error}</div> : <div className="hl-empty">Loading…</div>) : (
        <div className="hl-meals">
          {HALL_SLOTS.map((s) => (
            <HallMealCard key={s} slot={s} cell={cells.slots[s]} items={hallMenuFor(m.menu, today, s)}
              price={(m.slots.find((x) => x.slot === s) || {}).price} busy={m.busyKey === today + s}
              onToggle={() => m.toggle(today, s)} maxGuests={m.data.maxGuests} onGuests={(n) => m.setGuests(today, s, n)} />
          ))}
        </div>
      )}
      <div className="mt-4 text-center">
        <button className="hl-btn ghost" onClick={() => goTab("meals")}>See the next 7 days →</button>
      </div>
      <HallSavingsCard call={call} />
    </>
  );
}

function HallAdminHome({ call, user, notify, goTab }) {
  const [day, setDay] = useState(null);
  const [err, setErr] = useState(null);
  const [date, setDate] = useState(null);   // null = today
  const [today, setToday] = useState(null);
  useEffect(() => {
    setDay(null); setErr(null);
    call("/api/hall/report/day" + (date ? `?date=${date}` : ""))
      .then((r) => { setDay(r); if (!date) setToday(r.date); })
      .catch((e) => { setErr(e.message || String(e)); notify(e, true); });
  }, [date]);
  return (
    <>
      <div className="hl-greet">
        <div>
          <div className="font-display font-800 text-xl">Hello, {String(user.name || "").split(" ")[0]} 👋</div>
          <div className="text-sm hl-muted">Today's plates at a glance.</div>
        </div>
        {day && today && <HallDayNav date={day.date} today={today} onChange={setDate} />}
      </div>
      <HallAdminChips call={call} goTab={goTab} />
      {!day ? (err ? <div className="hl-error">⚠️ {err}</div> : <div className="hl-empty">Loading…</div>) : (
        <div className="hl-grid3">
          {day.slots.map((s) => (
            <div key={s.slot} className="hl-tile">
              <div className="flex items-center justify-between">
                <div className="font-700">{HALL_SLOT_EMOJI[s.slot]} {s.label}</div>
                <span className={`hl-chip ${s.locked ? "plain" : "ok"}`}>{s.locked ? "🔒 final" : "open"}</span>
              </div>
              <div className="hl-big font-display my-2" style={{ color: "var(--gold-deep)" }}>{s.plates}</div>
              <div className="text-xs hl-muted">plates = {s.on} ON + {s.guests} guest · {s.off} OFF of {s.members}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-2 flex-wrap justify-center">
        <button className="hl-btn ghost" onClick={() => goTab("report")}>Full reports →</button>
      </div>
    </>
  );
}

function HallHome(props) {
  return props.isAdmin ? <HallAdminHome {...props} /> : <HallMemberHome {...props} />;
}
Hall.register({ key: "home", label: "Home", icon: "🏠", order: 1, component: HallHome });

function HallApp({ call, user, token, lang, onBack, onLogout, refreshWallet, ui, ext }) {
  const tabs = Hall.tabs.filter((t) => !t.roles || t.roles.includes(user.role));
  const [tab, setTab] = useState(tabs[0].key);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const notify = (message, isError) => {
    setToast({ message: String(message && message.message ? message.message : message), isError: !!isError });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };
  const Active = (tabs.find((t) => t.key === tab) || tabs[0]).component;
  const slides = useHallHeroSlides(call, user, setTab, tab);

  return (
    <div className="min-h-screen hl" style={{ color: "var(--ink)" }}>
      <HallTopBar user={user} tabs={tabs} active={tab} setActive={setTab} onLogout={onLogout} ui={ui} />

      {toast && (
        <div className="fixed top-[76px] right-4 z-50 w-[min(90vw,340px)]">
          <div className="hl-toast fade-in shadow-lg"
            style={toast.isError
              ? { background: "var(--danger-bg)", color: "var(--danger-fg)", borderColor: "var(--danger-border)" }
              : { background: "var(--ok-bg)", color: "var(--ok-fg)", borderColor: "var(--ok-border)" }}>
            <span>{toast.isError ? "⚠️" : "✅"}</span><span className="flex-1">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="hl-strip">
        <div className="flex items-center gap-2.5">
          <img src="/images/restaurants/hall.svg" alt="" />
          <div className="leading-tight">
            <div className="text-sm font-700">Hall</div>
            <div className="text-[11px] opacity-60">Hall student & services</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-gold px-3 py-1.5 rounded-lg text-xs" onClick={onBack}>← Restaurants</button>
        </div>
      </div>

      <div className="hl-wrap fade-in" key={tab}>
        {(tab === "home" || tab === "meals") && <HallHero slides={slides} />}
        <Active call={call} user={user} token={token} isAdmin={user.role === "admin"} notify={notify} refreshWallet={refreshWallet} goTab={setTab} ui={ui} ext={ext} />
      </div>
    </div>
  );
}
window.HallApp = HallApp;
