// Kitchen inventory screens for the Staff panel and the Admin panel.
// Loaded by campusdine.html (compiled in the browser by Babel) and published as window.CDInventory.
(function () {
  const { useState, useEffect, useCallback, useMemo } = React;

  async function call(apiBase, token, path, { method = "GET", body } = {}) {
    const res = await fetch(`${apiBase}/api/inventory${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  const localToday = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  const fmt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));
  const when = (v) => (v ? new Date(v).toLocaleString() : "—");

  const STATUS_STYLE = {
    pending: { bg: "#FEF3C7", fg: "#92400E", label: "Pending" },
    approved: { bg: "#DBEAFE", fg: "#1E40AF", label: "Approved" },
    rejected: { bg: "#FEE2E2", fg: "#991B1B", label: "Rejected" },
    purchased: { bg: "#DCFCE7", fg: "#166534", label: "Purchased" },
  };
  const LEVEL_STYLE = {
    ok: { bg: "#DCFCE7", fg: "#166534", label: "In stock" },
    low: { bg: "#FEF3C7", fg: "#92400E", label: "Low" },
    out: { bg: "#FEE2E2", fg: "#991B1B", label: "Out" },
  };

  const Pill = ({ s }) => (
    <span className="text-[11px] font-800 px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
  );

  const Notice = ({ error, info }) => (
    <>
      {error && <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: "#FEE2E2", color: "#991B1B" }}>{error}</div>}
      {info && <div className="text-sm px-3 py-2 rounded-lg mb-3" style={{ background: "#DCFCE7", color: "#166534" }}>{info}</div>}
    </>
  );

  const TabBar = ({ tabs, value, onChange }) => (
    <div className="flex flex-wrap gap-2 mb-4">
      {tabs.map((t) => (
        <button key={t.key} type="button" onClick={() => onChange(t.key)}
          className="px-3 py-1.5 rounded-full text-sm font-700 border"
          style={value === t.key ? { background: "var(--gold)", color: "#fff", borderColor: "var(--gold)" } : { borderColor: "var(--line)", background: "var(--panel)" }}>
          {t.label}{t.badge ? <span className="ml-1.5 text-[11px] px-1.5 rounded-full" style={{ background: "#EF4444", color: "#fff" }}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );

  const inputCls = "w-full px-3 py-2 rounded-lg border text-sm";
  const inputStyle = { borderColor: "var(--line)", background: "var(--panel)", color: "var(--ink)" };

  // Shared hook: loads data and keeps it fresh without a page reload.
  function useLive(loader, deps, everyMs = 20000) {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const reload = useCallback(async () => {
      try { setData(await loader()); setError(""); } catch (e) { setError(e.message); }
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      reload();
      const t = setInterval(reload, everyMs);
      return () => clearInterval(t);
    }, [reload, everyMs]);
    return { data, error, reload };
  }

  // Low / out-of-stock warning list. onRestock (optional) adds a "Request restock" button per item.
  function StockAlerts({ items, onRestock }) {
    const bad = items.filter((i) => i.level === "out" || i.level === "low");
    if (!bad.length) return null;
    return (
      <div className="mb-4 rounded-xl p-3" style={{ background: "#FFF7ED", border: "1px solid #FDBA74" }}>
        <div className="text-sm font-800 mb-2" style={{ color: "#9A3412" }}>⚠ Stock alert</div>
  function StockTable({ items, actions }) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase" style={{ color: "var(--ink-soft)" }}>
              <th className="py-2 pr-3">Raw material</th><th className="py-2 pr-3">Current stock</th><th className="py-2 pr-3">Unit</th><th className="py-2 pr-3">Status</th>
              {actions && <th className="py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td className="py-2 pr-3 font-700">{it.name}{it.nameBn ? <span className="ml-2 font-400" style={{ color: "var(--ink-soft)" }}>{it.nameBn}</span> : null}</td>
                <td className="py-2 pr-3 font-mono">{fmt(it.currentStock)}</td>
                <td className="py-2 pr-3">{it.unit}</td>
                <td className="py-2 pr-3"><Pill s={LEVEL_STYLE[it.level] || LEVEL_STYLE.ok} /></td>
                {actions && <td className="py-2 text-right">{actions(it)}</td>}
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="py-6 text-center" style={{ color: "var(--ink-soft)" }}>No raw materials yet.</td></tr>}
          </tbody>
        </table>
      </div>
    );
  }

  // ───────────────────────── STAFF ─────────────────────────
  function StaffInventoryPanel({ apiBase, token }) {
    const [tab, setTab] = useState("stock");
    const items = useLive(() => call(apiBase, token, "/items"), [apiBase, token]);
    const mine = useLive(() => call(apiBase, token, "/requests/mine"), [apiBase, token]);
    const [form, setForm] = useState({ itemId: "", requestType: "request", currentQty: "", requiredQty: "", note: "" });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const list = (items.data && items.data.items) || [];
    const requests = (mine.data && mine.data.requests) || [];
    const chosen = list.find((i) => String(i.id) === String(form.itemId));

    const submit = async () => {
      setBusy(true); setError(""); setInfo("");
      try {
        await call(apiBase, token, "/requests", { method: "POST", body: { ...form, itemId: Number(form.itemId) } });
        setInfo("Sent to the canteen admin.");
        setForm({ itemId: "", requestType: "request", currentQty: "", requiredQty: "", note: "" });
        mine.reload(); setTab("mine");
      } catch (e) { setError(e.message); }
      setBusy(false);
    };

    return (
      <div>
        <TabBar value={tab} onChange={setTab} tabs={[
          { key: "stock", label: "Current stock" },
          { key: "send", label: "Send report / request" },
          { key: "mine", label: "My requests", badge: requests.filter((r) => r.status === "pending").length || null },
        ]} />
        <Notice error={error || items.error || mine.error} info={info} />

        {tab === "stock" && (
          <div className="card p-5">
            <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>Official stock kept by the canteen admin. Staff can view it but cannot change it.</p>
            <StockTable items={list} />
          </div>
        )}

        {tab === "send" && (
          <div className="card p-5 max-w-xl">
            <label className="text-xs font-700">Raw material</label>
            <select className={inputCls + " mb-3"} style={inputStyle} value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })}>
              <option value="">Choose…</option>
              {list.map((i) => <option key={i.id} value={i.id}>{i.name}{i.nameBn ? ` (${i.nameBn})` : ""}</option>)}
            </select>
            {chosen && <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>Official stock now: <strong>{fmt(chosen.currentStock)} {chosen.unit}</strong></p>}
            <label className="text-xs font-700">Type</label>
            <select className={inputCls + " mb-3"} style={inputStyle} value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value })}>
              <option value="request">Purchase request</option>
              <option value="report">Stock report</option>
            </select>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-700">Current quantity{chosen ? ` (${chosen.unit})` : ""}</label>
                <input className={inputCls} style={inputStyle} inputMode="decimal" value={form.currentQty} onChange={(e) => setForm({ ...form, currentQty: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-700">Required quantity{chosen ? ` (${chosen.unit})` : ""}</label>
                <input className={inputCls} style={inputStyle} inputMode="decimal" value={form.requiredQty} onChange={(e) => setForm({ ...form, requiredQty: e.target.value })} />
              </div>
            </div>
            <label className="text-xs font-700">Note (optional)</label>
            <textarea className={inputCls + " mb-3"} style={inputStyle} rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <button type="button" className="btn-primary px-4 py-2 rounded-xl text-sm" disabled={busy || !form.itemId} onClick={submit}>{busy ? "Sending…" : "Send to admin"}</button>
          </div>
        )}

        {tab === "mine" && (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-700">{r.itemName}{r.itemNameBn ? <span className="ml-2 font-400" style={{ color: "var(--ink-soft)" }}>{r.itemNameBn}</span> : null}
                    <span className="ml-2 text-xs font-400" style={{ color: "var(--ink-soft)" }}>{r.requestType === "report" ? "Stock report" : "Purchase request"} · #{r.id}</span></div>
                  <Pill s={STATUS_STYLE[r.status]} />
                </div>
                <div className="text-sm mt-2">Current: <strong>{fmt(r.currentQty)} {r.unit}</strong> · Required: <strong>{fmt(r.requiredQty)} {r.unit}</strong></div>
                {r.note && <div className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>Your note: {r.note}</div>}
                {r.adminReply && <div className="text-sm mt-2 px-3 py-2 rounded-lg" style={{ background: "var(--gold-soft)" }}><strong>Admin reply:</strong> {r.adminReply}</div>}
                <div className="text-xs mt-2" style={{ color: "var(--ink-soft)" }}>
                  Updated stock: <strong>{fmt(r.status === "purchased" && r.stockAfterPurchase !== null ? r.stockAfterPurchase : r.officialStock)} {r.unit}</strong>
                  {r.status === "purchased" && r.purchasedQty !== null ? ` (after purchase of ${fmt(r.purchasedQty)} ${r.unit})` : " (current official stock)"}
                  {" · Sent "}{when(r.createdAt)}
                </div>
              </div>
            ))}
            {!requests.length && <div className="card p-6 text-center text-sm" style={{ color: "var(--ink-soft)" }}>You have not sent any reports or requests yet.</div>}
          </div>
        )}
      </div>
    );
  }

  // ───────────────────────── ADMIN ─────────────────────────
  function AdminInventoryPanel({ apiBase, token }) {
    const [tab, setTab] = useState("requests");
    const [filter, setFilter] = useState("");
    const summary = useLive(() => call(apiBase, token, "/admin/summary"), [apiBase, token]);
    const items = useLive(() => call(apiBase, token, "/items"), [apiBase, token]);
    const reqs = useLive(() => call(apiBase, token, `/admin/requests${filter ? `?status=${filter}` : ""}`), [apiBase, token, filter]);
    const purchases = useLive(() => call(apiBase, token, "/admin/purchases"), [apiBase, token], 60000);
    const history = useLive(() => call(apiBase, token, "/admin/history"), [apiBase, token], 60000);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [reply, setReply] = useState({});
    const [buy, setBuy] = useState({}); // per request: { quantity, unitCost, supplier }
    const [direct, setDirect] = useState({ itemId: "", quantity: "", unitCost: "", supplier: "", note: "" });
    const [newItem, setNewItem] = useState({ name: "", nameBn: "", unit: "kg", currentStock: "", minStock: "", category: "" });
    const list = (items.data && items.data.items) || [];
    const s = summary.data || {};

    const refreshAll = () => { summary.reload(); items.reload(); reqs.reload(); purchases.reload(); history.reload(); };
    const run = async (fn, okMsg) => {
      setError(""); setInfo("");
      try { await fn(); setInfo(okMsg); refreshAll(); } catch (e) { setError(e.message); }
    };

    const decide = (id, decision) => run(
      () => call(apiBase, token, `/admin/requests/${id}/decision`, { method: "POST", body: { decision, reply: reply[id] || "" } }),
      decision === "approved" ? "Request approved." : "Request rejected."
    );
    const purchase = (r) => run(
      () => call(apiBase, token, "/admin/purchases", { method: "POST", body: { requestId: r.id, ...(buy[r.id] || { quantity: r.requiredQty }) } }),
      "Purchase recorded and official stock updated."
    );
    const adjust = (it) => {
      const v = window.prompt(`New official stock for ${it.name} (${it.unit}). Current: ${fmt(it.currentStock)}`);
      if (v === null) return;
      const note = window.prompt("Reason for this correction (required):");
      if (note === null) return;
      run(() => call(apiBase, token, `/admin/items/${it.id}/adjust`, { method: "POST", body: { newStock: v, note } }), "Official stock corrected.");
    };

    return (
      <div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[["Pending requests", s.pending], ["Low stock", s.lowStock], ["Out of stock", s.outOfStock], ["Purchases this month (৳)", s.monthSpend]].map(([l, v]) => (
            <div key={l} className="card p-3"><div className="text-xs" style={{ color: "var(--ink-soft)" }}>{l}</div><div className="text-xl font-800">{fmt(v || 0)}</div></div>
          ))}
        </div>
        <TabBar value={tab} onChange={setTab} tabs={[
          { key: "requests", label: "Requests", badge: s.pending || null },
          { key: "stock", label: "Stock" },
          { key: "purchases", label: "Purchases" },
          { key: "history", label: "History" },
        ]} />
        <Notice error={error || items.error || reqs.error} info={info} />

        {tab === "requests" && (
          <div>
            <select className={inputCls + " mb-3 max-w-xs"} style={inputStyle} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All requests</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="purchased">Purchased</option>
            </select>
            <div className="space-y-3">
              {((reqs.data && reqs.data.requests) || []).map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-700">{r.itemName} <span className="text-xs font-400" style={{ color: "var(--ink-soft)" }}>· {r.requestType === "report" ? "Stock report" : "Purchase request"} #{r.id} · from {r.staffName}</span></div>
                    <Pill s={STATUS_STYLE[r.status]} />
                  </div>
                  <div className="text-sm mt-2">Staff says current <strong>{fmt(r.currentQty)} {r.unit}</strong>, needs <strong>{fmt(r.requiredQty)} {r.unit}</strong> · Official stock: <strong>{fmt(r.officialStock)} {r.unit}</strong></div>
                  {r.note && <div className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>Note: {r.note}</div>}
                  {r.adminReply && <div className="text-xs mt-1"><strong>Your reply:</strong> {r.adminReply}</div>}
                  {r.status === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <input className={inputCls + " flex-1 min-w-[200px]"} style={inputStyle} placeholder="Reply to staff (required for reject)" value={reply[r.id] || ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} />
                      <button type="button" className="btn-primary px-3 py-2 rounded-xl text-sm" onClick={() => decide(r.id, "approved")}>Approve</button>
                      <button type="button" className="px-3 py-2 rounded-xl text-sm border" style={{ borderColor: "#FCA5A5", color: "#991B1B" }} onClick={() => decide(r.id, "rejected")}>Reject</button>
                    </div>
                  )}
                  {r.status === "approved" && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                      <div><label className="text-[11px] font-700">Qty bought ({r.unit})</label>
                        <input className={inputCls} style={inputStyle} inputMode="decimal" defaultValue={r.requiredQty} onChange={(e) => setBuy({ ...buy, [r.id]: { ...(buy[r.id] || { quantity: r.requiredQty }), quantity: e.target.value } })} /></div>
                      <div><label className="text-[11px] font-700">Unit cost (৳)</label>
                        <input className={inputCls} style={inputStyle} inputMode="decimal" onChange={(e) => setBuy({ ...buy, [r.id]: { ...(buy[r.id] || { quantity: r.requiredQty }), unitCost: e.target.value } })} /></div>
                      <div><label className="text-[11px] font-700">Supplier</label>
                        <input className={inputCls} style={inputStyle} onChange={(e) => setBuy({ ...buy, [r.id]: { ...(buy[r.id] || { quantity: r.requiredQty }), supplier: e.target.value } })} /></div>
                      <button type="button" className="btn-primary px-3 py-2 rounded-xl text-sm" onClick={() => purchase(r)}>Record purchase</button>
                    </div>
                  )}
                  {r.status === "purchased" && <div className="text-xs mt-2">Bought {fmt(r.purchasedQty)} {r.unit} → stock became <strong>{fmt(r.stockAfterPurchase)} {r.unit}</strong></div>}
                </div>
              ))}
              {!((reqs.data && reqs.data.requests) || []).length && <div className="card p-6 text-center text-sm" style={{ color: "var(--ink-soft)" }}>No requests.</div>}
            </div>
          </div>
        )}

        {tab === "stock" && (
          <div className="space-y-4">
            <div className="card p-5">
              <StockTable items={list} actions={(it) => <button type="button" className="text-xs font-700 underline" onClick={() => adjust(it)}>Correct stock</button>} />
            </div>
            <div className="card p-5">
              <div className="font-700 mb-2 text-sm">Add a raw material</div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <input className={inputCls} style={inputStyle} placeholder="Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
                <input className={inputCls} style={inputStyle} placeholder="বাংলা নাম" value={newItem.nameBn} onChange={(e) => setNewItem({ ...newItem, nameBn: e.target.value })} />
                <select className={inputCls} style={inputStyle} value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>
                  {["kg", "g", "litre", "ml", "piece", "dozen", "packet", "bottle"].map((u) => <option key={u}>{u}</option>)}
                </select>
                <input className={inputCls} style={inputStyle} placeholder="Opening stock" inputMode="decimal" value={newItem.currentStock} onChange={(e) => setNewItem({ ...newItem, currentStock: e.target.value })} />
                <input className={inputCls} style={inputStyle} placeholder="Low-stock level" inputMode="decimal" value={newItem.minStock} onChange={(e) => setNewItem({ ...newItem, minStock: e.target.value })} />
                <button type="button" className="btn-primary px-3 py-2 rounded-xl text-sm" onClick={() => run(async () => { await call(apiBase, token, "/admin/items", { method: "POST", body: newItem }); setNewItem({ name: "", nameBn: "", unit: "kg", currentStock: "", minStock: "", category: "" }); }, "Item added.")}>Add</button>
              </div>
            </div>
          </div>
        )}

        {tab === "purchases" && (
          <div className="space-y-4">
            <div className="card p-5">
              <div className="font-700 mb-2 text-sm">Record a purchase (without a request)</div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <select className={inputCls} style={inputStyle} value={direct.itemId} onChange={(e) => setDirect({ ...direct, itemId: e.target.value })}>
                  <option value="">Item…</option>{list.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
                <input className={inputCls} style={inputStyle} placeholder="Quantity" inputMode="decimal" value={direct.quantity} onChange={(e) => setDirect({ ...direct, quantity: e.target.value })} />
                <input className={inputCls} style={inputStyle} placeholder="Unit cost ৳" inputMode="decimal" value={direct.unitCost} onChange={(e) => setDirect({ ...direct, unitCost: e.target.value })} />
                <input className={inputCls} style={inputStyle} placeholder="Supplier" value={direct.supplier} onChange={(e) => setDirect({ ...direct, supplier: e.target.value })} />
                <input className={inputCls} style={inputStyle} placeholder="Note" value={direct.note} onChange={(e) => setDirect({ ...direct, note: e.target.value })} />
                <button type="button" className="btn-primary px-3 py-2 rounded-xl text-sm" onClick={() => run(async () => { await call(apiBase, token, "/admin/purchases", { method: "POST", body: { ...direct, itemId: Number(direct.itemId) } }); setDirect({ itemId: "", quantity: "", unitCost: "", supplier: "", note: "" }); }, "Purchase recorded and official stock updated.")}>Save</button>
              </div>
            </div>
            <div className="card p-5 overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase" style={{ color: "var(--ink-soft)" }}><th className="py-2 pr-3">When</th><th className="pr-3">Item</th><th className="pr-3">Qty</th><th className="pr-3">Unit ৳</th><th className="pr-3">Total ৳</th><th>Supplier</th></tr></thead>
                <tbody>{((purchases.data && purchases.data.purchases) || []).map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: "var(--line)" }}><td className="py-2 pr-3">{when(p.purchasedAt)}</td><td className="pr-3">{p.itemName}</td><td className="pr-3">{fmt(p.quantity)} {p.unit}</td><td className="pr-3">{fmt(p.unitCost)}</td><td className="pr-3">{fmt(p.totalCost)}</td><td>{p.supplier || "—"}</td></tr>
                ))}</tbody></table>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="card p-5 overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase" style={{ color: "var(--ink-soft)" }}><th className="py-2 pr-3">When</th><th className="pr-3">Item</th><th className="pr-3">Change</th><th className="pr-3">Before → After</th><th className="pr-3">Reason</th><th>By</th></tr></thead>
              <tbody>{((history.data && history.data.history) || []).map((h) => (
                <tr key={h.id} className="border-t" style={{ borderColor: "var(--line)" }}><td className="py-2 pr-3">{when(h.createdAt)}</td><td className="pr-3">{h.itemName}</td><td className="pr-3 font-mono">{h.change > 0 ? "+" : ""}{fmt(h.change)} {h.unit}</td><td className="pr-3 font-mono">{fmt(h.before)} → {fmt(h.after)}</td><td className="pr-3">{h.reason}{h.note ? ` · ${h.note}` : ""}</td><td>{h.actorName || "System"}</td></tr>
              ))}</tbody></table>
          </div>
        )}
      </div>
    );
  }

  window.CDInventory = { StaffInventoryPanel, AdminInventoryPanel };
})();
