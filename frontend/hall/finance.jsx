// Finance (admin): how the mess is doing this month — what was billed and collected, what was spent,
// what one plate costs, and whether the hall is making or losing money. Print/PDF and CSV included.

// data = GET /api/hall/finance/summary, expenses = GET /api/hall/finance/expenses → CSV text
function hallFinanceToCsv(data, expenses) {
  const rows = [["Mess finance", `${data.year}-${String(data.month).padStart(2, "0")}`], []];
  rows.push(["Plates served (closed meals)", data.plates]);
  rows.push(["Billed to students (BDT)", data.billed]);
  rows.push(["Collected (BDT)", data.collected]);
  rows.push(["Still to collect (BDT)", data.outstanding]);
  rows.push(["Last-call sales (BDT)", data.lastCall.amount]);
  rows.push(["Expenses (BDT)", data.expense.total]);
  rows.push(["Result so far: collected + last-call - expenses (BDT)", data.result.cash]);
  rows.push(["Result if everyone pays (BDT)", data.result.ifAllPaid]);
  if (data.perPlate) {
    rows.push(["Cost per plate (BDT)", data.perPlate.cost]);
    rows.push(["Price per plate (BDT)", data.perPlate.price]);
    rows.push(["Margin per plate (BDT)", data.perPlate.margin]);
  }
  rows.push([]);
  rows.push(["Date", "What for", "Supplier", "Note", "Amount (BDT)"]);
  expenses.forEach((e) => rows.push([e.date, e.categoryLabel, e.supplierName || "", e.note || "", e.amount]));
  return "\uFEFF" + rows.map((r) => r.map(hallCsvCell).join(",")).join("\r\n");
}

function HallFinanceView({ data }) {
  const pp = data.perPlate;
  const good = data.result.cash >= 0;
  return (
    <>
      <div className="hl-stats">
        <HallStat icon="🧾" label="Billed" value={hallTaka(data.billed)} sub={`${data.plates} plates, closed meals`} />
        <HallStat icon="💵" label="Collected" value={hallTaka(data.collected)} sub={`${hallTaka(data.outstanding)} still to collect`} />
        <HallStat icon="🛒" label="Expenses" value={hallTaka(data.expense.total)} sub="food, gas, wages …" />
        <HallStat icon={good ? "📈" : "📉"} label="Result so far" value={hallTaka(data.result.cash)} sub={`if everyone pays: ${hallTaka(data.result.ifAllPaid)}`} />
      </div>

      <div className="hl-banner" style={{ background: !pp ? "var(--panel)" : pp.margin >= 0 ? "var(--ok-bg)" : "var(--danger-bg)", borderColor: !pp ? "var(--line)" : pp.margin >= 0 ? "var(--ok-border)" : "var(--danger-border)" }}>
        {pp ? (
          <div className="text-sm">
            <div>🍽 One plate costs <b>{hallTaka(pp.cost)}</b> and is sold for <b>{hallTaka(pp.price)}</b> on average.</div>
            <div className="text-xs opacity-80 mt-0.5">
              {pp.margin >= 0 ? `The hall keeps ${hallTaka(pp.margin)} on every plate.` : `The hall loses ${hallTaka(-pp.margin)} on every plate — prices or costs need a look.`}
              {data.lastCall.plates > 0 && ` Last-call sales are not in this number.`}
            </div>
          </div>
        ) : <div className="text-sm">No closed meal in this month yet, so there is no cost per plate to show.</div>}
      </div>

      <div className="hl-grid2" style={{ marginBottom: 14 }}>
        <div className="hl-tile">
          <div className="font-700 mb-2">Plates per day</div>
          <HallDayBars days={data.daily} field="plates" color="var(--gold)" fmt={(n) => `${n} plates`} />
        </div>
        <div className="hl-tile">
          <div className="font-700 mb-2">Spending per day</div>
          <HallDayBars days={data.daily} field="expense" color="var(--brick)" fmt={hallTaka} />
        </div>
        <div className="hl-tile">
          <div className="font-700 mb-2">Money in and out</div>
          <HallHBars rows={[
            { key: "billed", label: "Billed", value: data.billed, text: hallTaka(data.billed) },
            { key: "collected", label: "Collected", value: data.collected, text: hallTaka(data.collected), color: "var(--ok-fg)" },
            { key: "lastcall", label: "Last-call sales", value: data.lastCall.amount, text: hallTaka(data.lastCall.amount), color: "var(--ok-fg)" },
            { key: "expense", label: "Expenses", value: data.expense.total, text: hallTaka(data.expense.total), color: "var(--brick)" },
          ]} />
        </div>
        <div className="hl-tile">
          <div className="font-700 mb-2">Where the money went</div>
          {data.expense.byCategory.length === 0 ? <div className="text-sm hl-muted">No expenses yet.</div> : (
            <HallHBars color="var(--brick)" rows={data.expense.byCategory.map((c) => ({ key: c.category, label: c.label, value: c.amount, text: hallTaka(c.amount) }))} />
          )}
        </div>
      </div>

      <div className="hl-tile" style={{ marginBottom: 14 }}>
        <div className="font-700 mb-2">By meal</div>
        <HallHBars rows={data.bySlot.map((s) => ({ key: s.slot, label: `${HALL_SLOT_EMOJI[s.slot]} ${HALL_SLOT_LABEL[s.slot]} · ${s.plates} plates`, value: s.billed, text: hallTaka(s.billed) }))} />
      </div>
    </>
  );
}

