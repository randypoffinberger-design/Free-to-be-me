const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
function harness({signedIn=true, verifyError, refreshError, refreshUser, changeAccount}={}) {
  let account = signedIn ? {token:'session',serverUrl:'https://server.test',user:{id:'parent',emailVerified:false},cursor:42} : {};
  const location = {href:'https://app.test/index.html?verify=email-token&invite=invitation#home'};
  const requests = [];
  const sync = {
    state:async()=>structuredClone(account), saveState:async value=>{account=value;},
    api:async(path,options)=>{
      requests.push({path,options});
      if(path.endsWith('/verify')) {if(verifyError)throw verifyError;return {ok:true,verified:true};}
      if(refreshError)throw refreshError;
      if(changeAccount)account={...account,token:'other-session',user:{id:'other'}};
      return {user:refreshUser||{id:'parent',emailVerified:true}};
    }
  };
  const context = vm.createContext({URL,location,history:{replaceState(_state,_title,url){location.href=new URL(url,location.href).href;}}});
  const source=read('sync.js');
  vm.runInContext(source.slice(source.indexOf('let emailVerificationNotice'),source.indexOf('function showEmailVerificationNotice')),context);
  return {run:()=>context.handleEmailVerification(sync),account:()=>account,location,requests,notice:()=>vm.runInContext('emailVerificationNotice',context)};
}
test('verification retains same-browser session and unrelated link parameters',async()=>{
  const h=harness();assert.equal(await h.run(),true);
  assert.equal(h.account().token,'session');assert.equal(h.account().cursor,42);assert.equal(h.account().user.emailVerified,true);
  assert.equal(new URL(h.location.href).searchParams.get('verify'),null);
  assert.equal(new URL(h.location.href).searchParams.get('invite'),'invitation');
  assert.equal(await h.run(),false);assert.equal(h.requests.length,2,'consumed token is not submitted again');
});
test('verification on another device asks for sign-in and never creates a session',async()=>{
  const h=harness({signedIn:false});assert.equal(await h.run(),true);
  assert.equal(h.account().token,undefined);assert.equal(h.requests.length,1);assert.match(h.notice().message,/Sign in to finish setup/);
});
test('account refresh failure preserves verification success and removes consumed token',async()=>{
  const h=harness({refreshError:new Error('Disconnected')});assert.equal(await h.run(),true);
  assert.match(h.notice().message,/Email verified/);assert.equal(h.notice().refresh,true);assert.equal(h.notice().error,undefined);
  assert.equal(new URL(h.location.href).searchParams.get('verify'),null);assert.equal(h.account().token,'session');
});
test('expired links are removed; uncertain connection failures retain the link for retry',async()=>{
  for(const error of [Object.assign(new Error('Expired'),{status:400}),new Error('Disconnected')]){
    const h=harness({verifyError:error});assert.equal(await h.run(),false);assert.equal(h.notice().error,true);
    assert.equal(new URL(h.location.href).searchParams.get('verify'),error.status===400?null:'email-token');assert.equal(h.account().user.emailVerified,false);
    assert.equal(h.notice().retry,error.status!==400);
    assert.match(h.notice().message,error.status===400?/request a new verification email/:/Check your connection/);
  }
});
test('verification refresh cannot overwrite another account or mark it verified',async()=>{
  const changed=harness({changeAccount:true});await changed.run();assert.equal(changed.account().user.id,'other');assert.equal(changed.account().token,'other-session');
  const other=harness({refreshUser:{id:'parent',emailVerified:false}});await other.run();assert.equal(other.account().user.emailVerified,false);assert.match(other.notice().message,/still needs its own verification/);
});
test('account links take priority over birthdays and arbitrary initial routes',()=>{
  const source=read('app.js'),context=vm.createContext({URL});
  vm.runInContext(source.slice(source.indexOf('function initialAppRoute'),source.indexOf('async function init()')),context);
  for(const param of ['verify','reset','invite'])assert.equal(context.initialAppRoute(`https://app.test/?${param}=token#products`,true),'sync');
  assert.equal(context.initialAppRoute('https://app.test/#sync',false),'sync');
  assert.equal(context.initialAppRoute('https://app.test/#child',true),'home');
});
test('navigation processes verification even when opening another screen in an existing app',async()=>{
  const source=read('app.js');const renders=[];
  const context=vm.createContext({URL,location:{href:'https://app.test/?verify=token#home'},window:{MTMAccess:{route:async r=>r}},routes:{home:async()=>renders.push('home'),sync:async()=>renders.push('sync')},routeStack:[],currentRoute:'home',profileAgeTimer:null,communityRefreshTimer:null,screenTimerInterval:null,applyRouteChrome(){},ANALYTICS_FEATURES:{},history:{replaceState(){}},closeDrawer(){},view:{focus(){}},console});
  context.window.MTMLayouts={isSaving:()=>false,dispose(){},mountExisting:async()=>{}};
  context.window.MTMAccess.readonlyChrome=async()=>{};
  context.navigate=()=>{};
  vm.runInContext(source.slice(source.indexOf('async function performNavigation'),source.indexOf('function navigate(')),context);
  await context.performNavigation('home');assert.deepEqual(renders,['sync']);assert.equal(context.currentRoute,'sync');
});
