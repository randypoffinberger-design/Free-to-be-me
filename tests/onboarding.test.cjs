const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function harness(){
 const storage=new Map();let account={serverUrl:'https://api.example',token:'token',user:{id:'parent'},householdId:'family'};
 let access={canWrite:true,role:'owner',kind:'trial'};
 const window={};const context={window,MTMSync:{state:async()=>account,mode:()=>account.mode||'family'},MTMAccess:{status:async()=>access},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../onboarding.js'),'utf8'),context);
 return {onboarding:window.MTMOnboarding,setAccount:v=>{account={...account,...v}},setAccess:v=>{access={...access,...v}},storage};
}
test('onboarding starts for eligible trial owners and remains scoped to account, household, and server',async()=>{
 const h=harness();await h.onboarding.activated();assert.equal((await h.onboarding.progress()).started,true);
 h.setAccount({householdId:'other'});assert.deepEqual(Object.keys(await h.onboarding.progress()),[]);
 h.setAccount({householdId:'family',user:{id:'other'}});assert.deepEqual(Object.keys(await h.onboarding.progress()),[]);
 h.setAccount({user:{id:'parent'},serverUrl:'https://other.example'});assert.deepEqual(Object.keys(await h.onboarding.progress()),[]);
 h.setAccount({mode:'babysitter'});assert.equal(await h.onboarding.scope(),null);
});
test('expired sessions, paid accounts, and non-owner trials do not start onboarding',async()=>{
 for(const change of [{reauthRequired:true},{token:null}]){const h=harness();h.setAccount(change);await h.onboarding.activated();assert.equal(h.storage.size,0);}
 for(const change of [{kind:'paid'},{role:'viewer'},{canWrite:false}]){const h=harness();h.setAccess(change);await h.onboarding.activated();assert.equal(h.storage.size,0);}
});
test('completion requires useful saved content and cannot leak across a delayed household switch',async()=>{
 const h=harness();await h.onboarding.activated();const scope=await h.onboarding.scope();
 await h.onboarding.saved('profiles',{id:'child'},scope);assert.equal((await h.onboarding.progress()).completed,undefined);
 await h.onboarding.saved('settings',{id:'dailyCare:child',value:{updatedAt:'now',instructions:'  '}},scope);assert.equal((await h.onboarding.progress()).completed,undefined);
 await h.onboarding.saved('settings',{id:'sleep:routine:child',value:[{text:'Read a book'}]},scope);assert.equal((await h.onboarding.progress()).completed,true);
 h.setAccount({householdId:'other'});await h.onboarding.activated();await h.onboarding.saved('achievements',{title:'Win'},scope);assert.equal((await h.onboarding.progress()).completed,undefined);
});
test('onboarding script and styles participate in the same offline release as application integration',()=>{
 const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
 for(const file of ['onboarding.js','onboarding.css']){assert.ok(html.includes(file+'?v=0.10.1-onboarding-1'));assert.ok(worker.includes(file+'?v=0.10.1-onboarding-1'));}
 assert.ok(html.indexOf('onboarding.js?')<html.indexOf('app.js?'));
});
