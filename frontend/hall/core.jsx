// Hall core: shared helpers, the page shell (header + tabs) and the Hall home tab.
// Naming rule: every top-level name in hall/*.jsx is shared, so keep names unique across files.
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const HALL_SLOTS = ["breakfast", "lunch", "dinner"];
const HALL_SLOT_LABEL = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };
const hallTaka = (n) => "৳" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

const hallCard = { background: "var(--panel)", borderColor: "var(--line)", color: "var(--ink)" };

function HallCard({ title, children, right }) {
  return (
    <section className="rounded-2xl border p-4 mb-4" style={hallCard}>
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-700 text-base">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

// Home tab: proves the Hall API is reachable and shows the canteen clock.
function HallHome({ call, user }) {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { call("/api/hall/info").then(setInfo).catch((e) => setErr(e.message)); }, []);
  const hh = info ? String(Math.floor(info.minutes / 60)).padStart(2, "0") : "";
  const mm = info ? String(info.minutes % 60).padStart(2, "0") : "";
  return (
    <HallCard title="Welcome to the Hall">
      <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
        The meal system: switch each meal on or off, see the weekly menu and feasts, and check your monthly bill.
        More tabs appear here as the features are added.
      </p>
      {err && <p className="text-sm mt-3" style={{ color: "var(--danger-fg)" }}>{err}</p>}
      {info && (
        <p className="text-sm mt-3">
          Signed in as <b>{info.userName}</b> ({info.role}) · Canteen time: <b>{info.today} {hh}:{mm}</b> ({info.timezone})
        </p>
      )}
    </HallCard>
  );
}
Hall.register({ key: "home", label: "Home", order: 1, component: HallHome });

function HallApp({ call, user, lang, onBack, onLogout, refreshWallet }) {
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

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ color: "var(--ink)" }}>
      <div className="max-w-4xl mx-auto fade-in">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div>
            <div className="font-display gold-text text-2xl font-800">🍛 Hall</div>
            <div className="text-xs opacity-70">{user.name} · {user.role}</div>
          </div>
          <div className="flex gap-2">
            <button className="btn-gold px-3 py-1.5 rounded-lg text-xs" onClick={onBack}>← Restaurants</button>
            <button className="btn-gold px-3 py-1.5 rounded-lg text-xs" onClick={onLogout}>Log out</button>
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-sm border whitespace-nowrap"
              style={t.key === tab
                ? { background: "var(--gold)", color: "#fff", borderColor: "var(--gold)" }
                : { background: "transparent", color: "var(--ink)", borderColor: "var(--line)" }}>
              {t.label}
            </button>
          ))}
        </div>

        {toast && (
          <div className="rounded-xl border px-3 py-2 mb-4 text-sm"
            style={toast.isError
              ? { background: "var(--danger-bg)", color: "var(--danger-fg)", borderColor: "var(--danger-border)" }
              : { background: "var(--ok-bg)", color: "var(--ok-fg)", borderColor: "var(--ok-border)" }}>
            {toast.message}
          </div>
        )}

        <Active call={call} user={user} isAdmin={user.role === "admin"} notify={notify} refreshWallet={refreshWallet} />
      </div>
    </div>
  );
}
window.HallApp = HallApp;