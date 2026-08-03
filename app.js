'use strict';

const APP={name:'Free to Be Me',version:'0.2.0',schemaVersion:1};
const DB_NAME='ftbm-db',DB_VERSION=1,STORE_NAMES=['profiles','achievements','words','notes','settings','snapshots'];
let db,deferredInstallPrompt=null;
const $=s=>document.querySelector(s),view=$('#view'),modal=$('#modal'),modalBody=$('#modalBody');
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const nowISO=()=>new Date().toISOString();
const esc=(v='')=>String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const fmtDate=v=>v?new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(v)?`${v}T12:00:00`:v)):'';

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

const routes={home:renderHome,child:renderChild,vocabulary:renderVocabulary,resources:renderResources,explore:renderExplore,caregiver:renderCaregiver,backup:renderBackup,about:renderAbout,settings:renderSettings};
function navigate(r){const route=routes[r]?r:'home';document.body.classList.toggle('home-route',route==='home');routes[route]();history.replaceState(null,'',`#${route}`);closeDrawer();view.focus();}
const card=(i,t,d,r)=>`<button class="card-button" data-go="${r}"><span class="emoji">${i}</span><strong>${t}</strong><small>${d}</small></button>`;
function bindRouteButtons(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));}

async function renderHome(){
  view.innerHTML=`<section class="illustrated-home" aria-label="Free to Be Me home navigation">
    <img src="assets/home/homepage.jpeg" alt="Free to Be Me — celebrating every child’s unique journey" width="864" height="1536">
    <button class="home-hotspot growth" data-go="child" aria-label="Open Growth Journey and My Child"><span>Growth Journey</span></button>
    <button class="home-hotspot communication" data-go="vocabulary" aria-label="Open Communication Support and Vocabulary"><span>Communication Support</span></button>
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

const isoToday=()=>new Date().toISOString().slice(0,10);
const wordKey=v=>String(v||'').trim().toLocaleLowerCase();
function parseDateText(value){
  const s=String(value||'').trim().replace(/^[,;|\-–—\s]+|[,;|\-–—\s]+$/g,'');
  let m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(m)return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m=s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2}|\d{4})$/);
  if(m){let y=Number(m[3]);if(y<100)y+=y<50?2000:1900;const d=new Date(y,Number(m[1])-1,Number(m[2]));if(d.getFullYear()===y&&d.getMonth()===Number(m[1])-1&&d.getDate()===Number(m[2]))return `${y}-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;}
  const t=Date.parse(s);return Number.isNaN(t)?null:new Date(t).toISOString().slice(0,10);
}
function parseBulkVocabulary(text,fallbackDate){
  const entries=[],skipped=[];let currentDate=fallbackDate;
  const datePattern=/(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/.]\d{1,2}[\/.](?:\d{2}|\d{4})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,)?\s+\d{2,4})/i;
  for(const original of String(text||'').split(/\r?\n/)){
    let line=original.trim().replace(/^(?:[-•*☐☑✓]+|\d+[.)])\s*/, '');
    if(!line)continue;
    const onlyDate=parseDateText(line);
    if(onlyDate&&datePattern.test(line)){currentDate=onlyDate;continue;}
    const match=line.match(datePattern);let date=currentDate,word=line;
    if(match){date=parseDateText(match[0])||currentDate;word=line.replace(match[0],'');}
    word=word.replace(/^[\s,:;|\-–—]+|[\s,:;|\-–—]+$/g,'').trim();
    if(!word||!date){skipped.push(original);continue;}
    entries.push({word,date});
  }
  return{entries,skipped};
}
async function renderVocabulary(){
  const profiles=await getAll('profiles'),words=await getAll('words');
  if(!profiles.length){view.innerHTML=`<div class="empty card"><div class="big">🗣️</div><h2>Create a child profile first</h2><p>Vocabulary entries are connected to a child so every word remains part of the correct story.</p><button id="vocabCreateProfile" class="btn">Create profile</button></div>`;$('#vocabCreateProfile').onclick=openProfileForm;return;}
  const years=[...new Set(words.map(x=>String(x.date||'').slice(0,4)).filter(Boolean))].sort((a,b)=>b-a);
  view.innerHTML=`<section class="hero"><h1>🗣️ Vocabulary</h1><p>Save each word or phrase with the date it was first said.</p></section>
  <div class="btn-row"><button id="addWord" class="btn">Add one word</button><button id="bulkWords" class="btn secondary">Bulk import from Notes</button></div>
  <div class="vocab-controls card">
    <div class="field"><label>Child</label><select id="vocabProfile"><option value="all">All children</option>${profiles.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Search</label><input id="vocabSearch" type="search" placeholder="Find a word or phrase"></div>
    <div class="field"><label>Sort</label><select id="vocabSort"><option value="alpha">Alphabetical</option><option value="newest">Date said — newest</option><option value="oldest">Date said — oldest</option></select></div>
    <div class="field"><label>Year</label><select id="vocabYear"><option value="">All years</option>${years.map(y=>`<option>${y}</option>`).join('')}</select></div>
    <div class="field"><label>Month</label><select id="vocabMonth"><option value="">All months</option>${Array.from({length:12},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}">${new Intl.DateTimeFormat(undefined,{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2020,i,1)))}</option>`).join('')}</select></div>
    <div class="field"><label>Exact date</label><input id="vocabDate" type="date"></div>
    <button id="clearVocabFilters" class="btn secondary" type="button">Clear filters</button>
  </div>
  <div id="vocabSummary" class="section-title"></div><div id="vocabList" class="word-list"></div>`;
  const names=Object.fromEntries(profiles.map(p=>[p.id,p.name]));
  const refresh=()=>{
    const profile=$('#vocabProfile').value,q=wordKey($('#vocabSearch').value),year=$('#vocabYear').value,month=$('#vocabMonth').value,exact=$('#vocabDate').value,sort=$('#vocabSort').value;
    let shown=words.filter(x=>(profile==='all'||x.profileId===profile)&&(!q||wordKey(x.word).includes(q))&&(!exact||x.date===exact)&&(!exact&&!year||String(x.date||'').startsWith(year))&&(!exact&&!month||String(x.date||'').slice(5,7)===month));
    shown.sort(sort==='alpha'?(a,b)=>a.word.localeCompare(b.word,undefined,{sensitivity:'base'}):sort==='oldest'?(a,b)=>String(a.date).localeCompare(String(b.date))||a.word.localeCompare(b.word):(a,b)=>String(b.date).localeCompare(String(a.date))||a.word.localeCompare(b.word));
    $('#vocabSummary').textContent=`${shown.length} of ${words.length} ${words.length===1?'entry':'entries'}`;
    $('#vocabList').innerHTML=shown.length?shown.map(x=>`<article class="word-card card"><div><h3>${esc(x.word)}</h3><p>${esc(names[x.profileId]||'Child')} • First said ${fmtDate(x.date)}</p>${x.notes?`<small>${esc(x.notes)}</small>`:''}</div><div class="word-actions"><button class="icon-btn edit-word" data-id="${x.id}" aria-label="Edit ${esc(x.word)}">✏️</button><button class="icon-btn delete-word" data-id="${x.id}" aria-label="Delete ${esc(x.word)}">🗑️</button></div></article>`).join(''):`<div class="empty card"><div class="big">🔎</div><p>No vocabulary entries match these filters.</p></div>`;
    document.querySelectorAll('.edit-word').forEach(b=>b.onclick=()=>openWordForm(profiles,words.find(x=>x.id===b.dataset.id)));
    document.querySelectorAll('.delete-word').forEach(b=>b.onclick=async()=>{const item=words.find(x=>x.id===b.dataset.id);if(item&&confirm(`Delete “${item.word}”? This cannot be undone.`)){await deleteItem('words',item.id);renderVocabulary();}});
  };
  ['vocabProfile','vocabSearch','vocabSort','vocabYear','vocabMonth','vocabDate'].forEach(id=>$('#'+id).addEventListener(id==='vocabSearch'?'input':'change',refresh));
  $('#clearVocabFilters').onclick=()=>{['vocabYear','vocabMonth','vocabDate','vocabSearch'].forEach(id=>$('#'+id).value='');$('#vocabProfile').value='all';$('#vocabSort').value='alpha';refresh();};
  $('#addWord').onclick=()=>openWordForm(profiles);
  $('#bulkWords').onclick=()=>openBulkVocabulary(profiles,words);
  refresh();
}
function openWordForm(profiles,item=null){
  modalBody.innerHTML=`<h2>${item?'Edit':'Add'} vocabulary</h2><div class="form-grid"><div class="field"><label>Child</label><select id="wordProfile">${profiles.map(p=>`<option value="${p.id}" ${item?.profileId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Word or phrase</label><input id="wordText" value="${esc(item?.word||'')}" autocomplete="off"></div><div class="field"><label>Date first said</label><input id="wordDate" type="date" value="${item?.date||isoToday()}"></div><div class="field"><label>Notes <span class="hint">(optional)</span></label><textarea id="wordNotes">${esc(item?.notes||'')}</textarea></div><button id="saveWord" class="btn full" type="button">Save vocabulary</button></div>`;
  modal.showModal();$('#saveWord').onclick=async()=>{const word=$('#wordText').value.trim(),date=$('#wordDate').value,profileId=$('#wordProfile').value;if(!word||!date)return alert('Please enter a word or phrase and the date first said.');const all=await getAll('words');if(all.some(x=>x.id!==item?.id&&x.profileId===profileId&&wordKey(x.word)===wordKey(word)))return alert('That word or phrase is already listed for this child.');await put('words',{id:item?.id||uid(),profileId,word,date,notes:$('#wordNotes').value.trim(),createdAt:item?.createdAt||nowISO(),updatedAt:nowISO(),syncStatus:'local'});modal.close();renderVocabulary();};
}
function openBulkVocabulary(profiles,existing){
  modalBody.innerHTML=`<h2>Bulk import vocabulary</h2><div class="form-grid"><div class="field"><label>Child</label><select id="bulkProfile">${profiles.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Fallback date</label><input id="bulkFallback" type="date" value="${isoToday()}"><span class="hint">Used only for lines that do not contain a date or follow a dated heading.</span></div><div class="field"><label>Paste from Notes</label><textarea id="bulkText" class="bulk-text" placeholder="Mama — 4/12/2025&#10;Dada — 4/18/2025&#10;&#10;May 2, 2025&#10;Ball&#10;More"></textarea></div><div class="banner">Nothing will be saved until you review the parsed list.</div><button id="previewBulk" class="btn full" type="button">Parse and review</button></div>`;
  if(!modal.open)modal.showModal();$('#previewBulk').onclick=()=>{const profileId=$('#bulkProfile').value,parsed=parseBulkVocabulary($('#bulkText').value,$('#bulkFallback').value);const seen=new Set(existing.filter(x=>x.profileId===profileId).map(x=>wordKey(x.word))),fresh=[];let duplicates=0;for(const entry of parsed.entries){const key=wordKey(entry.word);if(seen.has(key)){duplicates++;continue;}seen.add(key);fresh.push(entry);}modalBody.innerHTML=`<h2>Review vocabulary import</h2><p><strong>${fresh.length}</strong> ready to import • ${duplicates} duplicate${duplicates===1?'':'s'} skipped • ${parsed.skipped.length} unread line${parsed.skipped.length===1?'':'s'}</p><div class="import-preview">${fresh.map(x=>`<div class="preview-row"><strong>${esc(x.word)}</strong><span>${fmtDate(x.date)}</span></div>`).join('')||'<p>No new entries were found.</p>'}</div><div class="btn-row"><button id="backBulk" class="btn secondary" type="button">Go back</button>${fresh.length?'<button id="importBulk" class="btn" type="button">Import reviewed words</button>':''}</div>`;$('#backBulk').onclick=()=>openBulkVocabulary(profiles,existing);if(fresh.length)$('#importBulk').onclick=async()=>{await createSnapshot('Before vocabulary bulk import');for(const x of fresh)await put('words',{id:uid(),profileId,word:x.word,date:x.date,notes:'',createdAt:nowISO(),updatedAt:nowISO(),syncStatus:'local'});modal.close();alert(`${fresh.length} vocabulary ${fresh.length===1?'entry':'entries'} imported.`);renderVocabulary();};};
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
  $('#viewWords').onclick=()=>navigate('vocabulary');
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
function setupDrawer(){const links=[['🏠','Home','home'],['🌱','My Child','child'],['🗣️','Vocabulary','vocabulary'],['📚','Resources','resources'],['🗺️','Explore','explore'],['💛','Caregiver Corner','caregiver'],['💾','Backup & Restore','backup'],['⚙️','Settings','settings'],['ℹ️','About','about']];$('#drawerNav').innerHTML=links.map(x=>`<button data-go="${x[2]}">${x[0]} ${x[1]}</button>`).join('');$('#drawerVersion').textContent=APP.version;bindRouteButtons();$('#menuBtn').onclick=openDrawer;$('#homeBadge').onclick=()=>navigate('home');$('#closeDrawer').onclick=closeDrawer;$('#scrim').onclick=closeDrawer;}
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
