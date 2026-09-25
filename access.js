/* Online checks refresh signed offline access. Imported account state never grants writes. */
window.MTMAccess = (() => {
  let verified = null, pending = null;
  const identity = s => `${s.serverUrl}|${s.user?.id}|${s.householdId}|${s.token}`;
  const locked = (kind,label) => ({access:false,canWrite:false,canRestore:false,kind,label});
  async function status(force=false) {
    const sync=window.MTMSync,s=await sync.state();
    if(!s.token||!s.user||s.reauthRequired)return locked('signed-out','Create an account or sign in');
    if(!s.householdId)return locked('no-household','Create or join a household');
    const key=identity(s),tick=performance.now();
    if(verified?.key!==key)verified=null;
    if(navigator.onLine===false){
      const offline=await window.MTMOffline?.read(s);
      return offline||{...locked('offline','Reconnect to verify access. Your saved entries are preserved.'),canRead:false};
    }
    if(!force&&verified&&tick-verified.checked<60000&&tick<verified.deadline)return verified.value;
    if(!pending){
      pending=(async()=>{
        try {
          const response=await sync.api(`/v1/households/${encodeURIComponent(s.householdId)}/access`,{signal:AbortSignal.timeout(10000)});
          const value=response.entitlement;
          if(value?.userId!==s.user.id||value.householdId!==s.householdId||!value.enforced)throw new Error('The server did not verify household access.');
          if(identity(await sync.state())!==key)return locked('changed','Account changed. Refresh access.');
          const subscriptionEnd=value.kind==='trial'?Date.parse(value.trialEndsAt):value.kind==='paid'?Date.parse(value.paidUntil):Infinity;
          const end=Math.min(subscriptionEnd,value.memberAccessExpiresAt?Date.parse(value.memberAccessExpiresAt):Infinity);
          const lifetime=Math.max(0,Math.min(30*86400000,end-Date.parse(value.serverTime)));
          await window.MTMOffline?.accept(response.offlinePass,s);
          verified={key,value,checked:performance.now(),deadline:performance.now()+lifetime};
          await sync.saveState({...await sync.state(),entitlement:value});
          return value;
        } catch(error) {
          if([401,403].includes(error.status)){verified=null;window.MTMOffline?.clear();return locked('invalid','Sign in again to verify access.');}
          const offline=await window.MTMOffline?.read(s);
          if(offline)return offline;
          return {...locked('offline',s.householdRole==='babysitter'?'Connect to verify the parent’s shared access.':'Connect to verify access; saved data can still be exported.'),canRead:false};
        } finally {pending=null;}
      })();
    }
    const result=await pending;
    // A response started under another household may never authorize this one.
    if(identity(await sync.state())!==key)return locked('changed','Account changed. Refresh access.');
    if(result.userId && (result.userId!==s.user.id || result.householdId!==s.householdId))return locked('changed','Account changed. Refresh access.');
    return result;
  }
  async function requireWrite(store,id,value=null,deleting=false) {
    if(MTMSync.isSwitching?.())throw Object.assign(new Error('Wait for the household switch to finish.'),{code:'MTM_ACCESS'});
    if(store==='snapshots'||(store==='settings'&&['lastBackupAt','profileDisplay','vocabFilterDefaults'].includes(id)))return;
    const s=await status();
    if(s.role==='babysitter'){
      const account=await MTMSync.state(),existing=(await getAll(store)).find(x=>x.id===id);
      if(store==='words' && (!['word','sentence'].includes(value?.entryType) || (existing && (existing.profileId!==value.profileId || (existing.entryType||'word')!==value.entryType))))throw Object.assign(new Error('Only words and sentences for the shared child may be updated.'),{code:'MTM_ACCESS'});
      if(deleting || (existing && !['pottyLogs','words'].includes(store)) || !['notes','pottyLogs','words'].includes(store) || !value || (account.sharedProfileId==='*'?!(await getAll('profiles')).some(p=>p.id===value.profileId):value.profileId!==account.sharedProfileId))
        throw Object.assign(new Error('Babysitters may add notes and My Day entries and update daily potty totals, words, and sentences for shared children. Deletion is unavailable.'),{code:'MTM_ACCESS'});
    }
    if(!s.canWrite)throw Object.assign(new Error('Your household needs an active trial or subscription to make changes. Saved data can still be exported.'),{code:'MTM_ACCESS'});
  }
  const publicRoutes=new Set(['products','about','sync','support']);
  const readRoutes=new Set(['child','vocabulary','skills','potty','myDay','screenTime','food','lifeSkills','caregiver']);
  async function route(requested) {
    if(typeof modal!=='undefined'&&modal.open)modal.close();
    try{await MTMSync.ensureMode();}catch{/* Offline clients retain their account-scoped selection. */}
    if(publicRoutes.has(requested))return requested;
    const account=await MTMSync.state();
    if(!account.token||!account.user||account.reauthRequired)return 'sync';
    const sitterMode=MTMSync.mode(account)==='babysitter';
    if(requested==='babysitterHome'&&!sitterMode)return 'sync';
    if(sitterMode){
      if(['babysitters','babysitterHome'].includes(requested))return requested;
      if(['home','subscription'].includes(requested)||!account.householdId)return 'babysitterHome';
      if(!['child','vocabulary','myDay','potty','caregiver','food','screenTime'].includes(requested))return 'babysitterHome';
    }
    const s=await status();
    if(sitterMode && !s.access && !s.canRead)return 'babysitterHome';
    if(['signed-out','invalid','no-household'].includes(s.kind))return 'sync';
    if(['subscription','backup'].includes(requested))return requested;
    if(s.access)return requested;
    return 'subscription';
  }
  async function renderSubscription() {
    const s=await status(true),account=await MTMSync.state();
    const owner=s.role==='owner';
    const paid=s.kind==='paid', canceling=paid&&(s.cancelAtPeriodEnd||s.cancelAt);
    const date=value=>new Date(value).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
    const end=canceling&&s.cancelAt&&Date.parse(s.cancelAt)<Date.parse(s.paidUntil)?s.cancelAt:s.paidUntil;
    const heading=canceling?'Subscription canceled':s.label;
    const description=paid?(canceling?`Your household has full access until ${date(end)}. Your subscription will not renew.`:`Your household has paid access through ${date(s.paidUntil)}.`):s.kind==='complimentary'?'Your household has complimentary access. No payment is required.':s.kind==='expired'?'Your household access has ended. Your saved data is preserved and can be exported at any time. Subscribe for $12.99 per month or $99.99 per year to use the app again.':'Try MTM for 7 days without a credit card. Afterward, choose $12.99 per month or $99.99 per year. The free trial does not automatically charge you.';
    view.innerHTML=`<section class="hero"><h1>Your household’s MTM access</h1><p>One household membership covers you and your spouse.</p></section>
      <div class="card"><h2>${esc(heading)}</h2><p>${esc(description)}</p>
      ${s.kind==='trial'&&s.trialEndsAt?`<p>Trial ends: ${esc(new Date(s.trialEndsAt).toLocaleString())}</p>`:''}
      <div class="btn-row">${s.trialEligible?'<button class="btn" id="startHouseholdTrial">Start free trial</button>':''}
      ${owner&&s.checkoutAvailable&&!['paid','complimentary'].includes(s.kind)?'<button class="btn" data-plan="monthly">Subscribe — $12.99/month</button><button class="btn" data-plan="yearly">Subscribe — $99.99/year</button>':''}
      ${owner&&s.provider==='stripe'?'<button class="btn secondary" id="manageBilling">Manage subscription</button>':''}
      <button class="btn secondary" data-go="sync">Account and household</button><button class="btn secondary" data-go="backup">${s.access?'Export or restore data':'Export your data'}</button>
      <button class="btn secondary" data-go="support">Contact support</button><button class="btn secondary" data-go="products">Product links — always free</button></div>
      ${owner&&!s.checkoutAvailable&&!['paid','complimentary'].includes(s.kind)?'<p>Paid subscriptions are being prepared. Contact support if you need access extended.</p>':''}
      ${s.kind==='trial'?'<p>Subscribing starts paid access immediately. You can also wait until your free trial ends.</p>':''}
      </div><div class="banner">Your data stays yours. When access ends, saved data is preserved and can be exported at any time. Restoring a backup requires paid or complimentary access, or a support exception during your trial.</div>`;
    bindRouteButtons();
    async function act(path,body={}) {
      const buttons=[...view.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
      try {
        const result=await MTMSync.api(`/v1/households/${encodeURIComponent(account.householdId)}/${path}`,{method:'POST',body:JSON.stringify(body)});
        verified=null;
        if(result.url)location.assign(result.url);else await navigate('home');
      }catch(e){alert(e.message);}finally{buttons.forEach(b=>b.disabled=false);}
    }
    document.getElementById('startHouseholdTrial')?.addEventListener('click',()=>act('trial'));
    document.getElementById('manageBilling')?.addEventListener('click',()=>act('billing/portal'));
    view.querySelectorAll('[data-plan]').forEach(b=>b.addEventListener('click',()=>act('billing/checkout',{plan:b.dataset.plan})));
  }
  async function readonlyChrome() {
    await renderSwitcher();
    if((await MTMSync.state()).householdRole==='babysitter'){
      if(currentRoute==='vocabulary')view.querySelectorAll('#addLetter,#addNumber,#bulkWords,#manageCategories').forEach(b=>b.hidden=true);
      view.querySelectorAll('button').forEach(b=>{if(/^(edit|delete|remove|create child|add child|create profile|customize)/i.test(b.textContent.trim()) && !(currentRoute==='vocabulary' && b.classList.contains('edit-word')))b.hidden=true;});
    }
    if(!safelyAllowed(currentRoute) && !(await status()).access){
      if(typeof modal!=='undefined'&&modal.open)modal.close();
      void navigate('subscription');return;
    }
    if(!readRoutes.has(currentRoute))return;
    if((await status()).canWrite)return;
    const banner=document.createElement('p');banner.className='banner';banner.textContent=(await MTMSync.state()).householdRole==='babysitter'?'Read-only access. Ask the parent to check the shared access window.':'Read-only access: saved information is preserved. Renew or contact support to make changes.';view.prepend(banner);
    // Mutation handlers are also guarded at the storage layer; navigation and export stay available.
    view.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=true);
  }
  const safelyAllowed=route=>publicRoutes.has(route)||['subscription','backup','babysitterHome','babysitters'].includes(route);
  async function renderExport(){
    view.innerHTML='<section class="hero"><h1>Export your data</h1><p>Your saved data is preserved. Renew household access to use the app again.</p></section><div class="card"><p>Download a complete backup of the data saved on this device. Connect and sync from Account and household to include the latest shared records.</p><button class="btn" id="exportBtn">Export complete backup</button><button class="btn secondary" data-go="subscription">Subscription options</button><button class="btn secondary" data-go="sync">Account and household</button></div>';
    document.getElementById('exportBtn').onclick=exportBackup;bindRouteButtons();
  }
  async function checkOpenScreen(){
    if(typeof currentRoute==='undefined'||document.visibilityState==='hidden')return;
    if(!safelyAllowed(currentRoute) && !(await status()).access){
      if(typeof modal!=='undefined'&&modal.open)modal.close();
      await navigate('subscription');
    }
  }
  window.addEventListener('focus',()=>{checkOpenScreen().catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{checkOpenScreen().catch(()=>{});});
  setInterval(()=>{checkOpenScreen().catch(()=>{});},30000);
  async function households(){
    const s=await MTMSync.state();if(!s.token)return [];
    const result=await MTMSync.api('/v1/households');return result.households;
  }
  let changingView=false;
  async function renderSwitcher(inDrawer=false){
    const switcherId=inDrawer?'drawerModeSwitch':'quickHouseholdSwitch';
    document.getElementById(switcherId)?.remove();
    if(!inDrawer&&!['sync','babysitterHome'].includes(currentRoute))return;
    const s=await MTMSync.state();if(!s.token||!s.user||s.reauthRequired)return;
    let list=[];try{list=await households();}catch{/* Keep the mode switch visible when offline. */}
    if(identity(await MTMSync.state())!==identity(s)||(!inDrawer&&!['sync','babysitterHome'].includes(currentRoute)))return;
    if(!s.user.isBabysitter&&s.householdRole!=='babysitter'&&!s.lastSitterHouseholdId&&!list.some(h=>h.role==='babysitter'))return;
    const selectedMode=MTMSync.mode(s);
    const bar=document.createElement(inDrawer?'section':'nav');bar.id=switcherId;bar.className='card';bar.setAttribute('aria-label','Account view and household');
    const title=document.createElement('strong');title.textContent=selectedMode==='family'?'Family / Personal view':'Babysitter view';bar.append(title);
    const modes=document.createElement('div');modes.className='btn-row';bar.append(modes);
    if(inDrawer){bar.setAttribute('style','min-width:0; margin:0 0 8px;');modes.setAttribute('style','display:grid; grid-template-columns:minmax(0,1fr); gap:6px; margin-top:8px;');}
    for(const [mode,label] of [['family','Family / Personal'],['babysitter','Babysitter']]){
      const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent=label;button.setAttribute('aria-pressed',String(mode===selectedMode));
      if(inDrawer)button.setAttribute('style',`width:100%; min-height:44px; white-space:normal; background:${mode===selectedMode?'var(--lavender, #eee7f7)':'transparent'}; border:1px solid var(--line);`);
      button.onclick=async()=>{if(changingView)return;changingView=true;bar.querySelectorAll('button').forEach(b=>b.disabled=true);try{await MTMSync.switchMode(mode);await navigate(mode==='family'?'home':'babysitterHome');}catch(e){alert(e.message);bar.querySelectorAll('button').forEach(b=>b.disabled=false);}finally{changingView=false;}};modes.append(button);
    }
    if(inDrawer){document.getElementById('drawerNav')?.prepend(bar);return;}
    const householdTitle=document.createElement('p');householdTitle.textContent=s.householdName?`${selectedMode==='babysitter'?'Caring for':'Household'}: ${s.householdName}`:selectedMode==='babysitter'?'No parent-shared household selected.':'Create or join a personal household in Account and household.';bar.append(householdTitle);
    const buttons=document.createElement('div');buttons.className='btn-row';bar.append(buttons);
    for(const h of MTMSync.householdsForMode(list,selectedMode)){const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent=h.name;button.setAttribute('aria-pressed',String(h.id===s.householdId));
      button.onclick=async()=>{if(changingView)return;changingView=true;bar.querySelectorAll('button').forEach(b=>b.disabled=true);try{await MTMSync.switchHousehold(h.id);await navigate(selectedMode==='family'?'home':'babysitterHome');}catch(e){alert(e.message);bar.querySelectorAll('button').forEach(b=>b.disabled=false);}finally{changingView=false;}};buttons.append(button);}
    view.prepend(bar);
  }
  async function dailyCare(){
    const profiles=await getAll('profiles');
    modalBody.innerHTML=`<h2>Daily Care & Safety</h2><p>Instructions shared by the parent. View only.</p><label>Child<select id="sitterCareChild">${profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><div id="sitterCareDetails"></div><button id="closeSitterCare" class="btn">Done</button>`;
    const draw=async()=>{const care=await getDailyCare(document.querySelector('#sitterCareChild').value);document.querySelector('#sitterCareDetails').innerHTML=DAILY_CARE_FIELDS.map(([key,label])=>`<section><h3>${esc(label)}</h3><p style="white-space:pre-wrap">${esc(care[key]||'Not provided')}</p></section>`).join('');};
    document.querySelector('#sitterCareChild').onchange=draw;document.querySelector('#closeSitterCare').onclick=()=>modal.close();await draw();if(!modal.open)modal.showModal();
  }
  async function foodDiary(){
    const profiles=await getAll('profiles');
    view.innerHTML=`<section class="hero"><h1>Food Diary</h1><p>View the parent's saved foods, preferences, and reactions. Only household caregivers can change this diary.</p></section><div class="card"><label>Child<select id="sitterFoodChild">${profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label><label>Show foods<select id="sitterFoodFilter"><option value="all">All foods</option><option value="safe">Safe</option><option value="sometimes">Occasionally eats</option><option value="not">Absolutely not</option></select></label></div><div id="sitterFoodEntries"></div>`;
    const draw=async()=>{const id=document.querySelector('#sitterFoodChild').value,all=await getSetting(`foodDiary:${id}`,[]),filter=document.querySelector('#sitterFoodFilter').value,items=all.filter(x=>filter==='all'||x.category===filter);document.querySelector('#sitterFoodEntries').innerHTML=items.length?items.map(x=>`<div class="card"><h2>${esc(x.name||'Food')}</h2><p>${esc(({safe:'Safe',sometimes:'Occasionally eats',not:'Absolutely not'})[x.category]||x.category||'')} · ${esc(x.kind||'food')}</p>${x.response&&x.response!=='none'?`<p><strong>${esc(x.response)}</strong></p>`:''}<p>${esc(x.reactionDetails||'')}</p><p>${esc(x.notes||'')}</p>${x.date?`<p>${esc(x.date)}</p>`:''}</div>`).join(''):'<div class="card">No foods match this filter for this child.</div>';};
    document.querySelector('#sitterFoodChild').onchange=draw;document.querySelector('#sitterFoodFilter').onchange=draw;await draw();
  }
  async function babysitterHome(){
    const s=await MTMSync.state(),profiles=s.sharedProfileId==='*'?await getAll('profiles'):[];
    view.innerHTML=`<section class="hero"><h1>Babysitter care</h1><p>Your babysitter profile is free and separate from shared child access. Parents choose which children to share and when access ends.</p></section><div class="card"><h2>${esc(s.householdName||'Your shared households')}</h2>${s.accessExpiresAt?`<p>Shared access ends ${esc(new Date(s.accessExpiresAt).toLocaleString())}.</p>`:''}${s.sharedProfileId==='*'?`<label>Child for quick note<select id="sitterNoteChild">${profiles.map(p=>`<option value="${esc(p.id)}">${esc(p.name||'Child')}</option>`).join('')}</select></label>`:''}<div class="btn-row">${s.householdId?'<button class="btn" data-go="myDay">My Day</button><button class="btn" id="sitterNote">Add note</button><button class="btn" data-go="potty">Potty entries</button><button class="btn" data-go="vocabulary">Words and sentences</button><button class="btn" data-go="screenTime">Screen time</button><button class="btn secondary" data-go="food">View Food Diary</button><button class="btn secondary" id="sitterDailyCare">Daily Care &amp; Safety</button><button class="btn secondary" data-go="child">Child information</button>':''}<button class="btn secondary" data-go="sync">Accept invitation / account</button><button class="btn secondary" data-go="babysitters">My babysitter profile</button></div><p>Open Accounts &amp; Sync to switch families or return to your Family / Personal view. Notes and entries are saved only to the selected household. You can add and update words, sentences, and daily potty totals. You can add screen-time entries and view the Food Diary. You cannot change the Food Diary, edit other existing household information, or delete records.</p></div>`;
    if(document.querySelector('#sitterDailyCare'))document.querySelector('#sitterDailyCare').onclick=dailyCare;
    bindRouteButtons();
    document.getElementById('sitterNote')?.addEventListener('click',async()=>{
      const text=prompt('Note for the parent:');if(!text?.trim())return;
      try{await put('notes',{id:crypto.randomUUID(),profileId:s.sharedProfileId==='*'?document.getElementById('sitterNoteChild').value:s.sharedProfileId,kind:'dayEvent',label:'Babysitter note',emoji:'📝',category:'activity',notes:text.trim(),occurredAt:new Date().toISOString(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});alert('Note saved.');}catch(e){alert(e.message);}
    });
  }
  window.addEventListener('unhandledrejection',e=>{if(e.reason?.code==='MTM_ACCESS'){e.preventDefault();alert(e.reason.message);}});
  window.addEventListener('mtm:share-ended',()=>{
    verified=null;window.MTMOffline?.clear();
    if(typeof modal!=='undefined'&&modal.open)modal.close();
    if(typeof view!=='undefined')view.replaceChildren();
    navigate('babysitterHome');
  });
  return {isChangingView:()=>changingView,renderSwitcher,status,requireWrite,route,renderSubscription,renderExport,readonlyChrome,babysitterHome,foodDiary,dailyCare,invalidate:()=>{verified=null;}};
})();
