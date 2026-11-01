/* CampusDine Hall Admin — portal logic (auth, navigation, hall records). Chat lives in hall-admin-chat.js */
const $=id=>document.getElementById(id);
let token='',challenge='';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const P={
overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
chat:'<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.2A8.4 8.4 0 1 1 21 11.5z"/>',
notice:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
services:'<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
ops:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
alert:'<path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
refresh:'<path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8"/><path d="M21 4v5h-5M3 20v-5h5"/>',
moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>',
back:'<path d="M15 18l-6-6 6-6"/>',
close:'<path d="M18 6L6 18M6 6l12 12"/>',
check:'<path d="M20 6L9 17l-5-5"/>',
trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
reply:'<path d="M9 14L4 9l5-5"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'};
const ic=(n,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;
const setIc=(id,n,s)=>{const e=$(id);if(e)e.innerHTML=ic(n,s)};

function toast(t,k){const e=document.createElement('div');e.className='toast'+(k==='err'?' err':'');e.setAttribute('role',k==='err'?'alert':'status');e.textContent=t;$('toasts').appendChild(e);setTimeout(()=>e.remove(),4500)}
const msg=(id,text,ok=false)=>{const e=$(id);e.className='msg '+(ok?'ok':'error');e.textContent=text};
async function api(path,opts={}){const r=await fetch('/api/hall-admin'+path,{method:opts.method||'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(opts.body?{body:JSON.stringify(opts.body)}:{})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Request failed');return d}
async function campusApi(path,opts={}){const r=await fetch('/api/campus'+path,{method:opts.method||'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(opts.body?{body:JSON.stringify(opts.body)}:{})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Campus request failed');return d}
window.getToken=()=>token;

/* ---- theme ---- */
function curTheme(){try{return JSON.parse(localStorage.getItem('cd_theme')||'{}')}catch{return{}}}
function paintThemeBtn(){setIc('themeBtn',document.documentElement.getAttribute('data-theme')==='dark'?'sun':'moon')}
$('themeBtn').onclick=()=>{const dark=document.documentElement.getAttribute('data-theme')!=='dark';document.documentElement.setAttribute('data-theme',dark?'dark':'light');try{localStorage.setItem('cd_theme',JSON.stringify({...curTheme(),mode:dark?'dark':'light'}))}catch{}paintThemeBtn()};

/* ---- navigation ---- */
const NAV=[['overview','Overview','overview'],['messages','Messages','chat'],['notices','Notices','notice'],['create','New Record','plus'],['services','Hall Services','services'],['ops','Operations','ops'],['sos','Emergency SOS','alert'],['lost','Lost & Found','box']];
const badges={messages:0,services:0,sos:0};let view='overview';
function renderNav(){const q=$('navSearch').value.trim().toLowerCase();$('nav').innerHTML=NAV.filter(n=>!q||n[1].toLowerCase().includes(q)).map(([id,l,i])=>`<button class="portal-nav-item ${id===view?'active':''}" data-v="${id}" title="${esc(l)}"><span class="portal-nav-icon">${ic(i)}</span><span class="portal-nav-label">${esc(l)}</span>${badges[id]?`<span class="portal-nav-badge">${badges[id]>99?'99+':badges[id]}</span>`:''}</button>`).join('');$('nav').querySelectorAll('button').forEach(b=>b.onclick=()=>show(b.dataset.v))}
function show(id){if(!NAV.some(n=>n[0]===id))id='overview';view=id;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!=='v-'+id));$('hdrTitle').textContent=NAV.find(n=>n[0]===id)[1];renderNav();closeMenu();try{history.replaceState(null,'','#'+id)}catch{}window.scrollTo(0,0);if(id==='messages'&&window.HallChat)HallChat.opened()}
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g)show(g.dataset.go)});
$('navSearch').oninput=renderNav;
const openMenu=()=>{$('sidebar').classList.add('mobile-open');$('scrim').classList.add('show')},closeMenu=()=>{$('sidebar').classList.remove('mobile-open');$('scrim').classList.remove('show')};
$('menuBtn').onclick=openMenu;$('scrim').onclick=closeMenu;
$('collapseBtn').onclick=()=>{const c=$('sidebar').classList.toggle('collapsed');try{localStorage.setItem('cd_hall_collapsed',c?'1':'0')}catch{}};
try{if(localStorage.getItem('cd_hall_collapsed')==='1')$('sidebar').classList.add('collapsed')}catch{}
$('bellBtn').onclick=()=>show('messages');$('refreshAll').onclick=()=>loadData(true);
$('sosBannerClose').onclick=()=>$('sosBanner').classList.add('hidden');
window.onChatUnread=n=>{badges.messages=n;renderNav();const d=$('bellDot');d.textContent=n>99?'99+':n;d.classList.toggle('hidden',!n);if(window.lastKpi)renderKpis()};

