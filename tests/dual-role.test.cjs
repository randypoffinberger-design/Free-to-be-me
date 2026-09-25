const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const family={id:'personal',name:'My family',role:'owner'};
const shared={id:'shared',name:'Parent family',role:'babysitter',sharedProfileId:'child',accessExpiresAt:'2099-01-01'};

function harness({isBabysitter=false,households=[family],selected=family,activeMode,kind='paid'}={}){
  const stores=new Map(),events={},requests=[];
  const table=name=>{if(!stores.has(name))stores.set(name,new Map());return stores.get(name);};
  table('accountState').set('current',{id:'current',serverUrl:'https://example.test',token:'token-a',user:{id:'a',isBabysitter},localDataOwnerId:'a',householdId:selected?.id||null,householdName:selected?.name||null,householdRole:selected?.role||null,sharedProfileId:selected?.sharedProfileId||null,accessExpiresAt:selected?.accessExpiresAt||null,activeMode});
  const db={transaction(name){const tx={objectStore(){const t=table(name);const req=fn=>{const r={};queueMicrotask(()=>{r.result=structuredClone(fn());r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return r;};return {get:id=>req(()=>t.get(id)),getAll:()=>req(()=>[...t.values()]),put:value=>req(()=>{t.set(value.id,structuredClone(value));return value;}),delete:id=>req(()=>t.delete(id)),clear:()=>req(()=>t.clear())};}};return tx;}};
  class Element{
    constructor(tag){this.tag=tag;this.children=[];this.attributes={};this.textContent='';}
    append(e){this.children.push(e);e.parent=this;}
    prepend(e){this.children.unshift(e);e.parent=this;}
    replaceChildren(...children){this.children=children;}
    setAttribute(k,v){this.attributes[k]=v;}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
    querySelectorAll(selector){return this.children.flatMap(e=>[...(selector==='button'&&e.tag==='button'?[e]:[]),...e.querySelectorAll(selector)]);}
  }
  const view=new Element('main');
  const document={visibilityState:'visible',addEventListener(){},createElement:t=>new Element(t),getElementById:id=>view.children.find(e=>e.id===id),querySelector:()=>null};
  const navigator={onLine:true};
  let list=structuredClone(households),entitlementKind=kind;
  const window={addEventListener:(type,fn)=>events[type]=fn,dispatchEvent:e=>events[e.type]?.(e),MTMOffline:{clear(){},async read(){return null;},async accept(){}}};
  const context=vm.createContext({db,window,document,navigator,performance,structuredClone,AbortSignal,AbortController,crypto:require('node:crypto').webcrypto,CustomEvent:class{constructor(type){this.type=type;}},setInterval(){},setTimeout,clearTimeout,currentRoute:'home',view,modal:{open:false},alert(){},navigate:async route=>{context.currentRoute=await window.MTMAccess.route(route);},getAll:async name=>[...table(name).values()]});
  context.fetch=async(url,options)=>{
    requests.push({url,options});
    let data;
    if(url.endsWith('/v1/households'))data={households:list};
    else if(url.endsWith('/access')){const s=table('accountState').get('current');data={entitlement:{userId:s.user.id,householdId:s.householdId,enforced:true,role:s.householdRole,kind:entitlementKind,access:entitlementKind!=='expired',canWrite:entitlementKind!=='expired',serverTime:new Date().toISOString(),paidUntil:'2099-01-01',trialEndsAt:'2099-01-01'}};}
    else if(url.includes('/sync/pull'))data={changes:[],cursor:0,hasMore:false};
    else throw Error('Unexpected request '+url);
    return {ok:true,json:async()=>data};
  };
  vm.runInContext(read('sync.js'),context);context.MTMSync=window.MTMSync;
  vm.runInContext(read('access.js'),context);context.MTMAccess=window.MTMAccess;
  return {sync:window.MTMSync,access:window.MTMAccess,table,context,view,requests,navigator,setHouseholds:v=>list=v,setKind:v=>entitlementKind=v};
}

test('family-only paid/trial routing retains home, paid features and subscription',async()=>{
  for(const kind of ['paid','trial']){const h=harness({kind});for(const route of ['home','skills','subscription','backup','babysitters'])assert.equal(await h.access.route(route),route);assert.equal((await h.sync.state()).activeMode,'family');}
  const h=harness({kind:'expired'});assert.equal(await h.access.route('home'),'subscription');assert.equal(await h.access.route('subscription'),'subscription');
});
test('listing capability on a family account never changes its route or entitlement',async()=>{
  const h=harness();await h.access.route('home');const before=await h.sync.state();
  await h.sync.saveState({...before,user:{...before.user,isBabysitter:true}});
  assert.equal(await h.access.route('home'),'home');assert.equal(await h.access.route('subscription'),'subscription');assert.equal((await h.access.status()).kind,'paid');
});
test('legacy dual-role migration prefers personal household even when shared one was selected',async()=>{
  const h=harness({isBabysitter:true,households:[shared,family],selected:shared});
  assert.equal(await h.access.route('home'),'home');assert.equal((await h.sync.state()).householdId,'personal');
});
test('babysitter-only default, restricted routes, public listing and no household landing',async()=>{
  for(const selected of [null,shared]){
    const h=harness({isBabysitter:true,households:selected?[shared]:[],selected});
    for(const route of ['home','subscription','skills','backup'])assert.equal(await h.access.route(route),'babysitterHome');
    assert.equal(await h.access.route('babysitters'),'babysitters');
    assert.equal(await h.access.route('myDay'),selected?'myDay':'babysitterHome');
  }
});
test('temporary share works without a public listing; mode cannot bypass sitter restrictions',async()=>{
  const h=harness({households:[shared],selected:shared,activeMode:'family'});
  assert.equal(h.sync.mode(await h.sync.state()),'babysitter');
  assert.equal(await h.access.route('skills'),'babysitterHome');
  await assert.rejects(h.access.requireWrite('profiles','child',{id:'child'}),/Babysitters/);
  await h.access.requireWrite('notes','n',{id:'n',profileId:'child'});
  await assert.rejects(h.access.requireWrite('notes','n',{id:'n',profileId:'other'}),/Babysitters/);
  await assert.rejects(h.access.requireWrite('notes','n',{id:'n',profileId:'child'},true),/Babysitters/);
});
test('switching modes preserves separate household data and outboxes and restores personal entitlement',async()=>{
  const h=harness({isBabysitter:true,households:[shared,family],activeMode:'family'});
  h.table('profiles').set('mine',{id:'mine'});h.table('syncOutbox').set('pending',{id:'pending',entityType:'notes',entityId:'draft'});
  h.navigator.onLine=false;
  await h.sync.switchMode('babysitter');
  assert.equal((await h.sync.state()).householdId,'shared');assert.equal(h.table('profiles').size,0);assert.equal(h.table('syncOutbox').size,0);
  h.table('profiles').set('child',{id:'child'});
  await h.sync.switchMode('family');
  assert.equal((await h.sync.state()).householdId,'personal');assert.ok(h.table('profiles').has('mine'));assert.ok(!h.table('profiles').has('child'));assert.ok(h.table('syncOutbox').has('pending'));
  h.navigator.onLine=true;assert.equal(await h.access.route('home'),'home');assert.equal((await h.access.status()).role,'owner');
});
test('dual-role listing with no shares can enter babysitter mode without exposing personal data',async()=>{
  const h=harness({isBabysitter:true,activeMode:'family'});h.table('profiles').set('mine',{id:'mine'});
  await h.sync.switchMode('babysitter');const s=await h.sync.state();
  assert.equal(s.householdId,null);assert.equal(s.householdName,null);assert.equal(h.table('profiles').size,0);
  assert.equal(await h.access.route('home'),'babysitterHome');
  await h.sync.switchMode('family');assert.ok(h.table('profiles').has('mine'));assert.equal(await h.access.route('home'),'home');
});
test('sitter can choose family setup, then create/join a personal household',async()=>{
  const h=harness({isBabysitter:true,households:[shared],selected:shared,activeMode:'babysitter'});
  await h.sync.switchMode('family');assert.equal(await h.access.route('home'),'sync');assert.equal((await h.sync.state()).activeMode,'family');
  h.setHouseholds([shared,family]);await h.sync.switchHousehold('personal');assert.equal(await h.access.route('home'),'home');
  await h.sync.switchMode('babysitter');assert.equal((await h.sync.state()).householdId,'shared');
});
test('mode and household preferences do not leak on signout, login or direct account replacement',async()=>{
  const h=harness({isBabysitter:true,households:[shared,family],activeMode:'family'});
  await h.sync.switchMode('babysitter');await h.sync.signOutAccount();
  assert.equal((await h.sync.state()).activeMode,undefined);assert.equal(await h.access.route('babysitterHome'),'sync');
  await h.sync.activateAccount({token:'b',user:{id:'b',isBabysitter:false}});
  let s=await h.sync.state();assert.equal(s.activeMode,undefined);assert.equal(s.householdId,undefined);assert.equal(h.sync.mode(s),'family');
  await h.sync.activateAccount({token:'a2',user:{id:'a',isBabysitter:true}});
  s=await h.sync.state();assert.equal(s.activeMode,'babysitter');assert.equal(s.householdId,'shared');
  await h.sync.activateAccount({token:'c',user:{id:'c',isBabysitter:true}});s=await h.sync.state();assert.equal(s.activeMode,undefined);assert.equal(s.lastFamilyHouseholdId,undefined);
});
test('household choices are mode-specific and expired sitter shares are excluded',()=>{
  const h=harness();const expired={...shared,id:'expired',accessExpiresAt:'2000-01-01'};
  assert.deepEqual(Array.from(h.sync.householdsForMode([family,shared,expired],'family'),h=>h.id),['personal']);
  assert.deepEqual(Array.from(h.sync.householdsForMode([family,shared,expired],'babysitter'),h=>h.id),['shared']);
});
test('visible mode controls switch routing and household buttons exclude the opposite role',async()=>{
  const h=harness({isBabysitter:true,households:[family,shared],activeMode:'family'});
  h.context.currentRoute='sync';
  await h.access.renderSwitcher();let buttons=h.view.querySelectorAll('button');
  assert.deepEqual(buttons.map(b=>b.textContent),['Family / Personal','Babysitter','My family']);
  await buttons[1].onclick();assert.equal(h.context.currentRoute,'babysitterHome');
  h.context.currentRoute='sync';
  await h.access.renderSwitcher();buttons=h.view.querySelectorAll('button');
  assert.deepEqual(buttons.map(b=>b.textContent),['Family / Personal','Babysitter','Parent family']);
  await buttons[0].onclick();assert.equal(h.context.currentRoute,'home');
});
test('refresh retains selected mode; listing flag is never written by mode switches',async()=>{
  const h=harness({isBabysitter:true,households:[family,shared],activeMode:'family'});
  await h.sync.switchMode('babysitter');await h.sync.ensureMode();assert.equal((await h.sync.state()).activeMode,'babysitter');
  await h.sync.switchMode('family');assert.ok((await h.sync.state()).user.isBabysitter);
  assert.ok(!h.requests.some(r=>r.url.includes('babysitter-status')));
});

test('each mode remembers the most recently selected household',async()=>{
  const otherFamily={...family,id:'second-personal'},otherShare={...shared,id:'second-shared'};
  const h=harness({isBabysitter:true,households:[family,otherFamily,shared,otherShare],activeMode:'family'});
  await h.sync.switchHousehold(otherFamily.id);await h.sync.switchHousehold(otherShare.id);
  await h.sync.switchMode('family');assert.equal((await h.sync.state()).householdId,otherFamily.id);
  await h.sync.switchMode('babysitter');assert.equal((await h.sync.state()).householdId,otherShare.id);
});
test('expired shared access clears shared records while the personal vault survives',async()=>{
  const h=harness({isBabysitter:true,households:[family,shared],activeMode:'family'});
  h.table('profiles').set('mine',{id:'mine'});await h.sync.switchMode('babysitter');h.table('profiles').set('child',{id:'child'});
  const s=await h.sync.state();await h.sync.saveState({...s,accessExpiresAt:'2000-01-01'});
  assert.equal((await h.sync.state()).householdId,null);assert.ok(!h.table('profiles').has('child'));
  h.setHouseholds([family]);await h.sync.switchMode('family');assert.ok(h.table('profiles').has('mine'));
  assert.equal(await h.access.route('home'),'home');
});
test('failed switch preserves account mode and data, and releases the switching lock',async()=>{
  const h=harness({isBabysitter:true,activeMode:'family'});h.table('profiles').set('mine',{id:'mine'});
  const fetch=h.context.fetch;h.context.fetch=async()=>{throw Error('Offline');};
  await assert.rejects(h.sync.switchMode('babysitter'),/Offline/);
  assert.equal((await h.sync.state()).activeMode,'family');assert.ok(h.table('profiles').has('mine'));assert.equal(h.sync.isSwitching(),false);
  h.context.fetch=fetch;await h.sync.switchMode('babysitter');assert.equal((await h.sync.state()).activeMode,'babysitter');
});
test('an account change during mode discovery cannot apply the previous account selection',async()=>{
  const h=harness({isBabysitter:true,households:[family,shared],activeMode:'family'});
  const fetch=h.context.fetch;let release,entered;const started=new Promise(r=>entered=r);
  h.context.fetch=async(...args)=>{entered();await new Promise(r=>release=r);return fetch(...args);};
  const changing=h.sync.switchMode('babysitter');await started;
  await h.sync.activateAccount({token:'b',user:{id:'b',isBabysitter:false}});release();
  await assert.rejects(changing,/Account changed/);assert.equal((await h.sync.state()).user.id,'b');assert.equal((await h.sync.state()).activeMode,undefined);
});


test('mode and household switcher appears in Accounts & Sync and Babysitter home, never Family home',async()=>{
  const h=harness({isBabysitter:true,households:[family,shared],activeMode:'family'});
  h.context.currentRoute='sync';await h.access.renderSwitcher();assert.equal(h.view.children.length,1);
  for(const route of ['home','babysitters','child','subscription']){
    h.context.currentRoute=route;await h.access.renderSwitcher();assert.equal(h.view.children.length,0,route);
  }
  h.context.currentRoute='babysitterHome';await h.access.renderSwitcher();assert.equal(h.view.children.length,1);
  h.context.currentRoute='sync';await h.access.renderSwitcher();assert.equal(h.view.children.length,1);
});

test('Accounts mode switch suppresses refresh until destination navigation completes',async()=>{
  const h=harness({isBabysitter:true,households:[family,shared],selected:shared,activeMode:'babysitter'});
  h.context.currentRoute='sync';await h.access.renderSwitcher();
  let refreshReads=0;h.context.$=()=>{refreshReads++;throw Error('Refresh touched outgoing screen');};
  let release,entered;const started=new Promise(r=>entered=r);
  h.context.navigate=async route=>{entered();await new Promise(r=>release=r);h.context.currentRoute=route;};
  const click=h.view.children[0].querySelectorAll('button')[0].onclick();
  await started;assert.equal(h.access.isChangingView(),true);
  await h.context.refreshSyncCenter();assert.equal(refreshReads,0);
  release();await click;assert.equal(h.context.currentRoute,'home');assert.equal(h.access.isChangingView(),false);
  assert.equal((await h.sync.state()).householdId,'personal');
});

test('delayed Accounts refresh cannot rebuild a screen after switching modes',async()=>{
  const h=harness({isBabysitter:true,households:[family,shared],selected:shared,activeMode:'babysitter'});
  h.context.currentRoute='sync';
  const nodes={'#syncStatus':{},'#syncDecisionsTitle':{},'#syncDecisions':{},'#activeHousehold':{options:[{value:'shared'}]}};
  h.context.$=id=>nodes[id];h.context.syncConflictMarkup=()=>'';
  let rebuilt=0;h.context.renderSyncCenter=async()=>rebuilt++;
  const fetch=h.context.fetch;let release,entered;const started=new Promise(r=>entered=r);
  h.context.fetch=async(...args)=>{entered();await new Promise(r=>release=r);return fetch(...args);};
  const refreshing=h.context.refreshSyncCenter();await started;
  const s=await h.sync.state();await h.sync.saveState({...s,activeMode:'family',householdId:'personal',householdRole:'owner'});
  h.context.currentRoute='home';release();await refreshing;
  assert.equal(rebuilt,0);assert.equal(nodes['#syncStatus'].textContent,undefined);
});

test('hamburger menu puts mode buttons first and switches from either view',async()=>{
  const h=harness({isBabysitter:true,households:[family,shared],activeMode:'family'});
  const drawer=new h.view.constructor('nav'),existing=new h.view.constructor('button');drawer.append(existing);
  const lookup=h.context.document.getElementById;
  h.context.document.getElementById=id=>id==='drawerNav'?drawer:drawer.children.find(e=>e.id===id)||lookup(id);
  await h.access.renderSwitcher(true);
  assert.equal(drawer.children[0].tag,'section');assert.equal(drawer.children[0].id,'drawerModeSwitch');assert.equal(drawer.children[1],existing);
  assert.equal(h.view.children.length,0);
  let buttons=drawer.children[0].querySelectorAll('button');assert.equal(buttons.length,2);
  await buttons[1].onclick();assert.equal(h.context.currentRoute,'babysitterHome');
  await h.access.renderSwitcher(true);assert.equal(drawer.children.length,2);
  buttons=drawer.children[0].querySelectorAll('button');assert.equal(buttons[1].attributes['aria-pressed'],'true');
  await buttons[0].onclick();assert.equal(h.context.currentRoute,'home');
  await h.sync.signOutAccount();await h.access.renderSwitcher(true);assert.equal(drawer.children.length,1);
});
