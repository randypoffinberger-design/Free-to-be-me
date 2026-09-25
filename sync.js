"use strict";

/* The UI always reads application data from IndexedDB. This module only moves
   copies between IndexedDB and the optional server. */
window.MTMSync = (() => {
  const BUILD = "0.10.1-production-3";
  const SYNCED_STORES = new Set(["profiles","achievements","words","notes","appointments","todos","pottyLogs","settings"]);
  const ACCOUNT_CONTENT_STORES = [...SYNCED_STORES,"snapshots","syncOutbox","syncMeta","syncConflicts","deletedRecords"];
  const DEVICE_SETTINGS = new Set(["lastBackupAt","profileDisplay","vocabFilterDefaults"]);
  let switching = false;
  let applyingRemote = false, running = false, rerun = false, syncTimer = null;
  const iso = () => new Date().toISOString();
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const rawStore = (name, mode = "readonly") => db.transaction(name, mode).objectStore(name);
  const rawGet = (store, id) => new Promise((resolve, reject) => { const r=rawStore(store).get(id); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  const rawAll = store => new Promise((resolve, reject) => { const r=rawStore(store).getAll(); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
  const rawPut = (store, value) => new Promise((resolve, reject) => { const r=rawStore(store,"readwrite").put(value); r.onsuccess=()=>resolve(value); r.onerror=()=>reject(r.error); });
  const rawDelete = (store, id) => new Promise((resolve, reject) => { const r=rawStore(store,"readwrite").delete(id); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
  const rawClear = store => new Promise((resolve, reject) => { const r=rawStore(store,"readwrite").clear(); r.onsuccess=()=>resolve(); r.onerror=()=>reject(r.error); });
  const PRODUCTION_SERVER = "https://api.serenityvalleyworks.com/mtm";
  const LEGACY_PRODUCTION_SERVER = "https://randys.tail96598f.ts.net/mtm";
  const defaultProductionServer = () => PRODUCTION_SERVER;
  const normalizeServerUrl = value => String(value || "").trim().replace(/\/+$/, "");
  // Migrate only the exact former production endpoint, preserving account data
  // and custom servers. One transaction prevents concurrent reads losing edits.
  const readState = () => new Promise((resolve, reject) => {
    const transaction = db.transaction("accountState", "readwrite");
    const store = transaction.objectStore("accountState");
    const request = store.get("current");
    let current;
    request.onsuccess = () => {
      current = request.result || { id:"current", serverUrl:defaultProductionServer(), cursor:0 };
      if (current.serverUrl === LEGACY_PRODUCTION_SERVER) {
        current = { ...current, serverUrl:PRODUCTION_SERVER };
        store.put(current);
      }
    };
    transaction.oncomplete = () => resolve(current);
    transaction.onabort = () => reject(transaction.error || new Error("Could not load account settings."));
    transaction.onerror = () => reject(transaction.error || new Error("Could not load account settings."));
  });
  const state = async () => {
    const current=await readState();
    if(current.householdRole==="babysitter"&&current.accessExpiresAt&&Date.parse(current.accessExpiresAt)<=Date.now()){
      await clearTemporaryShareData(current);
      const ended={...current,householdId:null,householdName:null,householdRole:null,sharedProfileId:null,accessExpiresAt:null,cursor:0,lastError:"Temporary babysitter access expired."};
      await saveState(ended);window.dispatchEvent(new CustomEvent("mtm:share-ended"));return ended;
    }
    return current;
  };
  const saveState = value => rawPut("accountState", { ...(value || {}), id:"current" });
  // Mode belongs to this account's vault, never to device-wide settings.
  const accountContext = value => ({activeMode:value.activeMode||null,lastFamilyHouseholdId:value.lastFamilyHouseholdId||null,lastSitterHouseholdId:value.lastSitterHouseholdId||null,householdName:value.householdName||null,householdId:value.householdId||null,householdRole:value.householdRole||null,sharedProfileId:value.sharedProfileId||null,accessExpiresAt:value.accessExpiresAt||null,cursor:value.cursor||0,lastSyncAt:value.lastSyncAt||null,lastError:value.lastError||null});
  const mode = s => s.householdId ? (s.householdRole==='babysitter'?'babysitter':'family') :
    s.activeMode==='family'||s.activeMode==='babysitter' ? s.activeMode :
    s.user?.isBabysitter ? 'babysitter' : 'family';
  const householdsForMode = (list,selectedMode) => list.filter(h =>
    selectedMode==='babysitter' ? h.role==='babysitter' && (!h.accessExpiresAt||Date.parse(h.accessExpiresAt)>Date.now()) : h.role!=='babysitter');
  async function switchMode(selectedMode){
    if(!['family','babysitter'].includes(selectedMode))throw new Error('Unknown account view.');
    const current=await state();
    if(!current.token||!current.user||current.reauthRequired)throw new Error('Sign in to switch views.');
    const {households}=await api('/v1/households');
    if((await state()).token!==current.token)throw new Error('Account changed. Please retry.');
    const list=householdsForMode(households,selectedMode);
    if(selectedMode==='babysitter'&&!current.user.isBabysitter&&!list.length)throw new Error('Create a sitter profile or accept a parent invitation first.');
    const remembered=selectedMode==='family'?current.lastFamilyHouseholdId:current.lastSitterHouseholdId;
    const selected=list.find(h=>h.id===current.householdId)||list.find(h=>h.id===remembered)||list[0];
    await switchHousehold(selected?.id||null,selectedMode);
  }
  async function ensureMode(){
    const current=await state();
    if(!current.token||!current.user||current.reauthRequired||current.activeMode||navigator.onLine===false)return;
    // Existing personal households take precedence when migrating dual-role accounts.
    const {households}=await api('/v1/households');
    if((await state()).token!==current.token)throw new Error('Account changed. Please retry.');
    const family=householdsForMode(households,'family');
    await switchMode(family.length?'family':current.user.isBabysitter||householdsForMode(households,'babysitter').length?'babysitter':'family');
  }
  async function hasLocalAccountContent(){for(const store of ACCOUNT_CONTENT_STORES)if((await rawAll(store)).length)return true;return false;}
  async function saveAccountVault(userId,current){
    if(!userId)return;
    const data={};for(const store of ACCOUNT_CONTENT_STORES)data[store]=await rawAll(store);
    await rawPut("accountVaults",{id:userId,data,context:accountContext(current||{}),updatedAt:iso()});
  }
  async function clearAccountContent(){applyingRemote=true;try{for(const store of ACCOUNT_CONTENT_STORES)await rawClear(store);}finally{applyingRemote=false;}}
  async function restoreAccountVault(userId){
    const vault=await rawGet("accountVaults",userId);await clearAccountContent();
    if(!vault)return null;
    applyingRemote=true;try{for(const store of ACCOUNT_CONTENT_STORES)for(const item of vault.data?.[store]||[])await rawPut(store,item);}finally{applyingRemote=false;}
    return vault.context||null;
  }
  async function initializeAccountIsolation(){
    const current=await readState();
    if(current.user?.id&&!current.localDataOwnerId)await saveState({...current,localDataOwnerId:current.user.id});
  }
  async function activateAccount(auth){
    if(switching)throw new Error('Wait for the household switch to finish before changing accounts.');
    const current=await readState(),nextId=auth.user.id,currentId=current.localDataOwnerId||current.user?.id||null;
    let context=null;
    if(currentId&&currentId!==nextId){await saveAccountVault(currentId,current);context=await restoreAccountVault(nextId);}
    else if(!currentId){if(await hasLocalAccountContent())context=accountContext(current);else context=await restoreAccountVault(nextId);}
    else context=accountContext(current);
    const next={id:"current",serverUrl:current.serverUrl||defaultProductionServer(),...(context||{}),token:auth.token,user:auth.user,localDataOwnerId:nextId,entitlement:auth.entitlement||null,cursor:context?.cursor||0};
    await saveState(next);return next;
  }
  async function signOutAccount(){
    if(switching)throw new Error('Wait for the household switch to finish before signing out.');
    try{const r=await navigator.serviceWorker?.getRegistration();await (await r?.pushManager?.getSubscription())?.unsubscribe();}catch{}
    const current=await readState(),ownerId=current.localDataOwnerId||current.user?.id||null;
    if(ownerId)await saveAccountVault(ownerId,current);
    await clearAccountContent();
    await saveState({id:"current",serverUrl:current.serverUrl||defaultProductionServer(),cursor:0,lastAccountId:ownerId});
  }
  async function clearDeletedAccountData(){
    try{const r=await navigator.serviceWorker?.getRegistration();await (await r?.pushManager?.getSubscription())?.unsubscribe();}catch{}
    const current=await readState(),ownerId=current.localDataOwnerId||current.user?.id||null;
    await clearAccountContent();
    if(ownerId)for(const vault of await rawAll("accountVaults"))if(vault.id===ownerId||vault.id.startsWith(`${ownerId}:`))await rawDelete("accountVaults",vault.id);
    await saveState({id:"current",serverUrl:current.serverUrl||defaultProductionServer(),cursor:0});
    window.MTMOffline?.clear();MTMAccess.invalidate();
  }
  async function removeCurrentHouseholdData(){
    const current=await readState(),ownerId=current.localDataOwnerId||current.user?.id||null;
    await clearAccountContent();if(ownerId)await rawDelete("accountVaults",ownerId);
    await saveState({...current,householdId:null,householdName:null,householdRole:null,sharedProfileId:null,accessExpiresAt:null,cursor:0,lastSyncAt:null,lastError:null});
  }
  async function clearTemporaryShareData(current=null){
    current ||= await readState();
    const profileId=current.sharedProfileId;
    if(!profileId)return;
    applyingRemote=true;
    try{
      for(const store of SYNCED_STORES){
        for(const item of await rawAll(store)){
          if((profileId==="*")||(store==="profiles"&&item.id===profileId)||(store!=="profiles"&&item.profileId===profileId)||(store==="settings"&&['foodDiary:','dailyCare:','babysitterNotes:'].some(prefix=>item.id===prefix+profileId))){
            await rawDelete(store,item.id);await rawDelete("syncMeta",metaId(store,item.id));
          }
        }
      }
      for(const item of await rawAll("syncOutbox"))if(profileId==="*"||item.payload?.profileId===profileId||item.entityId===profileId)await rawDelete("syncOutbox",item.id);
      for(const item of await rawAll("syncConflicts"))if(profileId==="*"||item.local?.profileId===profileId||item.entityId===profileId)await rawDelete("syncConflicts",item.id);
    }finally{applyingRemote=false;}
  }
  const syncable = (store, valueOrId) => SYNCED_STORES.has(store) && !(store === "settings" && DEVICE_SETTINGS.has(typeof valueOrId === "object" ? valueOrId.id : valueOrId));
  const metaId = (store,id) => `${store}:${id}`;
  async function queue(store, id, operation, payload, analyticsVersion = 0) {
    const s=await state(); if(!s.householdId) return;
    const meta=await rawGet("syncMeta",metaId(store,id));
    const existing=(await rawAll("syncOutbox")).find(x=>x.entityType===store&&x.entityId===id);
    const item={id:existing?.id||uuid(),mutationId:uuid(),entityType:store,entityId:id,
      analyticsVersion,operation,payload:operation==="delete"?null:structuredClone(payload),baseRevision:meta?.revision||0,queuedAt:iso()};
    await rawPut("syncOutbox",item);
  }
  // Layout, outbox entry and account check share a transaction. A household
  // switch cannot place a layout into another account's active vault halfway
  // through saving; the normal sync protocol still handles remote conflicts.
  async function saveLayoutSetting(id, value, expectedValue, expectedAccount) {
    if (!['home','caregiver','sleep','fun'].some(section => id === `moduleLayout:v1:household:${encodeURIComponent(expectedAccount.householdId)}:${section}`)) throw new Error('Invalid household layout key.');
    await MTMAccess.requireWrite('settings', id, {id,value});
    if (switching) throw new Error('Wait for the household switch to finish.');
    const timestamp = iso(), mutationId = uuid();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['accountState','settings','syncMeta','syncOutbox'], 'readwrite');
      let failure = null, count = 0;
      const requests = [
        transaction.objectStore('accountState').get('current'),
        transaction.objectStore('settings').get(id),
        transaction.objectStore('syncMeta').get(metaId('settings',id)),
        transaction.objectStore('syncOutbox').getAll()
      ];
      transaction.oncomplete = resolve;
      transaction.onerror = () => { failure ||= transaction.error; };
      transaction.onabort = () => reject(failure || transaction.error || new Error('Layout could not be saved.'));
      for (const request of requests) request.onsuccess = () => {
        if (++count !== requests.length) return;
        try {
          const [account, existing, meta, outbox] = requests.map(r=>r.result);
          if (switching || !account?.token || account.token !== expectedAccount.token || account.user?.id !== expectedAccount.user?.id || account.householdId !== expectedAccount.householdId || account.householdRole === 'babysitter') throw new Error('The account or household changed. Reopen this section before saving.');
          if (JSON.stringify(existing?.value ?? null) !== JSON.stringify(expectedValue)) throw new Error('This layout changed on another device. Cancel and reopen this section.');
          const record = {id,value:structuredClone(value),updatedAt:timestamp};
          const pending = outbox.find(x=>x.entityType==='settings' && x.entityId===id);
          transaction.objectStore('settings').put(record);
          transaction.objectStore('syncOutbox').put({id:pending?.id || uuid(),mutationId,entityType:'settings',entityId:id,operation:'upsert',payload:record,baseRevision:meta?.revision||0,queuedAt:timestamp});
        } catch (error) { failure=error;transaction.abort(); }
      };
    });
    schedule();
  }

  async function onLocalPut(store,value){ if(applyingRemote||!syncable(store,value)||!value?.id)return; await queue(store,value.id,"upsert",value,1); schedule(); }
  async function onLocalDelete(store,id,record=null){ if(applyingRemote||!syncable(store,id))return; await rawPut("deletedRecords",{id:metaId(store,id),entityType:store,entityId:id,record:record?structuredClone(record):null,deletedAt:iso()}); await queue(store,id,"delete",null); schedule(); }
  async function api(path, options={}) {
    const s=await state(), serverUrl=normalizeServerUrl(s.serverUrl || defaultProductionServer());
    const usageRequest = path === "/v1/analytics/activity";
    if (usageRequest && (!s.token || switching || document.visibilityState !== "visible" || !navigator.onLine)) return;
    const response=await fetch(`${serverUrl}${path}`,{...options,headers:{"Content-Type":"application/json",...(s.token?{Authorization:`Bearer ${s.token}`}:{ }),...(options.headers||{})}});
    const data=await response.json().catch(()=>({error:`HTTP ${response.status}`}));
    if(response.status===401&&s.token&&!usageRequest&&!path.startsWith('/v1/auth/'))await new Promise((resolve,reject)=>{
      const transaction=db.transaction('accountState','readwrite'),store=transaction.objectStore('accountState'),request=store.get('current');
      request.onsuccess=()=>{const current=request.result;if(current?.token===s.token&&normalizeServerUrl(current.serverUrl||defaultProductionServer())===serverUrl)store.put({...current,reauthRequired:true});};
      transaction.oncomplete=resolve;transaction.onabort=()=>reject(transaction.error);transaction.onerror=()=>reject(transaction.error);
    });
    if(!response.ok)throw Object.assign(new Error(data.error||"Server request failed"),{status:response.status});
    try { await window.MTMAnalytics?.response(path, options, data, s); } catch {}
    return data;
  }
  async function recordConflict(localStore, localRecord, remote, reason="Both this device and the household changed this record.") {
    const id=metaId(localStore,remote.entityId); await rawPut("syncConflicts",{id,entityType:localStore,entityId:remote.entityId,local:structuredClone(localRecord||null),remote,reason,createdAt:iso()});
  }
  async function pull() {
    const s=await state(); if(!s.token||!s.householdId)return 0;
    const foodReplay=s.householdRole==='babysitter' && s.sitterFoodReadVersion!==2;
    let cursor=foodReplay?0:s.cursor||0, more=true, received=0;
    while(more){const data=await api(`/v1/sync/pull?householdId=${encodeURIComponent(s.householdId)}&since=${cursor}`), outbox=await rawAll("syncOutbox");
      applyingRemote=true;
      try{for(const change of data.changes){const pending=outbox.find(x=>x.entityType===change.entityType&&x.entityId===change.entityId), local=await rawGet(change.entityType,change.entityId), meta=await rawGet("syncMeta",metaId(change.entityType,change.entityId));
        if(pending && change.revision>(meta?.revision||0)){await recordConflict(change.entityType,local,change);continue;}
        if(change.deletedAt){if(local)await rawPut("deletedRecords",{id:metaId(change.entityType,change.entityId),entityType:change.entityType,entityId:change.entityId,record:local,deletedAt:change.deletedAt,remote:true});await rawDelete(change.entityType,change.entityId);}
        else await rawPut(change.entityType,{...change.payload,id:change.entityId});
        received++;
        await rawPut("syncMeta",{id:metaId(change.entityType,change.entityId),revision:change.revision,updatedAt:change.updatedAt,deletedAt:change.deletedAt||null});
      }}finally{applyingRemote=false;} cursor=data.cursor;more=data.hasMore;}
    await saveState({...await state(),cursor,...(foodReplay?{sitterFoodReadVersion:2}:{}),lastSyncAt:iso(),lastError:null});
    return received;
  }
  async function push() {
    if(!(await MTMAccess.status()).canWrite)return;
    const s=await state(), mutations=await rawAll("syncOutbox"); if(!s.token||!s.householdId||!mutations.length)return;
    for(let i=0;i<mutations.length;i+=100){const batch=mutations.slice(i,i+100),data=await api("/v1/sync/push",{method:"POST",body:JSON.stringify({householdId:s.householdId,mutations:batch})});
      for(const result of data.results){const item=batch.find(x=>x.mutationId===result.mutationId);if(!item)continue;
        if(result.status==="accepted"){await rawPut("syncMeta",{id:metaId(item.entityType,item.entityId),revision:result.revision,updatedAt:result.updatedAt,deletedAt:result.deletedAt||null});const latest=await rawGet("syncOutbox",item.id);if(latest?.mutationId===item.mutationId)await rawDelete("syncOutbox",item.id);else if(latest)await rawPut("syncOutbox",{...latest,baseRevision:result.revision});}
        else if(result.status==="conflict"){await recordConflict(item.entityType,await rawGet(item.entityType,item.entityId),result.current);const latest=await rawGet("syncOutbox",item.id);if(latest?.mutationId===item.mutationId)await rawDelete("syncOutbox",item.id);}
        else if(result.status==="denied"){const latest=await rawGet("syncOutbox",item.id);if(latest?.mutationId===item.mutationId)await rawDelete("syncOutbox",item.id);throw new Error(result.error||"This account cannot make that household change.");}
      }}
  }
  async function syncNow(){if(switching)return;if(running){rerun=true;return;}const s=await state();if(!s.token||!s.householdId)return;
    if(s.householdRole==="babysitter"&&s.accessExpiresAt&&Date.parse(s.accessExpiresAt)<=Date.now()){
      await clearTemporaryShareData();await saveState({...s,householdId:null,householdName:null,householdRole:null,sharedProfileId:null,accessExpiresAt:null,cursor:0,lastError:"Temporary babysitter access expired."});return;
    }
    if(!navigator.onLine)return;running=true;let received=0;
    try{received+=await pull();await push();received+=await pull();await saveState({...await state(),lastSyncAt:iso(),lastError:null});if(received)window.dispatchEvent(new CustomEvent("mtm:remote-data",{detail:{received}}));}
    catch(e){
      const current=await state();
      if(current.householdRole==="babysitter"&&e.status===403){await clearTemporaryShareData();await saveState({...current,householdId:null,householdName:null,householdRole:null,sharedProfileId:null,accessExpiresAt:null,cursor:0,lastError:"Temporary babysitter access ended."});window.dispatchEvent(new CustomEvent("mtm:share-ended"));}
      else await saveState({...current,lastError:e.message});
    }finally{running=false;if(currentRoute==="sync")refreshSyncCenter().catch(()=>{});if(rerun){rerun=false;schedule();}}}
  function schedule(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>{syncTimer=null;syncNow();},250);}
  async function queueExisting(){throw new Error("Use Backup & Restore to import existing data with verified restore access.");}
  async function resolveConflict(id,choice,merged=null){if(choice!=="remote")await MTMAccess.requireWrite("profiles",id);const c=await rawGet("syncConflicts",id);if(!c)return;applyingRemote=true;try{
    if(choice==="remote"){if(c.remote.deletedAt)await rawDelete(c.entityType,c.entityId);else await rawPut(c.entityType,{...c.remote.payload,id:c.entityId});await rawPut("syncMeta",{id,revision:c.remote.revision,updatedAt:c.remote.updatedAt,deletedAt:c.remote.deletedAt||null});}
    if(choice==="local"){await rawPut("syncMeta",{id,revision:c.remote.revision,updatedAt:c.remote.updatedAt,deletedAt:c.remote.deletedAt||null});await queue(c.entityType,c.entityId,c.local?"upsert":"delete",c.local);}
    if(choice==="both"&&c.local&&c.remote.payload){await rawPut(c.entityType,{...c.remote.payload,id:c.entityId});const copy={...c.local,id:uuid(),createdAt:c.local.createdAt||iso(),updatedAt:iso()};await rawPut(c.entityType,copy);await rawPut("syncMeta",{id,revision:c.remote.revision,updatedAt:c.remote.updatedAt});await queue(c.entityType,copy.id,"upsert",copy);}
    if(choice==="manual"&&merged){const record={...merged,id:c.entityId,updatedAt:iso()};await rawPut(c.entityType,record);await rawPut("syncMeta",{id,revision:c.remote.revision,updatedAt:c.remote.updatedAt,deletedAt:null});await queue(c.entityType,c.entityId,"upsert",record);}
    await rawDelete("syncConflicts",id);
  }finally{applyingRemote=false;}schedule();}
  window.addEventListener("online",schedule);
  setInterval(()=>syncNow(),5000);

  const USAGE_FEATURES = new Set([
    "home", "my-day", "skill-building", "speech-language", "potty-training",
    "caregiver-corner", "sleep-sanctuary", "asd-friendly-fun", "health-wellness",
    "profile", "food-diary", "screen-time", "toy-exchange", "babysitter-search",
    "recommendations", "products", "support"
  ]);

  function analyticsDevice() {
    // Inspect locally; send only these coarse labels, never the user-agent.
    const ua = navigator.userAgent || "";
    const platform =
      /iPhone|iPod/i.test(ua) ? "ios" :
      /iPad/i.test(ua) || (/Macintosh|Mac OS X/i.test(ua) && navigator.maxTouchPoints > 1) ? "ipados" :
      /Android/i.test(ua) ? "android" :
      /Windows/i.test(ua) ? "windows" :
      /Macintosh|Mac OS X/i.test(ua) ? "macos" :
      /Linux/i.test(ua) ? "linux" : "unknown";
    const client =
      navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches ? "pwa" :
      /Edg(?:A|iOS)?\//i.test(ua) ? "edge" :
      /CriOS|Chrome\//i.test(ua) ? "chrome" :
      /FxiOS|Firefox\//i.test(ua) ? "firefox" :
      /Safari\//i.test(ua) ? "safari" : "browser";
    return { platform, client };
  }

  async function trackActivity(feature = "") {
    let timeout;
    try {
      if (document.visibilityState !== "visible" || !navigator.onLine || switching) return;
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 10000);
      await api("/v1/analytics/activity", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          ...analyticsDevice(),
          version: window.MTM_APP_VERSION || "",
          ...(USAGE_FEATURES.has(feature) ? { feature } : {})
        })
      });
    } catch {
      // Best effort only: no UI errors, sync state changes or offline queue.
    } finally {
      clearTimeout(timeout);
    }
  }

  setInterval(() => { void trackActivity(); }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void trackActivity();
  });
  window.addEventListener("online", () => { void trackActivity(); });

  async function switchHousehold(id,requestedMode=null){
    if(switching)throw new Error("A household switch is already in progress.");
    switching=true;
    try{
      const start=performance.now();
      while(running){if(performance.now()-start>15000)throw new Error("Sync is still running. Please try switching again shortly.");await new Promise(r=>setTimeout(r,50));}
      const current=await state();
      const result=await api("/v1/households"),selected=id?result.households.find(h=>h.id===id):null;
      if((await state()).token!==current.token)throw new Error('Account changed. Please retry.');
      if(id&&!selected)throw new Error("This household invitation has ended or is unavailable.");
      if(!id&&!['family','babysitter'].includes(requestedMode))throw new Error('Choose an account view.');
      const selectedMode=selected?(selected.role==='babysitter'?'babysitter':'family'):requestedMode;
      if(selected?.role==='babysitter'&&selected.accessExpiresAt&&Date.parse(selected.accessExpiresAt)<=Date.now())throw new Error('This household invitation has ended.');
      if(requestedMode&&selectedMode!==requestedMode)throw new Error('This household is unavailable in the selected view.');
      const selection={activeMode:selectedMode,lastFamilyHouseholdId:selectedMode==='family'&&id?id:current.lastFamilyHouseholdId||null,lastSitterHouseholdId:selectedMode==='babysitter'&&id?id:current.lastSitterHouseholdId||null,householdId:id,householdName:selected?.name||null,householdRole:selected?.role||null,sharedProfileId:selected?.sharedProfileId||null,accessExpiresAt:selected?.accessExpiresAt||null};
      let contextForScope=null;
      if(current.householdId!==id){
        if(current.householdId)await saveAccountVault(`${current.user.id}:${current.householdId}`,current);
        else if(await hasLocalAccountContent())await saveAccountVault(`${current.user.id}:unassigned`,current);
        const context=id?await restoreAccountVault(`${current.user.id}:${id}`):(await clearAccountContent(),null);contextForScope=context;
        await saveState({...current,...(context||{}),...selection,cursor:context?.cursor||0,sitterFoodReadVersion:0,entitlement:null,lastError:null});
      }else await saveState({...current,...selection});
      const scopeState=await readState();
      if(selected?.role==='babysitter' && (current.householdId===id?current.sharedProfileId:contextForScope?.sharedProfileId)!==(selected.sharedProfileId||null)){
        await clearAccountContent();
        await saveState({...scopeState,cursor:0,entitlement:null});
      }
      window.MTMOffline?.clear();MTMAccess.invalidate();
    }finally{switching=false;}
    await syncNow();
  }
  async function reloadAfterRestore(){
    if(running)throw new Error("Restore is saved on the server. Wait for sync to finish, then sync again.");
    running=true;
    try{
      const names=[...SYNCED_STORES,"syncOutbox","syncMeta","syncConflicts","deletedRecords"];
      const transaction=db.transaction(names,"readwrite");
      const done=new Promise((resolve,reject)=>{transaction.oncomplete=resolve;transaction.onabort=()=>reject(transaction.error);transaction.onerror=()=>reject(transaction.error);});
      for(const store of names)transaction.objectStore(store).clear();
      await done;await saveState({...await state(),cursor:0});await pull();
    }finally{running=false;}
  }
  async function restoreRemote(backup,mode,requestId){
    if(switching)throw new Error("Another household operation is in progress.");
    switching=true;
    try{
      const start=performance.now();
      while(running){if(performance.now()-start>15000)throw new Error("Sync is busy. Please retry shortly.");await new Promise(r=>setTimeout(r,50));}
      const current=await state();
      await api(`/v1/households/${encodeURIComponent(current.householdId)}/restore`,{method:"POST",body:JSON.stringify({backup,mode,requestId})});
      await reloadAfterRestore();
    }finally{switching=false;}
  }
  return {saveLayoutSetting,mode,householdsForMode,switchMode,ensureMode,restoreRemote,reloadAfterRestore,switchHousehold,isSwitching:()=>switching,build:BUILD,onLocalPut,onLocalDelete,syncNow,queueExisting,state,saveState,api,trackActivity,resolveConflict,rawAll,clearTemporaryShareData,activateAccount,signOutAccount,clearDeletedAccountData,removeCurrentHouseholdData,initializeAccountIsolation,defaultServer:defaultProductionServer};
})();

