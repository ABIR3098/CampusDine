// Step 7 — "Feasts & Guest Meals" tab: guest meal booking and special feast pre-booking.
function HallFeasts({ call, isAdmin, notify }) {
  const [activeTab, setActiveTab] = useState("feasts"); // "feasts" or "guest"
  const [feasts, setFeasts] = useState(null);
  const [today, setToday] = useState("");
  const [slots, setSlots] = useState([]);
  const [f, setF] = useState({ date: "", slot: "dinner", title: "", items: "", extraPrice: "", capacity: "" });

  // Guest booking state
  const [gDate, setGDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [gSlot, setGSlot] = useState("lunch");
  const [gCount, setGCount] = useState(1);
  const [gName, setGName] = useState("");
  const [gBusy, setGBusy] = useState(false);
  const [gPass, setGPass] = useState(null);

  const load = async () => {
    try {
      const [list, info, slotData] = await Promise.all([
        call("/api/hall/feasts"),
        call("/api/hall/info"),
        call("/api/hall/slots").catch(() => [])
      ]);
      setFeasts(list);
      setToday(info.today);
      if (slotData && slotData.length) setSlots(slotData);
    } catch (e) { notify(e, true); }
  };
  useEffect(() => { load(); }, []);

  // Going / Not going for one feast
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(null);
  const [list, setList] = useState(null);
  const showWho = async (id) => {
    if (open === id) { setOpen(null); return; }
    try { setList(await call("/api/hall/feasts/" + id + "/rsvps")); setOpen(id); }
    catch (e) { notify(e, true); }
  };

  const downloadCsv = () => {
    const rows = [["Name", "ID", "Answer", "Answered at"]];
    list.people.forEach((p) => rows.push([p.name, p.externalId, p.status === "going" ? "Going" : "Not going", p.at]));
    const csv = "\uFEFF" + rows.map((r) => r.map(hallCsvCell).join(",")).join("\r\n");
    hallDownloadFile("feast-" + list.feast.date + "-" + list.feast.slot + ".csv", csv, "text/csv;charset=utf-8");
  };

  const clearRsvp = async (id) => {
    setBusy(id);
    try { await call("/api/hall/feasts/" + id + "/rsvp", { method: "DELETE" }); notify("Answer removed"); await load(); }
    catch (e) { notify(e, true); }
    setBusy(null);
  };
  const rsvp = async (id, status) => {
    setBusy(id);
    try {
      await call("/api/hall/feasts/" + id + "/rsvp", { method: "POST", body: { status } });
      notify(status === "going" ? "See you at the feast! Entry pass booked." : "Marked as not going");
      await load();
    } catch (e) { notify(e, true); }
    setBusy(null);
  };

  const add = async () => {
    try {
      await call("/api/hall/feasts", { method: "POST", body: { ...f, extraPrice: Number(f.extraPrice || 0), capacity: f.capacity === "" ? null : Number(f.capacity) } });
      notify("Feast saved");
      setF({ date: "", slot: "dinner", title: "", items: "", extraPrice: "", capacity: "" });
      await load();
    } catch (e) { notify(e, true); }
  };
  const remove = async (id) => {
    if (!window.confirm("Remove this feast?")) return;
    try { await call("/api/hall/feasts/" + id, { method: "DELETE" }); notify("Feast removed"); await load(); }
    catch (e) { notify(e, true); }
  };

  const isFull = (x) => x.capacity != null && x.goingCount >= x.capacity && x.myRsvp !== "going";

  // Book instant guest meal tokens
  const bookGuestMeal = async () => {
    setGBusy(true);
    try {
      await call("/api/hall/guests/" + gDate + "/" + gSlot, { method: "PUT", body: { count: Number(gCount) } });
      const passId = "GST-" + Math.floor(1000 + Math.random() * 9000);
      const slotObj = slots.find(s => s.slot === gSlot) || { guestPrice: 65 };
      const totalCost = Number(gCount) * (slotObj.guestPrice || 65);

      const passData = {
        passId,
        date: gDate,
        slot: gSlot,
        count: Number(gCount),
        guestName: gName.trim() || "Guest of Resident",
        unitPrice: slotObj.guestPrice || 65,
        totalCost,
        generatedAt: new Date().toLocaleString()
      };
      setGPass(passData);
      notify("Guest meal tokens (" + gCount + " guests) successfully booked!");
      window.dispatchEvent(new Event("hall-changed"));
    } catch (e) {
      notify(e, true);
    } finally {
      setGBusy(false);
    }
  };

  const currentSlotPrice = (slots.find(s => s.slot === gSlot) || {}).guestPrice || 65;

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex gap-2 border-b pb-3 border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("feasts")}
          className={"px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 " + (activeTab === "feasts" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
          <span>🎉</span>
          <span>Grand Feasts Pre-Booking</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("guest")}
          className={"px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 " + (activeTab === "guest" ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}>
          <span>🎟️</span>
          <span>Guest Meal Token Counter</span>
        </button>
      </div>

      {activeTab === "guest" && (
                      <span className="hl-chip">{HALL_SLOT_EMOJI[x.slot]} {HALL_SLOT_LABEL[x.slot]}</span>
                      {x.date === today && <span className="hl-chip warn">Today</span>}
                      <span className={`hl-chip ${x.extraPrice > 0 ? "plain" : "ok"}`}>{x.extraPrice > 0 ? `+${hallTaka(x.extraPrice)}` : "No extra charge"}</span>
                      <span className="hl-chip plain">👥 {x.goingCount} going</span>
                      {x.capacity != null && (x.goingCount >= x.capacity
                        ? <span className="hl-chip warn">Full</span>
                        : <span className="hl-chip ok">{x.capacity - x.goingCount} seat{x.capacity - x.goingCount === 1 ? "" : "s"} left</span>)}
                    </div>
                    <div className="text-sm mt-2">{x.items}</div>
                    <div className="flex gap-2 mt-3">
                      <button className={`hl-btn sm ${x.myRsvp === "going" ? "" : "ghost"}`} disabled={busy === x.id || !x.rsvpOpen || isFull(x)} onClick={() => rsvp(x.id, "going")}>✅ Going</button>
                      <button className={`hl-btn sm ${x.myRsvp === "not_going" ? "" : "ghost"}`} disabled={busy === x.id || !x.rsvpOpen} onClick={() => rsvp(x.id, "not_going")}>🚫 Not going</button>
                      {x.myRsvp && x.rsvpOpen && <button className="hl-btn sm ghost" disabled={busy === x.id} onClick={() => clearRsvp(x.id)}>Clear</button>}
                    </div>
                    {!x.rsvpOpen ? <div className="text-xs mt-1.5 hl-muted">RSVP is closed, this meal has locked.</div>
                      : isFull(x) && <div className="text-xs mt-1.5 hl-muted">This feast is full.</div>}
                    {isAdmin && <button className="hl-btn sm ghost mt-2" onClick={() => showWho(x.id)}>👥 Who is going</button>}
                    {isAdmin && open === x.id && list && (
                      <div className="mt-2 text-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="hl-muted text-xs">{list.going} going · {list.notGoing} not going</span>
                          {list.people.length > 0 && <button className="hl-btn sm ghost" onClick={downloadCsv}>⬇ CSV</button>}
                        </div>
                        {list.people.length === 0 ? <div className="hl-empty">Nobody has answered yet.</div> : list.people.map((p, i) => (
                          <div key={i} className="flex justify-between items-center gap-2 py-0.5">
                            <span>{p.name} <span className="hl-muted">{p.externalId}</span></span>
                            <span className={`hl-chip ${p.status === "going" ? "ok" : "plain"}`}>{p.status === "going" ? "Going" : "Not going"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HallCard>

      {isAdmin && (
        <HallCard title="Add a feast" icon="➕">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="hl-label">Date</label><input type="date" className="hl-input" min={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div><label className="hl-label">Meal</label>
              <select className="hl-input" value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })}>
                {HALL_SLOTS.map((s) => <option key={s} value={s}>{HALL_SLOT_LABEL[s]}</option>)}
              </select></div>
            <div><label className="hl-label">Feast name</label><input className="hl-input" placeholder="e.g. Eid dinner" maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div><label className="hl-label">Extra price (৳)</label><input type="number" min="0" className="hl-input" placeholder="0" value={f.extraPrice} onChange={(e) => setF({ ...f, extraPrice: e.target.value })} /></div>
            <div><label className="hl-label">Seats (optional)</label><input type="number" min="1" className="hl-input" placeholder="No limit" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="hl-label">What is served</label><input className="hl-input" placeholder="e.g. Polao, Beef roast, Firni" maxLength={255} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} /></div>
          </div>
          <button className="hl-btn mt-4" disabled={!f.date || !f.title || !f.items} onClick={add}>Save feast</button>
          <p className="text-xs mt-3 hl-muted">A feast on a date + meal that already has one replaces it. It can't be added once that meal has closed. Leave Seats empty for no limit.</p>
        </HallCard>
      )}
    </>
  );
}
Hall.register({ key: "feasts", label: "Feasts", icon: "🎉", order: 5, component: HallFeasts });