/* ---- auth ---- */
function authMode(m){$('loginForm').classList.toggle('hidden',m!=='login');$('registerForm').classList.toggle('hidden',m!=='register');$('showLogin').classList.toggle('on',m==='login');$('showRegister').classList.toggle('on',m==='register');$('authMsg').textContent=''}
$('showLogin').onclick=()=>authMode('login');$('showRegister').onclick=()=>authMode('register');
$('sendOtp').onclick=async()=>{try{const d=await api('/auth/send-otp',{method:'POST',body:{email:$('regEmail').value}});$('regOtpArea').classList.remove('hidden');msg('authMsg',d.message||'OTP sent',true)}catch(e){msg('authMsg',e.message)}};
$('createAdmin').onclick=async()=>{try{const d=await api('/auth/register',{method:'POST',body:{name:$('regName').value,email:$('regEmail').value,externalId:$('regId').value,password:$('regPw').value,otp:$('regOtp').value}});msg('authMsg',d.message||'Account created. Log in now.',true);authMode('login')}catch(e){msg('authMsg',e.message)}};
$('loginBtn').onclick=async()=>{try{const d=await api('/auth/login',{method:'POST',body:{identifier:$('loginId').value,password:$('loginPw').value}});challenge=d.challenge;$('loginOtpArea').classList.remove('hidden');msg('authMsg',d.emailed?'OTP sent to your email.':'OTP generated; check backend console in development.',true)}catch(e){msg('authMsg',e.message)}};
$('verifyLogin').onclick=async()=>{try{const d=await api('/auth/verify-login',{method:'POST',body:{challenge,otp:$('loginOtp').value}});token=d.token;localStorage.setItem('campusdine_hall_admin_token',token);await enter()}catch(e){msg('authMsg',e.message)}};
$('logout').onclick=()=>{token='';localStorage.removeItem('campusdine_hall_admin_token');location.reload()};
async function enter(){$('auth').classList.add('hidden');$('app').classList.remove('hidden');show(location.hash.slice(1)||'overview');await loadData();if(window.HallChat)HallChat.start()}

/* ---- helpers ---- */
const lc=s=>String(s||'').toLowerCase();
function tone(s){s=lc(s);return /resolved|approved|returned|closed|claimed|done/.test(s)?'ok':/rejected|false/.test(s)?'bad':/pending|open|new|submitted|waiting/.test(s)?'warn':'info'}
const badge=s=>`<span class="badge ${tone(s)}">${esc(String(s||'').replace(/_/g,' '))}</span>`;
const empty=(t,i='file')=>`<div class="empty"><span class="ico">${ic(i,22)}</span>${esc(t)}</div>`;
const btn=(label,fn,cls='ghost')=>`<button class="btn sm ${cls}" onclick="${fn}">${label}</button>`;
function kpi(label,val,icon,tn='',go=''){return `<button class="kpi" ${go?`data-go="${go}"`:''}><span class="kpi-ico ${tn}">${ic(icon,22)}</span><span><small>${esc(label)}</small><b>${val}</b></span></button>`}