function passwordResetTokenFromLink(){
  return new URL(location.href).searchParams.get("reset")?.trim()||"";
}

function clearPasswordResetFromLink(){
  const url=new URL(location.href);url.searchParams.delete("reset");history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
}

async function renderSyncCenter(){
  const sync=window.MTMSync;
  try{await sync.ensureMode();}catch{/* Keep account recovery available offline. */}
  const outbox=await sync.rawAll("syncOutbox"),conflicts=await sync.rawAll("syncConflicts");
  let s=await sync.state();
  const emailToken=new URL(location.href).searchParams.get("verify");
  if(emailToken){
    try{
      await sync.api("/v1/auth/email/verify",{method:"POST",body:JSON.stringify({token:emailToken})});
      const clean=new URL(location.href);clean.searchParams.delete("verify");history.replaceState(null,"",`${clean.pathname}${clean.search}${clean.hash}`);
      if(s.token){const account=await sync.api("/v1/account");s={...s,user:account.user};await sync.saveState(s);}
      alert("Email verified. You can now use your account.");
    }catch(e){alert(e.message);}
  }
  if(s.token&&!s.reauthRequired&&(!s.user||s.user.emailVerified===false)){try{const account=await sync.api("/v1/account");s={...s,user:account.user};await sync.saveState(s);}catch{s=await sync.state();}}
  if(emailToken&&s.token&&s.user?.emailVerified===true&&invitationCodeFromLink())await acceptPendingInvitation(sync);
  const signedIn=Boolean(s.token&&!s.reauthRequired),resetToken=passwordResetTokenFromLink(), status=!navigator.onLine?"Offline — saved information is still available":s.lastError?`Sync paused: ${esc(s.lastError)}`:outbox.length?`${outbox.length} local change${outbox.length===1?"":"s"} waiting to sync`:s.lastSyncAt?`Up to date`:"Not synchronized yet";
  if(signedIn&&s.user?.deletion?.pending){
    const date=new Date(s.user.deletion.purgeAt).toLocaleString();
    view.innerHTML=`<section class="hero"><h1>Account scheduled for deletion</h1><p>Your subscription was canceled. Your saved server data is held until ${esc(date)} so you can change your mind.</p></section><div class="card"><p>Restore this account before the date above to keep its saved information. Any paid or trial time still remaining at restoration ends on its original date. Billing will not restart and the trial will not reset.</p><div class="btn-row"><button id="restoreScheduledAccount" class="btn" type="button">Restore account</button><button id="signOutScheduledAccount" class="btn secondary" type="button">Sign out</button></div></div>`;
    $("#restoreScheduledAccount").onclick=async()=>{if(!confirm("Restore this account and keep its saved information? Billing will remain canceled."))return;try{await sync.api("/v1/account/deletion/restore",{method:"POST",body:"{}"});const account=await sync.api("/v1/account");await sync.saveState({...await sync.state(),user:account.user});alert("Account restored. Any remaining paid or trial time ends on its original date. Your subscription remains canceled.");await renderSyncCenter();}catch(e){alert(e.message);}};
    $("#signOutScheduledAccount").onclick=async()=>{await sync.signOutAccount();await renderSyncCenter();};
    return;
  }
  view.innerHTML=`<section class="hero"><h1>${signedIn?"Account & Household":"Create an account or sign in"}</h1><p>Your saved information stays available on this device, even offline.</p></section>
  ${s.reauthRequired?'<div class="banner" role="status">Your sign-in has expired or is no longer valid. Please sign in again. Your saved records are still on this device.</div>':''}
  ${resetToken?`<div class="card"><h3>Choose a new password</h3><p class="hint">This one-time link expires 30 minutes after it was requested.</p><div class="form-grid"><div class="field"><label>New password (10+ characters)</label><input id="resetPassword" type="password" autocomplete="new-password"></div><div class="field"><label>Confirm new password</label><input id="resetPasswordConfirm" type="password" autocomplete="new-password"></div><button id="finishPasswordReset" class="btn">Reset password</button></div></div>`:""}
  ${signedIn?`<div class="card"><h3>Signed in as</h3><p><strong>${esc(s.user?.displayName||"Account")}</strong><br>${esc(s.user?.email||"")}</p></div><div class="card"><h3>Household</h3><div id="householdArea"><p>Loading memberships…</p></div><div class="btn-row"><button id="syncNow" class="btn">Sync now</button><span id="syncStatus" class="hint" role="status">${esc(status)}</span><button id="prepareData" class="btn secondary">Add existing local data</button><button id="logoutSync" class="btn secondary">Sign out</button></div><p class="hint">Signing out stores this account's local records privately on this device and removes them from the signed-out view.</p></div><div class="card"><h3>Change password</h3><p class="hint">Changing it signs this account out on other devices.</p><div class="form-grid"><div class="field"><label>Current password</label><input id="currentPassword" type="password" autocomplete="current-password"></div><div class="field"><label>New password (10+ characters)</label><input id="newPassword" type="password" autocomplete="new-password"></div><div class="field"><label>Confirm new password</label><input id="newPasswordConfirm" type="password" autocomplete="new-password"></div><button id="changePassword" class="btn secondary">Change password</button></div></div>`:`<div class="card"><h3>Sign in</h3><form id="signInForm" class="form-grid"><div class="field"><label for="syncEmail">Email</label><input id="syncEmail" name="username" type="email" autocomplete="section-signin username" required autocapitalize="none" spellcheck="false"></div><div class="field"><label for="syncPassword">Password</label><input id="syncPassword" name="password" type="password" autocomplete="section-signin current-password" required></div><div class="btn-row"><button id="loginSync" class="btn" type="submit">Sign in</button><button id="forgotPassword" class="btn secondary" type="button">Forgot password?</button></div></form><h3>Create free account</h3><p class="hint">Creating an account is free. Parents create or join a household before entering information. Babysitter accounts remain free and use parent-approved shared access.</p><form id="registerForm" class="form-grid"><div class="field"><label for="regName">Your name</label><input id="regName" name="name" autocomplete="section-register name" required></div><div class="field"><label for="regEmail">Email</label><input id="regEmail" name="username" type="email" autocomplete="section-register username" required autocapitalize="none" spellcheck="false"></div><div class="field"><label for="regPassword">Password (10+ characters)</label><input id="regPassword" name="new-password" type="password" autocomplete="section-register new-password" minlength="10" required></div><label class="check-option"><input id="regBabysitter" type="checkbox"> I am a babysitter and want to create a free searchable profile</label><button id="registerSync" class="btn" type="submit">Create account</button></form></div>`}
  <h2 id="syncDecisionsTitle" class="section-title">Sync decisions${conflicts.length?` (${conflicts.length})`:""}</h2><div id="syncDecisions" class="list">${syncConflictMarkup(conflicts)}</div>`;
  if(signedIn&&s.user?.emailVerified===false){
    view.innerHTML=`<section class="hero"><h1>Verify your email</h1><p>We sent a verification link to ${esc(s.user.email)}. Open the link within 30 minutes to finish setting up this account.</p></section><div class="card"><p>If the message did not arrive, request another after two minutes. Check your spam folder too.</p><div class="btn-row"><button id="resendVerification" class="btn" type="button">Resend verification email</button><button id="verificationSignout" class="btn secondary" type="button">Sign out</button></div></div>`;
    $("#resendVerification").onclick=async()=>{const button=$("#resendVerification");button.disabled=true;try{await sync.api("/v1/account/email-verification/resend",{method:"POST",body:"{}"});alert("Verification email sent.");}catch(e){alert(e.message);}finally{button.disabled=false;}};
    $("#verificationSignout").onclick=async()=>{await sync.signOutAccount();renderSyncCenter();};
    return;
  }
  if(signedIn){
    const exportSection=document.createElement("div");exportSection.className="card";
    exportSection.innerHTML='<h3>Download account data</h3><p class="hint">Download your server-held account, household, community, and support data. Family information saved only on this device is available through Backup & Restore. Keep both files private.</p><button id="downloadAccountData" class="btn secondary" type="button">Download account data</button>';
    $("#syncDecisionsTitle").before(exportSection);
    $("#downloadAccountData").onclick=async()=>{
      const password=prompt("Enter your current password to download account data:");if(password===null)return;
      const button=$("#downloadAccountData");button.disabled=true;
      try{
        const data=await sync.api("/v1/account/export",{method:"POST",body:JSON.stringify({password})});
        const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
        const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`MoreThanMeasured-Account-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      }catch(e){alert(e.message);}finally{button.disabled=false;}
    };
  }
  if(signedIn){
    const section=document.createElement("div");section.className="card";
    section.innerHTML='<h3>Schedule account deletion</h3><p class="hint">Your subscription will be canceled immediately. Your account and saved server data will be deleted after 30 days unless you sign in and restore the account. Remaining paid or trial time continues counting down and ends on its original date.</p><button id="reviewAccountDeletion" class="btn secondary" type="button">Review scheduled deletion</button>';
    $("#syncDecisionsTitle").before(section);
    $("#reviewAccountDeletion").onclick=async()=>{
      const button=$("#reviewAccountDeletion");button.disabled=true;
      try{
        const plan=await sync.api("/v1/account/deletion");
        const summary=`Delete ${plan.email}?\n\n${plan.notice}\n\nHouseholds to delete:\n${plan.households.map(h=>`${h.name} (${h.records} records)`).join("\n")||"None"}`;
        if(!plan.canDelete){alert(summary+"\n\nDeletion blocked:\n"+plan.blockers.join("\n"));return;}
        if(!confirm(summary))return;
        const password=prompt("Enter your current password to delete this account:");if(password===null)return;
        if(prompt("Type DELETE to permanently delete this account:")!=="DELETE")return;
        const result=await sync.api("/v1/account/deletion",{method:"POST",body:JSON.stringify({password,confirm:"DELETE",confirmation:plan.confirmation})});
        await sync.signOutAccount();
        alert(`Your account is scheduled for deletion on ${new Date(result.purgeAt).toLocaleString()}. Sign in before then to restore it. Any linked MTM subscription was canceled immediately.`);
        await renderSyncCenter();
      }catch(e){alert(e.message);}
      finally{button.disabled=false;}
    };
  }
  if($("#finishPasswordReset"))$("#finishPasswordReset").onclick=async()=>{const password=$("#resetPassword").value,confirmPassword=$("#resetPasswordConfirm").value;if(password!==confirmPassword)return alert("The new passwords do not match.");try{const d=await sync.api("/v1/auth/password/reset",{method:"POST",body:JSON.stringify({token:resetToken,password})});if(signedIn)await sync.signOutAccount();clearPasswordResetFromLink();alert(d.message);await renderSyncCenter();}catch(e){alert(e.message);}};
  if(!signedIn){$("#signInForm").onsubmit=async event=>{event.preventDefault();try{const d=await sync.api("/v1/auth/login",{method:"POST",body:JSON.stringify({email:$("#syncEmail").value,password:$("#syncPassword").value})});await sync.activateAccount(d);await acceptPendingInvitation(sync);await renderSyncCenter();}catch(e){alert(e.message);}};
    $("#registerForm").onsubmit=async event=>{event.preventDefault();try{const d=await sync.api("/v1/auth/register",{method:"POST",body:JSON.stringify({displayName:$("#regName").value,email:$("#regEmail").value,password:$("#regPassword").value,isBabysitter:$("#regBabysitter").checked})});await sync.activateAccount(d);await acceptPendingInvitation(sync);await renderSyncCenter();if(d.emailSent===false)alert("Your account was created, but the verification email could not be sent. Select Resend verification email to try again.");}catch(e){alert(e.message);}};
    $("#forgotPassword").onclick=async()=>{const email=prompt("Enter the email address used for this MTM account:",$("#syncEmail").value.trim());if(!email?.trim())return;try{const d=await sync.api("/v1/auth/password/forgot",{method:"POST",body:JSON.stringify({email:email.trim()})});alert(d.message);}catch(e){alert(e.message);}};
  }else{
    $("#changePassword").onclick=async()=>{const currentPassword=$("#currentPassword").value,newPassword=$("#newPassword").value,confirmPassword=$("#newPasswordConfirm").value;if(newPassword!==confirmPassword)return alert("The new passwords do not match.");try{const d=await sync.api("/v1/account/password",{method:"POST",body:JSON.stringify({currentPassword,newPassword})});await sync.saveState({...await sync.state(),token:d.token});$("#currentPassword").value="";$("#newPassword").value="";$("#newPasswordConfirm").value="";alert("Password changed. Other signed-in devices will need the new password.");}catch(e){alert(e.message);}};
    try{const d=await sync.api("/v1/households");d.households=sync.householdsForMode(d.households,sync.mode(s));const area=$("#householdArea"),active=d.households.find(h=>h.id===s.householdId)||d.households[0];if(!active&&s.householdId){await sync.removeCurrentHouseholdData();return renderSyncCenter();}area.innerHTML=`${d.households.length?`<div class="field"><label>Active household</label><select id="activeHousehold">${d.households.map(h=>`<option value="${h.id}" ${h.id===active?.id?"selected":""}>${esc(h.name)} — ${esc(h.role)}${h.accessExpiresAt?` until ${esc(fmtDate(h.accessExpiresAt))}`:""}</option>`).join("")}</select></div>`:'<div class="banner">This account is not connected to a household yet.</div>'}<div class="btn-row"><button id="createHousehold" class="btn secondary">Create household</button><button id="joinInvite" class="btn secondary">Accept invitation</button>${active?.role==="owner"?'<button id="inviteCaregiver" class="btn secondary">Invite caregiver</button><button id="inviteViewer" class="btn secondary">Invite viewer</button>':""}${["owner","caregiver"].includes(active?.role)?'<button id="inviteBabysitter" class="btn secondary">Share with a babysitter</button>':""}${active&&active.role!=="owner"?'<button id="leaveHousehold" class="btn secondary">Leave this household</button>':""}</div>${["owner","caregiver"].includes(active?.role)?'<div id="currentShares"><p class="hint">Loading shared access…</p></div>':""}`;$("#prepareData").classList.toggle("hidden",!active||["viewer","babysitter"].includes(active.role));if(active&&(s.householdId!==active.id||s.householdRole!==active.role||(s.accessExpiresAt||null)!==(active.accessExpiresAt||null)))await sync.switchHousehold(active.id);if($("#activeHousehold"))$("#activeHousehold").onchange=async e=>{const selected=d.households.find(item=>item.id===e.target.value);await sync.switchHousehold(selected.id);renderSyncCenter();};$("#createHousehold").onclick=async()=>{const name=prompt("Household name:");if(!name?.trim())return;try{const result=await sync.api("/v1/households",{method:"POST",body:JSON.stringify({name:name.trim()})});await sync.switchHousehold(result.household.id);renderSyncCenter();}catch(e){alert(e.message);}};$("#joinInvite").onclick=async()=>{const code=prompt("Invitation code:");if(code)await acceptInvitation(sync,code);};if($("#inviteCaregiver"))$("#inviteCaregiver").onclick=()=>createInvitation(sync,"caregiver");if($("#inviteBabysitter"))$("#inviteBabysitter").onclick=()=>createInvitation(sync,"babysitter");if($("#inviteViewer"))$("#inviteViewer").onclick=()=>createInvitation(sync,"viewer");if($("#leaveHousehold"))$("#leaveHousehold").onclick=async()=>{if(!confirm("Leave this household and remove its family data from this account on this device?"))return;try{await sync.api(`/v1/households/${encodeURIComponent(active.id)}/members/self`,{method:"DELETE"});await sync.removeCurrentHouseholdData();await renderSyncCenter();}catch(e){alert(e.message);}};await renderCurrentShares(sync,active);}catch(e){$("#householdArea").innerHTML=`<div class="banner">${esc(e.message)}</div>`;}
    await window.MTMAccess.renderSwitcher();
    if(sync.mode(await sync.state())==="family"){const area=$("#householdArea");if(area&&!area.querySelector("[data-subscription-link]")){const accessLink=document.createElement("button");accessLink.className="btn";accessLink.dataset.subscriptionLink="true";accessLink.textContent="Trial and subscription";accessLink.onclick=()=>navigate("subscription");area.append(accessLink);}}
    $("#prepareData").hidden=true;
    $("#syncNow").onclick=async()=>{await sync.syncNow();};$("#prepareData").onclick=async()=>{if(!confirm("Create a safety checkpoint and add copies of all existing local family data to this household? Nothing local will be removed."))return;try{const count=await sync.queueExisting();alert(`${count} existing records are ready to synchronize.`);await sync.syncNow();}catch(e){alert(e.message);}};$("#logoutSync").onclick=async()=>{if(s.householdRole==="babysitter")await sync.clearTemporaryShareData();try{await sync.api("/v1/auth/logout",{method:"POST",body:"{}"});}catch{}await sync.signOutAccount();renderSyncCenter();};}
  bindSyncConflictActions(conflicts);
}

