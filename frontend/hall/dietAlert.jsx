// Home: a warning when a meal that is ON for you in the next 3 days contains something you avoid or are allergic to.

// warnings = GET /api/hall/diet/warnings → the banner (red when it is an allergy)
function HallDietBanner({ warnings, goTab }) {
  const danger = warnings.some((w) => w.level === "allergy");
  const shown = warnings.slice(0, 3);
  return (
    <div className="hl-banner" style={{ display: "block", background: danger ? "var(--danger-bg)" : "var(--warn-bg)", borderColor: danger ? "var(--danger-border)" : "var(--warn-border)" }}>
      <div className="font-700 text-sm mb-1">{danger ? "🚨 Check your meals: allergy" : "🥗 Check your meals"}</div>
      {shown.map((w) => (
        <div key={w.date + w.slot} className="flex items-center justify-between gap-2 flex-wrap text-sm" style={{ marginTop: 6 }}>
          <span>
            {HALL_SLOT_EMOJI[w.slot]} <b>{w.label}</b> · {hallDateLabel(w.date)}: {w.items} — {w.matches.map((m) => `${m.label} (${m.level === "allergy" ? "allergy" : "you avoid it"})`).join(", ")}
          </span>
          {w.canChange ? <button className="hl-btn sm ghost" onClick={() => goTab("meals")}>Turn OFF</button> : <span className="hl-chip">closed</span>}
        </div>
      ))}
      {warnings.length > shown.length && <div className="text-xs opacity-80" style={{ marginTop: 6 }}>+{warnings.length - shown.length} more meal(s) in the next 3 days.</div>}
    </div>
  );
}

function HallDietAlert({ call, goTab }) {
  const [warnings, setWarnings] = useState([]);
  useEffect(() => {
    let dead = false;
    const load = () => call("/api/hall/diet/warnings?days=3").then((r) => { if (!dead) setWarnings(r.warnings); }).catch(() => {});
    load();
    window.addEventListener("hall-changed", load);   // a meal was switched ON/OFF
    return () => { dead = true; window.removeEventListener("hall-changed", load); };
  }, []);
  if (!warnings.length) return null;
  return <HallDietBanner warnings={warnings} goTab={goTab} />;
}
