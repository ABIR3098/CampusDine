// Hall operations: notices, maintenance, laundry, guest requests, facilities, lost & found,
// feedback, events, inventory, overview and audit log. No wallet/payment functionality.
const HALL_SERVICE_TYPES = [
  ["maintenance","Maintenance / repair"],["cleaning","Cleaning request"],["laundry","Laundry service"],
  ["guest","Guest entry request"],["lost_found","Lost & found"],["facility_booking","Facility booking"],
  ["feedback","Food / hall feedback"],["emergency","Urgent issue"],["event","Hall event / catering"]
];
const HALL_STATUS_LABEL = {submitted:"Submitted",approved:"Approved",in_progress:"In progress",resolved:"Resolved",rejected:"Rejected",cancelled:"Cancelled"};
function HallServices({call,user,isAdmin,notify}) {
  const [section,setSection]=useState("requests");
  const [requests,setRequests]=useState([]);
  const [notices,setNotices]=useState([]);
  const [inventory,setInventory]=useState([]);
  const [audit,setAudit]=useState([]);
  const [overview,setOverview]=useState(null);
  const [waste,setWaste]=useState([]);
  const [forecast,setForecast]=useState([]);
  const [students,setStudents]=useState([]);
  const [pickupTokens,setPickupTokens]=useState([]);
  const [pickupDate,setPickupDate]=useState(new Date().toISOString().slice(0,10));
  const [pickupSlot,setPickupSlot]=useState("lunch");
  const [pickupCode,setPickupCode]=useState("");
  const [roomEdits,setRoomEdits]=useState({});
  const [wasteForm,setWasteForm]=useState({date:new Date().toISOString().slice(0,10),slot:"lunch",preparedPlates:"",servedPlates:"",wastedPlates:"",notes:""});
  const [type,setType]=useState("maintenance");
  const [form,setForm]=useState({title:"",description:"",location:"",requestedDate:""});
  const [noticeForm,setNoticeForm]=useState({title:"",body:"",category:"General",pinned:false});
  const [itemForm,setItemForm]=useState({itemName:"",category:"Food",quantity:"",unit:"kg",minQuantity:""});
  const [busy,setBusy]=useState(false);
  const load=async()=>{
    try {
      const [r,n]=await Promise.all([call("/api/hall/services"),call("/api/hall/notices")]);
      setRequests(r); setNotices(n);
      try { const inf=await call("/api/hall/info"); if(inf.today) setPickupDate(inf.today); } catch(e) {}
      try { setPickupTokens(await call("/api/hall/pickup-tokens")); } catch(e) {}
      if(isAdmin){
        const [i,o,a,w,f,st]=await Promise.all([call("/api/hall/inventory"),call("/api/hall/overview"),call("/api/hall/audit"),call("/api/hall/waste"),call("/api/hall/forecast"),call("/api/hall/students")]);
        setInventory(i);setOverview(o);setAudit(a);setWaste(w);setForecast(f);setStudents(st);
      }
    } catch(e){notify(e,true);}
  };
  useEffect(()=>{load();},[isAdmin]);
  const submit=async()=>{
    if(!form.title.trim()){notify("Please enter a title",true);return;}
    setBusy(true);
    try {await call("/api/hall/services",{method:"POST",body:{...form,type}});setForm({title:"",description:"",location:"",requestedDate:""});notify("Request submitted");await load();}
    catch(e){notify(e,true);} finally{setBusy(false);}
  };
  const updateStatus=async(id,status)=>{
    try{await call(`/api/hall/services/${id}`,{method:"PATCH",body:{status}});notify("Request updated");await load();}
    catch(e){notify(e,true);}
  };
  const cancel=async(id)=>{
    if(!window.confirm("Cancel this request?"))return;
    try{await call(`/api/hall/services/${id}`,{method:"DELETE"});notify("Request cancelled");await load();}
    catch(e){notify(e,true);}
  };
  const createNotice=async()=>{
    try{await call("/api/hall/notices",{method:"POST",body:noticeForm});setNoticeForm({title:"",body:"",category:"General",pinned:false});notify("Notice published");await load();}
    catch(e){notify(e,true);}
  };
  const deleteNotice=async(id)=>{
    if(!window.confirm("Delete this notice?"))return;
    try{await call(`/api/hall/notices/${id}`,{method:"DELETE"});await load();notify("Notice deleted");}
    catch(e){notify(e,true);}
  };
  const saveItem=async()=>{
    try{await call("/api/hall/inventory",{method:"POST",body:{...itemForm,quantity:Number(itemForm.quantity),minQuantity:Number(itemForm.minQuantity||0)}});setItemForm({itemName:"",category:"Food",quantity:"",unit:"kg",minQuantity:""});notify("Inventory saved");await load();}
    catch(e){notify(e,true);}
  };
  const btn=(key,label)=> <button key={key} className={`hl-btn ${section===key?"":"ghost"}`} onClick={()=>setSection(key)}>{label}</button>;
  return <div className="space-y-4">
    <div className="flex gap-2 flex-wrap">{btn("requests",isAdmin?"Service desk":"My requests")}{btn("notices","Notice board")}{btn("pickup","Meal QR / collection")}{isAdmin&&<>{btn("rooms","Hall students / rooms")}{btn("inventory","Kitchen inventory")}{btn("waste","Food waste")}{btn("forecast","Demand forecast")}{btn("overview","Overview & audit")}</>}</div>
    {section==="requests"&&<>
      {!isAdmin&&<HallCard title="Submit a hall request" icon="🛠️" sub="Requests are visible to you and authorized hall administrators. Do not use this form for immediate life-threatening emergencies.">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">Request type<select className="hl-input mt-1 w-full" value={type} onChange={e=>setType(e.target.value)}>{HALL_SERVICE_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
          <label className="text-sm">Title<input className="hl-input mt-1 w-full" maxLength="180" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Room fan not working"/></label>
          <label className="text-sm">Location / room<input className="hl-input mt-1 w-full" maxLength="180" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Hall, block, room"/></label>
          <label className="text-sm">Preferred date<input type="date" className="hl-input mt-1 w-full" value={form.requestedDate} onChange={e=>setForm({...form,requestedDate:e.target.value})}/></label>
          <label className="text-sm sm:col-span-2">Details<textarea className="hl-input mt-1 w-full" rows="3" maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe the issue or request"/></label>
        </div>
        <button className="hl-btn mt-3" disabled={busy} onClick={submit}>{busy?"Submitting…":"Submit request"}</button>
      </HallCard>}
      <HallCard title={isAdmin?"All service requests":"Request history"} icon="📨">
        {requests.length===0?<div className="hl-empty">No requests yet.</div>:<div className="space-y-3">{requests.map(r=><div key={r.id} className="hl-tile">
          <div className="flex flex-wrap justify-between gap-2"><b>#{r.id} · {r.title}</b><span className="hl-chip">{HALL_STATUS_LABEL[r.status]||r.status}</span></div>
          <div className="text-xs hl-muted mt-1">{(HALL_SERVICE_TYPES.find(x=>x[0]===r.type)||[r.type,r.type])[1]} · {r.student_name||"Student"} · {new Date(r.created_at).toLocaleString()}</div>
          {r.description&&<p className="text-sm mt-2 whitespace-pre-wrap">{r.description}</p>}
          {r.location&&<p className="text-sm hl-muted">📍 {r.location}{r.requested_date?` · ${String(r.requested_date).slice(0,10)}`:""}</p>}
          {r.admin_note&&<p className="text-sm mt-2">Admin note: {r.admin_note}</p>}
          <div className="flex gap-2 flex-wrap mt-3">{isAdmin?<><select className="hl-input" value={r.status} onChange={e=>updateStatus(r.id,e.target.value)}>{Object.entries(HALL_STATUS_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>{r.status!=="resolved"&&<button className="hl-btn ghost" onClick={()=>updateStatus(r.id,"resolved")}>Mark resolved</button>}</>:["submitted","approved"].includes(r.status)&&<button className="hl-btn ghost" onClick={()=>cancel(r.id)}>Cancel request</button>}</div>
        </div>)}</div>}
      </HallCard>
    </>}
    {section==="notices"&&<HallCard title="Hall notice board" icon="📢" sub="Official hall announcements and important updates.">
      {isAdmin&&<div className="hl-tile mb-4 space-y-3"><input className="hl-input w-full" placeholder="Notice title" value={noticeForm.title} onChange={e=>setNoticeForm({...noticeForm,title:e.target.value})}/><input className="hl-input w-full" placeholder="Category (e.g. Maintenance)" value={noticeForm.category} onChange={e=>setNoticeForm({...noticeForm,category:e.target.value})}/><textarea className="hl-input w-full" rows="3" placeholder="Notice details" value={noticeForm.body} onChange={e=>setNoticeForm({...noticeForm,body:e.target.value})}/><label className="text-sm flex gap-2 items-center"><input type="checkbox" checked={noticeForm.pinned} onChange={e=>setNoticeForm({...noticeForm,pinned:e.target.checked})}/> Pin this notice</label><button className="hl-btn" onClick={createNotice}>Publish notice</button></div>}
      {!notices.length?<div className="hl-empty">No active notices.</div>:<div className="space-y-3">{notices.map(n=><article key={n.id} className="hl-tile"><div className="flex justify-between gap-2"><b>{n.pinned?"📌 ":""}{n.title}</b><span className="hl-chip">{n.category}</span></div><p className="text-sm mt-2 whitespace-pre-wrap">{n.body}</p><div className="text-xs hl-muted mt-2">{new Date(n.created_at).toLocaleString()}</div>{isAdmin&&<button className="hl-btn ghost mt-2" onClick={()=>deleteNotice(n.id)}>Delete notice</button>}</article>)}</div>}
    </HallCard>}


    {section==="pickup"&&<HallCard title={isAdmin?"Meal collection desk":"My meal pickup QR"} icon="🎫" sub="QR tokens verify meal collection only. No wallet or payment is involved.">
      <div className="flex flex-wrap gap-2 items-end mb-4"><label className="text-sm">Date<input type="date" className="hl-input block mt-1" value={pickupDate} onChange={async e=>{setPickupDate(e.target.value);try{setPickupTokens(await call(`/api/hall/pickup-tokens?date=${e.target.value}`));}catch(err){notify(err,true)}}}/></label>
      {!isAdmin&&<><label className="text-sm">Meal<select className="hl-input block mt-1" value={pickupSlot} onChange={e=>setPickupSlot(e.target.value)}>{HALL_SLOTS.map(x=><option key={x} value={x}>{HALL_SLOT_LABEL[x]}</option>)}</select></label><button className="hl-btn" onClick={async()=>{try{await call("/api/hall/pickup-tokens",{method:"POST",body:{date:pickupDate,slot:pickupSlot}});setPickupTokens(await call(`/api/hall/pickup-tokens?date=${pickupDate}`));notify("Pickup QR token created");}catch(e){notify(e,true)}}}>Create pickup QR</button></>}
      {isAdmin&&<><label className="text-sm">Enter token code<input className="hl-input block mt-1" value={pickupCode} onChange={e=>setPickupCode(e.target.value.toUpperCase())} placeholder="QR token code"/></label><button className="hl-btn" onClick={async()=>{try{await call(`/api/hall/pickup-tokens/${encodeURIComponent(pickupCode)}/serve`,{method:"PATCH",body:{}});notify("Meal marked as collected");setPickupCode("");setPickupTokens(await call(`/api/hall/pickup-tokens?date=${pickupDate}`));}catch(e){notify(e,true)}}}>Verify & serve</button></>}
      </div>
      {!pickupTokens.length?<div className="hl-empty">No pickup tokens for this date.</div>:<div className="grid sm:grid-cols-2 gap-3">{pickupTokens.map(t=>{
        let qrUrl="";try{if(window.qrcode){const q=window.qrcode(0,"M");q.addData(t.token_code);q.make();qrUrl=q.createDataURL(5,4);}}catch(e){}
        return <div className="hl-tile flex gap-3 items-center" key={t.id}><div className="shrink-0">{qrUrl&&<img src={qrUrl} alt="Meal pickup QR" width="100" height="100"/>}</div><div className="min-w-0"><b>{isAdmin?(t.student_name||"Student"):HALL_SLOT_LABEL[t.slot]}</b><div className="text-xs hl-muted">{HALL_SLOT_LABEL[t.slot]} · {String(t.the_date).slice(0,10)}</div><div className="font-mono font-700 mt-1">{t.token_code}</div><span className="hl-chip mt-1">{t.status==="served"?"Collected":"Waiting"}</span>{isAdmin&&<div className="text-xs hl-muted mt-1">Student ID: {t.external_id||t.user_id}</div>}</div></div>;
      })}</div>}
    </HallCard>}
    {section==="rooms"&&isAdmin&&<HallCard title="Hall student & room management" icon="🏠" sub="Assign hall, room and optional hall ID to registered Hall Student accounts.">
      {!students.length?<div className="hl-empty">No Hall Student accounts found. Register a Student account with account type Hall first.</div>:<div className="space-y-3">{students.map(st=>{
        const f=roomEdits[st.id]||{hallName:st.hall_name||"",roomNumber:st.room_number||"",hallId:st.hall_id||""};
        return <div className="hl-tile" key={st.id}><div className="font-700">{st.name} · {st.external_id}</div><div className="text-xs hl-muted">{st.department||"No department"} · {st.email||"No email"}</div>
          <div className="grid sm:grid-cols-4 gap-2 mt-3"><input className="hl-input" placeholder="Hall name" value={f.hallName} onChange={e=>setRoomEdits({...roomEdits,[st.id]:{...f,hallName:e.target.value}})}/><input className="hl-input" placeholder="Room number" value={f.roomNumber} onChange={e=>setRoomEdits({...roomEdits,[st.id]:{...f,roomNumber:e.target.value}})}/><input className="hl-input" placeholder="Hall ID (optional)" value={f.hallId} onChange={e=>setRoomEdits({...roomEdits,[st.id]:{...f,hallId:e.target.value}})}/><button className="hl-btn" onClick={async()=>{try{await call(`/api/hall/students/${st.id}/room`,{method:"PATCH",body:f});notify("Room assignment saved");await load();}catch(e){notify(e,true)}}}>Save assignment</button></div>
        </div>
      })}</div>}
    </HallCard>}
    {section==="inventory"&&isAdmin&&<HallCard title="Kitchen & supply inventory" icon="📦" sub="Track ingredients, supplies and low-stock alerts. This does not handle purchases or payments.">
      <div className="grid sm:grid-cols-5 gap-2 mb-4"><input className="hl-input" placeholder="Item name" value={itemForm.itemName} onChange={e=>setItemForm({...itemForm,itemName:e.target.value})}/><input className="hl-input" placeholder="Category" value={itemForm.category} onChange={e=>setItemForm({...itemForm,category:e.target.value})}/><input className="hl-input" type="number" min="0" placeholder="Quantity" value={itemForm.quantity} onChange={e=>setItemForm({...itemForm,quantity:e.target.value})}/><input className="hl-input" placeholder="Unit" value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}/><button className="hl-btn" onClick={saveItem}>Save stock</button></div>
      {!inventory.length?<div className="hl-empty">No inventory items yet.</div>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Item</th><th className="text-left p-2">Category</th><th className="text-left p-2">Stock</th><th className="text-left p-2">Status</th><th/></tr></thead><tbody>{inventory.map(i=><tr key={i.id} className="border-t"><td className="p-2">{i.item_name}</td><td className="p-2">{i.category}</td><td className="p-2">{i.quantity} {i.unit}</td><td className="p-2">{Number(i.quantity)<=Number(i.min_quantity)?<span className="text-red-600">Low stock</span>:"OK"}</td><td><button className="hl-btn ghost" onClick={async()=>{try{await call(`/api/hall/inventory/${i.id}`,{method:"DELETE"});await load();}catch(e){notify(e,true)}}}>Remove</button></td></tr>)}</tbody></table></div>}
    </HallCard>}

    {section==="waste"&&isAdmin&&<HallCard title="Food waste tracking" icon="♻️" sub="Record prepared, served and wasted plates to help reduce overproduction.">
      <div className="grid sm:grid-cols-3 gap-2 mb-3">
        <label className="text-sm">Date<input className="hl-input w-full mt-1" type="date" value={wasteForm.date} onChange={e=>setWasteForm({...wasteForm,date:e.target.value})}/></label>
        <label className="text-sm">Meal<select className="hl-input w-full mt-1" value={wasteForm.slot} onChange={e=>setWasteForm({...wasteForm,slot:e.target.value})}>{HALL_SLOTS.map(x=><option key={x} value={x}>{HALL_SLOT_LABEL[x]}</option>)}</select></label>
        <label className="text-sm">Prepared plates<input className="hl-input w-full mt-1" type="number" min="0" value={wasteForm.preparedPlates} onChange={e=>setWasteForm({...wasteForm,preparedPlates:e.target.value})}/></label>
        <label className="text-sm">Served plates<input className="hl-input w-full mt-1" type="number" min="0" value={wasteForm.servedPlates} onChange={e=>setWasteForm({...wasteForm,servedPlates:e.target.value})}/></label>
        <label className="text-sm">Wasted plates<input className="hl-input w-full mt-1" type="number" min="0" value={wasteForm.wastedPlates} onChange={e=>setWasteForm({...wasteForm,wastedPlates:e.target.value})}/></label>
        <label className="text-sm">Notes<input className="hl-input w-full mt-1" value={wasteForm.notes} onChange={e=>setWasteForm({...wasteForm,notes:e.target.value})}/></label>
      </div>
      <button className="hl-btn" onClick={async()=>{try{await call("/api/hall/waste",{method:"POST",body:wasteForm});notify("Food waste record saved");setWasteForm({...wasteForm,preparedPlates:"",servedPlates:"",wastedPlates:"",notes:""});await load();}catch(e){notify(e,true)}}}>Save waste record</button>
      <div className="space-y-2 mt-4">{waste.map(w=><div className="hl-tile text-sm" key={w.id}><b>{String(w.waste_date).slice(0,10)} · {HALL_SLOT_LABEL[w.slot]}</b><div>Prepared {w.prepared_plates} · Served {w.served_plates} · Wasted {w.wasted_plates} ({w.prepared_plates?Math.round(100*w.wasted_plates/w.prepared_plates):0}%)</div>{w.notes&&<div className="hl-muted">{w.notes}</div>}</div>)}</div>
    </HallCard>}
    {section==="forecast"&&isAdmin&&<HallCard title="Meal demand estimate" icon="📈" sub="Uses the previous 56 days of meal selections and guest counts. Estimates are indicative, not AI-generated guarantees.">
      <div className="hl-grid3">{forecast.map(f=><div className="hl-tile" key={f.slot}><div className="font-700">{HALL_SLOT_LABEL[f.slot]}</div><div className="hl-big font-display">{f.estimatedPlates}</div><div className="text-xs hl-muted">estimated plates · {f.sampleDays} sample days · {f.confidence} confidence</div></div>)}</div>
    </HallCard>}
    {section==="overview"&&isAdmin&&<><HallCard title="Hall operations overview" icon="📊">{!overview?<div className="hl-empty">Loading…</div>:<div className="hl-grid3">{[["Open requests",overview.open_requests],["Maintenance open",overview.maintenance_open],["Guest requests pending",overview.guest_pending],["Feedback (30 days)",overview.feedback_30d],["Active notices",overview.active_notices],["Low-stock items",overview.low_stock]].map(([l,v])=><HallStat key={l} label={l} value={v} icon="📌"/>)}</div>}</HallCard><HallCard title="Recent audit log" icon="🧾"><div className="space-y-2">{audit.slice(0,80).map(a=><div key={a.id} className="hl-tile text-sm"><b>{a.actor||`User ${a.user_id}`}</b> {a.action} {a.entity_type} {a.entity_id?`#${a.entity_id}`:""}<div className="text-xs hl-muted">{new Date(a.created_at).toLocaleString()}</div></div>)}</div></HallCard></>}
  </div>;
}
Hall.register({key:"services",label:"Hall services",icon:"🛠️",order:9,component:HallServices});
