'use strict';

const APP={name:'Free to Be Me',version:'0.1.7',schemaVersion:1};
const DB_NAME='ftbm-db',DB_VERSION=1,STORE_NAMES=['profiles','achievements','words','notes','settings','snapshots'];
let db,deferredInstallPrompt=null;
const $=s=>document.querySelector(s),view=$('#view'),modal=$('#modal'),modalBody=$('#modalBody');
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowISO=()=>new Date().toISOString();
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate=v=>v?new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(v)):'';

function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,DB_VERSION);req.onupgradeneeded=()=>{const d=req.result;for(const n of STORE_NAMES)if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
const tx=(s,m='readonly')=>db.transaction(s,m).objectStore(s);
const getAll=s=>new Promise((res,rej)=>{const r=tx(s).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const put=(s,v)=>new Promise((res,rej)=>{const r=tx(s,'readwrite').put(v);r.onsuccess=()=>res(v);r.onerror=()=>rej(r.error);});
const clearStore=s=>new Promise((res,rej)=>{const r=tx(s,'readwrite').clear();r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});
const deleteItem=(s,id)=>new Promise((res,rej)=>{const r=tx(s,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});
async function getSetting(k,f=null){const a=await getAll('settings');return a.find(x=>x.id===k)?.value??f;}
async function setSetting(k,v){return put('settings',{id:k,value:v,updatedAt:nowISO()});}

const quotes=['You are not behind. You are learning your child, one loving step at a time.','Progress can be quiet. Celebrate the moments only your family knows how hard-won they are.','Your child does not need comparison. They need connection, patience, and room to shine.','A small step today can become a treasured memory tomorrow.','You are building safety, trust, and possibility every time you show up.'];
const weeklyQuote=()=>quotes[Math.floor(Date.now()/604800000)%quotes.length];

const routes={home:renderHome,child:renderChild,resources:renderResources,explore:renderExplore,caregiver:renderCaregiver,backup:renderBackup,about:renderAbout,settings:renderSettings};
function navigate(r){const route=routes[r]?r:'home';document.body.classList.toggle('home-route',route==='home');routes[route]();history.replaceState(null,'',`#${route}`);closeDrawer();view.focus();}
const card=(i,t,d,r)=>`<button class="card-button" data-go="${r}"><span class="emoji">${i}</span><strong>${t}</strong><small>${d}</small></button>`;
function bindRouteButtons(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));}

async function renderHome(){
  view.innerHTML=`<section class="illustrated-home" aria-label="Free to Be Me home navigation">
    <img src="assets/home/homepage.jpeg" alt="Free to Be Me — celebrating every child’s unique journey" width="864" height="1536">
    <button class="home-hotspot growth" data-go="child" aria-label="Open Growth Journey and My Child"><span>Growth Journey</span></button>
    <button class="home-hotspot communication" data-feature="Communication Support" aria-label="Open Communication Support"><span>Communication Support</span></button>
    <button class="home-hotspot sleep" data-feature="Sleep Sanctuary" aria-label="Open Sleep Sanctuary"><span>Sleep Sanctuary</span></button>
    <button class="home-hotspot sensory" data-feature="Sensory Support" aria-label="Open Sensory Support"><span>Sensory Support</span></button>
    <button class="home-hotspot learning" data-feature="Learning Tools" aria-label="Open Learning Tools"><span>Learning Tools</span></button>
    <button class="home-hotspot medical" data-feature="Medical Resources" aria-label="Open Medical Resources"><span>Medical Resources</span></button>
    <button class="home-hotspot caregiver-link" data-go="caregiver" aria-label="Open Caregiver Corner"><span>Caregiver Corner</span></button>
    <button class="home-hotspot community" data-go="explore" aria-label="Open Community Village and Explore"><span>Community Village</span></button>
  </section>`;
  bindRouteButtons();
  document.querySelectorAll('.home-hotspot[data-feature]').forEach(b=>b.onclick=()=>underConstruction(b.dataset.feature));
}

function openWeeklyEncouragement(){
  modalBody.innerHTML=`<h2>💛 A message for you</h2>
  <div class="card"><p style="font-size:1.1rem;line-height:1.6">“${esc(weeklyQuote())}”</p></div>
  <p class="hint">A new encouragement appears automatically each week.</p>
  <button id="closeEncouragement" class="btn full" type="button">Thank you</button>`;
  modal.showModal();
  $('#closeEncouragement').onclick=()=>modal.close();
}

function underConstruction(feature){
  modalBody.innerHTML=`<h2>🚧 ${esc(feature)}</h2>
  <div class="banner">This feature is still under construction and will become available in a future build.</div>
  <button id="closeConstruction" class="btn full" type="button" style="margin-top:14px">Got it</button>`;
  modal.showModal();
  $('#closeConstruction').onclick=()=>modal.close();
}

async function renderChild(){
  const p=await getAll('profiles'),a=await getAll('achievements'),w=await getAll('words');
  if(!p.length){
    view.innerHTML=`<div class="empty card"><div class="big">🌱</div><h2>Start your child’s journey</h2><p>Create a profile before adding real progress data.</p><div class="btn-row" style="justify-content:center"><button id="addProfile" class="btn">Create profile</button></div></div>`;
    $('#addProfile').onclick=openProfileForm;
    return;
  }
  view.innerHTML=`<div class="btn-row"><button id="addProfile" class="btn secondary">Add another child</button><button id="addAchievement" class="btn">Celebrate a new achievement</button></div>
  <h2 class="section-title">Child profiles</h2>
  <div class="list">${p.map(x=>`<div class="profile-card card"><div class="avatar">${esc(x.emoji||'🌟')}</div><div class="meta"><h3>${esc(x.name)}</h3><p>${x.birthDate?`Born ${fmtDate(x.birthDate)}`:'A unique journey worth celebrating'}</p></div></div>`).join('')}</div>
  <h2 class="section-title">Progress tools</h2>
  <div class="grid">
    <button id="viewAchievements" class="card-button"><span class="emoji">✨</span><strong>Achievements</strong><small>${a.length} saved. Tap to view.</small></button>
    <button id="viewWords" class="card-button"><span class="emoji">🗣️</span><strong>Words & phrases</strong><small>${w.length} saved.</small></button>
    <button id="providerSummary" class="card-button"><span class="emoji">📄</span><strong>Provider summary</strong><small>Share progress over time.</small></button>
  </div>`;
  $('#addProfile').onclick=openProfileForm;
  $('#addAchievement').onclick=()=>openAchievementForm(p);
  $('#viewAchievements').onclick=()=>openAchievements(a,p);
  $('#viewWords').onclick=()=>underConstruction('Words & phrases');
  $('#providerSummary').onclick=()=>underConstruction('Provider summary');
}

function openAchievements(items,profiles){
  const names=Object.fromEntries(profiles.map(p=>[p.id,p.name]));
  const sorted=[...items].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  modalBody.innerHTML=`<h2>✨ Achievements</h2>
  ${sorted.length?`<div class="list">${sorted.map(x=>`<div class="list-item"><div style="font-size:1.7rem">🎉</div><div><strong>${esc(x.title)}</strong><div class="hint">${esc(names[x.profileId]||'Child')} • ${esc(x.category||'Achievement')} • ${fmtDate(x.date||x.createdAt)}</div>${x.notes?`<p style="margin-bottom:0">${esc(x.notes)}</p>`:''}</div></div>`).join('')}</div>`:`<div class="empty"><div class="big">🌱</div><p>No achievements have been saved yet.</p></div>`}
  <button id="closeAchievements" class="btn full" type="button" style="margin-top:14px">Close</button>`;
  modal.showModal();
  $('#closeAchievements').onclick=()=>modal.close();
}

function openProfileForm(){modalBody.innerHTML=`<h2>Create child profile</h2><div class="form-grid"><div class="field"><label>Name</label><input id="pName" autocomplete="off"></div><div class="field"><label>Birth date <span class="hint">(optional)</span></label><input id="pBirth" type="date"></div><div class="field"><label>Profile symbol</label><select id="pEmoji"><option>🌟</option><option>🌱</option><option>🌈</option><option>🦋</option><option>🌻</option></select></div><button id="saveProfile" class="btn full" type="button">Save profile</button></div>`;modal.showModal();$('#saveProfile').onclick=async()=>{const name=$('#pName').value.trim();if(!name)return alert('Please enter a name.');await put('profiles',{id:uid(),name,birthDate:$('#pBirth').value||null,emoji:$('#pEmoji').value,createdAt:nowISO(),updatedAt:nowISO(),syncStatus:'local'});modal.close();renderChild();};}
function openAchievementForm(p){modalBody.innerHTML=`<h2>Celebrate an achievement</h2><div class="form-grid"><div class="field"><label>Child</label><select id="aProfile">${p.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>What happened?</label><input id="aTitle" placeholder="Used a new sentence"></div><div class="field"><label>Category</label><select id="aCategory"><option>Communication</option><option>Learning</option><option>Daily living</option><option>Motor skills</option><option>Sensory & regulation</option><option>Social connection</option><option>Other</option></select></div><div class="field"><label>Date</label><input id="aDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Notes</label><textarea id="aNotes" placeholder="What helped? What made this moment special?"></textarea></div><button id="saveAchievement" class="btn full" type="button">🎉 You did it! Save achievement</button></div>`;modal.showModal();$('#saveAchievement').onclick=async()=>{const t=$('#aTitle').value.trim();if(!t)return alert('Please describe the achievement.');await put('achievements',{id:uid(),profileId:$('#aProfile').value,title:t,category:$('#aCategory').value,date:$('#aDate').value,notes:$('#aNotes').value.trim(),createdAt:nowISO(),updatedAt:nowISO(),syncStatus:'local'});modal.close();alert('🎉 Achievement saved!');renderChild();};}

function placeholder(t,i,c,items){
  view.innerHTML=`<section class="hero"><h1>${i} ${t}</h1><p>${c}</p></section><h2 class="section-title">Planned sections</h2><div class="grid">${items.map(x=>`<button class="card-button future-feature" data-feature="${esc(x[0].replace(/^[^ ]+ /,''))}"><strong>${x[0]}</strong><small>${x[1]}</small></button>`).join('')}</div><div class="banner" style="margin-top:18px">This section is included in the app structure now and will be activated in a later version.</div>`;
  document.querySelectorAll('.future-feature').forEach(b=>b.onclick=()=>underConstruction(b.dataset.feature));
}
function renderResources(){placeholder('Resources','📚','Practical information organized for overwhelmed caregivers.',[['🗣️ Communication','ASL, AAC, speech, and visual supports.'],['🧸 Sensory','Tools, toys, regulation, and room supports.'],['🌙 Sleep','Routines, tracking, and sleep environment ideas.'],['🏥 Medical advocacy','Equipment information and necessity-letter templates.'],['🧬 Health education','Careful, sourced explanations for labs and genetics.'],['🎓 Learning','Discovering how your child learns best.']]);}
function renderExplore(){placeholder('Explore','🗺️','A future guide to autism-friendly family fun.',[['🎡 Family activities','Sensory-friendly events and destinations.'],['🔇 Sensory details','Noise, crowds, lighting, and quiet spaces.'],['📍 Location search','Find nearby options when online services are added.']]);}
function renderCaregiver(){
  view.innerHTML=`<section class="hero"><h1>💛 Caregiver Corner</h1><p>Support for the caregiver matters too.</p></section>
  <h2 class="section-title">Caregiver support</h2>
  <div class="grid">
    <button id="caregiverEncouragement" class="card-button"><strong>💬 Encouragement</strong><small>Weekly messages and strength-focused reminders.</small></button>
    <button class="card-button future-feature" data-feature="Reflection"><strong>📝 Reflection</strong><small>Private notes and observations.</small></button>
    <button class="card-button future-feature" data-feature="Support messaging"><strong>🤝 Support messaging</strong><small>A future premium support option with clear boundaries.</small></button>
  </div>`;
  $('#caregiverEncouragement').onclick=openWeeklyEncouragement;
  document.querySelectorAll('.future-feature').forEach(b=>b.onclick=()=>underConstruction(b.dataset.feature));
}

async function collectBackup(){const data={};for(const s of STORE_NAMES.filter(x=>x!=='snapshots'))data[s]=await getAll(s);return{format:'ftbm-backup',app:APP.name,appVersion:APP.version,schemaVersion:APP.schemaVersion,exportedAt:nowISO(),counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),data};}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function exportBackup(){const b=await collectBackup(),stamp=new Date().toISOString().replace(/[:.]/g,'-');downloadBlob(new Blob([JSON.stringify(b,null,2)],{type:'application/json'}),`FreeToBeMe-Backup-${stamp}.ftbmbackup`);await setSetting('lastBackupAt',b.exportedAt);renderBackup();}
async function createSnapshot(reason){const b=await collectBackup(),s={id:uid(),reason,createdAt:nowISO(),backup:b};await put('snapshots',s);const all=(await getAll('snapshots')).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));for(const old of all.slice(5))await deleteItem('snapshots',old.id);}
function validateBackup(b){if(!b||b.format!=='ftbm-backup'||!b.data||typeof b.schemaVersion!=='number')throw new Error('This is not a valid Free to Be Me backup.');if(b.schemaVersion>APP.schemaVersion)throw new Error('This backup was created by a newer version of the app.');for(const s of STORE_NAMES.filter(x=>x!=='snapshots'))if(!Array.isArray(b.data[s]||[]))throw new Error(`Backup section ${s} is invalid.`);}
async function previewRestore(file){const b=JSON.parse(await file.text());validateBackup(b);modalBody.innerHTML=`<h2>Restore preview</h2><div class="card"><p><strong>Created:</strong> ${fmtDate(b.exportedAt)}</p><p><strong>App version:</strong> ${esc(b.appVersion)}</p><p><strong>Profiles:</strong> ${b.data.profiles.length}</p><p><strong>Achievements:</strong> ${b.data.achievements.length}</p><p><strong>Words:</strong> ${b.data.words.length}</p><p><strong>Notes:</strong> ${b.data.notes.length}</p></div><div class="banner" style="margin-top:12px">A safety checkpoint will be created before current data changes.</div><div class="btn-row"><button id="replaceRestore" type="button" class="btn danger">Replace current data</button><button id="mergeRestore" type="button" class="btn secondary">Merge safely</button></div>`;modal.showModal();$('#replaceRestore').onclick=()=>performRestore(b,'replace');$('#mergeRestore').onclick=()=>performRestore(b,'merge');}
async function performRestore(b,mode){try{await createSnapshot(`Before ${mode} restore`);const stores=STORE_NAMES.filter(x=>x!=='snapshots');if(mode==='replace')for(const s of stores)await clearStore(s);for(const s of stores){const existing=mode==='merge'?new Set((await getAll(s)).map(x=>x.id)):new Set();for(const item of b.data[s]||[])if(!existing.has(item.id))await put(s,item);}modal.close();alert('Restore completed successfully.');navigate('backup');}catch(e){alert(`Restore failed: ${e.message}`);}}
async function renderBackup(){const last=await getSetting('lastBackupAt'),snaps=(await getAll('snapshots')).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));view.innerHTML=`<section class="hero"><h1>💾 Backup & Restore</h1><p>Your family data stays on this device unless you export it yourself.</p></section><h2 class="section-title">Complete local backup</h2><div class="card"><p>Exports profiles, achievements, words, notes, and settings into one versioned file.</p><div class="btn-row"><button id="exportBtn" class="btn">Export complete backup</button><button id="restoreBtn" class="btn secondary">Restore from file</button></div><p class="hint">Last manual backup: ${last?fmtDate(last):'None yet'}</p></div><h2 class="section-title">Safety checkpoints</h2><div class="card"><p>The app keeps up to five internal checkpoints before risky operations.</p><div class="btn-row"><button id="checkpointBtn" class="btn secondary">Create checkpoint now</button></div><p class="hint">Saved checkpoints: ${snaps.length}</p></div><div class="banner" style="margin-top:18px"><strong>Important:</strong> Removing the PWA or clearing browser storage can erase local data. Export backups regularly and store copies somewhere safe.</div>`;$('#exportBtn').onclick=exportBackup;$('#restoreBtn').onclick=()=>$('#restoreInput').click();$('#checkpointBtn').onclick=async()=>{await createSnapshot('Manual checkpoint');alert('Safety checkpoint created.');renderBackup();};}

