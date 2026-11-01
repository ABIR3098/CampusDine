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
