// Ratings (admin): is each meal getting better or worse? A small line per meal time.

// a line through the daily averages (1-5 stars). points = [{ date, average }], from/to = the period
function HallSparkline({ points, from, to }) {
  const W = 200, H = 46, pad = 4;
  const span = Math.max(1, (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
  const x = (d) => pad + ((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 / span) * (W - 2 * pad);
  const y = (v) => H - pad - ((v - 1) / 4) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="46" role="img" aria-label="Rating trend" preserveAspectRatio="none">
      <line x1={pad} x2={W - pad} y1={y(3)} y2={y(3)} stroke="var(--line)" strokeDasharray="3 3" />
      {points.length > 1 && <polyline fill="none" stroke="var(--gold-deep)" strokeWidth="2" points={points.map((p) => `${x(p.date).toFixed(1)},${y(p.average).toFixed(1)}`).join(" ")} />}
      {points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.average)} r="2.5" fill="var(--gold-deep)" />)}
    </svg>
  );
}

// data = GET /api/hall/ratings/trend
function HallRatingsTrendView({ data }) {
  if (!data.series.some((s) => s.count)) return <div className="hl-empty">No ratings in the last {data.days} days to draw a trend from.</div>;
  return (
    <div className="hl-grid3" style={{ marginBottom: 16 }}>
      {data.series.map((s) => (
        <div key={s.slot} className="hl-tile">
          <div className="flex items-center justify-between gap-2">
            <div className="font-700">{HALL_SLOT_EMOJI[s.slot]} {s.label}</div>
            {s.count > 0 ? <b>{s.average} ★</b> : <span className="hl-muted text-xs">no ratings</span>}
          </div>
          {s.count > 0 && (
            <>
              <HallSparkline points={s.points} from={data.from} to={data.to} />
              <div className="text-xs mt-1" style={{ color: s.change == null ? undefined : s.change >= 0 ? "var(--ok-fg)" : "var(--danger-fg)" }}>
                {s.change == null ? <span className="hl-muted">not enough ratings to compare</span> : `${s.change >= 0 ? "▲ +" : "▼ "}${s.change} since the first half`}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function HallRatingsTrend({ call, days }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let dead = false;
    setData(null);
    call(`/api/hall/ratings/trend?days=${days}`).then((d) => { if (!dead) setData(d); }).catch(() => { /* optional chart */ });
    return () => { dead = true; };
  }, [days]);
  if (!data) return null;
  return (
    <>
      <div className="font-700 mb-2">Trend</div>
      <HallRatingsTrendView data={data} />
    </>
  );
}
