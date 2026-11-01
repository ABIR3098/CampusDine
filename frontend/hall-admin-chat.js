/* CampusDine Hall Admin — Messages (same chat look & behaviour as the other roles) */
window.HallChat=(function(){
const S={started:false,convs:[],sel:null,msgs:[],firstUnread:null,me:0,sock:null,online:new Set(),lastSeen:{},reply:null,typing:false,typingT:null,sig:'',imgs:{}};
const TPL=['Hello! How can I help you?','We have received your request.','Your issue is being worked on.','Your request has been resolved. Thank you!','Please share a few more details.'];
const COLORS=['#4F7F5F','#2F76B8','#7A5CA8','#D0537A','#B7791F','#0E7490','#B45309'];
const q=id=>document.getElementById(id);
const col=n=>COLORS[[...String(n||'?')].reduce((a,c)=>a+c.charCodeAt(0),0)%COLORS.length];
const ini=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?';
const roleLabel=r=>r==='admin'?'Canteen Admin':r==='teacher'?'Teacher':r==='student'?'Student':r==='staff'?'Staff':r||'';
const av=(n,id,sm)=>`<span class="chat-av ${sm?'sm':''}" style="background:${col(n)}">${esc(ini(n))}${!sm&&S.online.has(Number(id))?'<i class="on"></i>':''}</span>`;
const t12=d=>d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
function when(t){const d=new Date(t);if(isNaN(d))return'';const n=new Date();return d.toDateString()===n.toDateString()?t12(d):d.toLocaleDateString([],{day:'numeric',month:'short'})}
function day(t){const d=new Date(t),n=new Date(),y=new Date(Date.now()-864e5);return d.toDateString()===n.toDateString()?'Today':d.toDateString()===y.toDateString()?'Yesterday':d.toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})}
function ago(s){s=Number(s);if(!isFinite(s))return'';if(s<60)return'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';return Math.floor(s/86400)+' d ago'}
async function call(path,opts={}){const r=await fetch('/api/chat'+path,{method:opts.method||'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+getToken()},...(opts.body?{body:JSON.stringify(opts.body)}:{})});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Chat request failed');return d}
const visible=()=>!q('v-messages').classList.contains('hidden');
const err=t=>{const e=q('chErr');if(e)e.textContent=t||''};

function build(){
 q('chatRoot').innerHTML=`<div class="chat-shell" id="chShell" data-mobile-chat="0">
  <div class="panel chat-inbox"><div class="chat-inbox-head"><div class="chat-inbox-title"><b>Inbox</b><span class="chat-pill" id="chUnread" hidden></span></div><input class="chat-search" id="chSearch" placeholder="Search student or teacher to message…" autocomplete="off" aria-label="Find a student"><div id="chFound" class="chat-found hidden"></div></div><div class="chat-inbox-list" id="chList"></div></div>
  <div class="panel chat-panel"><div class="chat-head" id="chHead"></div><div class="chat-error" id="chErr" role="alert"></div><div class="chat-scroll" id="chScroll"></div><div class="chat-replybar hidden" id="chReply"></div>
   <div class="chat-templates" id="chTpl">${TPL.map((t,i)=>`<button type="button" data-i="${i}" disabled>${esc(t)}</button>`).join('')}</div>
   <form class="chat-composer" id="chForm"><div class="chat-input-wrap"><textarea id="chInput" rows="1" maxlength="4000" placeholder="Choose a conversation to start…" aria-label="Message" disabled></textarea><span class="chat-count" id="chCount"></span></div><button class="chat-send" id="chSend" aria-label="Send" disabled>${ic('send',18)}</button></form></div></div>`;
 head();paintMsgs(true);
 q('chShell').addEventListener('click',e=>{const t=e.target.closest('[data-i]');if(t&&t.closest('#chTpl')){const i=q('chInput');i.value=TPL[t.dataset.i];i.focus();fit()}});
 q('chForm').onsubmit=e=>{e.preventDefault();send()};
 const inp=q('chInput');inp.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
 inp.oninput=()=>{fit();q('chCount').textContent=inp.value.length>3500?inp.value.length+' / 4000':'';q('chSend').disabled=!inp.value.trim()||!S.sel;typing(true)};
 let st;q('chSearch').oninput=()=>{clearTimeout(st);const v=q('chSearch').value.trim();if(v.length<2){q('chFound').classList.add('hidden');return}st=setTimeout(()=>find(v),250)};
 document.addEventListener('click',e=>{if(!e.target.closest('.chat-inbox-head'))q('chFound')&&q('chFound').classList.add('hidden')});
}
const fit=()=>{const i=q('chInput');i.style.height='auto';i.style.height=Math.min(i.scrollHeight,120)+'px'};
async function find(v){try{const d=await call('/directory?q='+encodeURIComponent(v));const b=q('chFound');b.innerHTML=(d.users||[]).length?d.users.map(u=>`<button type="button" data-u="${u.id}" data-n="${esc(u.name)}" data-r="${esc(u.role)}">${av(u.name,u.id,true)}<span>${esc(u.name)}<small>${esc(roleLabel(u.role))}${u.external_id?' · '+esc(u.external_id):''}</small></span></button>`).join(''):'<div class="note">No student found</div>';b.classList.remove('hidden');b.querySelectorAll('button').forEach(x=>x.onclick=()=>{q('chSearch').value='';b.classList.add('hidden');open(+x.dataset.u,x.dataset.n,x.dataset.r)})}catch(e){err(e.message)}}

function paintList(){
 const un=S.convs.reduce((n,c)=>n+Number(c.unread_count||0),0);const p=q('chUnread');p.textContent=un+' unread';p.hidden=!un;
 if(window.onChatUnread)window.onChatUnread(un);
 q('chList').innerHTML=S.convs.length?S.convs.map(c=>`<button class="chat-item ${Number(c.user_id)===Number(S.sel&&S.sel.id)?'active':''}" data-u="${c.user_id}" data-n="${esc(c.name)}" data-r="${esc(c.role)}">${av(c.name,c.user_id)}<span class="chat-item-body"><span class="chat-item-top"><span class="chat-item-name">${esc(c.name)}</span><span class="chat-item-time">${when(c.updated_at)}</span></span><span class="chat-item-bottom"><span class="chat-item-last">${esc(c.last_message||'')}</span>${Number(c.unread_count)?`<span class="chat-badge">${Number(c.unread_count)}</span>`:''}</span><span class="chat-item-role">${esc(roleLabel(c.role))}</span></span></button>`).join(''):`<div class="chat-empty" style="padding:30px 16px"><span class="ico">${ic('chat',26)}</span>No conversations yet.<br>Search a student above to send the first message.</div>`;
 q('chList').querySelectorAll('.chat-item').forEach(b=>b.onclick=()=>open(+b.dataset.u,b.dataset.n,b.dataset.r));
}
function head(){
 const s=S.sel;const h=q('chHead');
 if(!s){h.innerHTML='<div class="chat-head-info"><b>Choose a conversation</b><small>Messages with students are private to the Hall Admin.</small></div>';return}
 const on=S.online.has(Number(s.id));const live=S.typing?'typing…':on?'Online':(S.lastSeen[s.id]!=null?'Last seen '+ago(S.lastSeen[s.id]):'');
 h.innerHTML=`<button class="chat-back" id="chBack" aria-label="Back">${ic('back',20)}</button>${av(s.name,s.id)}<div class="chat-head-info"><b>${esc(s.name)}</b><small class="${S.typing||on?'live':''}">${esc(live||roleLabel(s.role))}</small></div><span class="chat-pill role">${esc(roleLabel(s.role))}</span>`;
 q('chBack').onclick=()=>q('chShell').setAttribute('data-mobile-chat','0');
}
function bubbleImg(m){return m.image_id?`<img class="chat-img" data-img="${m.image_id}" alt="Photo">`:''}
function paintMsgs(force){
 const box=q('chScroll');const sig=S.msgs.map(m=>m.id+(m.deleted_at?'x':'')+(m.read_at?'r':'')).join(',')+(S.typing?'t':'');
 if(!force&&sig===S.sig)return;S.sig=sig;const near=box.scrollHeight-box.scrollTop-box.clientHeight<90;
 if(!S.sel){box.innerHTML=`<div class="chat-empty"><span class="ico">${ic('chat',28)}</span><b>Select a conversation</b><br>Pick a student from the inbox, or search for one to start a new chat.</div>`;return}
 if(!S.msgs.length){box.innerHTML=`<div class="chat-empty"><span class="ico">${ic('chat',28)}</span>No messages yet.<br>Say hello to ${esc(S.sel.name)} below.</div>`;return}
 const unread=S.firstUnread?S.msgs.slice(S.msgs.findIndex(m=>m.id===S.firstUnread)).filter(m=>Number(m.sender_id)!==S.me&&!m.deleted_at).length:0;let out='';
 S.msgs.forEach((m,i)=>{const p=S.msgs[i-1],n=S.msgs[i+1],mine=Number(m.sender_id)===S.me,sd=!p||new Date(p.created_at).toDateString()!==new Date(m.created_at).toDateString();
  if(sd)out+=`<div class="chat-day"><span>${day(m.created_at)}</span></div>`;
  if(m.id===S.firstUnread&&unread>0)out+=`<div class="chat-unread" id="chUnreadDiv"><span>${unread} new message${unread>1?'s':''}</span></div>`;
  const first=!p||Number(p.sender_id)!==Number(m.sender_id)||sd,last=!n||Number(n.sender_id)!==Number(m.sender_id);
  const tools=!m.pending&&!m.deleted_at?`<div class="tools"><button type="button" data-reply="${m.id}" title="Reply" aria-label="Reply">${ic('reply',14)}</button>${mine?`<button type="button" data-del="${m.id}" title="Delete" aria-label="Delete">${ic('trash',14)}</button>`:''}</div>`:'';
  const quote=m.reply_to_id&&!m.deleted_at?`<div class="chat-quote"><b>${esc(m.reply_sender_name||'')}</b>${m.reply_deleted?'<i>Message deleted</i>':esc(m.reply_text||'')}</div>`:'';
  out+=`<div class="chat-row ${mine?'mine':''}">${!mine?`<div style="width:30px">${last?av(S.sel.name,S.sel.id,true):''}</div>`:tools}<div class="chat-bubble ${mine?'mine':'theirs'} ${first?'first':''} ${last?'last':''} ${m.pending?'pending':''} ${m.deleted_at?'deleted':''}">${quote}${m.deleted_at?'<p>Message deleted</p>':bubbleImg(m)+(m.message?`<p>${esc(m.message)}</p>`:'')}<span class="chat-meta">${t12(new Date(m.created_at))}${mine&&!m.pending?(m.read_at?' ✓✓':' ✓'):''}</span></div>${!mine?tools:''}</div>`});
 if(S.typing)out+='<div class="chat-typing"><i></i><i></i><i></i></div>';
 box.innerHTML=out;
 box.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>startReply(+b.dataset.reply));box.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>del(+b.dataset.del));
 box.querySelectorAll('img[data-img]').forEach(loadImg);
 const d=q('chUnreadDiv');if(force&&d)d.scrollIntoView({block:'center'});else if(force||near)box.scrollTop=box.scrollHeight;
}
async function loadImg(el){const id=el.dataset.img;try{if(!S.imgs[id]){const r=await fetch('/api/chat/images/'+id,{headers:{Authorization:'Bearer '+getToken()}});if(!r.ok)throw 0;S.imgs[id]=URL.createObjectURL(await r.blob())}el.src=S.imgs[id]}catch{el.alt='Photo unavailable'}}
function startReply(id){const m=S.msgs.find(x=>x.id===id);if(!m)return;S.reply=m;const r=q('chReply');r.innerHTML=`<div><b>Replying to ${Number(m.sender_id)===S.me?'yourself':esc(S.sel.name)}</b> · ${esc((m.message||'Photo').slice(0,90))}</div><button type="button" class="icon-btn" style="width:30px;height:30px" aria-label="Cancel reply" id="chReplyX">${ic('close',14)}</button>`;r.classList.remove('hidden');q('chReplyX').onclick=clearReply;q('chInput').focus()}
function clearReply(){S.reply=null;q('chReply').classList.add('hidden')}
async function del(id){if(!confirm('Delete this message?'))return;try{await call('/messages/'+id,{method:'DELETE'});await loadMsgs();await loadConvs()}catch(e){err(e.message)}}

