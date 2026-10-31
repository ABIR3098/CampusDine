// Ratings, admin side: what students think of the meals (average, spread, best / lowest meals, latest comments).
// Names are left out on purpose, so students can be honest.

// bars: how many 5-star, 4-star ... ratings
function HallRatingBars({ distribution }) {
  const max = Math.max(1, ...distribution.map((d) => d.count));
  return (
    <div>
      {distribution.slice().reverse().map((d) => (
        <div key={d.stars} className="flex items-center gap-2 text-xs" style={{ marginBottom: 6 }}>
          <span style={{ width: 30 }}>{d.stars} ★</span>
          <div style={{ flex: 1, height: 10, borderRadius: 6, overflow: "hidden", background: "var(--line)" }}>
            <div style={{ width: `${(d.count / max) * 100}%`, height: "100%", background: "var(--gold)" }} />
          </div>
          <span style={{ width: 30, textAlign: "right" }}>{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function HallMealRatingTable({ rows }) {
  return (
    <div className="hl-scroll">
      <table className="hl-table">
        <thead><tr><th>Date</th><th>Meal</th><th>Menu</th><th>Rating</th><th>Votes</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date + r.slot}>
              <td className="whitespace-nowrap">{hallDateLabel(r.date)}</td>
              <td className="whitespace-nowrap">{HALL_SLOT_EMOJI[r.slot]} {HALL_SLOT_LABEL[r.slot]}</td>
              <td>{r.items || "—"}</td>
              <td className="font-700 whitespace-nowrap">{r.average} ★</td>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// data = GET /api/hall/ratings/summary
function HallRatingsSummaryView({ data }) {
  if (!data.overall.count) return <div className="hl-empty">No ratings in the last {data.days} days yet.</div>;
  const rated = data.bySlot.filter((s) => s.count > 0);
  const best = rated.slice().sort((a, b) => b.average - a.average)[0];
  const worst = rated.slice().sort((a, b) => a.average - b.average)[0];
  const lowest = data.meals.slice(0, 5);
  const lowestKeys = lowest.map((r) => r.date + r.slot);
  const top = data.meals.length > 5 ? data.meals.slice(-5).reverse().filter((r) => !lowestKeys.includes(r.date + r.slot)) : [];
  return (
    <>
      <div className="hl-stats">
        <HallStat icon="⭐" label="Average rating" value={`${data.overall.average} ★`} sub={`last ${data.days} days`} />
        <HallStat icon="🗳" label="Ratings given" value={data.overall.count} sub="by students & teachers" />
        <HallStat icon="👍" label="Best liked" value={best ? HALL_SLOT_LABEL[best.slot] : "—"} sub={best ? `${best.average} ★ (${best.count})` : ""} />
        <HallStat icon="🔧" label="Needs attention" value={worst ? HALL_SLOT_LABEL[worst.slot] : "—"} sub={worst ? `${worst.average} ★ (${worst.count})` : ""} />
      </div>
      <div className="hl-grid2" style={{ marginBottom: 16 }}>
        <div className="hl-tile">
          <div className="font-700 mb-2">How people rated</div>
          <HallRatingBars distribution={data.distribution} />
        </div>
        <div className="hl-tile">
          <div className="font-700 mb-2">By meal time</div>
          {data.bySlot.map((s) => (
            <div key={s.slot} className="flex justify-between text-sm" style={{ marginBottom: 6 }}>
              <span>{HALL_SLOT_EMOJI[s.slot]} {s.label}</span>
              <span>{s.count ? <b>{s.average} ★ <span className="hl-muted" style={{ fontWeight: 400 }}>({s.count})</span></b> : <span className="hl-muted">no ratings</span>}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="font-700 mb-2">{top.length ? "Lowest rated meals" : "Rated meals"}</div>
      <HallMealRatingTable rows={lowest} />
      {top.length > 0 && (
        <>
          <div className="font-700 mb-2 mt-4">Best rated meals</div>
          <HallMealRatingTable rows={top} />
        </>
      )}
      {data.comments.length > 0 && (
        <>
          <div className="font-700 mb-2 mt-4">Latest comments</div>
          {data.comments.map((c, i) => (
            <div key={i} className="hl-tile" style={{ marginBottom: 8 }}>
              <div className="text-xs hl-muted">{HALL_SLOT_EMOJI[c.slot]} {HALL_SLOT_LABEL[c.slot]} · {hallDateLabel(c.date)} · {"★".repeat(c.stars)}</div>
              <div className="text-sm mt-1">{c.comment}</div>
            </div>
          ))}
        </>
      )}
    </>
  );
}

function HallRatingsAdmin({ call, notify }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let dead = false;
    setData(null); setErr(null);
    call(`/api/hall/ratings/summary?days=${days}`)
      .then((d) => { if (!dead) setData(d); })
      .catch((e) => { if (!dead) { setErr(e.message || String(e)); notify(e, true); } });
    return () => { dead = true; };
  }, [days]);
  return (
    <HallCard title="Meal ratings" icon="⭐" right={(
      <div className="flex gap-1.5">
        {[7, 30, 90].map((n) => (
          <button key={n} className={`hl-btn sm ${days === n ? "" : "ghost"}`} onClick={() => setDays(n)}>{n} days</button>
        ))}
      </div>
    )}>
      {err ? <div className="hl-error">⚠️ {err}</div> : !data ? <div className="hl-empty">Loading…</div> : <><HallRatingsSummaryView data={data} /><div className="mt-4"><HallRatingsTrend call={call} days={days} /></div></>}
    </HallCard>
  );
}
