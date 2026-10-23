// Step 13 — meal tokens. Student/teacher: "Token" tab, take a number for today's meal and watch the queue.
// Admin: "Serve" tab, the waiting list for a meal and a button to serve each token.

function HallToken({ call, notify }) {
  const [data, setData] = useState(null);
  const load = async (quiet) => {
    try { setData(await call("/api/hall/token")); } catch (e) { if (!quiet) notify(e, true); }
  };
  useEffect(() => { load(); const t = setInterval(() => load(true), 10000); return () => clearInterval(t); }, []);

  const take = async (slot) => {
    try { const r = await call("/api/hall/token", { method: "POST", body: { slot } }); notify(`Your token for ${HALL_SLOT_LABEL[slot]} is #${r.serial}`); await load(true); }
    catch (e) { notify(e, true); }
  };

  return (
    <HallCard title="Today's meal token" icon="🎫"
      sub="Take a number when you come for a meal that is ON for you. Meals are served in token order.">
      {!data ? <div className="hl-empty">Loading…</div> : (
        <div className="hl-grid3">
          {HALL_SLOTS.map((slot) => {
            const t = data.tokens.find((x) => x.slot === slot);
            return (
              <div key={slot} className={`hl-ticket ${t ? "has" : ""}`}>
                <div className="font-display font-700">{HALL_SLOT_EMOJI[slot]} {HALL_SLOT_LABEL[slot]}</div>
                {!t ? (
                  <>
                    <div className="text-sm hl-muted mt-2 mb-3">No token yet</div>
                    <button className="hl-btn" onClick={() => take(slot)}>Get token</button>
                  </>
                ) : (
                  <>
                    <div className="hl-ticket-no font-display">#{t.serial}</div>
                    <div className="text-xs hl-muted">{t.plates} plate(s)</div>
                    <div className="mt-2">
                      {t.status === "served" ? <span className="hl-chip ok">✅ Served</span>
                        : t.ahead === 0 ? <span className="hl-chip warn">🔔 You're next!</span>
                        : <span className="hl-chip">{t.ahead} ahead · now serving #{t.nowServing}</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </HallCard>
  );
}
Hall.register({ key: "token", label: "Token", icon: "🎫", order: 7, roles: ["student", "teacher"], component: HallToken });

function HallServe({ call, notify }) {
  const [slot, setSlot] = useState("lunch");
  const [q, setQ] = useState(null);
  const load = async (s, quiet) => {
    try { setQ(await call(`/api/hall/queue?slot=${s}`)); } catch (e) { if (!quiet) notify(e, true); }
  };
  useEffect(() => { setQ(null); load(slot); const t = setInterval(() => load(slot, true), 8000); return () => clearInterval(t); }, [slot]);

  const serve = async (serial) => {
    try { await call("/api/hall/queue/serve", { method: "POST", body: { slot, serial } }); await load(slot, true); }
    catch (e) { notify(e, true); }
  };

  return (
    <HallCard title="Serve tokens — today" icon="🔔" right={
      <div className="flex gap-1.5">{HALL_SLOTS.map((s) => (
        <button key={s} onClick={() => setSlot(s)} className={`hl-btn sm ${s === slot ? "" : "ghost"}`}>{HALL_SLOT_EMOJI[s]} {HALL_SLOT_LABEL[s]}</button>
      ))}</div>
    }>
      {!q ? <div className="hl-empty">Loading…</div> : (
        <>
          <div className="hl-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <HallStat icon="📣" label="Now serving" value={q.nowServing ? `#${q.nowServing}` : "—"} />
            <HallStat icon="⏳" label="Waiting" value={q.waiting.length} sub={`${q.waitingPlates} plates`} />
            <HallStat icon="✅" label="Served" value={q.served} />
          </div>
          {q.waiting.length === 0 ? <div className="hl-empty">Nobody is waiting.</div> : (
            <div className="hl-scroll">
              <table className="hl-table">
                <thead><tr><th>#</th><th>Name</th><th>Plates</th><th></th></tr></thead>
                <tbody>{q.waiting.map((w) => (
                  <tr key={w.serial}>
                    <td className="font-800">#{w.serial}</td><td>{w.name} <span className="hl-muted">({w.externalId})</span></td><td>{w.plates}</td>
                    <td style={{ textAlign: "right" }}><button className="hl-btn sm" onClick={() => serve(w.serial)}>Serve</button></td>
                  </tr>))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </HallCard>
  );
}
Hall.register({ key: "serve", label: "Serve", icon: "🔔", order: 8, roles: ["admin"], component: HallServe });