async function loadConvs(){try{const d=await call('/conversations');S.convs=d.conversations||[];paintList()}catch(e){err(e.message)}}
async function loadMsgs(force){if(!S.sel)return;try{const d=await call('/'+S.sel.id+'/messages');const keep=S.msgs.filter(m=>m.pending&&!(d.messages||[]).some(x=>x.message===m.message&&Number(x.sender_id)===S.me&&x.id>(S.lastId||0)));S.msgs=[...(d.messages||[]),...keep];if(force)S.firstUnread=d.firstUnreadId||null;paintMsgs(!!force);err('')}catch(e){err(e.message)}}
async function loadPresence(){try{const d=await call('/presence');S.online=new Set((d.online||[]).map(Number));S.lastSeen=d.lastSeen||{};paintList();head()}catch{}}
async function open(id,name,role){S.sel={id,name,role};S.msgs=[];S.sig='';S.typing=false;clearReply();q('chShell').setAttribute('data-mobile-chat','1');
 head();paintMsgs(true);const i=q('chInput');i.disabled=false;i.placeholder='Write a message…';q('chSend').disabled=true;q('chTpl').querySelectorAll('button').forEach(b=>b.disabled=false);
 await loadMsgs(true);await loadConvs();if(window.innerWidth>900)i.focus()}
