// Hall Services: complaints, maintenance, cleaning, laundry, lost & found, feedback and notices. Food/menu/pickup is handled by Canteen Admin.
const HALL_SERVICE_TYPES = [
  ["maintenance","Room Maintenance & Repair"],["complaint","Complaint / help"],["cleaning","Cleaning request"],
  ["lost_found","Lost & found"],["feedback","Hall service feedback"],["emergency","Urgent hall issue"]
];
const MAINTENANCE_CATEGORIES = [
  { key: "fan", label: "Fan & AC", icon: "🪭" },
  { key: "light", label: "Light & Electrical", icon: "💡" },
  { key: "toilet", label: "Toilet & Plumbing", icon: "🚰" },
  { key: "furniture", label: "Bed & Furniture", icon: "🪑" },
  { key: "door", label: "Door & Lock", icon: "🚪" },
  { key: "other", label: "General Repair", icon: "🔧" }
];
const HALL_STATUS_LABEL = {submitted:"Submitted",approved:"Assigned",in_progress:"In Progress",resolved:"Resolved",rejected:"Rejected",cancelled:"Cancelled"};

function HallServices({call,user,isAdmin,notify}) {
  const [section,setSection]=useState("requests");
  const [requests,setRequests]=useState([]);
  const [notices,setNotices]=useState([]);
  const [audit,setAudit]=useState([]);
  const [overview,setOverview]=useState(null);
  const [laundryJobs,setLaundryJobs]=useState([]);
  const [laundryForm,setLaundryForm]=useState({description:"",pieces:"1",pickupDate:new Date().toISOString().slice(0,10)});
  const [roomEdits,setRoomEdits]=useState({});
  const [type,setType]=useState("maintenance");
  const [mCategory,setMCategory]=useState("fan");
  const [photoPreview,setPhotoPreview]=useState(null);
  const [viewPhoto,setViewPhoto]=useState(null);
  const [form,setForm]=useState({title:"",description:"",location:"",requestedDate:""});
  const [noticeForm,setNoticeForm]=useState({title:"",body:"",category:"General",pinned:false});
  const [busy,setBusy]=useState(false);

  const load=async()=>{
    try {
      const [r,n]=await Promise.all([call("/api/hall/services"),call("/api/hall/notices")]);
      setRequests(r); setNotices(n);
      try { setLaundryJobs(await call("/api/hall/laundry/jobs")); } catch(e) {}
      if(isAdmin){
        const [o,a]=await Promise.all([call("/api/hall/overview"),call("/api/hall/audit")]);
        setOverview(o);setAudit(a);
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
    <div className="flex gap-2 flex-wrap">{btn("requests",isAdmin?"Service desk":"My requests")}{btn("notices","Notice board")}{!isAdmin&&btn("laundry","Laundry service")}{isAdmin&&btn("overview","Services overview & audit")}</div>
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


    {section==="laundry"&&!isAdmin&&<>
      <HallCard title="Request laundry service" icon="🧺" sub="Laundry is a hall service. Submit a pickup request and track its status here.">
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">Clothes / service details<input className="hl-input mt-1 w-full" value={laundryForm.description} onChange={e=>setLaundryForm({...laundryForm,description:e.target.value})} placeholder="e.g. 5 shirts and 2 trousers"/></label>
          <label className="text-sm">Number of pieces<input className="hl-input mt-1 w-full" type="number" min="1" value={laundryForm.pieces} onChange={e=>setLaundryForm({...laundryForm,pieces:e.target.value})}/></label>
          <label className="text-sm">Preferred pickup date<input className="hl-input mt-1 w-full" type="date" value={laundryForm.pickupDate} onChange={e=>setLaundryForm({...laundryForm,pickupDate:e.target.value})}/></label>
        </div>
        <button className="hl-btn mt-3" onClick={async()=>{if(!laundryForm.description.trim()){notify('Enter laundry details',true);return;}try{await call('/api/hall/laundry/jobs',{method:'POST',body:{...laundryForm,pieces:Number(laundryForm.pieces),vendorId:null}});setLaundryForm({...laundryForm,description:'',pieces:'1'});notify('Laundry request submitted');await load();}catch(e){notify(e,true)}}}>Submit laundry request</button>
      </HallCard>
      <HallCard title="My laundry requests" icon="📦"><div className="space-y-2">{laundryJobs.length?laundryJobs.map(j=><div className="hl-tile" key={j.id}><b>Request #{j.id}</b> · {j.description}<div className="text-sm hl-muted">{j.pieces} pieces · Pickup: {String(j.pickup_date||j.pickupDate||'Not scheduled').slice(0,10)} · Status: {j.status}</div></div>):<div className="hl-empty">No laundry requests yet.</div>}</div></HallCard>
    </>}
    {section==="overview"&&isAdmin&&<><HallCard title="Hall operations overview" icon="📊">{!overview?<div className="hl-empty">Loading…</div>:<div className="hl-grid3">{[["Open requests",overview.open_requests],["Maintenance open",overview.maintenance_open],["Guest requests pending",overview.guest_pending],["Feedback (30 days)",overview.feedback_30d],["Active notices",overview.active_notices]].map(([l,v])=><HallStat key={l} label={l} value={v} icon="📌"/>)}</div>}</HallCard><HallCard title="Recent audit log" icon="🧾"><div className="space-y-2">{audit.slice(0,80).map(a=><div key={a.id} className="hl-tile text-sm"><b>{a.actor||`User ${a.user_id}`}</b> {a.action} {a.entity_type} {a.entity_id?`#${a.entity_id}`:""}<div className="text-xs hl-muted">{new Date(a.created_at).toLocaleString()}</div></div>)}</div></HallCard></>}
  </div>;
}
Hall.register({key:"services",label:"Hall services",icon:"🛠️",order:9,component:HallServices});