function invitationCodeFromLink(){
  return new URL(location.href).searchParams.get("invite")?.trim()||"";
}

function clearInvitationFromLink(){
  const url=new URL(location.href);url.searchParams.delete("invite");history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
}

async function acceptInvitation(sync,code){
  let joined;
  try{
    joined=await sync.api("/v1/invitations/join",{method:"POST",body:JSON.stringify({code:code.trim()})});
  }catch(e){alert(e.message);return false;}
  // The one-use invitation is consumed. Never repeat the join to retry a load.
  clearInvitationFromLink();
  try{
    try{await sync.switchHousehold(joined.householdId);}
    catch(e){
      if(e.status || !(e instanceof TypeError) || !navigator.onLine)throw e;
      await new Promise(resolve=>setTimeout(resolve,500));
      await sync.switchHousehold(joined.householdId);
    }
    await renderSyncCenter();
  }catch(e){
    alert("Invitation accepted. The household could not finish loading. Reopen Account and household when your connection is available; you do not need to enter the code again.");
  }
  return true;
}

async function acceptPendingInvitation(sync){
  const code=invitationCodeFromLink();
  if(!code)return;
  const state=await sync.state();
  if(state.user?.emailVerified===false)return;
  if(confirm(`Accept the household invitation in this link using ${state.user?.email||"the signed-in account"}?`))await acceptInvitation(sync,code);
  else clearInvitationFromLink();
}

