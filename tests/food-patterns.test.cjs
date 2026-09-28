const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'..'),ctx=vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(root,'food-patterns.js'),'utf8'),ctx);
const {analyze,endTime}=ctx.window.MTMFoodPatterns;
const now=Date.parse('2026-09-20T12:00:00Z');
const meal=(day,foods=[{name:'Pizza',status:'eaten'}],profileId='child-a')=>({id:'meal-'+day,kind:'dayEvent',bubbleId:'meal',profileId,occurredAt:`2026-09-${String(day).padStart(2,'0')}T18:00:00Z`,foodItems:foods});
const response=(day,kind='meltdown',hour=19,profileId='child-a')=>({id:kind+'-'+day,kind:'dayEvent',bubbleId:kind,label:kind,category:kind==='sleep-difficulty'?'sleepOutcome':'behavior',outcome:true,profileId,occurredAt:`2026-09-${String(day).padStart(2,'0')}T${hour}:00:00Z`});
const pick=(events,kind='meltdown')=>analyze(events,'child-a',{now}).find(r=>r.kind===kind);
test('counts 4 of 6 consumed occasions, normalizes names, includes no-response occasions',()=>{
 const events=[1,2,3,4,5,6].map(d=>meal(d,[{name:d%2?' Pizza ':'pizza',status:'eaten'}])).concat([1,2,3,4].map(d=>response(d)));
 const r=pick(events);assert.equal(r.matches,4);assert.equal(r.total,6);assert.equal(r.repeated,true);
 assert.equal(r.occasions.filter(o=>!o.matches.length).length,2);
});
test('refusals, unknown consumption, legacy notes, future and other-child responses are excluded',()=>{
 const events=[meal(1),meal(2,[{name:'pizza',status:'not-eaten'}]),meal(3,[{name:'pizza',status:'unsure'}]),{...meal(4),foodItems:undefined,notes:'ate pizza'},response(1,'meltdown',19,'child-b'),{...meal(21)}];
 const r=pick(events);assert.equal(r.total,1);assert.equal(r.matches,0);assert.equal(r.refused,1);assert.equal(r.uncertain,1);
});
test('deduplicates a food within a meal, repeated event IDs and multiple responses per meal',()=>{
 const m=meal(1,[{name:'pizza',status:'eaten'},{name:' PIZZA ',status:'eaten'}]);
 const r=pick([m,m,response(1),{...response(1),id:'second',occurredAt:'2026-09-01T19:30:00Z'}]);
 assert.equal(r.total,1);assert.equal(r.matches,1);assert.equal(r.occasions[0].matches.length,2);
 assert.equal(pick([meal(1,[{name:'pizza',status:'eaten'},{name:'pizza',status:'not-eaten'}])]).total,0);
});
test('two-hour boundaries and pending windows do not turn missing future data into a negative',()=>{
 assert.equal(pick([meal(1),response(1,'meltdown',20)]).matches,1);
 assert.equal(pick([meal(1),response(1,'meltdown',21)]).matches,0);
 assert.equal(pick([meal(1),response(1,'meltdown',18)]).matches,0);
 const recent={...meal(19),occurredAt:'2026-09-20T11:00:00Z'};
 const r=pick([recent]);assert.equal(r.total,0);assert.equal(r.pending,1);
});
test('sleep window reaches overnight, respects following noon and caps at 24 hours',()=>{
 const t=new Date(2026,8,1,18).getTime();
 assert.equal(endTime(t,'sleep-difficulty'),new Date(2026,8,2,12).getTime());
 const morning=new Date(2026,8,1,8).getTime();assert.equal(endTime(morning,'sleep-difficulty')-morning,24*3600000);
 const m={...meal(1),occurredAt:new Date(t).toISOString()},r={...response(2,'sleep-difficulty'),occurredAt:new Date(2026,8,2,2).toISOString()};
 assert.equal(pick([m,r],'sleep-difficulty').matches,1);
});
test('custom bowel responses use chosen observation windows; ordinary health events are not inferred symptoms',()=>{
 const events=[1,2,3].flatMap(d=>[meal(d),{...response(d,'bowel',23),label:'Diarrhea',category:'response',responseWindowHours:6}]);
 const r=pick(events,'bowel@6');assert.equal(r.matches,3);assert.equal(r.hours,6);assert.equal(r.repeated,true);
 assert.equal(pick(events.map(e=>e.category==='response'?{...e,responseWindowHours:2}:e),'bowel@2').matches,0);
 assert.ok(!analyze([meal(1),{...response(1,'medicine'),category:'health',outcome:false}],'child-a',{now}).some(r=>r.kind==='medicine'));
});
test('multiple foods are separate associations; positive responses are supported',()=>{
 const events=[1,2,3].flatMap(d=>[meal(d,[{name:'pizza',status:'eaten'},{name:'milk',status:'eaten'}]),{...response(d,'regulated'),label:'Comfortable',category:'wellbeing'}]);
 const results=analyze(events,'child-a',{now}).filter(r=>r.kind==='regulated');assert.equal(results.length,2);assert.ok(results.every(r=>r.matches===3));
});
test('date range, minimum distinct days, edits and deletions recalculate instead of retaining alerts',()=>{
 const events=[1,2,3].flatMap(d=>[meal(d),response(d)]);assert.equal(pick(events).repeated,true);
 assert.equal(pick(events.filter(e=>e.id!=='meltdown-1'&&e.id!=='meltdown-2')).repeated,false);
 assert.equal(pick(events.map(e=>e.id==='meal-1'?{...e,foodItems:[{name:'pizza',status:'not-eaten'}]}:e)).total,2);
 assert.equal(analyze(events,'child-a',{now:now+40*86400000,days:30}).length,0);
 assert.ok(analyze(events,'child-a',{now:now+40*86400000,days:90}).length>0);
 assert.equal(pick([meal(1),{...meal(1),id:'b'},{...meal(1),id:'c'},response(1)]).repeated,false);
});
test('general My Day patterns retain custom symptom windows and separate children',()=>{
 const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const c=vm.createContext({dayEventTime:e=>new Date(e.occurredAt),localDayKey:d=>d.toISOString().slice(0,10)});
 vm.runInContext(app.slice(app.indexOf('function buildDayInsights('),app.indexOf('async function openDayEventForm(')),c);
 const events=[1,2,3,4,5,6,7].flatMap(d=>[
  {...meal(d),label:'Outing',category:'activity',outcome:false},
  {...response(d,'bowel',23),label:'Difficulty pooping',category:'response',responseWindowHours:6},
  {...meal(d),id:'b-'+d,profileId:'child-b',label:'Outing',category:'activity',outcome:false}
 ]);
 const r=c.buildDayInsights(events).insights[0];assert.equal(r.profileId,'child-a');assert.equal(r.total,7);assert.equal(r.matches,7);assert.equal(r.hours,6);
});

test('delayed symptoms include 12 and 24 hour boundaries but never later than one day',()=>{
 const m=meal(1), start=Date.parse(m.occurredAt);
 const symptom=h=>({...response(2,'bowel'),category:'response',occurredAt:new Date(start+h*3600000).toISOString()});
 assert.equal(pick([m,symptom(24)],'bowel@24').matches,1);
 assert.equal(pick([m,symptom(24.01)],'bowel@24').matches,0);
 assert.equal(pick([m,{...symptom(12),responseWindowHours:12}],'bowel@12').matches,1);
 assert.equal(pick([m,{...symptom(12.01),responseWindowHours:12}],'bowel@12').matches,0);
});
