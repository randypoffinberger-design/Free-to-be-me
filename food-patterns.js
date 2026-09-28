"use strict";
window.MTMFoodPatterns = (() => {
  const HOUR = 3600000;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
  const statuses = {'eaten':'Ate/drank some', 'not-eaten':'Didn’t eat/drink it', 'unsure':'Not sure'};
  const dateKey = time => { const d = new Date(time); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
  function endTime(time, kind, hours = 2) {
    if (kind !== 'sleep-difficulty') return time + hours * HOUR;
    const noon = new Date(time); noon.setDate(noon.getDate() + 1); noon.setHours(12,0,0,0);
    return Math.min(noon.getTime(), time + 24 * HOUR);
  }
  function analyze(events, profileId, {now = Date.now(), days = 30} = {}) {
    if (!profileId || ![30,90].includes(days)) return [];
    const unique = [...new Map(events.filter(e=>e?.id && e.kind==='dayEvent' && e.profileId===profileId).map(e=>[e.id,e])).values()];
    const valid = unique.filter(e=>Number.isFinite(Date.parse(e.occurredAt)) && Date.parse(e.occurredAt)<=now);
    const meals = valid.filter(e=>e.bubbleId==='meal' && Array.isArray(e.foodItems) && Date.parse(e.occurredAt)>=now-days*24*HOUR);
    const groups = new Map();
    for (const meal of meals) {
      const foods = new Map();
      for (const food of meal.foodItems) {
        const key = normalize(food.name);
        if (!key || !statuses[food.status]) continue;
        // Reject conflicting duplicate food rows instead of guessing consumption.
        if (foods.has(key) && foods.get(key).status !== food.status) foods.set(key,{...food,status:'unsure'});
        else if (!foods.has(key)) foods.set(key,food);
      }
      for (const [key,food] of foods) {
        if (!groups.has(key)) groups.set(key,{key,name:food.name.trim(),eaten:[],refused:0,uncertain:0});
        const group=groups.get(key);
        if (food.status==='eaten') group.eaten.push(meal);
        else if (food.status==='not-eaten') group.refused++;
        else group.uncertain++;
      }
    }
    const outcomes = new Map([['meltdown',{label:'Meltdown',sleep:false,hours:2}],['sleep-difficulty',{label:'Trouble sleeping',sleep:true,hours:24}]]);
    const responseHours=e=>[2,6,12,24].includes(Number(e.responseWindowHours))?Number(e.responseWindowHours):(e.category==='response'?24:2);
    const outcomeKey=e=>(e.bubbleId || normalize(e.label))+(e.category==='response'?'@'+responseHours(e):'');
    for(const e of valid) if(e.outcome || ['behavior','sleepOutcome','response'].includes(e.category)) outcomes.set(outcomeKey(e),{label:e.label,sleep:e.category==='sleepOutcome',hours:responseHours(e)});
    const results=[];
    for (const group of groups.values()) for (const [kind, outcome] of outcomes) {
      const occasions=group.eaten.map(meal=>{
        const start=Date.parse(meal.occurredAt), end=endTime(start,outcome.sleep?'sleep-difficulty':'response',outcome.hours);
        return {meal,end,pending:end>now,matches:valid.filter(e=>outcomeKey(e)===kind && (e.outcome || ['behavior','sleepOutcome','response'].includes(e.category)) && Date.parse(e.occurredAt)>start && Date.parse(e.occurredAt)<=end)};
      }).sort((a,b)=>Date.parse(b.meal.occurredAt)-Date.parse(a.meal.occurredAt));
      const complete=occasions.filter(o=>!o.pending), matches=complete.filter(o=>o.matches.length);
      const distinctOutcomes=new Set(matches.flatMap(o=>o.matches.map(e=>e.id)));
      const distinctDays=new Set(complete.map(o=>dateKey(o.meal.occurredAt)));
      results.push({...group,kind,outcomeLabel:outcome.label,sleep:outcome.sleep,hours:outcome.hours,occasions,total:complete.length,matches:matches.length,pending:occasions.length-complete.length,
        repeated:complete.length>=3 && distinctDays.size>=3 && matches.length>=2 && distinctOutcomes.size>=2});
    }
    return results.sort((a,b)=>Number(b.repeated)-Number(a.repeated) || b.matches-a.matches || a.name.localeCompare(b.name));
  }
  function timeline(items) {
    return Array.isArray(items) ? items.map(f=>`${f.name}: ${statuses[f.status] || 'Not sure'}${f.amount ? ` (${f.amount})` : ''}`).join('; ') : '';
  }
  function editor(host, initial, events, getProfile) {
    const list=document.createElement('div');list.className='food-entry-list';
    const heading=document.createElement('h3');heading.textContent='What was offered?';
    const hint=document.createElement('p');hint.className='hint';hint.textContent='Add each food or drink separately and say whether any was eaten. Use the same name each time; notes are not used to guess foods.';
    const suggestions=document.createElement('datalist');suggestions.id='meal-food-suggestions';
    const updateSuggestions=()=>{const names=new Map();for(const event of events.filter(e=>e.profileId===getProfile())) for(const f of event.foodItems||[]) if(normalize(f.name)) names.set(normalize(f.name),f.name);suggestions.replaceChildren(...[...names.values()].sort().map(name=>{const o=document.createElement('option');o.value=name;return o;}));};
    host.append(heading,hint,list,suggestions);
    function add(value={}) {
      const row=document.createElement('fieldset');row.className='card food-entry-row';
      row.innerHTML=`<legend>Food or drink</legend><div class="field"><label>Name <input class="meal-food-name" list="meal-food-suggestions" maxlength="100" placeholder="Pizza" value="${escape(value.name)}"></label></div><div class="field"><label>Did they eat or drink it? <select class="meal-food-status"><option value="">Choose…</option>${Object.entries(statuses).map(([id,label])=>`<option value="${id}" ${value.status===id?'selected':''}>${escape(label)}</option>`).join('')}</select></label></div><div class="field"><label>Amount (optional) <input class="meal-food-amount" maxlength="100" placeholder="A few bites, one slice…" value="${escape(value.amount)}"></label></div><button class="small-action remove-meal-food" type="button">Remove this food</button>`;
      row.querySelector('button').onclick=()=>row.remove();list.append(row);
    }
    const addButton=document.createElement('button');addButton.type='button';addButton.className='btn secondary';addButton.textContent='Add another food or drink';addButton.onclick=()=>{add();list.lastElementChild.querySelector('input').focus();};host.append(addButton);
    (Array.isArray(initial)&&initial.length?initial:[{}]).forEach(add);updateSuggestions();
    return {updateSuggestions,read(){
      const rows=[...list.children],seen=new Set();
      if(!rows.length)throw new Error('Add at least one food or drink.');
      return rows.map(row=>{
        const name=row.querySelector('.meal-food-name').value.trim().replace(/\s+/g,' '),status=row.querySelector('select').value,amount=row.querySelector('.meal-food-amount').value.trim();
        if(!name || !statuses[status])throw new Error('Enter a food name and choose whether it was eaten for every row.');
        const key=normalize(name);if(seen.has(key))throw new Error('List each food only once in this meal.');seen.add(key);
        return {name,status,amount};
      });
    }};
  }
  function mountReport(host, events, profiles, selectedProfile, showDetail) {
    const profileId=selectedProfile==='all'?(profiles.length===1?profiles[0].id:null):selectedProfile;
    host.innerHTML='<h2 class="section-title">Food & responses</h2>';
    if(!profileId){host.insertAdjacentHTML('beforeend','<div class="card"><p>Choose one child above to see their food patterns. Children’s records are never combined here.</p></div>');return;}
    const controls=document.createElement('label');controls.textContent='Look back: ';
    const select=document.createElement('select');select.innerHTML='<option value="30">Last 30 days</option><option value="90">Last 90 days</option>';controls.append(select);host.append(controls);
    const content=document.createElement('div');host.append(content);
    const draw=()=>{
      const results=analyze(events,profileId,{days:Number(select.value)}), repeated=results.filter(r=>r.repeated);
      const profile=profiles.find(p=>p.id===profileId);
      content.innerHTML=`<p class="hint">For ${escape(profile?.name || 'this child')}. Independent of the timeline’s selected day. Responses: within 2 hours, or the window chosen for a custom symptom/response. Sleep difficulties: after the meal through the following noon, capped at 24 hours.</p><p class="hint">Only confirmed eating counts. Meals whose observation window is still open are pending. A repeated pattern requires at least 3 completed occasions on 3 different days and 2 distinct response entries.</p>${repeated.length?'':'<div class="card"><p>No repeated food pattern meets those criteria yet. Use Meal or snack to record foods, then log responses at the time they happen. Use existing response bubbles or create a custom symptom or response bubble. Earlier entries without food details are not counted; you can edit them to add confirmed information.</p></div>'}<div class="food-pattern-cards"></div><p class="hint">These are recorded timing associations, not proof of a cause or a diagnosis. No response recorded does not mean no response happened. Several foods or meals can precede the same event; review sleep, illness, activities and other context too.</p>`;
      const cards=content.querySelector('.food-pattern-cards');
      for (const result of results.filter(r=>r.occasions.length)) {
        const card=document.createElement('div');card.className='card pattern-card';
        const outcome=result.outcomeLabel;
        card.innerHTML=`<strong>${result.repeated?'Possible pattern':'Tracking'}: ${escape(result.name)} and ${escape(outcome.toLowerCase())}</strong><p>${escape(outcome)} was logged after ${result.matches} of ${result.total} completed eating occasions${result.sleep?' in the sleep window':` within ${result.hours} hours`}.</p><p class="hint">${result.pending} pending · ${result.refused} not eaten · ${result.uncertain} unsure (excluded)</p><button type="button" class="small-action">View occasions and context</button>`;
        card.querySelector('button').onclick=()=>showDetail(result,events.filter(e=>e.profileId===profileId));cards.append(card);
      }
    };
    select.onchange=draw;draw();
  }
  return Object.freeze({normalize,endTime,analyze,timeline,editor,mountReport});
})();
