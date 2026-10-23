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

  const input = "rounded-lg border px-2 py-1.5 text-sm";
  const style = { background: "var(--input-bg)", borderColor: "var(--line)", color: "var(--ink)" };

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

  return (
    <>
      <HallCard title="Upcoming feasts">
        {!feasts ? <p className="text-sm opacity-70">Loading…</p> : feasts.length === 0 ? (
          <p className="text-sm opacity-70">No feast in the next 60 days.</p>
        ) : (
          <div className="grid gap-2">
            {feasts.map((x) => (
              <div key={x.id} className="rounded-xl border p-3 flex items-start justify-between gap-3" style={{ borderColor: "var(--line)", background: "var(--gold-soft)" }}>
                <div>
                  <div className="font-700">🎉 {x.title}</div>
                  <div className="text-xs opacity-80">{hallDateLabel(x.date)} · {HALL_SLOT_LABEL[x.slot]}{x.date === today && " · today"}</div>
                  <div className="text-sm mt-1">{x.items}</div>
                  <div className="text-xs mt-1 opacity-80">{x.extraPrice > 0 ? `Extra ${hallTaka(x.extraPrice)} on top of the normal meal price` : "No extra charge"}</div>
                </div>
                {isAdmin && <button className="btn-gold px-2 py-1 rounded-lg text-xs" onClick={() => remove(x.id)}>Remove</button>}
              </div>
            ))}
          </div>
        )}
      </HallCard>

      {isAdmin && (
        <HallCard title="Add a feast">
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="date" className={input} style={style} min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            <select className={input} style={style} value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>
              {HALL_SLOTS.map((s) => <option key={s} value={s}>{HALL_SLOT_LABEL[s]}</option>)}
            </select>
            <input className={input} style={style} placeholder="Feast name (e.g. Eid dinner)" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            <input type="number" min="0" className={input} style={style} placeholder="Extra price (৳)" value={f.extraPrice} onChange={(e) => setF({ ...f, extraPrice: e.target.value })} />
            <input className={input + " sm:col-span-2"} style={style} placeholder="What is served (e.g. Polao, Beef roast, Firni)" maxLength={255} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} />
          </div>
          <button className="btn-gold px-4 py-2 rounded-lg text-sm mt-3" disabled={!f.date || !f.title || !f.items} onClick={add}>Save feast</button>
          <p className="text-xs mt-2" style={{ color: "var(--ink-soft)" }}>A feast on a date + meal that already has one replaces it. It can't be added once that meal has closed.</p>
        </HallCard>
      )}
    </>
  );
}
Hall.register({ key: "feasts", label: "Feasts", order: 5, component: HallFeasts });
