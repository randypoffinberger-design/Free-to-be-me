const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const context=vm.createContext({window:{},alert:()=>{throw Error('unexpected alert');}});
vm.runInContext(fs.readFileSync(path.join(root,'modules.js'),'utf8'),context);
const modules=context.window.MTMModules;
vm.runInContext(fs.readFileSync(path.join(root,'module-layouts.js'),'utf8'),context);
const layouts=context.window.MTMLayouts;

test('layouts cap home at eight, deduplicate IDs, and reject incompatible versions',()=>{
  const home=layouts.normalize('home',{version:1,order:['sleep','sleep','missing',...modules.ids],hidden:[]});
  assert.equal(home.order.length,8);assert.equal(new Set(home.order).size,8);assert.ok(!home.order.includes('missing'));
  assert.throws(()=>layouts.normalize('home',{version:2,order:[]}));
  assert.deepEqual([...layouts.normalize('home',{version:1,order:[]}).order],[...modules.sections.home]);
});
test('layout visibility and order never modify module definitions or records',()=>{
  const defaults=layouts.normalize('sleep',null);
  const moved=layouts.move(defaults,'sleepRoutine','sleepWhy');
  assert.equal(moved.order[0],'sleepRoutine');assert.equal(defaults.order[0],'sleepWhy');
  const hidden=layouts.normalize('sleep',{...defaults,hidden:['sleepRoutine']});
  assert.ok(!hidden.order.includes('sleepRoutine'));assert.ok(hidden.hidden.includes('sleepRoutine'));
  const replacement=layouts.replace(layouts.normalize('home',null),'sleep','sleepRoutine');
  assert.equal(replacement.order.length,8);assert.ok(replacement.order.includes('sleepRoutine'));
  assert.throws(()=>layouts.replace(replacement,'sleepRoutine','caregiver'));
});
test('future profile scopes cannot collide with household scopes',()=>{
  assert.notEqual(layouts.key('home',{kind:'household',id:'child:a'}),layouts.key('home',{kind:'profile',id:'child:a'}));
  assert.notEqual(layouts.key('home',{kind:'household',id:'a:b'}),layouts.key('home',{kind:'household',id:'a%3Ab'}));
  assert.throws(()=>layouts.key('home',{kind:'unknown',id:'a'}));
});

test('all registered modules support both presentations with one stable identity',()=>{
  const ids=modules.ids;
  assert.equal(new Set(ids).size,95);
  for(const id of ids){
    const item=modules.get(id);
    assert.ok(Object.isFrozen(item));
    for(const presentation of ['card','bubble']){
      const html=modules.render(id,{presentation});
      assert.ok(html.includes(`data-module="${id}"`));
      assert.ok(html.includes(`module-${presentation}`));
      assert.ok(html.includes('type="button"'));
      assert.ok(html.includes('aria-label="Open '));
      assert.equal(/\bdata-go=/.test(html),false);
    }
  }
});
test('home defaults remain eight immutable destinations',()=>{
  assert.deepEqual([...modules.sections.home],['growth','communication','sleep','sensory','learning','medical','caregiver','community']);
  assert.ok(Object.isFrozen(modules.sections.home));
  assert.throws(()=>modules.sections.home.push('caregiverCalendar'));
  assert.equal((modules.renderSection('home',{presentation:'bubble'}).match(/data-module=/g)||[]).length,8);
});
test('card and bubble dispatch the same existing destination exactly once',async()=>{
  for(const id of modules.ids){
    for(const presentation of ['card','bubble']){
      modules.render(id,{presentation});
      const calls=[], button={dataset:{module:id}};
      const item=modules.get(id),actions={};
      if(item.destination.action)actions[item.destination.action]=()=>calls.push(item.destination.action);
      modules.bind({querySelectorAll:()=>[button]},{navigate:r=>calls.push(r),actions});
      await button.onclick();
      assert.deepEqual(calls,[item.destination.route||item.destination.action]);
    }
  }
});
test('unavailable or rejected actions report errors without a fallback navigation',async()=>{
  const errors=[], button={dataset:{module:'caregiverCalendar'}};
  modules.bind({querySelectorAll:()=>[button]},{navigate:()=>assert.fail(),onError:e=>errors.push(e.message)});
  await button.onclick();
  assert.deepEqual(errors,['This module is unavailable here.']);
  modules.bind({querySelectorAll:()=>[button]},{navigate:()=>assert.fail(),actions:{caregiverCalendar:async()=>{throw Error('access denied');}},onError:e=>errors.push(e.message)});
  await button.onclick();
  assert.equal(errors[1],'access denied');
});
test('dynamic descriptions are escaped and never change registry or compact labels',()=>{
  const html=modules.render('caregiverCalendar',{description:'<img onerror="bad"> & text'});
  assert.ok(html.includes('&lt;img onerror=&quot;bad&quot;&gt; &amp; text'));
  assert.ok(!modules.render('caregiverCalendar',{presentation:'bubble',description:'private count'}).includes('private count'));
  assert.equal(modules.get('caregiverCalendar').description,'');
});
test('unknown modules and presentations fail explicitly; children use existing stable IDs',()=>{
  assert.throws(()=>modules.get('missing'));
  assert.throws(()=>modules.render('caregiver',{presentation:'missing'}));
  assert.throws(()=>modules.renderSection('missing'));
  assert.deepEqual([...modules.get('caregiver').children],[...modules.sections.caregiver]);
});
test('new assets are in the offline cache and load before the application',()=>{
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  for(const file of ['modules.js','module-layouts.js','modules.css']){
    assert.ok(index.includes(`${file}?v=0.10.1-modules-1`));
    assert.ok(sw.includes(`${file}?v=0.10.1-modules-1`));
  }
  assert.ok(index.indexOf('modules.js?')<index.indexOf('app.js?'));
  assert.ok(sw.includes("const CACHE='mtm-production-v0.10.1-modules-1'"));
});


test('every catalog entry can replace a home slot without losing existing layouts',()=>{
  const saved={version:1,order:['caregiverCalendar','sleepRoutine',...modules.sections.home.slice(2)],hidden:[]};
  assert.deepEqual([...layouts.normalize('home',saved).order],saved.order);
  for(const id of modules.ids.filter(id=>id!=='village'&&!modules.sections.home.includes(id))){
    const next=layouts.replace(layouts.normalize('home',null),'sleep',id);
    assert.equal(next.order.length,8);assert.ok(next.order.includes(id));
  }
  assert.equal(modules.get('potty').destination.route,'potty');
  assert.equal(modules.get('vocabulary').destination.route,'vocabulary');
});