function renderSettings(){view.innerHTML=`<section class="hero"><h1>⚙️ Settings</h1><p>App preferences and data protection information.</p></section><div class="card" style="margin-top:18px"><h3>Version</h3><p>${APP.name} v${APP.version}</p><p class="hint">Database schema ${APP.schemaVersion}</p></div><div class="card" style="margin-top:12px"><h3>Data model</h3><p>Local-first IndexedDB with permanent IDs and timestamps, ready for optional cloud sync later.</p></div><div class="btn-row"><button class="btn secondary" data-go="backup">Open backup tools</button><button class="btn secondary" data-go="about">About & disclaimer</button></div>`;bindRouteButtons();}
function renderAbout(){view.innerHTML=`<section class="hero"><h1>About Free to Be Me</h1><p>A strengths-first autism caregiver village.</p></section><div class="card" style="margin-top:18px"><h3>Our purpose</h3><p>To help caregivers celebrate progress, understand how their child learns and communicates, and find practical support without judgment or comparison.</p></div><div class="card" style="margin-top:12px"><h3>Important disclaimer</h3><p>This app is for caregiver education, organization, and support. It does not diagnose, treat, or replace advice from qualified medical, developmental, educational, or legal professionals.</p></div>`;}

function openDrawer(){$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#scrim').classList.remove('hidden');}
function closeDrawer(){$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#scrim').classList.add('hidden');}
function setupDrawer(){const links=[['🏠','Home','home'],['🌱','My Child','child'],['📚','Resources','resources'],['🗺️','Explore','explore'],['💛','Caregiver Corner','caregiver'],['💾','Backup & Restore','backup'],['⚙️','Settings','settings'],['ℹ️','About','about']];$('#drawerNav').innerHTML=links.map(x=>`<button data-go="${x[2]}">${x[0]} ${x[1]}</button>`).join('');$('#drawerVersion').textContent=APP.version;bindRouteButtons();$('#menuBtn').onclick=openDrawer;$('#homeBadge').onclick=()=>navigate('home');$('#closeDrawer').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;}
function setupPWA(){
  if('serviceWorker'in navigator){
    let refreshing=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(refreshing)return;
      refreshing=true;
      location.reload();
    });
    navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'})
      .then(reg=>reg.update())
      .catch(()=>{});
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;$('#installBtn').classList.remove('hidden');});
  $('#installBtn').onclick=async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('#installBtn').classList.add('hidden');};
}
async function init(){db=await openDB();setupDrawer();setupPWA();document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>navigate(b.dataset.route));$('#restoreInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await previewRestore(f);}catch(err){alert(err.message);}e.target.value='';};navigate(location.hash.slice(1)||'home');}
init().catch(err=>{view.innerHTML=`<div class="banner"><strong>Startup error:</strong> ${esc(err.message)}</div>`;});