function showInvitationShare(result,message){
  const url=new URL(location.href);url.searchParams.set('invite',result.code);url.hash='sync';
  modalBody.innerHTML=`<h2>Share invitation</h2><p>${esc(message)}</p><div class="field"><label for="invitationCode">One-time code</label><input id="invitationCode" readonly value="${esc(result.code)}" autocapitalize="off" spellcheck="false"></div><div class="btn-row"><button id="copyInvitationCode" class="btn" type="button">Copy code</button><button id="copyInvitationLink" class="btn secondary" type="button">Copy invitation link</button></div><div class="field"><label for="invitationLink">Invitation link</label><input id="invitationLink" readonly value="${esc(url.href)}"></div><p id="invitationCopyStatus" class="hint" role="status" aria-live="polite"></p><button id="closeInvitationShare" class="btn secondary" type="button">Done</button>`;
  async function copy(id,label){
    const input=document.getElementById(id),status=document.getElementById('invitationCopyStatus');
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(input.value);
      else {input.focus();input.select();input.setSelectionRange(0,input.value.length);if(!document.execCommand('copy'))throw new Error('Copy unavailable');}
      status.textContent=`${label} copied. You can paste it into a message.`;
    }catch{
      input.focus();input.select();input.setSelectionRange(0,input.value.length);
      status.textContent=`Automatic copying is unavailable. Touch and hold the selected ${label.toLowerCase()} and choose Copy.`;
    }
  }
  document.getElementById('copyInvitationCode').onclick=()=>copy('invitationCode','Code');
  document.getElementById('copyInvitationLink').onclick=()=>copy('invitationLink','Invitation link');
  document.getElementById('closeInvitationShare').onclick=()=>modal.close();
  if(!modal.open)modal.showModal();
}

