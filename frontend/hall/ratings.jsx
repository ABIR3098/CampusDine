// Ratings, student side: rate the meals you had (1-5 stars + an optional comment).
// Only meals that were ON for you and have already closed can be rated; you can change a rating later.
// Admin gets the summary from ratingsAdmin.jsx on the same tab.

function HallStars({ value, onChange, disabled, size }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div role="radiogroup" aria-label="Rating" style={{ display: "inline-flex", gap: 2 }} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={disabled} aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange(n)} onMouseEnter={() => setHover(n)}
          style={{ fontSize: size || 26, lineHeight: 1, padding: 2, background: "none", border: 0, cursor: disabled ? "default" : "pointer",
            color: n <= shown ? "#f5a623" : "var(--ink-soft)", opacity: n <= shown ? 1 : 0.45 }}>
          {n <= shown ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

// one meal: stars, comment and a save button
function HallRatingRow({ item, onSave }) {
  const [stars, setStars] = useState(item.stars || 0);
  const [comment, setComment] = useState(item.comment || "");
  const [busy, setBusy] = useState(false);
  const dirty = stars !== (item.stars || 0) || comment.trim() !== (item.comment || "");
  const save = async () => {
    setBusy(true);
    try { await onSave(item, stars, comment.trim()); } finally { setBusy(false); }
  };
  return (
    <div className="hl-tile" style={{ marginBottom: 10 }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="font-700">{HALL_SLOT_EMOJI[item.slot]} {item.label} · {hallDateLabel(item.date)}</div>
          {item.menu && <div className="text-xs hl-muted">{item.menu}</div>}
        </div>
        <HallStars value={stars} onChange={setStars} disabled={busy} />
      </div>
      <div className="flex gap-2 mt-2 flex-wrap">
        <input className="hl-input" style={{ flex: "1 1 200px" }} maxLength={300} placeholder="Comment (optional)"
          value={comment} onChange={(e) => setComment(e.target.value)} />
        <button className="hl-btn sm" disabled={busy || !stars || !dirty} onClick={save}>{item.stars ? "Update" : "Submit"}</button>
      </div>
    </div>
  );
}

function HallRateMeals({ call, notify }) {
  const [items, setItems] = useState(null);
  const [err, setErr] = useState(null);
  const load = async () => {
    try { setErr(null); setItems((await call("/api/hall/ratings/mine")).items); }
    catch (e) { setErr(e.message || String(e)); notify(e, true); }
  };
  useEffect(() => { load(); }, []);
  const save = async (item, stars, comment) => {
    try {
      await call(`/api/hall/ratings/${item.date}/${item.slot}`, { method: "PUT", body: { stars, comment } });
      notify("Thanks! Your rating was saved.");
      await load();
    } catch (e) { notify(e, true); }
  };
  const waiting = items ? items.filter((i) => !i.stars).length : 0;
  return (
    <HallCard title="Rate your meals" icon="⭐" sub="How were the meals you had in the last 7 days? The hall admin sees only the stars and comments, not your name.">
      {err ? <div className="hl-error">⚠️ {err}</div>
        : !items ? <div className="hl-empty">Loading…</div>
        : items.length === 0 ? <div className="hl-empty">No closed meal to rate yet.</div>
        : (
          <>
            {waiting > 0 && <p className="text-xs hl-muted mb-2">{waiting} meal(s) waiting for your rating.</p>}
            {items.map((it) => <HallRatingRow key={it.date + it.slot} item={it} onSave={save} />)}
          </>
        )}
    </HallCard>
  );
}

function HallRatings(props) {
  return props.isAdmin ? <HallRatingsAdmin {...props} /> : <HallRateMeals {...props} />;
}
Hall.register({ key: "ratings", label: "Ratings", icon: "⭐", order: 6.8, component: HallRatings });
