const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const vm=require('node:vm');
const code=readFileSync(require('node:path').join(__dirname,'..','onboarding.js'),'utf8');
const flush=async()=>{for(let i=0;i<12;i++)await new Promise(setImmediate);};
function fixture({blocked=false,routeError=false,sendError=false}={}){
 const memory=new Map(),sent=[],elements=new Map();
 const node=()=>({onclick:null,addEventListener(){}});
 for(const id of ['#resumeFirstTask','#exploreWithoutOnboarding','#onboardingCreateProfile','#onboardingCancelProfile'])elements.set(id,node());
 const account={token:'token',user:{id:'u'},householdId:'h',serverUrl:'https://example.invalid'};
 const ctx={window:{},crypto:{randomUUID},AbortController,setTimeout,clearTimeout,alerts:[],currentRoute:'gettingStarted',view:{innerHTML:'',dataset:{},querySelectorAll:()=>[]},document:{querySelector:id=>elements.get(id)},modalBody:{innerHTML:''},modal:{open:false,showModal(){this.open=true;},close(){this.open=false;}},esc:x=>x,MTMSync:{state:async()=>account,mode:()=> 'family',api:async(path,options)=>{if(sendError)throw Error('network');sent.push(JSON.parse(options.body));}},MTMAccess:{status:async()=>({canWrite:true,role:'owner',kind:'trial'})},localStorage:{getItem:k=>{if(blocked)throw Error('blocked');return memory.get(k)||null;},setItem(k,v){if(blocked)throw Error('blocked');memory.set(k,v);}},getAll:async()=>[{id:'PRIVATE-CHILD'}],openAchievementForm(){},openBabysitterCareSheet:async()=>{},alert:message=>ctx.alerts.push(message)};
 ctx.navigate=async route=>{ctx.currentRoute=route;if(!routeError)ctx.view.dataset.renderedRoute=route;};
 vm.createContext(ctx);vm.runInContext(code,ctx);return {o:ctx.window.MTMOnboarding,ctx,account,sent,elements};
}
test('blocked storage still presents first choices during the current visit',async()=>{const {o}=fixture({blocked:true});await o.activated();assert.equal((await o.progress()).started,true);});
test('choice and free exploration emit distinct fixed events',async()=>{const {o,sent,elements}=fixture();await o.activated();await o.render();await elements.get('#exploreWithoutOnboarding').onclick();await flush();assert.deepEqual(sent.map(x=>x.event),['choices_shown','explore_selected']);});
test('selected task, local attempt and local success use one attempt ID, without entered data',async()=>{const {o,sent}=fixture();await o.activated();await o.begin('bedtime');const id=await o.scope();const attempt=await o.saveAttempt('settings',{id:'sleep:routine:PRIVATE-CHILD',value:[{text:'SECRET'}]},id);o.saveResult(attempt,'local_saved',id);await flush();assert.ok(sent.some(x=>x.event==='task_opened'));assert.equal(sent.find(x=>x.event==='save_attempted').attemptId,attempt.attemptId);assert.equal(sent.find(x=>x.event==='local_saved').attemptId,attempt.attemptId);assert.equal(JSON.stringify(sent).includes('SECRET'),false);assert.equal(JSON.stringify(sent).includes('PRIVATE-CHILD'),false);});
test('failed route does not claim task opened',async()=>{const {o,sent,ctx}=fixture({routeError:true});await o.activated();await o.begin('win');await flush();assert.ok(sent.some(x=>x.event==='launch_failed'));assert.ok(!sent.some(x=>x.event==='task_opened'));assert.equal(ctx.alerts.length,1);});
test('unrelated save is not attributed to selected task',async()=>{const {o}=fixture();await o.activated();await o.begin('win');assert.equal(await o.saveAttempt('settings',{id:'dailyCare:x'},await o.scope()),null);});
test('account switch drops outgoing event from old scope',async()=>{const {o,account,sent}=fixture();await o.activated();await o.begin('win');await flush();sent.length=0;const id=await o.scope();const a=await o.saveAttempt('achievements',{title:'SECRET'},id);account.user={id:'different'};o.saveResult(a,'local_saved',id);await flush();assert.ok(!sent.some(x=>x.event==='local_saved'));});
test('optional analytics failures do not block tasks',async()=>{const {o}=fixture({sendError:true});await o.activated();await o.begin('win');await flush();assert.equal((await o.progress()).task,'win');});
test('local success remains recorded when sync enqueue fails',async()=>{
 const app=readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');const start=app.indexOf('const put = async');const end=app.indexOf('const clearStore',start);const results=[];
 const transaction={objectStore:()=>({put(){queueMicrotask(()=>transaction.oncomplete());return {};}})};
 const ctx={window:{MTMAccess:{requireWrite:async()=>{}},MTMOnboarding:{scope:async()=> 'scope',saveAttempt:async()=>({attemptId:'attempt'}),saveResult:(a,e)=>results.push(e),saved:async()=>{}},MTMSync:{onLocalPut:async()=>{throw Error('outbox failed');}}},db:{transaction:()=>transaction},Error};
 vm.createContext(ctx);vm.runInContext(app.slice(start,end)+';globalThis.save=put;',ctx);await assert.rejects(ctx.save('profiles',{id:'p'}),/outbox failed/);assert.deepEqual(results,['local_saved','sync_queue_failed']);
});
test('validation blockage is recorded without field values',async()=>{const {o,sent}=fixture();await o.activated();await o.begin('win');o.validationBlocked('task');await flush();assert.ok(sent.some(x=>x.event==='validation_blocked'&&x.task==='win'));assert.ok(sent.every(x=>!Object.hasOwn(x,'message')));});
test('task save failure gives visible feedback without raw errors',async()=>{const {o,ctx}=fixture();await o.activated();await o.begin('win');const id=await o.scope();const attempt=await o.saveAttempt('achievements',{title:'private'},id);o.saveResult(attempt,'local_failed',id);await flush();assert.deepEqual(ctx.alerts,['This entry could not be saved. Please try again.']);});
test('task selection is still observed if access has expired',async()=>{const {o,ctx,sent}=fixture();await o.activated();ctx.MTMAccess.status=async()=>({canWrite:false,role:'owner'});await o.begin('win');await flush();assert.ok(sent.some(x=>x.event==='task_selected'));assert.ok(sent.some(x=>x.event==='access_blocked'));assert.ok(!sent.some(x=>x.event==='task_opened'));});