function HallFinance({ call, notify }) {
  const [ym, setYm] = useState(null);
  const [data, setData] = useState(null);
  const [exp, setExp] = useState(null);       // { categories, expenses }
  const [suppliers, setSuppliers] = useState([]);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async (target) => {
    try {
      setErr(null);
      const q = target ? `?year=${target.year}&month=${target.month}` : "";
      const d = await call("/api/hall/finance/summary" + q);
      const e = await call(`/api/hall/finance/expenses?year=${d.year}&month=${d.month}`);
      setData(d); setExp(e); setYm({ year: d.year, month: d.month });
    } catch (e) { setErr(e.message || String(e)); notify(e, true); }
  };
  useEffect(() => {
    load();
    call("/api/hall/suppliers").then((r) => setSuppliers(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const shift = (n) => {
    let y = ym.year, m = ym.month + n;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    setData(null); setExp(null); load({ year: y, month: m });
  };
  const add = async (body) => {
    setBusy(true);
    try {
      await call("/api/hall/finance/expenses", { method: "POST", body });
      notify("Expense added.");
      await load(ym);
      setBusy(false);
      return true;
    } catch (e) { notify(e, true); setBusy(false); return false; }
  };
  const del = async (e) => {
    if (!window.confirm(`Delete this expense (${e.categoryLabel}, ${hallTaka(e.amount)})?`)) return;
    try { await call(`/api/hall/finance/expenses/${e.id}`, { method: "DELETE" }); notify("Expense deleted."); await load(ym); }
    catch (x) { notify(x, true); }
  };
  const label = ym ? hallYmLabel(`${ym.year}-${String(ym.month).padStart(2, "0")}`) : "";
  const csv = () => hallDownloadFile(`hall-finance-${ym.year}-${String(ym.month).padStart(2, "0")}.csv`, hallFinanceToCsv(data, exp.expenses), "text/csv;charset=utf-8");
  // the date the expense form starts with: today when looking at this month, else the 1st of the month
  const defaultDate = data ? (data.today.slice(0, 7) === `${data.year}-${String(data.month).padStart(2, "0")}` ? data.today : `${data.year}-${String(data.month).padStart(2, "0")}-01`) : "";

  return (
    <HallCard title={`Mess finance — ${label}`} icon="💹" sub="Income counts closed meals only, so these numbers do not change later. Plates include guests." right={ym && (
      <div className="flex gap-1.5 flex-wrap justify-end">
        {data && exp && <button className="hl-btn sm ghost" onClick={csv}>⬇ CSV</button>}
        <button className="hl-btn sm ghost" onClick={() => window.print()} title="Print, or choose Save as PDF">🖨 Print / PDF</button>
        <button className="hl-btn sm ghost" onClick={() => shift(-1)}>‹ Prev</button>
        <button className="hl-btn sm ghost" onClick={() => shift(1)}>Next ›</button>
        <style>{HALL_PRINT_CSS + " @media print { .hl-no-print { display: none !important; } }"}</style>
      </div>
    )}>
      {err ? <div className="hl-error">⚠️ {err}</div> : !data || !exp ? <div className="hl-empty">Loading…</div> : (
        <>
          <HallFinanceView data={data} />
          <div className="hl-no-print"><HallExpenseForm key={`${data.year}-${data.month}`} categories={exp.categories} suppliers={suppliers} defaultDate={defaultDate} busy={busy} onAdd={add} /></div>
          <div className="font-700 mb-2">Expenses in {label}</div>
          <HallExpenseList expenses={exp.expenses} onDelete={del} />
        </>
      )}
    </HallCard>
  );
}
Hall.register({ key: "finance", label: "Finance", icon: "💹", order: 10.6, roles: ["admin"], component: HallFinance });
