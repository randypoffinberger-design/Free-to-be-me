"use strict";

/* The UI always reads application data from IndexedDB. This module only moves
   copies between IndexedDB and the optional server. */
window.MTMSync = (() => {
  const SYNCED_STORES = new Set(["profiles","achievements","words","notes","appointments","todos","pottyLogs","settings"]);
  const DEVICE_SETTINGS = new Set(["lastBackupAt","profileDisplay","vocabFilterDefaults"]);
  let applyingRemote = false, running = false;
  const iso = () => new Date().toISOString();
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const rawStore = (name, mode = "readonly") => db.transaction(name, mode).objectStore(name);
  const rawGet = (store, id) => new Promise((resolve, reject) => { const r=rawStore(store).get(id); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  const rawAll = store => new Promise((resolve, reject) => { const r=rawStore(store).getAll(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  const rawPut = (store, value) => new Promise((resolve, reject) => { const r=rawStore(store,"readwrite").put(value); r.onsuccess=()=>resolve(value); r.onerror=()=>reject(r.error); });
  const rawDelete = (store, id) => new Promise((resolve, reject) => { const r=rawStore(store,"readwrite").delete(id); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
  const state = async () => (await rawGet("accountState", "current")) || { id:"current", serverUrl:"http://127.0.0.1:8788", cursor:0 };
  const saveState = value => rawPut("accountState", { ...(value || {}), id:"current" });
  const syncable = (store, valueOrId) => SYNCED_STORES.has(store) && !(store === "settings" && DEVICE_SETTINGS.has(typeof valueOrId === "object" ? valueOrId.id : valueOrId));
  const metaId = (store,id) => `${store}:${id}`;
  async function queue(store, id, operation, payload) {
    const s=await state(); if(!s.householdId) return;
    const meta=await rawGet("syncMeta",metaId(store,id));
    const existing=(await rawAll("syncOutbox")).find(x=>x.entityType===store&&x.entityId===id);
    const item={id:existing?.id||uuid(),mutationId:existing?.mutationId||uuid(),entityType:store,entityId:id,
      operation,payload:operation==="delete"?null:structuredClone(payload),baseRevision:meta?.revision||0,queuedAt:iso()};
    await rawPut("syncOutbox",item);
  }
  async function onLocalPut(store,value){ if(applyingRemote||!syncable(store,value)||!value?.id)return; await queue(store,value.id,"upsert",value); schedule(); }
  async function onLocalDelete(store,id,record=null){ if(applyingRemote||!syncable(store,id))return; await rawPut("deletedRecords",{id:metaId(store,id),entityType:store,entityId:id,record:record?structuredClone(record):null,deletedAt:iso()}); await queue(store,id,"delete",null); schedule(); }
  async function api(path, options={}) {
    const s=await state(), response=await fetch(`${s.serverUrl.replace(/\/$/,"")}${path}`,{...options,headers:{"Content-Type":"application/json",...(s.token?{Authorization:`Bearer ${s.token}`}:{ }),...(options.headers||{})}});
    const data=await response.json().catch(()=>({error:`HTTP ${response.status}`})); if(!response.ok)throw Object.assign(new Error(data.error||"Server request failed"),{status:response.status}); return data;
  }
  async function recordConflict(localStore, localRecord, remote, reason="Both this device and the household changed this record.") {
    const id=metaId(localStore,remote.entityId); await rawPut("syncConflicts",{id,entityType:localStore,entityId:remote.entityId,local:structuredClone(localRecord||null),remote,reason,createdAt:iso()});
  }
  async function pull() {
    const s=await state(); if(!s.token||!s.householdId)return;
    let cursor=s.cursor||0, more=true;
    while(more){const data=await api(`/v1/sync/pull?householdId=${encodeURIComponent(s.householdId)}&since=${cursor}`), outbox=await rawAll("syncOutbox");
      applyingRemote=true;
      try{for(const change of data.changes){const pending=outbox.find(x=>x.entityType===change.entityType&&x.entityId===change.entityId), local=await rawGet(change.entityType,change.entityId), meta=await rawGet("syncMeta",metaId(change.entityType,change.entityId));
        if(pending && change.revision>(meta?.revision||0)){await recordConflict(change.entityType,local,change);continue;}
        if(change.deletedAt){if(local)await rawPut("deletedRecords",{id:metaId(change.entityType,change.entityId),entityType:change.entityType,entityId:change.entityId,record:local,deletedAt:change.deletedAt,remote:true});await rawDelete(change.entityType,change.entityId);}
        else await rawPut(change.entityType,{...change.payload,id:change.entityId});
        await rawPut("syncMeta",{id:metaId(change.entityType,change.entityId),revision:change.revision,updatedAt:change.updatedAt,deletedAt:change.deletedAt||null});
      }}finally{applyingRemote=false;} cursor=data.cursor;more=data.hasMore;}
    await saveState({...await state(),cursor,lastSyncAt:iso(),lastError:null});
  }
  async function push() {
    const s=await state(), mutations=await rawAll("syncOutbox"); if(!s.token||!s.householdId||!mutations.length)return;
    for(let i=0;i<mutations.length;i+=100){const batch=mutations.slice(i,i+100),data=await api("/v1/sync/push",{method:"POST",body:JSON.stringify({householdId:s.householdId,mutations:batch})});
      for(const result of data.results){const item=batch.find(x=>x.mutationId===result.mutationId);if(!item)continue;
        if(result.status==="accepted"){await rawPut("syncMeta",{id:metaId(item.entityType,item.entityId),revision:result.revision,updatedAt:result.updatedAt,deletedAt:result.deletedAt||null});await rawDelete("syncOutbox",item.id);}
        else if(result.status==="conflict"){await recordConflict(item.entityType,await rawGet(item.entityType,item.entityId),result.current);await rawDelete("syncOutbox",item.id);}
      }}
  }
  async function syncNow(){if(running)return;const s=await state();if(!s.token||!s.householdId||!navigator.onLine)return;running=true;try{await pull();await push();await pull();await saveState({...await state(),lastSyncAt:iso(),lastError:null});}catch(e){await saveState({...await state(),lastError:e.message});}finally{running=false;if(currentRoute==="sync")refreshSyncCenter().catch(()=>{});}}
  function schedule(){setTimeout(()=>syncNow(),250);}
  async function queueExisting(){const s=await state();if(!s.householdId)throw new Error("Choose a household first.");await createSnapshot("Before connecting local data to household sync");let count=0;for(const store of SYNCED_STORES){for(const item of await getAll(store)){if(!syncable(store,item))continue;const meta=await rawGet("syncMeta",metaId(store,item.id));if(!meta){await queue(store,item.id,"upsert",item);count++;}}}return count;}
  async function resolveConflict(id,choice,merged=null){const c=await rawGet("syncConflicts",id);if(!c)return;applyingRemote=true;try{
    if(choice==="remote"){if(c.remote.deletedAt)await rawDelete(c.entityType,c.entityId);else await rawPut(c.entityType,{...c.remote.payload,id:c.entityId});await rawPut("syncMeta",{id,revision:c.remote.revision,updatedAt:c.remote.updatedAt,deletedAt:c.remote.deletedAt||null});}
    if(choice==="local"){await rawPut("syncMeta",{id,revision:c.remote.revision,updatedAt:c.remote.updatedAt,deletedAt:c.remote.deletedAt||null});await queue(c.entityType,c.entityId,c.local?"upsert":"delete",c.local);}
    if(choice==="both"&&c.local&&c.remote.payload){await rawPut(c.entityType,{...c.remote.payload,id:c.entityId});const copy={...c.local,id:uuid(),createdAt:c.local.createdAt||iso(),updatedAt:iso()};await rawPut(c.entityType,copy);await rawPut("syncMeta",{id,revision:c.remote.revision,updatedAt:c.remote.updatedAt});await queue(c.entityType,copy.id,"upsert",copy);}
    if(choice==="manual"&&merged){const record={...merged,id:c.entityId,updatedAt:iso()};await rawPut(c.entityType,record);await rawPut("syncMeta",{id,revision:c.remote.revision,updatedAt:c.remote.updatedAt,deletedAt:null});await queue(c.entityType,c.entityId,"upsert",record);}
    await rawDelete("syncConflicts",id);
  }finally{applyingRemote=false;}schedule();}
  window.addEventListener("online",schedule);
  setInterval(()=>syncNow(),30000);
  return {onLocalPut,onLocalDelete,syncNow,queueExisting,state,saveState,api,resolveConflict,rawAll};
})();

async function renderSyncCenter(){
  const sync=window.MTMSync,s=await sync.state(),outbox=await sync.rawAll("syncOutbox"),conflicts=await sync.rawAll("syncConflicts");
  const signedIn=Boolean(s.token), status=!navigator.onLine?"Offline — local data remains available":s.lastError?`Sync paused: ${esc(s.lastError)}`:outbox.length?`${outbox.length} local change${outbox.length===1?"":"s"} waiting to sync`:s.lastSyncAt?`Synchronized ${fmtDate(s.lastSyncAt)}`:"Not synchronized yet";
  view.innerHTML=`<section class="hero"><h1>🔄 Accounts & Sync</h1><p>Local data remains on this device whether the server is available or not.</p></section>
  <div class="card"><h3>Server</h3><div class="field"><label>Server address</label><input id="syncServer" value="${esc(s.serverUrl||"http://127.0.0.1:8788")}" placeholder="http://192.168.1.20:8788"></div><button id="saveServer" class="btn secondary">Save address</button><p id="syncStatus" class="hint">${esc(status)}</p></div>
  ${signedIn?`<div class="card"><h3>Household</h3><div id="householdArea"><p>Loading memberships…</p></div><div class="btn-row"><button id="syncNow" class="btn">Sync now</button><button id="prepareData" class="btn secondary">Add existing local data</button><button id="logoutSync" class="btn secondary">Sign out</button></div><p class="hint">Signing out never removes local records.</p></div>`:`<div class="card"><h3>Sign in</h3><div class="form-grid"><div class="field"><label>Email</label><input id="syncEmail" type="email"></div><div class="field"><label>Password</label><input id="syncPassword" type="password"></div><button id="loginSync" class="btn">Sign in</button></div><h3>Create account</h3><div class="form-grid"><div class="field"><label>Your name</label><input id="regName"></div><div class="field"><label>Household name</label><input id="regHousehold" placeholder="Our family"></div><div class="field"><label>Email</label><input id="regEmail" type="email"></div><div class="field"><label>Password (10+ characters)</label><input id="regPassword" type="password"></div><button id="registerSync" class="btn">Create account and household</button></div></div>`}
  <h2 id="syncDecisionsTitle" class="section-title">Sync decisions${conflicts.length?` (${conflicts.length})`:""}</h2><div id="syncDecisions" class="list">${syncConflictMarkup(conflicts)}</div>`;
  $("#saveServer").onclick=async()=>{await sync.saveState({...await sync.state(),serverUrl:$("#syncServer").value.trim()});alert("Server address saved.");};
  if(!signedIn){$("#loginSync").onclick=async()=>{try{await sync.saveState({...await sync.state(),serverUrl:$("#syncServer").value.trim()});const d=await sync.api("/v1/auth/login",{method:"POST",body:JSON.stringify({email:$("#syncEmail").value,password:$("#syncPassword").value})});await sync.saveState({...await sync.state(),token:d.token});renderSyncCenter();}catch(e){alert(e.message);}};
    $("#registerSync").onclick=async()=>{try{await sync.saveState({...await sync.state(),serverUrl:$("#syncServer").value.trim()});const d=await sync.api("/v1/auth/register",{method:"POST",body:JSON.stringify({displayName:$("#regName").value,householdName:$("#regHousehold").value,email:$("#regEmail").value,password:$("#regPassword").value})});await sync.saveState({...await sync.state(),token:d.token,householdId:d.household.id,cursor:0});renderSyncCenter();}catch(e){alert(e.message);}};
  }else{try{const d=await sync.api("/v1/households"),area=$("#householdArea");area.innerHTML=`<div class="field"><label>Active household</label><select id="activeHousehold">${d.households.map(h=>`<option value="${h.id}" ${h.id===s.householdId?"selected":""}>${esc(h.name)} — ${esc(h.role)}</option>`).join("")}</select></div><div class="btn-row"><button id="createInvite" class="btn secondary">Create caregiver invite</button><button id="joinInvite" class="btn secondary">Join with invitation</button></div>`;if(!s.householdId&&d.households[0])await sync.saveState({...s,householdId:d.households[0].id,cursor:0});$("#activeHousehold").onchange=async e=>{await sync.saveState({...await sync.state(),householdId:e.target.value,cursor:0});};$("#createInvite").onclick=async()=>{try{const role=confirm("OK creates a caregiver invitation. Cancel creates a read-only viewer invitation.")?"caregiver":"viewer",d=await sync.api("/v1/invitations",{method:"POST",body:JSON.stringify({householdId:$("#activeHousehold").value,role})});prompt(`Invitation expires ${d.expiresAt}. Copy this code:`,d.code);}catch(e){alert(e.message);}};$("#joinInvite").onclick=async()=>{const code=prompt("Invitation code:");if(!code)return;try{const d=await sync.api("/v1/invitations/join",{method:"POST",body:JSON.stringify({code})});await sync.saveState({...await sync.state(),householdId:d.householdId,cursor:0});renderSyncCenter();}catch(e){alert(e.message);}};}catch(e){$("#householdArea").innerHTML=`<div class="banner">${esc(e.message)}</div>`;}
    $("#syncNow").onclick=async()=>{await sync.syncNow();};$("#prepareData").onclick=async()=>{if(!confirm("Create a safety checkpoint and add copies of all existing local family data to this household? Nothing local will be removed."))return;try{const count=await sync.queueExisting();alert(`${count} existing records are ready to synchronize.`);await sync.syncNow();}catch(e){alert(e.message);}};$("#logoutSync").onclick=async()=>{try{await sync.api("/v1/auth/logout",{method:"POST",body:"{}"});}catch{}await sync.saveState({id:"current",serverUrl:s.serverUrl,cursor:0});renderSyncCenter();};}
  bindSyncConflictActions(conflicts);
}

function syncConflictMarkup(conflicts){
  return conflicts.map(c=>`<div class="card"><strong>${esc(c.entityType)} conflict</strong><p>${esc(c.reason)}</p><p class="hint">Record ${esc(c.entityId)}</p><div class="btn-row"><button class="small-action conflict-local" data-id="${esc(c.id)}">Keep this device</button><button class="small-action conflict-remote" data-id="${esc(c.id)}">Keep household version</button>${c.local&&c.remote?.payload?`<button class="small-action conflict-both" data-id="${esc(c.id)}">Keep both</button><button class="small-action conflict-manual" data-id="${esc(c.id)}">Merge fields</button>`:""}</div></div>`).join("")||'<div class="card"><p>No decisions are waiting.</p></div>';
}

function bindSyncConflictActions(conflicts){
  const sync=window.MTMSync;
  document.querySelectorAll(".conflict-local").forEach(b=>b.onclick=async()=>{await sync.resolveConflict(b.dataset.id,"local");renderSyncCenter();});document.querySelectorAll(".conflict-remote").forEach(b=>b.onclick=async()=>{await sync.resolveConflict(b.dataset.id,"remote");renderSyncCenter();});document.querySelectorAll(".conflict-both").forEach(b=>b.onclick=async()=>{await sync.resolveConflict(b.dataset.id,"both");renderSyncCenter();});document.querySelectorAll(".conflict-manual").forEach(b=>b.onclick=()=>openSyncFieldMerge(conflicts.find(c=>c.id===b.dataset.id)));
}

async function refreshSyncCenter(){
  const sync=window.MTMSync,s=await sync.state(),outbox=await sync.rawAll("syncOutbox"),conflicts=await sync.rawAll("syncConflicts");
  const status=!navigator.onLine?"Offline — local data remains available":s.lastError?`Sync paused: ${s.lastError}`:outbox.length?`${outbox.length} local change${outbox.length===1?"":"s"} waiting to sync`:s.lastSyncAt?`Synchronized ${fmtDate(s.lastSyncAt)}`:"Not synchronized yet";
  const statusEl=$("#syncStatus"),titleEl=$("#syncDecisionsTitle"),decisionsEl=$("#syncDecisions");
  if(!statusEl||!titleEl||!decisionsEl)return;
  statusEl.textContent=status;
  titleEl.textContent=`Sync decisions${conflicts.length?` (${conflicts.length})`:""}`;
  decisionsEl.innerHTML=syncConflictMarkup(conflicts);
  bindSyncConflictActions(conflicts);
}

function openSyncFieldMerge(conflict){
  if(!conflict?.local||!conflict.remote?.payload)return;
  const local=conflict.local,remote=conflict.remote.payload,keys=[...new Set([...Object.keys(local),...Object.keys(remote)])].filter(k=>!['id','createdAt','updatedAt','syncStatus'].includes(k));
  const shown=value=>typeof value==='object'?JSON.stringify(value):String(value??'');
  modalBody.innerHTML=`<h2>Merge conflicting fields</h2><p class="hint">Choose the value to keep for each field. Nothing changes until you save.</p><div class="sync-field-merge">${keys.map(k=>`<fieldset data-key="${esc(k)}"><legend>${esc(k)}</legend><label><input type="radio" name="merge-${esc(k)}" value="local" checked> This device: <span>${esc(shown(local[k]))}</span></label><label><input type="radio" name="merge-${esc(k)}" value="remote"> Household: <span>${esc(shown(remote[k]))}</span></label></fieldset>`).join('')}</div><div class="btn-row"><button id="cancelFieldMerge" class="btn secondary" type="button">Cancel</button><button id="saveFieldMerge" class="btn" type="button">Save merged record</button></div>`;
  modal.showModal();$("#cancelFieldMerge").onclick=()=>modal.close();$("#saveFieldMerge").onclick=async()=>{const merged={};for(const field of document.querySelectorAll('.sync-field-merge fieldset')){const key=field.dataset.key,source=field.querySelector('input:checked').value;merged[key]=structuredClone(source==='local'?local[key]:remote[key]);}merged.createdAt=local.createdAt||remote.createdAt;await window.MTMSync.resolveConflict(conflict.id,'manual',merged);modal.close();renderSyncCenter();};
}
