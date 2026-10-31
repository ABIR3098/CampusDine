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
        <HallCard title="Instant Guest Meal Token Counter" icon="🎟️" sub="Book guest tokens for your visiting friends or family members. Tokens are charged to your hall bill / wallet.">
          <div className="grid md:grid-cols-2 gap-6 items-start">
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="font-bold text-sm text-slate-800">New Guest Meal Booking</div>
              
              <div>
                <label className="hl-label">Meal Date</label>
                <input type="date" min={today} value={gDate} onChange={e => setGDate(e.target.value)} className="hl-input w-full" />
              </div>

              <div>
                <label className="hl-label">Meal Slot</label>
                <div className="grid grid-cols-3 gap-2">
                  {HALL_SLOTS.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setGSlot(s)}
                      className={"p-2 rounded-xl border text-center text-xs font-bold transition-all " + (gSlot === s ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm" : "border-slate-200 bg-white text-slate-600")}>
                      <div>{HALL_SLOT_EMOJI[s]}</div>
                      <div className="mt-1">{HALL_SLOT_LABEL[s]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="hl-label">Guest Count</label>
                  <select value={gCount} onChange={e => setGCount(Number(e.target.value))} className="hl-input w-full">
                    {[1, 2, 3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} Guest{n > 1 ? "s" : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="hl-label">Rate / Guest</label>
                  <div className="hl-input w-full bg-slate-100 font-bold text-slate-700 flex items-center">
                    ৳{currentSlotPrice}
                  </div>
                </div>
              </div>

              <div>
                <label className="hl-label">Guest Name / Relation (Optional)</label>
                <input type="text" placeholder="e.g. Cousin from BUET, School friend" value={gName} onChange={e => setGName(e.target.value)} className="hl-input w-full" />
              </div>

              <div className="p-3 bg-white rounded-xl border border-blue-200 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-bold">Total Estimated Cost:</span>
                <span className="text-lg font-black text-blue-600 font-mono">৳{Number(gCount) * currentSlotPrice}</span>
              </div>

              <button
                type="button"
                disabled={gBusy || !gDate}
                onClick={bookGuestMeal}
                className="hl-btn w-full">
                {gBusy ? "Booking Tokens…" : "🎟️ Confirm & Generate Guest Pass"}
              </button>
            </div>

            {/* Generated Guest Pass View */}
            <div>
              {gPass ? (
                <div className="bg-white border-2 border-dashed border-blue-400 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                  <div className="absolute top-2 right-2 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full font-black text-[10px] tracking-wider uppercase">
                    OFFICIAL GUEST PASS
                  </div>
                  <div className="text-center pb-3 border-b border-slate-200">
                    <div className="text-xs uppercase font-extrabold text-blue-600 tracking-wider">Hall Dining Service</div>
                    <div className="font-display font-black text-xl text-slate-900 mt-0.5">CampusDine Guest Pass</div>
                    <div className="text-xs text-slate-500">{gPass.generatedAt}</div>
                  </div>

                  <div className="text-center my-4">
                    <div className="text-xs text-slate-500 uppercase font-bold">Pick-up Token Number</div>
                    <div className="font-mono font-black text-3xl text-blue-700 tracking-widest mt-1 bg-blue-50 py-2 rounded-xl border border-blue-100 inline-block px-6">
                      #{gPass.passId}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs py-3 border-y border-slate-100 font-medium text-slate-700">
                    <div className="flex justify-between"><span>Guest:</span><strong>{gPass.guestName}</strong></div>
                    <div className="flex justify-between"><span>Date:</span><strong>{gPass.date}</strong></div>
                    <div className="flex justify-between"><span>Meal Slot:</span><strong>{HALL_SLOT_LABEL[gPass.slot] || gPass.slot}</strong></div>
                    <div className="flex justify-between"><span>Total Meals:</span><strong>{gPass.count} plates</strong></div>
                    <div className="flex justify-between"><span>Total Billed:</span><strong>৳{gPass.totalCost}</strong></div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="w-full py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 shadow">
                      <span>🖨️</span>
                      <span>Print Guest Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGPass(null)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold">
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="text-4xl mb-2">🎫</div>
                  <div className="font-bold text-sm text-slate-700">No Active Guest Pass Selected</div>
                  <div className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Fill in the form on the left to book guest plates. An official printable pass with token will be generated instantly.
                  </div>
                </div>
              )}
            </div>
          </div>
        </HallCard>
      )}

      {activeTab === "feasts" && (
        <>
          <HallCard title="Upcoming Grand Feasts & Special Nights" icon="🎉" sub="Grand feasts feature special menu items like Kacchi Biryani, Polao Roast, or Firni. Pre-book your seat in advance.">
            {!feasts ? <div className="hl-empty">Loading…</div> : feasts.length === 0 ? (
              <div className="hl-empty">🍽 No feast scheduled in the next 60 days.</div>
            ) : (
              <div className="hl-grid2">
                {feasts.map((x) => {
                  const dt = new Date(x.date + "T00:00:00Z");
                  const percentBooked = x.capacity ? Math.min(100, Math.round((x.goingCount / x.capacity) * 100)) : 45;

                  return (
                    <div key={x.id} className={"hl-feast " + (x.myRsvp === "going" ? "going border-2 border-blue-500 shadow-md" : "")}>
                      <div className="hl-feast-date bg-blue-700 text-white rounded-xl p-2.5 text-center shrink-0">
                        <div className="text-2xl font-black">{dt.getUTCDate()}</div>
                        <div className="text-[11px] font-bold uppercase tracking-wider">{dt.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</div>
                      </div>
                      <div className="hl-feast-body flex-1" style={{ paddingTop: 4 }}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-display font-black text-base text-slate-900 leading-tight">{x.title}</div>
                            <div className="text-xs text-blue-600 font-bold mt-0.5">
                              {HALL_SLOT_EMOJI[x.slot]} {HALL_SLOT_LABEL[x.slot]} Special
                            </div>
                          </div>
                          {isAdmin && <button className="hl-btn sm danger" onClick={() => remove(x.id)}>Remove</button>}
                        </div>

                        {/* Capacity Progress Bar */}
                        {x.capacity != null && (
                          <div className="mt-2.5">
                            <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                              <span>Seat Availability</span>
                              <span>{x.goingCount} / {x.capacity} Booked ({x.capacity - x.goingCount} left)</span>
                            </div>
                            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
  );
}
Hall.register({ key: "feasts", label: "Feasts", icon: "🎉", order: 5, component: HallFeasts });
