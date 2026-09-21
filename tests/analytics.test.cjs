const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const origin = 'https://randypoffinberger-design.github.io';
const state = {serverUrl:'https://api.serenityvalleyworks.com/mtm',user:{id:'private-user'},householdId:'private-family',token:'secret'};
function harness(overrides={}) {
  const messages=[],storage=new Map(),listeners={},frame={contentWindow:{postMessage:m=>messages.push(m)}};
  const window={addEventListener:(name,fn)=>listeners[name]=fn};
  const context={window,location:{origin,pathname:'/Free-to-be-me/'},document:{createElement:()=>frame,body:{append(){}}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},Map,Set,URL,Date,setTimeout:fn=>{fn();},...overrides};
  vm.runInNewContext(fs.readFileSync(path.join(root,'analytics.js'),'utf8'),context);
  listeners.message?.({source:frame.contentWindow,origin,data:'mtm-analytics-ready'});
  return {window,messages,storage,response:window.MTMAnalytics.response};
}
test('signup and successful trial are counted once; payload excludes account and family data',()=>{
  const h=harness();
  for(let i=0;i<2;i++) {
    h.response('/v1/auth/register',{method:'POST'},{user:{id:'private-user',email:'private@example.test'}},state);
    h.response('/v1/households/private-family/trial',{method:'POST'},{entitlement:{kind:'trial',trialEndsAt:'2026-10-01'}},state);
  }
  h.response('/v1/auth/login',{method:'POST'},{user:state.user},state);
  h.response('/v1/households/private-family/trial',{method:'POST'},{entitlement:{kind:'complimentary'}},state);
  assert.deepEqual(h.messages.map(m=>m.name),['sign_up','trial_start']);
  assert.doesNotMatch(JSON.stringify(h.messages),/private|secret|email.*@/);
});
test('checkout starts only after success, ignores sandbox, and purchase requires a verified receipt',async()=>{
  const h=harness();
  const opts={method:'POST',body:JSON.stringify({plan:'monthly'})};
  const checkout={url:'https://checkout.stripe.com/c/pay/cs_live_abc',checkoutId:'cs_live_abc',livemode:true};
  await h.response('/v1/households/private-family/billing/checkout',opts,checkout,state);
  await h.response('/v1/households/private-family/billing/checkout',opts,checkout,state);
  assert.equal(h.messages.length,1);
  let receipt={status:'pending',purchase:null},calls=0;
  h.window.MTMSync={state:async()=>state,api:async()=>{calls++;return receipt;}};
  const tick=()=>new Promise(r=>setImmediate(r));
  h.response('/v1/households/private-family/access',{}, {entitlement:{kind:'paid'}},state);await tick();
  assert.equal(h.messages.length,1,'paid access alone cannot establish a purchase');
  receipt={status:'paid',purchase:{transaction_id:'in_abc',currency:'USD',value:12.99,plan:'monthly'}};
  h.response('/v1/households/private-family/access',{}, {},state);await tick();
  h.response('/v1/households/private-family/access',{}, {},state);await tick();
  assert.deepEqual(h.messages.map(m=>m.name),['begin_checkout','purchase']);assert.equal(calls,2);
  assert.equal(h.messages[1].params.transaction_id,'in_abc');
  await h.response('/v1/households/private-family/billing/checkout',opts,{...checkout,checkoutId:'cs_test_abc',livemode:false},state);
  assert.equal(h.messages.length,2);
});
test('account switch during receipt lookup never attributes another account purchase',async()=>{
  const h=harness();await h.response('/v1/households/private-family/billing/checkout',{method:'POST',body:'{"plan":"yearly"}'},{url:'https://checkout.stripe.com/c/pay',checkoutId:'cs_live_def'},state);
  h.window.MTMSync={state:async()=>({...state,user:{id:'different'}}),api:async()=>({purchase:{transaction_id:'in_def',currency:'USD',value:99.99,plan:'yearly'}})};
  h.response('/v1/households/private-family/access',{}, {},state);
  await new Promise(r=>setImmediate(r));assert.deepEqual(h.messages.map(m=>m.name),['begin_checkout']);
});
test('storage denial, blocked frame, custom server and native builds cannot break the app',()=>{
  const h=harness({localStorage:{getItem(){throw Error();},setItem(){throw Error();}}});
  assert.doesNotThrow(()=>h.response('/v1/auth/register',{method:'POST'},{user:state.user},state));
  h.response('/v1/auth/register',{method:'POST'},{user:{id:'other'}},{...state,serverUrl:'http://localhost:8788'});
  assert.equal(h.messages.length,1);
  const native=harness({location:{origin:'https://localhost',pathname:'/'}});
  native.response('/v1/auth/register',{method:'POST'},{user:state.user},state);assert.equal(native.messages.length,0);
});
test('isolated Google frame rejects foreign messages and allowlists all outgoing parameters',()=>{
  let handler;const parent={postMessage(){}},window={parent,addEventListener:(n,fn)=>handler=fn};
  vm.runInNewContext(fs.readFileSync(path.join(root,'analytics-frame.js'),'utf8'),{window,location:{origin},document:{createElement:()=>({}),head:{append(){}}},Date});
  const message={source:parent,origin,data:{type:'mtm-conversion',name:'sign_up',params:{email:'secret@example.test',page_location:'https://private/?reset=secret'}}};
  handler({...message,origin:'https://attacker.test'});assert.equal(window.dataLayer.length,2);
  handler(message);assert.equal(window.dataLayer.length,3);
  assert.doesNotMatch(JSON.stringify(window.dataLayer),/secret|reset/);
  assert.equal(window.dataLayer[1][2].send_page_view,false);
});
