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

  const handlePhotoSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      notify("Image size must be less than 3MB", true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const submit=async()=>{
    if(!form.title.trim()){notify("Please enter a title",true);return;}
    setBusy(true);
    try {
      let finalDesc = form.description || "";
      if (type === "maintenance") {
        const catObj = MAINTENANCE_CATEGORIES.find(c => c.key === mCategory);
        finalDesc = "[Category: " + (catObj ? catObj.label : mCategory) + "] " + finalDesc;
      }
      if (photoPreview) {
        finalDesc += "\n[Photo Evidence Attached]";
      }
      const res = await call("/api/hall/services",{method:"POST",body:{...form,description:finalDesc,type}});
      if (photoPreview) {
        try {
          if (res && res.id) localStorage.setItem("cd_photo_" + res.id, photoPreview);
          localStorage.setItem("cd_maint_recent_photo", photoPreview);
        } catch (_) {}
      }
      setForm({title:"",description:"",location:"",requestedDate:""});
      setPhotoPreview(null);
      notify("Maintenance request submitted successfully!");
      await load();
    }
    catch(e){notify(e,true);} finally{setBusy(false);}
  };

  const updateStatus=async(id,status)=>{
    try{await call("/api/hall/services/" + id,{method:"PATCH",body:{status}});notify("Request updated");await load();}
    catch(e){notify(e,true);}
  };
  const cancel=async(id)=>{
    if(!window.confirm("Cancel this request?"))return;
    try{await call("/api/hall/services/" + id,{method:"DELETE"});notify("Request cancelled");await load();}
    catch(e){notify(e,true);}
  };
  const createNotice=async()=>{
    try{await call("/api/hall/notices",{method:"POST",body:noticeForm});setNoticeForm({title:"",body:"",category:"General",pinned:false});notify("Notice published");await load();}
    catch(e){notify(e,true);}
  };
  const deleteNotice=async(id)=>{
    if(!window.confirm("Delete this notice?"))return;
    try{await call("/api/hall/notices/" + id,{method:"DELETE"});await load();notify("Notice deleted");}
    catch(e){notify(e,true);}
  };

  const btn=(key,label)=> <button key={key} className={"hl-btn " + (section===key?"":"ghost")} onClick={()=>setSection(key)}>{label}</button>;

  const getStatusStep = (status) => {
    switch(status) {
      case "submitted": return 1;
      case "approved": return 2;
      case "in_progress": return 3;
      case "resolved": return 4;
      default: return 1;
    }
  };

  return <div className="space-y-4">
    <div className="flex gap-2 flex-wrap">
      {btn("requests",isAdmin?"Service desk":"Room Maintenance & Requests")}
      {btn("notices","Notice board")}
      {!isAdmin&&btn("laundry","Laundry service")}
      {isAdmin&&btn("overview","Services overview & audit")}
    </div>

    {section==="requests"&&<>
      {!isAdmin&&<HallCard title="Submit Room Maintenance / Repair Request" icon="🛠️" sub="Report issues with fan, light, plumbing, or room furniture. Upload a photo for rapid caretaker assignment.">
        <div className="space-y-4">
          {/* Category Chips */}
          <div>
            <label className="text-xs uppercase tracking-wide font-bold hl-muted block mb-1.5">Issue Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {MAINTENANCE_CATEGORIES.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => { setMCategory(c.key); setType("maintenance"); }}
                  className={"p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 " + (mCategory === c.key ? "border-blue-500 bg-blue-50 font-bold text-blue-700 shadow-sm" : "border-slate-200 hover:bg-slate-50 text-slate-600")}>
                  <span className="text-xl">{c.icon}</span>
                  <span className="text-[11px] leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm font-semibold">Request type
              <select className="hl-input mt-1 w-full" value={type} onChange={e=>setType(e.target.value)}>
                {HALL_SERVICE_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Issue Title
              <input className="hl-input mt-1 w-full" maxLength="180" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Ceiling fan speed regulator broken"/>
            </label>
            <label className="text-sm font-semibold">Location / Room
              <input className="hl-input mt-1 w-full" maxLength="180" value={form.location} onChange={e=>setForm({...form,location:e.target.value})} placeholder="e.g. Hall A, 3rd Floor, Room 304"/>
            </label>
            <label className="text-sm font-semibold">Preferred Visit Date
              <input type="date" className="hl-input mt-1 w-full" value={form.requestedDate} onChange={e=>setForm({...form,requestedDate:e.target.value})}/>
            </label>
            <label className="text-sm font-semibold sm:col-span-2">Detailed Description
              <textarea className="hl-input mt-1 w-full" rows="3" maxLength="5000" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe the problem, when it started, and specific urgency..."/>
            </label>
          </div>

          {/* Photo Upload with Live Preview */}
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
                  <span>📸</span>
                  <span>Attach Issue Photo (Optional)</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">Take a live photo from mobile camera or select file (Max 3MB).</div>
              </div>
              <label className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-all shadow-sm shrink-0">
                <span>Upload / Take Photo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </label>
            </div>
            {photoPreview && (
              <div className="mt-3 relative inline-block">
                <img src={photoPreview} alt="Preview" className="w-28 h-28 object-cover rounded-xl border border-slate-300 shadow-sm" />
                <button
                  type="button"
                  onClick={() => setPhotoPreview(null)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white font-bold text-xs grid place-items-center shadow hover:bg-red-700">
                  ✕
                </button>
              </div>
            )}
          </div>

          <button className="hl-btn w-full sm:w-auto" disabled={busy} onClick={submit}>
            {busy ? "Submitting…" : "🚀 Submit Maintenance Request"}
          </button>
        </div>
      </HallCard>}

      <HallCard title={isAdmin?"All service requests":"Maintenance & Request History"} icon="📨">
        {requests.length===0?<div className="hl-empty">No requests yet.</div>:<div className="space-y-4">{requests.map(r=>{
          const step = getStatusStep(r.status);
          const savedPhoto = (() => {
            try { return localStorage.getItem("cd_photo_" + r.id) || (photoPreview && localStorage.getItem("cd_maint_recent_photo")); }
            catch(_) { return null; }
          })();

          return (
            <div key={r.id} className="hl-tile bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div>
                  <div className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <span>#{r.id} · {r.title}</span>
                  </div>
                  <div className="text-xs hl-muted mt-0.5">
                    {(HALL_SERVICE_TYPES.find(x=>x[0]===r.type)||[r.type,r.type])[1]} · {r.student_name||"Student"} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <span className={"text-xs font-bold px-3 py-1 rounded-full " + (
                  r.status === "resolved" ? "bg-emerald-100 text-emerald-800" :
                  r.status === "in_progress" ? "bg-purple-100 text-purple-800" :
                  r.status === "approved" ? "bg-blue-100 text-blue-800" :
                  "bg-amber-100 text-amber-800"
                )}>
                  ● {HALL_STATUS_LABEL[r.status]||r.status}
                </span>
              </div>

              {/* Visual 4-Step Progress Tracker */}
              <div className="my-4 py-2 border-y border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Live Status Tracking</div>
                <div className="grid grid-cols-4 gap-1 text-center">
                  <div className={"p-1.5 rounded-lg text-xs font-bold " + (step >= 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>
                    1. Submitted
                  </div>
                  <div className={"p-1.5 rounded-lg text-xs font-bold " + (step >= 2 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400")}>
                    2. Assigned
                  </div>
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
