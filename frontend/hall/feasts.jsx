// Step 7 — "Feasts" tab: special meals on a given date. Everyone sees the list; admin can add / remove.
function HallFeasts({ call, isAdmin, notify }) {
  const [feasts, setFeasts] = useState(null);
  const [today, setToday] = useState("");
  const [f, setF] = useState({ date: "", slot: "dinner", title: "", items: "", extraPrice: "" });
  const load = async () => {
    try {
      const [list, info] = await Promise.all([call("/api/hall/feasts"), call("/api/hall/info")]);
      setFeasts(list); setToday(info.today);
    } catch (e) { notify(e, true); }
  };
  useEffect(() => { load(); }, []);

  // Going / Not going for one feast
  const [busy, setBusy] = useState(null);
  const clearRsvp = async (id) => {
    setBusy(id);
    try { await call(`/api/hall/feasts/${id}/rsvp`, { method: "DELETE" }); notify("Answer removed"); await load(); }
    catch (e) { notify(e, true); }
    setBusy(null);
  };
  const rsvp = async (id, status) => {
    setBusy(id);
    try {
      await call(`/api/hall/feasts/${id}/rsvp`, { method: "POST", body: { status } });
      notify(status === "going" ? "See you at the feast!" : "Marked as not going");
      await load();
    } catch (e) { notify(e, true); }
    setBusy(null);
  };

  const add = async () => {
    try {
      await call("/api/hall/feasts", { method: "POST", body: { ...f, extraPrice: Number(f.extraPrice || 0) } });
      notify("Feast saved");
      setF({ date: "", slot: "dinner", title: "", items: "", extraPrice: "" });
      await load();
    } catch (e) { notify(e, true); }
  };
  const remove = async (id) => {
    if (!window.confirm("Remove this feast?")) return;
    try { await call(`/api/hall/feasts/${id}`, { method: "DELETE" }); notify("Feast removed"); await load(); }
    catch (e) { notify(e, true); }
  };

  // I can't say going when the feast is full (unless I am already in) or when the meal has locked
  const isFull = (x) => x.capacity != null && x.goingCount >= x.capacity && x.myRsvp !== "going";

  return (
    <>
      <HallCard title="Upcoming feasts" icon="🎉">
        {!feasts ? <div className="hl-empty">Loading…</div> : feasts.length === 0 ? (
          <div className="hl-empty">🍽 No feast in the next 60 days.</div>
        ) : (
          <div className="hl-grid2">
            {feasts.map((x) => {
              const dt = new Date(x.date + "T00:00:00Z");
              return (
                <div key={x.id} className={`hl-feast ${x.myRsvp === "going" ? "going" : ""}`}>
                  <div className="hl-feast-date">
                    <div className="d font-display">{dt.getUTCDate()}</div>
                    <div className="m">{dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</div>
                  </div>
                  <div className="hl-feast-body" style={{ paddingTop: 12 }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-display font-700 leading-tight">{x.title}</div>
                      {isAdmin && <button className="hl-btn sm danger" onClick={() => remove(x.id)}>Remove</button>}
                    </div>
                    <div className="flex gap-1.5 flex-wrap mt-1.5">
                      <span className="hl-chip">{HALL_SLOT_EMOJI[x.slot]} {HALL_SLOT_LABEL[x.slot]}</span>
                      {x.date === today && <span className="hl-chip warn">Today</span>}
                      <span className={`hl-chip ${x.extraPrice > 0 ? "plain" : "ok"}`}>{x.extraPrice > 0 ? `+${hallTaka(x.extraPrice)}` : "No extra charge"}</span>
                      <span className="hl-chip plain">👥 {x.goingCount} going</span>
                      {x.capacity != null && (x.goingCount >= x.capacity
                        ? <span className="hl-chip warn">Full</span>
                        : <span className="hl-chip ok">{x.capacity - x.goingCount} seat{x.capacity - x.goingCount === 1 ? "" : "s"} left</span>)}
                    </div>
                    <div className="text-sm mt-2">{x.items}</div>
                    <div className="flex gap-2 mt-3">
                      <button className={`hl-btn sm ${x.myRsvp === "going" ? "" : "ghost"}`} disabled={busy === x.id || !x.rsvpOpen || isFull(x)} onClick={() => rsvp(x.id, "going")}>✅ Going</button>
                      <button className={`hl-btn sm ${x.myRsvp === "not_going" ? "" : "ghost"}`} disabled={busy === x.id || !x.rsvpOpen} onClick={() => rsvp(x.id, "not_going")}>🚫 Not going</button>
                      {x.myRsvp && x.rsvpOpen && <button className="hl-btn sm ghost" disabled={busy === x.id} onClick={() => clearRsvp(x.id)}>Clear</button>}
                    </div>
                    {!x.rsvpOpen ? <div className="text-xs mt-1.5 hl-muted">RSVP is closed, this meal has locked.</div>
                      : isFull(x) && <div className="text-xs mt-1.5 hl-muted">This feast is full.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HallCard>

      {isAdmin && (
        <HallCard title="Add a feast" icon="➕">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="hl-label">Date</label><input type="date" className="hl-input" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div><label className="hl-label">Meal</label>
              <select className="hl-input" value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>
                {HALL_SLOTS.map((s) => <option key={s} value={s}>{HALL_SLOT_LABEL[s]}</option>)}
              </select></div>
            <div><label className="hl-label">Feast name</label><input className="hl-input" placeholder="e.g. Eid dinner" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><label className="hl-label">Extra price (৳)</label><input type="number" min="0" className="hl-input" placeholder="0" value={f.extraPrice} onChange={(e) => setF({ ...f, extraPrice: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="hl-label">What is served</label><input className="hl-input" placeholder="e.g. Polao, Beef roast, Firni" maxLength={255} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} /></div>
          </div>
          <button className="hl-btn mt-4" disabled={!f.date || !f.title || !f.items} onClick={add}>Save feast</button>
          <p className="text-xs mt-3 hl-muted">A feast on a date + meal that already has one replaces it. It can't be added once that meal has closed.</p>
        </HallCard>
      )}
    </>
  );
}
Hall.register({ key: "feasts", label: "Feasts", icon: "🎉", order: 5, component: HallFeasts });
