// Last call, admin side: put up leftover plates, see who took them, hand them over by code, refund a plate nobody collected.

function HallLastCallForm({ slots, busy, onCreate }) {
  const [slot, setSlot] = useState("lunch");
  const [plates, setPlates] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const normal = (slots.find((s) => s.slot === slot) || {}).price;
  const submit = async () => {
    const ok = await onCreate({ slot, plates: Number(plates), price: Number(price), note, notify });
    if (ok) { setPlates(""); setNote(""); }
  };
  return (
    <div className="hl-tile" style={{ marginBottom: 14 }}>
      <div className="font-700 mb-2">➕ Put up leftover plates (today)</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <div><label className="hl-label">Meal</label>
          <select className="hl-input" value={slot} onChange={(e) => setSlot(e.target.value)}>
            {HALL_SLOTS.map((x) => <option key={x} value={x}>{HALL_SLOT_LABEL[x]}</option>)}
          </select></div>
        <div><label className="hl-label">Plates left</label><input type="number" min="1" className="hl-input" placeholder="10" value={plates} onChange={(e) => setPlates(e.target.value)} /></div>
        <div><label className="hl-label">Price per plate (৳)</label><input type="number" min="0" className="hl-input" placeholder={normal != null ? `normally ${normal}` : "0"} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div style={{ gridColumn: "span 2" }}><label className="hl-label">Note (optional)</label><input className="hl-input" maxLength={160} placeholder="e.g. chicken curry and rice" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Tell all hall members (notification)</label>
      <div className="mt-2"><button className="hl-btn sm" disabled={busy || !(Number(plates) >= 1) || price === ""} onClick={submit}>Put up last call</button></div>
    </div>
  );
}

function HallLastCallServe({ busy, onServe }) {
  const [code, setCode] = useState("");
  return (
    <div className="hl-tile" style={{ marginBottom: 14 }}>
      <div className="font-700 mb-2">✅ Hand over a plate</div>
      <div className="flex gap-2 flex-wrap">
        <input className="hl-input" style={{ flex: "1 1 160px", maxWidth: 240, textTransform: "uppercase" }} placeholder="Code, e.g. LC-7KQ2MX" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className="hl-btn sm" disabled={busy || !code.trim()} onClick={async () => { if (await onServe(code.trim())) setCode(""); }}>Serve</button>
      </div>
    </div>
  );
}

// data = GET /api/hall/lastcall/manage
function HallLastCallAdminView({ data, busy, onClose, onCancel }) {
  if (!data.items.length) return <div className="hl-empty">No last call in the last 7 days.</div>;
  return (
    <>
      {data.items.map((it) => (
        <div key={it.id} className="hl-tile" style={{ marginBottom: 12 }}>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="font-700">{HALL_SLOT_EMOJI[it.slot]} {it.label} · {hallDateLabel(it.date)} <span className={`hl-chip ${it.status === "open" ? "ok" : ""}`}>{it.status === "open" ? "Open" : "Closed"}</span></div>
              <div className="text-xs hl-muted mt-0.5">{it.taken} of {it.plates} plates taken · {it.served} collected · {hallTaka(it.price)} each{it.note ? ` · ${it.note}` : ""}</div>
            </div>
            {it.status === "open" && <button className="hl-btn sm ghost" disabled={busy} onClick={() => onClose(it)}>Close</button>}
          </div>
          {it.claims.length > 0 && (
            <div className="hl-scroll" style={{ marginTop: 8 }}>
              <table className="hl-table">
                <thead><tr><th>Code</th><th>Student</th><th>Time</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {it.claims.map((c) => (
                    <tr key={c.id}>
                      <td className="font-700">{c.code}</td>
                      <td>{c.name}<div className="text-[11px] hl-muted">{c.externalId || "—"}</div></td>
                      <td>{c.at}</td>
                      <td><span className={`hl-chip ${c.status === "served" ? "ok" : c.status === "claimed" ? "warn" : ""}`}>{c.status === "served" ? "Collected" : c.status === "claimed" ? "Waiting" : "Refunded"}</span></td>
                      <td>{c.status === "claimed" && <button className="hl-btn sm danger" disabled={busy} title="Cancel and give the money back" onClick={() => onCancel(c)}>Refund</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function HallLastCallAdmin({ call, notify }) {
  const [data, setData] = useState(null);
  const [slots, setSlots] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try { setErr(null); setData(await call("/api/hall/lastcall/manage")); }
    catch (e) { setErr(e.message || String(e)); notify(e, true); }
  };
  useEffect(() => {
    load();
    call("/api/hall/slots").then((r) => setSlots(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);
  const act = async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); if (okMsg) notify(okMsg(r)); await load(); setBusy(false); return true; }
    catch (e) { notify(e, true); setBusy(false); return false; }
  };
  const create = (body) => act(() => call("/api/hall/lastcall", { method: "POST", body }), (r) => `Last call is live${r.notified ? ` (${r.notified} people notified)` : ""}.`);
  const close = (it) => act(() => call(`/api/hall/lastcall/${it.id}/close`, { method: "PATCH" }), () => "Last call closed.");
  const serve = (code) => act(() => call("/api/hall/lastcall/serve", { method: "POST", body: { code } }), (r) => `Serve ${r.name} (${r.externalId || "no ID"}) ✓`);
  const cancel = (c) => {
    if (!window.confirm(`Refund ${hallTaka(c.price)} to ${c.name} and cancel plate ${c.code}?`)) return Promise.resolve(false);
    return act(() => call(`/api/hall/lastcall/claims/${c.id}/cancel`, { method: "POST" }), (r) => `Refunded ${hallTaka(r.refunded)} to ${c.name}.`);
  };
  return (
    <HallCard title="Last call" icon="🍱" sub="Sell leftover plates cheaply instead of throwing them away. Students take them with their wallet and show a code.">
      {err ? <div className="hl-error">⚠️ {err}</div> : !data ? <div className="hl-empty">Loading…</div> : (
        <>
          <HallLastCallForm slots={slots} busy={busy} onCreate={create} />
          <HallLastCallServe busy={busy} onServe={serve} />
          <HallLastCallAdminView data={data} busy={busy} onClose={close} onCancel={cancel} />
        </>
      )}
    </HallCard>
  );
}
