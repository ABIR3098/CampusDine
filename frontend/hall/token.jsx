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
    <HallCard title="Today's meal token">
      <p className="text-sm mb-3" style={{ color: "var(--ink-soft)" }}>
        Take a number when you come for a meal that is ON for you. Meals are served in token order.
      </p>
      {!data ? <p className="text-sm opacity-70">Loading…</p> : (
        <div className="grid gap-3 md:grid-cols-3">
          {HALL_SLOTS.map((slot) => {
            const t = data.tokens.find((x) => x.slot === slot);
            return (
              <div key={slot} className="rounded-xl border p-3 text-center" style={{ borderColor: "var(--line)" }}>
                <div className="font-700">{HALL_SLOT_LABEL[slot]}</div>
                {!t ? (
                  <button className="btn-gold px-3 py-2 rounded-lg text-sm mt-3" onClick={() => take(slot)}>Get token</button>
                ) : (
                  <>
                    <div className="font-display text-5xl font-800 my-2">#{t.serial}</div>
                    <div className="text-xs opacity-80">{t.plates} plate(s)</div>
                    <div className="text-sm mt-1 font-600">
                      {t.status === "served" ? "✅ Served" : t.ahead === 0 ? "🔔 You're next!" : `${t.ahead} ahead of you · now serving #${t.nowServing}`}
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
Hall.register({ key: "token", label: "Token", order: 7, roles: ["student", "teacher"], component: HallToken });

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
    <HallCard title="Serve tokens — today" right={
      <div className="flex gap-1">{HALL_SLOTS.map((s) => (
        <button key={s} onClick={() => setSlot(s)} className="px-2 py-1 rounded-lg text-xs border"
          style={s === slot ? { background: "var(--gold)", color: "#fff", borderColor: "var(--gold)" } : { borderColor: "var(--line)" }}>{HALL_SLOT_LABEL[s]}</button>
      ))}</div>
    }>
      {!q ? <p className="text-sm opacity-70">Loading…</p> : (
        <>
          <div className="text-sm mb-3">
            Now serving: <b>{q.nowServing ? `#${q.nowServing}` : "—"}</b> · Waiting: <b>{q.waiting.length}</b> ({q.waitingPlates} plates) · Served: <b>{q.served}</b>
          </div>
          {q.waiting.length === 0 ? <p className="text-sm opacity-70">Nobody is waiting.</p> : (
            <table className="w-full text-sm text-left">
              <thead><tr style={{ color: "var(--ink-soft)" }}><th className="py-1">#</th><th>Name</th><th>Plates</th><th></th></tr></thead>
              <tbody>{q.waiting.map((w) => (
                <tr key={w.serial} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="py-1.5 font-700">#{w.serial}</td><td>{w.name} <span className="opacity-60">({w.externalId})</span></td><td>{w.plates}</td>
                  <td className="text-right"><button className="btn-gold px-3 py-1 rounded-lg text-xs" onClick={() => serve(w.serial)}>Serve</button></td>
                </tr>))}</tbody>
            </table>
          )}
        </>
      )}
    </HallCard>
  );
}
Hall.register({ key: "serve", label: "Serve", order: 8, roles: ["admin"], component: HallServe });
