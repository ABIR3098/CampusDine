// Home: warns when the wallet can't cover the Hall bill.
//  - red:    wallet < what is due now (closed meals not paid yet)
//  - yellow: wallet < the rest of this month's estimate (open meals at today's price)

// bill = GET /api/hall/bill → null when everything is fine, else { level, text, need }
function hallBalanceAlertOf(bill) {
  const wallet = Number(bill.walletBalance) || 0;
  const due = Number(bill.due) || 0;
  const rest = Math.max(0, (Number(bill.summary.total) || 0) - (Number(bill.paid) || 0));
  if (due > wallet) {
    return { level: "danger", need: due - wallet, text: `Your wallet has ${hallTaka(wallet)} but you owe ${hallTaka(due)} for closed meals.` };
  }
  if (rest > wallet) {
    return { level: "warn", need: rest - wallet, text: `Your wallet (${hallTaka(wallet)}) may not cover the rest of this month (about ${hallTaka(rest)}).` };
  }
  return null;
}

function HallBalanceBanner({ alert, goTab }) {
  const danger = alert.level === "danger";
  return (
    <div className="hl-banner" style={{ background: danger ? "var(--danger-bg)" : "var(--warn-bg)", borderColor: danger ? "var(--danger-border)" : "var(--warn-border)" }}>
      <div className="text-sm">
        <div className="font-700">{danger ? "⚠️ Low wallet balance" : "👛 Heads up"}</div>
        <div className="text-xs opacity-80 mt-0.5">{alert.text} Add at least <b>{hallTaka(Math.ceil(alert.need))}</b>.</div>
      </div>
      <button className="hl-btn sm" onClick={() => goTab("wallet")}>Add money</button>
    </div>
  );
}

function HallBalanceAlert({ call, goTab }) {
  const [alert, setAlert] = useState(null);
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const bill = await call("/api/hall/bill");
        if (!dead) setAlert(hallBalanceAlertOf(bill));
      } catch (e) { /* optional banner — stay hidden if the bill can't load */ }
    };
    load();
    window.addEventListener("hall-changed", load);
    return () => { dead = true; window.removeEventListener("hall-changed", load); };
  }, []);
  if (!alert) return null;
  return <HallBalanceBanner alert={alert} goTab={goTab} />;
}