function invitationShareText(result){
  const url=new URL(location.href);url.searchParams.set("invite",result.code);url.hash="sync";
  return `One-time code: ${result.code}\n\nInvitation link: ${url.href}`;
}

async function createInvitation(sync,role){
  if(role==="babysitter")return openBabysitterShare(sync);
  try{
    const state=await sync.state(),result=await sync.api("/v1/invitations",{method:"POST",body:JSON.stringify({householdId:state.householdId,role})});
    showInvitationShare(result,`This ${role} invitation can be used once. Copy the code or link to send it.`);
  }catch(e){alert(e.message);}
}

async function openBabysitterShare(sync){
  const profiles=await sync.rawAll("profiles");
  if(!profiles.length)return alert("Create a child profile before sharing access.");
  modalBody.innerHTML=`<h2>Share babysitter access</h2><p class="hint">Choose one child or the whole household. Whole-household access includes all current and future child profiles. Babysitters can add notes and My Day entries and update potty totals, but cannot add children or delete records. You can withdraw access at any time. Withdrawal stops server access immediately; MTM removes downloaded shared data the next time the babysitter's device connects.</p><div class="form-grid">
    <div class="field"><label>Babysitter's email</label><input id="shareBabysitterEmail" type="email" autocomplete="email"></div>
    <div class="field"><label>Share</label><select id="shareProfile"><option value="*">Whole household — all children</option>${profiles.map(profile=>`<option value="${esc(profile.id)}">${esc(profile.name||"Child profile")}</option>`).join("")}</select></div>
    <div class="field"><label>Access length</label><select id="shareDays">${[1,2,3,4,5,6,7].map(day=>`<option value="${day}" ${day===1?"selected":""}>${day} day${day===1?"":"s"}</option>`).join("")}</select></div>
    <button id="sendBabysitterShare" class="btn" type="button">Create access</button><button id="cancelBabysitterShare" class="btn secondary" type="button">Cancel</button></div>`;
  modal.showModal();
  $("#cancelBabysitterShare").onclick=()=>modal.close();
  $("#sendBabysitterShare").onclick=async()=>{
    const button=$("#sendBabysitterShare");button.disabled=true;button.textContent="Creating…";
    try{
      const state=await sync.state(),result=await sync.api("/v1/invitations",{method:"POST",body:JSON.stringify({
        householdId:state.householdId,role:"babysitter",email:$("#shareBabysitterEmail").value.trim(),
        shareScope:$("#shareProfile").value==="*"?"household":"child",profileId:$("#shareProfile").value,accessDays:Number($("#shareDays").value)
      })});
      modal.close();
      if(result.emailed)alert("That email does not have an MTM account yet. An invitation to create one was sent.");
      else showInvitationShare(result,`${result.recipientName||"That babysitter"} already has an MTM account. Copy the code or link to send it.`);
      await renderSyncCenter();
    }catch(e){alert(e.message);button.disabled=false;button.textContent="Create access";}
  };
}