/* ---- data ---- */
let K={};window.lastKpi=null;
function renderKpis(){const k=K;$('kpis').innerHTML=[kpi('Open complaints',k.complaints,'file','warn','services'),kpi('Pending services',k.pendingServices,'clock','warn','services'),kpi('Unread messages',badges.messages,'chat','info','messages'),kpi('Active SOS alerts',k.sos,'alert',k.sos?'bad':'ok','sos'),kpi('Active notices',k.notices,'notice','','notices'),kpi('Student requests open',k.reqOpen,'services','info','services'),kpi('Open lost & found',k.lost,'box','','lost'),kpi('All hall records',k.records,'ops','','ops')].join('')}
function recCard(x){return `<div class="item"><div class="item-top"><strong>${esc(x.title)}</strong>${badge(x.item_type+' · '+x.status)}</div><p>${esc(x.details||'No details provided')}</p><div class="meta">Record #${x.id} · ${esc(x.created_at||'')}</div><div class="item-actions">${btn('In progress',`updateStatus(${x.id},'In Progress')`)}${btn('Resolve',`updateStatus(${x.id},'Resolved')`,'')}${btn('Approve',`updateStatus(${x.id},'Approved')`)}${btn('Reject',`updateStatus(${x.id},'Rejected')`,'danger')}${btn('Close',`updateStatus(${x.id},'Closed')`)}</div></div>`}
const recList=(a,t,i)=>a.length?a.map(recCard).join(''):empty(t,i);
async function loadData(manual){
 try{
  const [d,requests,notices,emergencies,lostFound]=await Promise.all([api('/dashboard'),api('/requests'),api('/notices'),campusApi('/emergency'),campusApi('/lost-found')]);
  const sT=['complaint','service','maintenance','cleaning','laundry'],oT=['incident','leave','visitor','booking','lost_found','event'];
  const sItems=d.recent.filter(x=>sT.includes(lc(x.item_type))),oItems=d.recent.filter(x=>oT.includes(lc(x.item_type)));
  const sPend=sItems.filter(x=>!['resolved','closed'].includes(lc(x.status)));
  const reqOpen=requests.filter(x=>!['resolved','rejected','closed'].includes(lc(x.status)));
  const sosAct=emergencies.filter(x=>!['resolved','false_alarm'].includes(lc(x.status)));
  const lostOpen=lostFound.filter(x=>!['closed','returned'].includes(lc(x.status)));
  const cnt=(t,f)=>d.counts.filter(x=>x.item_type===t&&f(x.status)).reduce((a,x)=>a+Number(x.total),0);
  K={complaints:cnt('complaint',s=>!['Resolved','Closed'].includes(s)),pendingServices:cnt('service',s=>s==='Pending'),notices:d.recent.filter(x=>x.item_type==='notice'&&!['Closed','Expired'].includes(x.status)).length,sos:sosAct.length,reqOpen:reqOpen.length,lost:lostOpen.length,records:d.recent.length};
  window.lastKpi=K;renderKpis();
  badges.services=sPend.length+reqOpen.length;badges.sos=sosAct.length;renderNav();
  const sb=$('sosBanner');if(sosAct.length){$('sosBannerText').innerHTML=`${ic('alert',16)} ${sosAct.length} active emergency alert${sosAct.length>1?'s':''} waiting for a response. <a data-go="sos">Open Emergency SOS</a>`;sb.classList.remove('hidden')}else sb.classList.add('hidden');
  /* overview */
  const att=[...sosAct.map(x=>({t:x.emergency_type+' · '+x.student_name,s:x.status,i:'alert',go:'sos'})),...reqOpen.map(x=>({t:x.title,s:x.status,i:'services',go:'services',sub:x.student_name})),...sPend.map(x=>({t:x.title,s:x.status,i:'file',go:'services'}))].slice(0,7);
  $('attention').innerHTML=att.length?att.map(a=>`<button class="attn" data-go="${a.go}"><span class="kpi-ico ${a.go==='sos'?'bad':'warn'}" style="width:36px;height:36px;border-radius:10px">${ic(a.i,17)}</span><div><b>${esc(a.t)}</b><small>${esc(a.sub||(a.go==='sos'?'Emergency':'Hall service'))}</small></div>${badge(a.s)}</button>`).join(''):empty('All caught up — nothing is waiting for you.','check');
  const nCard=n=>`<div class="item"><div class="item-top"><strong>${esc(n.title)}</strong><span class="badge info">${esc(n.category||'General')}${n.pinned?' · Pinned':''}</span></div><p>${esc(n.body)}</p><div class="item-actions">${btn('Delete notice',`deleteNotice(${n.id})`,'danger')}</div></div>`;
  $('noticeMini').innerHTML=notices.length?notices.slice(0,3).map(n=>`<div class="attn" style="cursor:default"><span class="kpi-ico" style="width:36px;height:36px;border-radius:10px">${ic('notice',17)}</span><div><b>${esc(n.title)}</b><small>${esc(n.category||'General')}${n.pinned?' · Pinned':''}</small></div></div>`).join(''):empty('No active notices.','notice');
  $('noticeList').innerHTML=notices.length?notices.map(nCard).join(''):empty('No active notices.','notice');
  /* services */
  $('serviceKpis').innerHTML=kpi('Complaints & help requests',sItems.length,'services')+kpi('Awaiting action',sPend.length,'clock','warn')+kpi('Resolved',sItems.length-sPend.length,'check','ok');
  $('studentRequests').innerHTML=requests.length?requests.map(x=>`<div class="item"><div class="item-top"><strong>${esc(x.title)} <small>· ${esc(x.student_name||'Student')} (${esc(x.student_external_id||'ID n/a')})</small></strong>${badge(x.type+' · '+x.status)}</div><p>${esc(x.description||'No details provided')}${x.location?'\nLocation: '+esc(x.location):''}</p><div class="item-actions">${btn('In progress',`updateRequest(${x.id},'in_progress')`)}${btn('Resolve',`updateRequest(${x.id},'resolved')`,'')}${btn('Approve',`updateRequest(${x.id},'approved')`)}${btn('Reject',`updateRequest(${x.id},'rejected')`,'danger')}</div></div>`).join(''):empty('No student-submitted hall requests found.','services');
  $('hallServiceRecords').innerHTML=recList(sItems,'No hall service records found.','file');
  /* operations */
  const n=t=>oItems.filter(x=>t.includes(x.item_type)).length;
  $('opsKpis').innerHTML=kpi('Leave requests',n(['leave']),'ops')+kpi('Visitor entries',n(['visitor']),'ops')+kpi('Bookings & events',n(['booking','event']),'ops','info')+kpi('Incidents / lost & found',n(['incident','lost_found']),'alert','warn');
  $('records').innerHTML=recList(oItems,'No hall operation records yet. Leave, visitor, booking, incident and event records will appear here.','ops');
  /* sos */
  $('emergencyRecords').innerHTML=emergencies.length?emergencies.map(x=>`<div class="item" style="border-left-color:${['resolved','false_alarm'].includes(lc(x.status))?'var(--accent-border)':'var(--brick)'}"><div class="item-top"><strong>${esc(x.emergency_type)} · ${esc(x.student_name)}</strong>${badge(x.status)}</div><p>${esc(x.details||'No details')}\nLocation: ${esc(x.location)} · ${esc(x.contact||'No contact')}</p><div class="item-actions">${btn('Acknowledge',`updateEmergency(${x.id},'acknowledged')`)}${btn('Responding',`updateEmergency(${x.id},'responding')`)}${btn('Resolve',`updateEmergency(${x.id},'resolved')`,'')}${btn('False alarm',`updateEmergency(${x.id},'false_alarm')`,'danger')}</div></div>`).join(''):empty('No emergency alerts.','alert');
  /* lost & found */
  $('lostFoundRecords').innerHTML=lostFound.length?lostFound.map(x=>`<div class="item">${x.image_data?`<img src="${esc(x.image_data)}" alt="Lost/found item">`:''}<div class="item-top"><strong>${esc(x.title)} · ${esc(x.item_type)}</strong>${badge(x.status)}</div><p>${esc(x.description||'')}\n${esc(x.location)} · ${esc(x.posted_by)}</p><div class="item-actions">${btn('Claimed',`updateLostFound(${x.id},'claimed')`)}${btn('Returned',`updateLostFound(${x.id},'returned')`)}${btn('Close',`updateLostFound(${x.id},'closed')`,'')}</div></div>`).join(''):empty('No open Lost & Found posts.','box');
  if(manual)toast('Refreshed','ok');
 }catch(e){if(manual)toast(e.message,'err');else msg('createMsg',e.message)}
}
const act=(fn,okMsg='Updated')=>async(...a)=>{try{await fn(...a);await loadData();toast(okMsg,'ok')}catch(e){toast(e.message,'err')}};
window.updateEmergency=act((id,status)=>campusApi('/emergency/'+id,{method:'PATCH',body:{status}}));
window.updateLostFound=act((id,status)=>campusApi('/lost-found/'+id,{method:'PATCH',body:{status}}));
window.updateRequest=act((id,status)=>api('/requests/'+id,{method:'PATCH',body:{status}}));
window.updateStatus=act((id,status)=>api('/items/'+id,{method:'PATCH',body:{status}}));
window.deleteNotice=async id=>{if(!confirm('Delete this notice?'))return;try{await api('/notices/'+id,{method:'DELETE'});await loadData();toast('Notice deleted','ok')}catch(e){toast(e.message,'err')}};
$('createItem').onclick=async()=>{try{const type=$('itemType').value,title=$('itemTitle').value,details=$('itemDetails').value;if(type==='notice')await api('/notices',{method:'POST',body:{title,body:details,category:'General'}});else await api('/items',{method:'POST',body:{item_type:type,title,details,student_id:$('studentId').value||null}});$('itemTitle').value='';$('itemDetails').value='';msg('createMsg',type==='notice'?'Notice published for hall students.':'Record saved.',true);await loadData()}catch(e){msg('createMsg',e.message)}};
setInterval(()=>{if(token&&!document.hidden)loadData()},20000);

/* ---- boot ---- */
setIc('collapseBtn','back',16);setIc('navSearchIco','search',15);setIc('menuBtn','menu',20);setIc('refreshAll','refresh',18);setIc('bellIco','bell',19);setIc('logoutIco','logout',17);setIc('sosBannerClose','close',18);paintThemeBtn();
renderNav();
(async()=>{const t=localStorage.getItem('campusdine_hall_admin_token');if(t){token=t;try{await api('/dashboard');await enter()}catch(_){localStorage.removeItem('campusdine_hall_admin_token');token=''}}})();
window.addEventListener('hashchange',()=>{if(token)show(location.hash.slice(1))});
