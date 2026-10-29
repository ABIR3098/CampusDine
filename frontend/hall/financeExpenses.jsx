// Mess finance: add an expense, and the list of this month's expenses.

function HallExpenseForm({ categories, suppliers, defaultDate, busy, onAdd }) {
  const [date, setDate] = useState(defaultDate);
  const [category, setCategory] = useState("grains");
  const [amount, setAmount] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const submit = async () => {
    const saved = await onAdd({ date, category, amount: Number(amount), supplierId: supplierId ? Number(supplierId) : undefined, note });
    if (saved) { setAmount(""); setNote(""); }
  };
  return (
    <div className="hl-tile" style={{ marginBottom: 14 }}>
      <div className="font-700 mb-2">➕ Add an expense</div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <div><label className="hl-label">Date</label><input type="date" className="hl-input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label className="hl-label">What for</label>
          <select className="hl-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select></div>
        <div><label className="hl-label">Amount (৳)</label><input type="number" min="0" className="hl-input" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="hl-label">Supplier (optional)</label>
          <select className="hl-input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">—</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div style={{ gridColumn: "span 2" }}><label className="hl-label">Note (optional)</label><input className="hl-input" maxLength={255} placeholder="e.g. 50 kg rice" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      </div>
      <div className="mt-2"><button className="hl-btn sm" disabled={busy || !(Number(amount) > 0) || !date} onClick={submit}>Add expense</button></div>
    </div>
  );
}

function HallExpenseList({ expenses, onDelete }) {
  if (!expenses.length) return <div className="hl-empty">No expense recorded for this month yet.</div>;
  return (
    <div className="hl-scroll">
      <table className="hl-table">
        <thead><tr><th>Date</th><th>What for</th><th>Supplier</th><th>Note</th><th style={{ textAlign: "right" }}>Amount</th><th /></tr></thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td className="whitespace-nowrap">{hallDateLabel(e.date)}</td>
              <td>{e.categoryLabel}</td>
              <td>{e.supplierName || "—"}</td>
              <td>{e.note || "—"}</td>
              <td className="font-700" style={{ textAlign: "right" }}>{hallTaka(e.amount)}</td>
              <td className="hl-no-print"><button className="hl-btn sm danger" title="Delete this entry" onClick={() => onDelete(e)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
