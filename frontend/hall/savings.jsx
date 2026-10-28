// Home: "your month so far" — how many closed meals were ON / OFF and how much the OFF meals saved.
// Uses the same /api/hall/bill data as the My bill tab plus the meal prices from /api/hall/slots.
// Only closed meals are counted, because those can't change any more.

// bill = GET /api/hall/bill, slots = GET /api/hall/slots
function hallSavingsOf(bill, slots) {
  const price = {};
  (slots || []).forEach((s) => { price[s.slot] = Number(s.price) || 0; });
  let eaten = 0, skipped = 0, saved = 0;
  bill.days.forEach((d) => HALL_SLOTS.forEach((slot) => {
    const c = d.slots[slot];
    if (!c.locked) return;
    if (c.status === "on") eaten++;
    else { skipped++; saved += price[slot] || 0; }
  }));
  const closed = eaten + skipped;
  return { eaten, skipped, saved, closed, spent: Number(bill.summary.confirmedTotal) || 0, skipPercent: closed ? Math.round((skipped / closed) * 100) : 0 };
}

function HallSavingsView({ info, monthName }) {
  return (
    <HallCard title={`Your ${monthName} so far`} icon="🐷">
      {info.closed === 0 ? <div className="hl-empty">No meal has closed yet this month.</div> : (
        <div className="hl-stats" style={{ marginBottom: 0 }}>
          <HallStat icon="🍽" label="Meals ON" value={info.eaten} sub="closed meals" />
          <HallStat icon="⛔" label="Meals OFF" value={info.skipped} sub={`${info.skipPercent}% of closed meals`} />
          <HallStat icon="💚" label="Money saved" value={hallTaka(info.saved)} sub="from meals you turned OFF" />
          <HallStat icon="💰" label="Spent so far" value={hallTaka(info.spent)} sub="closed meals" />
        </div>
      )}
    </HallCard>
  );
}

function HallSavingsCard({ call }) {
  const [info, setInfo] = useState(null);
  const [monthName, setMonthName] = useState("month");
  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const [bill, slots] = await Promise.all([call("/api/hall/bill"), call("/api/hall/slots")]);
        if (dead) return;
        setInfo(hallSavingsOf(bill, slots));
        setMonthName(new Date(Date.UTC(bill.year, bill.month - 1, 1)).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" }));
      } catch (e) { /* the card is a bonus — if it can't load, it just stays hidden */ }
    };
    load();
    window.addEventListener("hall-changed", load); // a meal was switched ON/OFF
    return () => { dead = true; window.removeEventListener("hall-changed", load); };
  }, []);
  if (!info) return null;
  return <div className="mt-6"><HallSavingsView info={info} monthName={monthName} /></div>;
}