function temporaryAccessRemaining(value){
  const ms=Date.parse(value)-Date.now();if(ms<=0)return "expired";
  const hours=Math.ceil(ms/3600000),days=Math.floor(hours/24),remainingHours=hours%24;
  return days?`${days} day${days===1?"":"s"}${remainingHours?`, ${remainingHours} hour${remainingHours===1?"":"s"}`:""} remaining`:`${hours} hour${hours===1?"":"s"} remaining`;
}

function shareCard(item){
  const expires=item.accessExpiresAt||item.invitationExpiresAt,label=item.status==="active"?"Active access":item.status==="pending"?"Waiting for acceptance":"Expired";
  return `<article class="card" style="min-width:0;max-width:100%;overflow-wrap:anywhere"><div class="babysitter-card-head" style="flex-wrap:wrap;gap:0.5rem"><span>${esc(label)}</span><small>${expires?esc(fmtDate(expires)):""}</small></div><h3 style="min-width:0;max-width:100%;white-space:normal;word-break:break-all;overflow-wrap:anywhere">${esc(item.name||item.email||"Babysitter")}</h3><p>Shared access: <strong>${esc(item.profileName||"Child profile")}</strong></p>
    <p class="hint">${item.status==="pending"?`The invitation expires ${esc(fmtDate(item.invitationExpiresAt))}. The selected access period starts when accepted.`:`Access ${item.status==="active"?"ends":"ended"} ${esc(fmtDate(item.accessExpiresAt))}${item.status==="active"?` · ${esc(temporaryAccessRemaining(item.accessExpiresAt))}`:""}.`}</p>
    <div class="btn-row">${item.status==="active"||item.status==="pending"?`<button class="btn secondary share-remove" data-type="${item.type}" data-id="${item.id}" type="button">${item.status==="active"?"Withdraw access":"Cancel invitation"}</button>`:`<button class="btn share-renew" data-type="${item.type}" data-id="${item.id}" data-days="${item.accessDays||1}" type="button">Renew</button><button class="btn secondary share-remove" data-type="${item.type}" data-id="${item.id}" type="button">Remove</button>`}</div></article>`;
}