const sync=readFileSync(require('node:path').join(__dirname,'..','sync.js'),'utf8');
test('onboarding attempt survives the sync queue without copying child data into its metadata',async()=>{
 const queue=sync.slice(sync.indexOf('  async function queue('),sync.indexOf('  // Layout, outbox'));
 const onPut=sync.slice(sync.indexOf('  async function onLocalPut('),sync.indexOf('  async function onLocalDelete('));
 let stored;const context={state:async()=>({householdId:'h'}),rawGet:async()=>null,rawAll:async()=>[],rawPut:async(store,item)=>{stored=item;},uuid:()=> 'mutation-uuid',metaId:(s,id)=>s+':'+id,iso:()=> 'now',structuredClone,applyingRemote:false,syncable:()=>true,schedule(){}};
 vm.createContext(context);vm.runInContext(queue+onPut,context);const meta={attemptId:'attempt',task:'care',stage:'task'};
 await context.onLocalPut('settings',{id:'dailyCare:private-id',value:{calming:'PRIVATE'}},meta);
 assert.deepEqual(stored.onboarding,meta);assert.equal(JSON.stringify(stored.onboarding).includes('PRIVATE'),false);assert.equal(stored.payload.value.calming,'PRIVATE');
});
test('optional onboarding request cannot invalidate login and rejects a changed household',async()=>{
 const start=sync.indexOf('  async function api('),end=sync.indexOf('  async function recordConflict(',start);let fetches=0;let token='original';let householdId='h';
 const context={state:async()=>({token,householdId,serverUrl:'https://example.invalid'}),normalizeServerUrl:x=>x,defaultProductionServer:()=> 'https://example.invalid',switching:false,document:{visibilityState:'visible'},navigator:{onLine:true},window:{},fetch:async()=>{fetches++;return {ok:false,status:401,json:async()=>({error:'expired'})};},db:{transaction(){throw Error('Analytics must not mutate account state');}},Error};
 vm.createContext(context);vm.runInContext(sync.slice(start,end),context);
 await assert.rejects(context.api('/v1/analytics/onboarding',{usageToken:token,usageHouseholdId:'h'}),/expired/);assert.equal(fetches,1);
 householdId='other';await context.api('/v1/analytics/onboarding',{usageToken:token,usageHouseholdId:'h'});assert.equal(fetches,1);
});
