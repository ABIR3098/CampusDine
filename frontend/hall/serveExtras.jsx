// Serve tab (admin): progress of the meal, a soft beep for each new token, and a sound switch.

// a short beep made in the browser (no sound file needed); kind "new" = a token arrived, "ok" = served
function hallBeep(kind) {
  try {
    if (localStorage.getItem("hall_serve_sound") === "off") return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = kind === "new" ? 880 : 520;
    gain.gain.value = 0.08;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (kind === "new" ? 0.18 : 0.1));
    osc.onended = () => ctx.close();
  } catch (e) { /* no sound is fine */ }
}

// did a new token join since last time? (prev = how many were waiting before, null = nothing seen yet)
function hallNewTokenArrived(prev, q) {
  return prev !== null && !!q && q.waiting.length > prev;
}

// beeps when a new token joins the queue (q = GET /api/hall/queue, null while loading)
function useHallServeSounds(q) {
  const prev = useRef(null);
  useEffect(() => {
    if (!q) { prev.current = null; return; }
    if (hallNewTokenArrived(prev.current, q)) hallBeep("new");
    prev.current = q.waiting.length;
  }, [q]);
}

// "Served 42 of 90 tokens" with a bar
function HallServeProgress({ q }) {
  const total = q.served + q.waiting.length;
  const pct = total ? Math.round((q.served / total) * 100) : 0;
  return (
    <div className="hl-tile" style={{ marginBottom: 12 }}>
      <div className="flex justify-between text-sm"><span>Served <b>{q.served}</b> of <b>{total}</b> tokens</span><b>{pct}%</b></div>
      <div style={{ height: 10, borderRadius: 6, overflow: "hidden", marginTop: 6, background: "var(--line)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "var(--ok-fg)" }} />
      </div>
      <div className="text-xs hl-muted mt-1">{q.waitingPlates} plates still waiting</div>
    </div>
  );
}

function HallServeSoundToggle() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem("hall_serve_sound") !== "off"; } catch (e) { return true; } });
  const flip = () => {
    const next = !on;
    setOn(next);
    try { localStorage.setItem("hall_serve_sound", next ? "on" : "off"); } catch (e) { /* ignore */ }
    if (next) hallBeep("ok");
  };
  return <button className="hl-btn sm ghost" title={on ? "Sound is on" : "Sound is off"} aria-pressed={on} onClick={flip}>{on ? "🔔 Sound" : "🔕 Muted"}</button>;
}
