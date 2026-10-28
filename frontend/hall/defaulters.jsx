// Dues (admin): who still owes money for a month, how much, whether their wallet can cover it,
// with a "Remind" button (sends a Hall notification) and a CSV download.

// data = GET /api/hall/defaulters → CSV text
function hallDuesToCsv(data) {
  const rows = [["Name", "ID", "Role", "Due (BDT)", "Paid (BDT)", "Confirmed (BDT)", "Wallet (BDT)", "Short by (BDT)", "Auto-pay", "Last reminded"]];
  data.defaulters.forEach((r) => rows.push([r.name, r.externalId || "", r.role, r.due, r.paid, r.confirmed, r.wallet, r.shortfall,
    r.autopay ? "ON" : "OFF", r.lastReminded ? String(r.lastReminded).slice(0, 16).replace("T", " ") : ""]));
  rows.push([]);
  rows.push(["People who owe", data.summary.count]);
  rows.push(["Total due (BDT)", data.summary.totalDue]);
  rows.push(["Wallet shortfall (BDT)", data.summary.totalShortfall]);
  return "\uFEFF" + rows.map((r) => r.map(hallCsvCell).join(",")).join("\r\n");
}

// the people who match what was typed in the search box (name or ID)
function hallDuesFilter(rows, text) {
  const q = String(text || "").trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => String(r.name).toLowerCase().includes(q) || String(r.externalId || "").toLowerCase().includes(q));
}

function HallDuesView({ data, busyId, onRemind, onRemindAll, onCsv }) {
  const [text, setText] = useState("");
  const s = data.summary;
  const label = hallYmLabel(`${data.year}-${String(data.month).padStart(2, "0")}`);
  const rows = hallDuesFilter(data.defaulters, text);
  const remindable = data.defaulters.filter((r) => !r.remindedRecently).length;
  return (
    <>
      <div className="hl-stats">
        <HallStat icon="📌" label="People who owe" value={s.count} sub={`of ${data.members} hall members`} />
        <HallStat icon="💸" label="Total due" value={hallTaka(s.totalDue)} sub="closed meals, not paid yet" />
        <HallStat icon="👛" label="Wallet shortfall" value={hallTaka(s.totalShortfall)} sub="they can't cover today" />
        <HallStat icon="🔁" label="Auto-pay ON" value={s.autopayOn} sub="among the people who owe" />
      </div>
      {s.count === 0 ? <div className="hl-empty">🎉 Nobody owes anything for {label}.</div> : (
        <>
          <div className="flex gap-2 flex-wrap items-center mb-3">
            <input className="hl-input" style={{ flex: "1 1 180px", maxWidth: 280 }} placeholder="Search name or ID" value={text} onChange={(e) => setText(e.target.value)} />
            <button className="hl-btn sm" disabled={remindable === 0 || busyId === "all"} onClick={onRemindAll}>🔔 Remind all ({remindable})</button>
            <button className="hl-btn sm ghost" onClick={onCsv}>⬇ CSV</button>
          </div>
          <div className="hl-scroll">
            <table className="hl-table">
              <thead><tr>
                <th>Name</th><th style={{ textAlign: "right" }}>Due</th><th style={{ textAlign: "right" }}>Paid</th>
                <th style={{ textAlign: "right" }}>Wallet</th><th style={{ textAlign: "right" }}>Short by</th><th>Auto-pay</th><th>Reminder</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b><div className="text-[11px] hl-muted">{r.externalId || "—"} · {r.role}</div></td>
                    <td className="font-700" style={{ textAlign: "right" }}>{hallTaka(r.due)}</td>
                    <td style={{ textAlign: "right" }}>{hallTaka(r.paid)}</td>
                    <td style={{ textAlign: "right" }}>{hallTaka(r.wallet)}</td>
                    <td style={{ textAlign: "right", color: r.shortfall > 0 ? "var(--danger-fg)" : undefined }}>{r.shortfall > 0 ? hallTaka(r.shortfall) : "—"}</td>
                    <td><span className={`hl-chip ${r.autopay ? "ok" : ""}`}>{r.autopay ? "ON" : "OFF"}</span></td>
                    <td>
                      <button className="hl-btn sm ghost" disabled={r.remindedRecently || busyId === r.id} onClick={() => onRemind(r.id)}
                        title={r.remindedRecently ? "Reminded in the last 24 hours" : "Send a Hall notification"}>
                        {r.remindedRecently ? "✓ Reminded" : "🔔 Remind"}
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="hl-muted" style={{ textAlign: "center" }}>No match.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function HallDues({ call, notify }) {
  const [ym, setYm] = useState(null);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async (target) => {
    try {
      setErr(null);
      const q = target ? `?year=${target.year}&month=${target.month}` : "";
      const d = await call("/api/hall/defaulters" + q);
      setData(d); setYm({ year: d.year, month: d.month });
    } catch (e) { setErr(e.message || String(e)); notify(e, true); }
  };
  useEffect(() => { load(); }, []);

  const shift = (n) => {
    let y = ym.year, m = ym.month + n;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setData(null); load({ year: y, month: m });
  };
  const remind = async (ids) => {
    setBusyId(ids ? ids[0] : "all");
    try {
      const body = { year: ym.year, month: ym.month };
      if (ids) body.userIds = ids;
      const r = await call("/api/hall/defaulters/remind", { method: "POST", body });
      notify(`Reminder sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}${r.skipped.length ? ` (${r.skipped.length} skipped)` : ""}.`);
      await load(ym);
    } catch (e) { notify(e, true); }
    setBusyId(null);
  };
  const remindAll = () => {
    if (window.confirm("Send a Hall notification to everyone who owes (except people reminded in the last 24 hours)?")) remind(null);
  };
  const csv = () => hallDownloadFile(`hall-dues-${data.year}-${String(data.month).padStart(2, "0")}.csv`, hallDuesToCsv(data), "text/csv;charset=utf-8");
  const label = ym ? hallYmLabel(`${ym.year}-${String(ym.month).padStart(2, "0")}`) : "";

  return (
    <HallCard title={`Dues — ${label}`} icon="📌" sub="Closed meals that are not paid yet. People see the same amount as 'Due now' on their My bill." right={ym && (
      <div className="flex gap-1.5 flex-wrap justify-end">
        <HallAutoPayRunner call={call} notify={notify} year={ym.year} month={ym.month} onDone={() => load(ym)} />
        <button className="hl-btn sm ghost" onClick={() => shift(-1)}>‹ Prev</button>
        <button className="hl-btn sm ghost" onClick={() => shift(1)}>Next ›</button>
      </div>
    )}>
      {err ? <div className="hl-error">⚠️ {err}</div>
        : !data ? <div className="hl-empty">Loading… (working out everyone's bill)</div>
        : <HallDuesView data={data} busyId={busyId} onRemind={(id) => remind([id])} onRemindAll={remindAll} onCsv={csv} />}
    </HallCard>
  );
}
Hall.register({ key: "dues", label: "Dues", icon: "📌", order: 10.5, roles: ["admin"], component: HallDues });