async function renderCurrentShares(sync,active){
  const host=$("#currentShares");if(!host||!active)return;
  try{
    const data=await sync.api(`/v1/households/${encodeURIComponent(active.id)}/shares`),current=data.shares.filter(item=>item.status!=="expired"),expired=data.shares.filter(item=>item.status==="expired");
    host.innerHTML=`<h3>Current shared access</h3>${current.length?current.map(shareCard).join(""):'<p class="hint">No babysitter currently has or is waiting for access.</p>'}
      <details ${expired.length?"":"class=\"hidden\""}><summary>Expired access${expired.length?` (${expired.length})`:""}</summary><div>${expired.map(shareCard).join("")}</div></details>`;
    host.querySelectorAll(".share-remove").forEach(button=>button.onclick=async()=>{
      const wording=button.textContent.includes("Remove")?"Remove this expired share from the list?":"End this shared access now?";
      if(!confirm(wording))return;
      try{await sync.api(`/v1/households/${encodeURIComponent(active.id)}/shares/${button.dataset.type}/${encodeURIComponent(button.dataset.id)}`,{method:"DELETE"});await renderCurrentShares(sync,active);}catch(e){alert(e.message);}
    });
    host.querySelectorAll(".share-renew").forEach(button=>button.onclick=async()=>{
      const days=Number(prompt("Renew access for how many days? Enter 1 through 7:",button.dataset.days||"1"));
      if(!Number.isInteger(days)||days<1||days>7)return alert("Enter a whole number from 1 through 7.");
      try{
        const result=await sync.api(`/v1/households/${encodeURIComponent(active.id)}/shares/${button.dataset.type}/${encodeURIComponent(button.dataset.id)}/renew`,{method:"POST",body:JSON.stringify({accessDays:days})});
        if(result.emailed)alert("A renewed invitation was emailed.");
        else if(result.code)showInvitationShare(result,"Copy this renewed code or link to send to the babysitter.");
        await renderCurrentShares(sync,active);
      }catch(e){alert(e.message);}
    });
  }catch(e){host.innerHTML=`<div class="banner">${esc(e.message)}</div>`;}
}

