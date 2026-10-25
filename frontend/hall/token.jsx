// Step 13 — meal tokens. Student/teacher: "Token" tab, take a number for today's meal and watch the queue.
// Admin: "Serve" tab, the waiting list for a meal and a button to serve each token.

function HallMealQr({ value, size = 156 }) {
  const qr = useMemo(() => {
    try {
      if (typeof window.qrcode !== "function" || !value) return null;
      const q = window.qrcode(0, "M"); q.addData(String(value)); q.make();
      const n = q.getModuleCount(); let d = "";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
      return { n, d };
    } catch (_) { return null; }
  }, [value]);
  if (!qr) return <div className="text-xs text-center">QR library unavailable. Use the token text above.</div>;
  const pad = 4;
  return <svg role="img" aria-label="Hall meal pickup QR code" width={size} height={size}
    viewBox={`${-pad} ${-pad} ${qr.n + pad * 2} ${qr.n + pad * 2}`} shapeRendering="crispEdges"
    style={{ background: "#fff", borderRadius: 8, flexShrink: 0 }}>
    <rect x={-pad} y={-pad} width={qr.n + pad * 2} height={qr.n + pad * 2} fill="#fff" />
    <path d={qr.d} fill="#000" />
  </svg>;
}

function HallToken({ call, notify, refreshWallet }) {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState(null);     // the meal whose "how do you pay" panel is open
  const [method, setMethod] = useState("wallet");
  const [busy, setBusy] = useState(false);
  const load = async (quiet) => {
    try { setData(await call("/api/hall/token")); } catch (e) { if (!quiet) notify(e, true); }
  };
  useEffect(() => { load(); const t = setInterval(() => load(true), 10000); return () => clearInterval(t); }, []);

  const take = async (slot) => {
    setBusy(true);
    try {
      const r = await call("/api/hall/token", { method: "POST", body: { slot, payMethod: method } });
      notify(`Your token for ${HALL_SLOT_LABEL[slot]} is #${r.serial}` + (r.paid > 0 ? ` — ${hallTaka(r.paid)} paid from your wallet.` : method === "wallet" ? " — already paid in your bill." : "."));
      setPick(null);
      await load(true);
      if (method === "wallet" && refreshWallet) refreshWallet().catch(() => {});
    } catch (e) { notify(e, true); }
    setBusy(false);
  };

  return (
    <HallCard title="Today's meal token" icon="🎫"
      sub="Take a number when you come for a meal that is ON for you, and choose how to pay. Meals are served in token order.">
      {!data ? <div className="hl-empty">Loading…</div> : (
        <>
          <div className="mb-3"><span className="hl-chip">👛 Wallet balance: {hallTaka(data.walletBalance)}</span></div>
          <div className="hl-grid3">
            {HALL_SLOTS.map((slot) => {
              const t = data.tokens.find((x) => x.slot === slot);
              const q = data.quotes && data.quotes[slot];
              const enough = q ? data.walletBalance >= q.amount : true;
              return (
                <div key={slot} className={`hl-ticket ${t ? "has" : ""}`}>
                  <div className="font-display font-700">{HALL_SLOT_EMOJI[slot]} {HALL_SLOT_LABEL[slot]}</div>
                  {t ? (
                    <>
                      <div className="hl-ticket-no font-display">#{t.serial}</div>
                      <div className="text-xs hl-muted">{t.plates} plate(s)</div>
                      <div className="mt-3 flex flex-col items-center gap-2 rounded-xl p-3" style={{ background: "#fff", color: "#111" }}>
                        <HallMealQr value={`HALL|${data.date}|${slot}|${t.serial}`} />
                        <div className="text-xs font-mono text-center">HALL|{data.date}|{slot}|{t.serial}</div>
                        <div className="text-[11px] text-center">Show this QR at the canteen counter</div>
                      </div>
                      <div className="mt-2">
                        {t.status === "served" ? <span className="hl-chip ok">✅ Served</span>
                          : t.ahead === 0 ? <span className="hl-chip warn">🔔 You're next!</span>
                          : <span className="hl-chip">{t.ahead} ahead · now serving #{t.nowServing}</span>}
                      </div>
                    </>
                  ) : !q ? (
                    <div className="text-sm hl-muted mt-3">This meal is OFF for you — no token needed.</div>
                  ) : pick !== slot ? (
                    <>
                      <div className="text-sm hl-muted mt-2 mb-3">{q.plates} plate(s) · {hallTaka(q.amount)}</div>
                      <button className="hl-btn" onClick={() => { setPick(slot); setMethod("wallet"); }}>Get token</button>
                    </>
                  ) : (
                    <div className="text-left mt-3">
                      <div className="text-sm mb-2 text-center">{q.plates} plate(s) · <b>{hallTaka(q.amount)}</b></div>
                      <div className="grid gap-2">
                        <button type="button" className={`hl-pay ${method === "wallet" ? "sel" : ""}`} onClick={() => setMethod("wallet")}>
                          <span>👛</span><span><b>Pay now from wallet</b><small>{hallTaka(data.walletBalance)} available</small></span>
                        </button>
                        <button type="button" className={`hl-pay ${method === "later" ? "sel" : ""}`} onClick={() => setMethod("later")}>
                          <span>🧾</span><span><b>Pay later</b><small>stays in your monthly bill</small></span>
                        </button>
                      </div>
                      {method === "wallet" && !enough && <p className="text-xs mt-2" style={{ color: "var(--brick)" }}>Not enough balance — add money in the Wallet tab.</p>}
                      <div className="flex gap-2 mt-3">
                        <button className="hl-btn flex-1" disabled={busy || (method === "wallet" && !enough)} onClick={() => take(slot)}>{busy ? "Please wait…" : "Confirm"}</button>
                        <button className="hl-btn ghost" disabled={busy} onClick={() => setPick(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
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
