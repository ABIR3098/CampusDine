// Diet, member side: say what you don't eat and what you are allergic to. The week's menu then shows
// which meals touch it, and Home warns you about meals that are still ON.
// The tags come from the words in the menu ("Beef curry" → Beef). It is a helper, not a guarantee.

const HALL_DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// the look of one tag chip: red = allergy, yellow = avoided, plain = nothing to do with you
function hallTagStyle(level, on) {
  if (level === "allergy") return on ? { background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger-fg)" } : {};
  if (level === "avoid") return on ? { background: "var(--warn-bg)", borderColor: "var(--warn-border)", color: "var(--warn-fg)" } : {};
  return {};
}

// a row of tags you can switch on/off. level = "avoid" | "allergy"
function HallTagPicker({ tags, selected, level, onToggle }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {tags.map((t) => {
        const on = selected.includes(t.key);
        return (
          <button key={t.key} type="button" aria-pressed={on} className="hl-chip" onClick={() => onToggle(t.key)}
            style={{ cursor: "pointer", ...hallTagStyle(level, on) }}>{on ? "✓ " : ""}{t.label}</button>
        );
      })}
    </div>
  );
}

function HallDietEditor({ info, busy, onSave }) {
  const [avoid, setAvoid] = useState(info.avoid);
  const [allergies, setAllergies] = useState(info.allergies);
  const [note, setNote] = useState(info.note);
  const flip = (list, key) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  // a tag can't be both: picking an allergy takes it out of "avoid"
  const toggleAllergy = (key) => { setAllergies(flip(allergies, key)); setAvoid(avoid.filter((k) => k !== key)); };
  const toggleAvoid = (key) => { if (!allergies.includes(key)) setAvoid(flip(avoid, key)); };
  const same = (a, b) => a.slice().sort().join() === b.slice().sort().join();
  const dirty = !same(avoid, info.avoid) || !same(allergies, info.allergies) || note.trim() !== info.note;
  return (
    <div className="hl-tile" style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="font-700">I don't eat</div>
        <button type="button" className="hl-btn sm ghost" onClick={() => setAvoid(info.vegetarian.filter((k) => !allergies.includes(k)))}>🥦 Vegetarian (no meat or fish)</button>
      </div>
      <HallTagPicker tags={info.tags} selected={avoid} level="avoid" onToggle={toggleAvoid} />
      <div className="font-700 mt-3 mb-2">I'm allergic to <span className="text-xs hl-muted" style={{ fontWeight: 400 }}>(serious — you get the strongest warning)</span></div>
      <HallTagPicker tags={info.tags} selected={allergies} level="allergy" onToggle={toggleAllergy} />
      <div className="mt-3">
        <label className="hl-label">Note for the kitchen (optional)</label>
        <input className="hl-input" maxLength={160} placeholder="e.g. carries an inhaler" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="mt-3"><button className="hl-btn sm" disabled={busy || !dirty} onClick={() => onSave({ avoid, allergies, note: note.trim() })}>Save</button></div>
    </div>
  );
}

// menu = GET /api/hall/diet/menu → the week starting today, tags coloured by how they affect you
function HallDietMenu({ menu, today, avoid, allergies, labels }) {
  const level = (key) => (allergies.includes(key) ? "allergy" : avoid.includes(key) ? "avoid" : null);
  return (
    <div className="hl-scroll">
      <table className="hl-table">
        <thead><tr><th>Day</th>{HALL_SLOTS.map((s) => <th key={s}>{HALL_SLOT_EMOJI[s]} {HALL_SLOT_LABEL[s]}</th>)}</tr></thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const dow = (today + i) % 7;
            return (
              <tr key={dow} className={i === 0 ? "today" : ""}>
                <td className="whitespace-nowrap font-600">{i === 0 ? "Today" : i === 1 ? "Tomorrow" : HALL_DOW[dow]}</td>
                {HALL_SLOTS.map((slot) => {
                  const m = menu.find((x) => x.dow === dow && x.slot === slot);
                  return (
                    <td key={slot}>
                      {m ? (
                        <>
                          <div className="text-sm">{m.items}</div>
                          <div className="flex gap-1 flex-wrap mt-1">
                            {m.tags.map((k) => <span key={k} className="hl-chip" style={{ padding: "2px 8px", fontSize: ".68rem", ...hallTagStyle(level(k), !!level(k)) }}>{labels[k]}</span>)}
                          </div>
                        </>
                      ) : <span className="hl-muted">—</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HallDietStudent({ call, notify }) {
  const [info, setInfo] = useState(null);
  const [menu, setMenu] = useState(null);   // { today, menu }
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([call("/api/hall/diet/mine"), call("/api/hall/diet/menu")])
      .then(([i, m]) => { setInfo(i); setMenu(m); })
      .catch((e) => { setErr(e.message || String(e)); notify(e, true); });
  }, []);
  const save = async (body) => {
    setBusy(true);
    try {
      const r = await call("/api/hall/diet/mine", { method: "PUT", body });
      setInfo((i) => ({ ...i, avoid: r.avoid, allergies: r.allergies, note: r.note }));
      notify("Saved. You will get a warning when a meal you have ON has something you avoid.");
    } catch (e) { notify(e, true); }
    setBusy(false);
  };
  const labels = info ? Object.fromEntries(info.tags.map((t) => [t.key, t.label])) : {};
  return (
    <HallCard title="My diet" icon="🥗" sub="Tell the hall what you don't eat. You get a warning on Home when a meal that is ON for you contains it.">
      {err ? <div className="hl-error">⚠️ {err}</div> : !info || !menu ? <div className="hl-empty">Loading…</div> : (
        <>
          <HallDietEditor key={`${info.avoid}|${info.allergies}|${info.note}`} info={info} busy={busy} onSave={save} />
          <div className="font-700 mb-2">This week's menu</div>
          <HallDietMenu menu={menu.menu} today={menu.today} avoid={info.avoid} allergies={info.allergies} labels={labels} />
          <p className="text-xs hl-muted mt-3">Tags are found from the words in the menu. If you have a serious allergy, always ask the canteen staff as well.</p>
        </>
      )}
    </HallCard>
  );
}

function HallDiet(props) {
  return props.isAdmin ? <HallDietAdmin {...props} /> : <HallDietStudent {...props} />;
}
Hall.register({ key: "diet", label: "Diet", icon: "🥗", order: 4.5, component: HallDiet });
