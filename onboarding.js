/* Device-only progress is scoped to the account, server and household. */
window.MTMOnboarding = (() => {
  let homeObserver = null;
  const progressMemory=new Map();
  const tasks = {
    bedtime: { title: 'Build a bedtime routine', description: 'Save a familiar sequence that helps your child know what comes next.', reason: 'A child profile keeps this routine connected to the right child.', route: 'sleepRoutine' },
    win: { title: 'Record a small win', description: 'Keep one moment of progress you want to remember.', reason: 'A child profile keeps this win in the right child\'s growth journey.', route: 'child' },
    care: { title: 'Prepare caregiver information', description: 'Save care instructions and prepare a sheet to share with a babysitter.', reason: 'A child profile keeps care instructions connected to the right child.', route: 'caregiver' }
  };
  async function scope() {
    const s = await MTMSync.state();
    if (!s.token || !s.user || s.reauthRequired || !s.householdId || MTMSync.mode(s) !== 'family') return null;
    return JSON.stringify([s.serverUrl, s.user.id, s.householdId]);
  }
  const key = id => `mtm-onboarding-v1:${id}`;
  function read(id) {
    if(progressMemory.has(id))return progressMemory.get(id);
    try { const value=localStorage.getItem(key(id)); return value?JSON.parse(value):(progressMemory.get(id)||{}); } catch { return progressMemory.get(id)||{}; }
  }
  async function update(id, value) {
    if (!id || await scope() !== id) return;
    const next={...read(id),...value};progressMemory.set(id,next);
    try { localStorage.setItem(key(id), JSON.stringify(next));progressMemory.delete(id); } catch { /* Storage may be unavailable; the task remains usable. */ }
  }
  function track(event,task='',stage='choice',id=null,attemptId){
    void (async()=>{
      if(!id||await scope()!==id)return;
      const account=await MTMSync.state();
      if(await scope()!==id)return;
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
      try{await MTMSync.api('/v1/analytics/onboarding',{method:'POST',signal:controller.signal,usageToken:account.token,usageHouseholdId:account.householdId,
        body:JSON.stringify({eventId:crypto.randomUUID(),householdId:account.householdId,event,task,stage,...(attemptId?{attemptId}:{})})});}
      finally{clearTimeout(timer);}
    })().catch(()=>{});
  }
  async function saveAttempt(store,value,id){
    if(!id||await scope()!==id)return null;
    const state=read(id);
    if(!state.started||state.completed||state.dismissed||!tasks[state.task])return null;
    const stage=store==='profiles'?'profile':
      state.task==='win'&&store==='achievements'||state.task==='bedtime'&&store==='settings'&&/^sleep:routine:/.test(value.id)||state.task==='care'&&store==='settings'&&/^dailyCare:/.test(value.id)?'task':null;
    if(!stage)return null;
    const attempt={attemptId:crypto.randomUUID(),task:state.task,stage};
    track('save_attempted',attempt.task,stage,id,attempt.attemptId);
    return attempt;
  }
  function validationBlocked(stage){
    void (async()=>{const id=await scope();if(!id)return;const state=read(id);if(state.started&&!state.completed&&!state.dismissed&&tasks[state.task])track('validation_blocked',state.task,stage,id);})().catch(()=>{});
  }
  function saveResult(attempt,event,id){
    if(!attempt)return;
    track(event,attempt.task,attempt.stage,id,attempt.attemptId);
    if(attempt.stage==='task'&&['local_failed','sync_queue_failed'].includes(event))void (async()=>{
      if(await scope()!==id)return;
      alert(event==='local_failed'?'This entry could not be saved. Please try again.':'Saved on this device, but sync could not be prepared. Please contact support if this continues.');
    })().catch(()=>{});
  }
  function syncResult(attempt,status,account){
    const id=JSON.stringify([account.serverUrl,account.user?.id,account.householdId]);
    saveResult(attempt,status==='conflict'?'sync_conflict':'sync_denied',id);
  }
  async function activated() {
    const id = await scope();
    if (!id) return;
    const s = await MTMAccess.status(true);
    if (s.canWrite && s.role === 'owner' && s.kind === 'trial' && !read(id).completed && !read(id).dismissed) await update(id, { started: true });
  }
  async function progress() {
    const id = await scope();
    return id ? read(id) : {};
  }
  async function launch(taskId, id, profileId) {
    if (await scope() !== id) return;
    const task = tasks[taskId];
    if (!task) return;
    await navigate(task.route);
    if (await scope() !== id) return;
    if(currentRoute!==task.route)throw new Error('Task navigation did not reach its destination.');
    if(view.dataset.renderedRoute!==task.route)throw new Error('Task route did not render.');
    if (taskId === 'win') {
      const profiles = await getAll('profiles');
      openAchievementForm(profiles);
      if (profileId) document.querySelector('#aProfile').value = profileId;
    } else if (taskId === 'care') {
      await openBabysitterCareSheet(profileId);
    } else if (profileId && document.querySelector('#sleepProfile')) {
      const select = document.querySelector('#sleepProfile');
      select.value = profileId;
      await select.onchange({ target: select });
    }
    track('task_opened',taskId,'task',id);
  }
  async function begin(taskId) {
    const task = tasks[taskId], id = await scope();
    if (!task || !id) return;
    track('task_selected',taskId,'choice',id);
    const access = await MTMAccess.status(true);
    if (!access.canWrite || !['owner', 'caregiver'].includes(access.role)){track('access_blocked',taskId,'task',id);return navigate('subscription');}
    await update(id, { started: true, task: taskId, dismissed: false });
    const profiles = await getAll('profiles');
    if (profiles.length) return safeLaunch(taskId,id);
    track('profile_prompt_shown',taskId,'profile',id);
    return requestProfile(task.title,task.reason,profile=>safeLaunch(taskId,id,profile.id),{id,taskId});
  }
  async function safeLaunch(taskId,id,profileId){
    try{await launch(taskId,id,profileId);}catch{track('launch_failed',taskId,'task',id);alert('Could not open your first task. Please try again from Home.');}
  }
  function requestProfile(title, reason, resume, context=null) {
    modalBody.innerHTML = `<h2>${esc(title)}</h2><p>${esc(reason)} Start with your child's name; other details can be added later.</p><div class="btn-row"><button id="onboardingCreateProfile" class="btn" type="button">Create child profile</button><button id="onboardingCancelProfile" class="btn secondary" type="button">Not now</button></div>`;
    if (!modal.open) modal.showModal();
    document.querySelector('#onboardingCreateProfile').onclick = () => {if(context)track('profile_form_opened',context.taskId,'profile',context.id);openProfileForm(null, { onSaved: resume,onCancelled:()=>{if(context)track('profile_cancelled',context.taskId,'profile',context.id);} });};
    document.querySelector('#onboardingCancelProfile').onclick = () => {if(context)track('profile_cancelled',context.taskId,'profile',context.id);modal.close();};
  }
  async function render() {
    const id = await scope(), state = id ? read(id) : {};
    view.innerHTML = `<section class="hero"><h1>What would help today?</h1><p>Choose one thing that would make today a little easier.</p></section>${tasks[state.task] && !state.completed ? `<section class="onboarding-next"><h2>Continue your first task</h2><button class="btn" id="resumeFirstTask" type="button">${esc(tasks[state.task].title)}</button></section>` : ''}<div class="grid onboarding-choices">${Object.entries(tasks).map(([taskId, task]) => `<button class="card-button" type="button" data-first-task="${taskId}"><strong>${esc(task.title)}</strong><small>${esc(task.description)}</small></button>`).join('')}</div><div class="btn-row"><button class="btn secondary" id="exploreWithoutOnboarding" type="button">Explore on my own</button></div>`;
    track('choices_shown','','choice',id);
    view.querySelectorAll('[data-first-task]').forEach(button => button.onclick = () => begin(button.dataset.firstTask));
    document.querySelector('#resumeFirstTask')?.addEventListener('click', () => begin(state.task));
    document.querySelector('#exploreWithoutOnboarding').onclick = async () => { track('explore_selected','','choice',id); await update(id, { dismissed: true, task: null }); await navigate('home'); };
  }
  async function decorate(route) {
    homeObserver?.disconnect();
    homeObserver = null;
    if (!['home', 'caregiver'].includes(route)) return;
    const id = await scope();
    if (!id) return;
    const state = read(id), access = await MTMAccess.status();
    if (!access.canWrite || !['owner', 'caregiver'].includes(access.role) || state.completed || state.dismissed) return;
    if (!state.started && (access.kind !== 'trial' || (await getAll('profiles')).length)) return;
    if (await scope() !== id || currentRoute !== route) return;
    if (route === 'caregiver') {
      const account = await MTMSync.state();
      if (await getSetting(`moduleLayout:v1:household:${encodeURIComponent(account.householdId)}:caregiver`, null)) return;
      const grid = view.querySelector('.module-cards');
      if (!grid) return;
      const toolbar = grid.previousElementSibling;
      const extras = grid.nextElementSibling;
      const section = document.createElement('section');
      section.className = 'onboarding-next';
      section.innerHTML = '<h2>Start with what helps today</h2><div class="btn-row"><button class="btn" id="firstCareSheet" type="button">Prepare a care sheet</button><button class="btn secondary" id="firstCareInstructions" type="button">Daily Care & Safety</button><button class="btn secondary" id="firstCareCalendar" type="button">Appointments</button></div>';
      grid.before(section);
      section.querySelector('#firstCareSheet').onclick = () => openBabysitterCareSheet();
      section.querySelector('#firstCareInstructions').onclick = () => openDailyCareProfile();
      section.querySelector('#firstCareCalendar').onclick = () => openCaregiverCalendar();
      const details = document.createElement('details');
      details.className = 'onboarding-all-tools';
      details.innerHTML = '<summary>All caregiver tools</summary>';
      section.after(details);
      if (toolbar?.classList.contains('module-layout-toolbar')) details.append(toolbar);
      details.append(grid);
      if (extras?.classList.contains('module-layout-extras')) details.append(extras);
      return;
    }
    const section = document.createElement('section');
    section.className = 'onboarding-next';
    section.innerHTML = `<h2>${tasks[state.task] ? 'Your first task is ready to continue' : 'What would help today?'}</h2><div class="btn-row"><button class="btn" id="continueFirstTask" type="button">${tasks[state.task] ? esc(tasks[state.task].title) : 'Choose a first task'}</button><button class="btn secondary" id="dismissFirstTask" type="button">Explore on my own</button></div>`;
    view.prepend(section);
    const frame = view.querySelector('.preserved-home');
    if (frame) {
      const resize = () => {
        if (!section.isConnected) { homeObserver?.disconnect(); return; }
        if (innerWidth >= 700) {
          const height = Math.max(0, Math.min(view.clientHeight - 58 - section.offsetHeight, view.clientWidth * 941 / 1672));
          frame.style.flex = 'none';
          frame.style.height = `${height}px`;
          frame.style.width = `${height * 1672 / 941}px`;
        } else { frame.style.flex = ''; frame.style.height = ''; frame.style.width = ''; }
      };
      homeObserver = new ResizeObserver(resize);
      homeObserver.observe(view);
      homeObserver.observe(section);
      resize();
    }
    section.querySelector('#continueFirstTask').onclick = () => tasks[state.task] ? begin(state.task) : navigate('gettingStarted');
    section.querySelector('#dismissFirstTask').onclick = async () => { track('explore_selected','','choice',id); await update(id, { dismissed: true, task: null }); await navigate('home'); };
  }
  async function saved(store, value, id) {
    if (!id || await scope() !== id) return;
    const state = read(id);
    if (!state.started || state.completed) return;
    const useful = store === 'achievements' || store === 'notes' && value.kind === 'dayEvent' || store === 'settings' && (/^sleep:routine:/.test(value.id) && value.value?.length || /^dailyCare:/.test(value.id) && Object.entries(value.value || {}).some(([k, v]) => k !== 'updatedAt' && typeof v === 'string' && v.trim()));
    if (useful) await update(id, { completed: true, task: null });
  }
  function bindProfiles(route) {
    view.querySelectorAll('[data-go="child"], #addProfile, #vocabCreateProfile, #pottyCreateProfile').forEach(button => {
      if (!/^create|^add another child/i.test(button.textContent.trim())) return;
      button.textContent = 'Create child profile';
      button.onclick = () => openProfileForm(null, { returnRoute: route });
    });
  }
  return { validationBlocked,saveAttempt,saveResult,syncResult,activated, progress, begin, render, decorate, requestProfile, bindProfiles, saved, scope };
})();