function syncConflictMarkup(conflicts){
  return conflicts.map(c=>`<div class="card"><strong>${esc(c.entityType)} conflict</strong><p>${esc(c.reason)}</p><p class="hint">Record ${esc(c.entityId)}</p><div class="btn-row"><button class="small-action conflict-local" data-id="${esc(c.id)}">Keep this device</button><button class="small-action conflict-remote" data-id="${esc(c.id)}">Keep household version</button>${c.local&&c.remote?.payload?`<button class="small-action conflict-both" data-id="${esc(c.id)}">Keep both</button><button class="small-action conflict-manual" data-id="${esc(c.id)}">Merge fields</button>`:""}</div></div>`).join("")||'<div class="card"><p>No decisions are waiting.</p></div>';
}

function bindSyncConflictActions(conflicts){
  const sync=window.MTMSync;
  document.querySelectorAll(".conflict-local").forEach(b=>b.onclick=async()=>{await sync.resolveConflict(b.dataset.id,"local");renderSyncCenter();});document.querySelectorAll(".conflict-remote").forEach(b=>b.onclick=async()=>{await sync.resolveConflict(b.dataset.id,"remote");renderSyncCenter();});document.querySelectorAll(".conflict-both").forEach(b=>b.onclick=async()=>{await sync.resolveConflict(b.dataset.id,"both");renderSyncCenter();});document.querySelectorAll(".conflict-manual").forEach(b=>b.onclick=()=>openSyncFieldMerge(conflicts.find(c=>c.id===b.dataset.id)));
}

async function refreshSyncCenter(){
  if(currentRoute!=="sync"||window.MTMAccess?.isChangingView()||window.MTMSync.isSwitching())return;
  const sync=window.MTMSync,s=await sync.state(),outbox=await sync.rawAll("syncOutbox"),conflicts=await sync.rawAll("syncConflicts");
  if(s.reauthRequired){if($("#logoutSync"))await renderSyncCenter();return;}
  const stillCurrent=async()=>{
    const latest=await sync.state();
    return currentRoute==="sync"&&!window.MTMAccess?.isChangingView()&&!sync.isSwitching()&&latest.token===s.token&&latest.householdId===s.householdId&&sync.mode(latest)===sync.mode(s)&&$("#syncStatus")===statusEl;
  };
  const status=!navigator.onLine?"Offline — saved information is still available":s.lastError?`Sync paused: ${s.lastError}`:outbox.length?`${outbox.length} local change${outbox.length===1?"":"s"} waiting to sync`:s.lastSyncAt?`Up to date`:"Not synchronized yet";
  const statusEl=$("#syncStatus"),titleEl=$("#syncDecisionsTitle"),decisionsEl=$("#syncDecisions");
  if(!statusEl||!titleEl||!decisionsEl)return;
  if(s.token){
    try{
      const d=await sync.api("/v1/households"),select=$("#activeHousehold");
      if(!await stillCurrent())return;
      const shown=select?[...select.options].map(option=>option.value).sort().join("|"):"";
      const available=sync.householdsForMode(d.households,sync.mode(s)).map(h=>h.id).sort().join("|");
      if(shown!==available){await renderSyncCenter();return;}
    }catch{}
  }
  if(!await stillCurrent())return;
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