async function send(){
 const i=q('chInput'),text=i.value.trim();if(!text||!S.sel)return;const reply=S.reply?S.reply.id:undefined;
 const tmp={id:'p'+Date.now(),sender_id:S.me,message:text,created_at:new Date().toISOString(),pending:true};S.msgs.push(tmp);S.lastId=Math.max(0,...S.msgs.filter(m=>typeof m.id==='number').map(m=>m.id));
 i.value='';fit();q('chCount').textContent='';q('chSend').disabled=true;clearReply();paintMsgs(true);typing(false);
 try{await call('/messages',{method:'POST',body:{message:text,userId:S.sel.id,replyTo:reply}});await loadMsgs(true);S.firstUnread=null;await loadConvs()}
 catch(e){S.msgs=S.msgs.filter(m=>m!==tmp);paintMsgs(true);err(e.message);i.value=text;q('chSend').disabled=false}
 i.focus()}
function typing(on){if(!S.sock||!S.sel)return;if(on){if(S.typing_sent)return;S.typing_sent=true;S.sock.emit('chat:typing',{to:S.sel.id,typing:true});clearTimeout(S.stopT);S.stopT=setTimeout(()=>typing(false),2500)}else{S.typing_sent=false;S.sock.emit('chat:typing',{to:S.sel.id,typing:false})}}

function start(){
 if(S.started)return;S.started=true;
 try{S.me=Number(JSON.parse(atob(getToken().split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).id)||0}catch{}
 build();loadConvs();loadPresence();
 setInterval(()=>{if(document.hidden)return;loadConvs();if(visible()){loadMsgs(false)}},7000);setInterval(()=>{if(!document.hidden)loadPresence()},20000);
 try{if(window.io){S.sock=io(location.origin,{auth:{token:getToken()}});
  S.sock.on('chat:message',()=>{loadConvs();if(visible())loadMsgs(false)});S.sock.on('chat:deleted',()=>{loadConvs();if(visible())loadMsgs(false)});
  S.sock.on('chat:typing',p=>{if(!p||!S.sel||Number(p.from)!==Number(S.sel.id))return;S.typing=!!p.typing;head();paintMsgs(true);clearTimeout(S.typingT);if(p.typing)S.typingT=setTimeout(()=>{S.typing=false;head();paintMsgs(true)},4000)})}}catch{}
}
function opened(){if(!S.started)return;loadConvs();if(S.sel)loadMsgs(false)}
return{start,opened}
})();
