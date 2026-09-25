"use strict";
window.MTMLayouts = (() => {
  const modules = window.MTMModules;
  let active = null;
  let requestedEditor = null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const identity = state => JSON.stringify([state.user?.id, state.householdId, state.token]);
  function key(section, scope) {
    if (!['household', 'profile'].includes(scope.kind) || !scope.id) throw new Error('A layout needs an explicit scope.');
    return `moduleLayout:v1:${scope.kind}:${encodeURIComponent(scope.id)}:${section}`;
  }
  function allowed(section) {
    if (!modules.sections[section]) throw new Error('Unknown layout section.');
    return section === 'home' ? modules.ids.filter(id => id !== 'village') : [...modules.sections[section]];
  }
  function normalize(section, saved) {
    const defaults = [...modules.sections[section]], valid = new Set(allowed(section));
    if (saved?.version != null && saved.version !== 1) throw new Error('This layout needs a newer version of MTM.');
    const unique = list => Array.isArray(list) ? [...new Set(list.filter(id => valid.has(id)))] : [];
    const order = saved && Array.isArray(saved.order) ? unique(saved.order) : defaults;
    if (section === 'home') {
      for (const id of defaults) if (order.length < 8 && !order.includes(id)) order.push(id);
      return {version: 1, order: order.slice(0, 8), hidden: []};
    }
    const hidden = unique(saved?.hidden);
    for (const id of defaults) if (!order.includes(id) && !hidden.includes(id)) order.push(id);
    return {version: 1, order: order.filter(id => !hidden.includes(id)), hidden};
  }
  function move(layout, from, to) {
    const next = clone(layout), a = next.order.indexOf(from), b = next.order.indexOf(to);
    if (a < 0 || b < 0 || a === b) return next;
    next.order.splice(a, 1);next.order.splice(b, 0, from);return next;
  }
  function replace(layout, oldId, newId) {
    const next = clone(layout), index = next.order.indexOf(oldId);
    if (index < 0 || next.order.includes(newId) || !allowed('home').includes(newId)) throw new Error('Choose an unused home module.');
    next.order[index] = newId;return normalize('home', next);
  }
  function dispose() { if (active) {active.disposed = true;active.frame?.classList.remove('home-layout-editing');}active = null; }
  async function mount({section, container, presentation, navigate, actions, descriptions = {}, renderItem = null}) {
    dispose();
    const session = {editing: false, saving: false, disposed: false};active = session;
    session.frame = section === 'home' ? container.closest('.preserved-home') : null;
    const state = await window.MTMSync.state();
    const scope = {kind: 'household', id: state.householdId};
    if (session.disposed || !container.isConnected || !scope.id) return;
    const settingKey = key(section, scope), owner = identity(state);
    const status = await window.MTMAccess.status();
    if (session.disposed || identity(await window.MTMSync.state()) !== owner) return;
    // Existing access rules remain authoritative. Sitters never customize a
    // household layout or gain feature access by changing a shortcut.
    if (status.role === 'babysitter') return;
    const canCustomize = Boolean(status.canWrite);
    if (requestedEditor === section) {session.editing = canCustomize;requestedEditor = null;}
    let original = await getSetting(settingKey, null);
    let layout;
    try { layout = normalize(section, original); } catch { return; }
    if (session.disposed || !container.isConnected) return;
    const toolbar = document.createElement('div');toolbar.className = 'module-layout-toolbar';
    const message = document.createElement('p');message.className = 'hint';message.setAttribute('role', 'status');
    const extras = document.createElement('div');extras.className = 'module-layout-extras';
    container.before(toolbar);container.after(message, extras);
    let draft = clone(layout);
    function button(text, handler, label) {
      const b = document.createElement('button');b.type = 'button';b.className = 'small-action';b.textContent = text;
      if (label) b.setAttribute('aria-label', label);b.onclick = event => {if (!session.saving) return handler(event);};return b;
    }
    function draw(focusId) {
      toolbar.replaceChildren();extras.replaceChildren();
      container.innerHTML = '';
      container.classList.toggle('module-layout-editing', session.editing);
      session.frame?.classList.toggle('home-layout-editing', session.editing);
      if (!session.editing) {
        if (canCustomize && section !== 'home') toolbar.append(button('Customize', () => {draft = clone(layout);session.editing = true;message.textContent = 'Move or replace shortcuts. Choose Done to save; Cancel leaves your layout unchanged.';draw();}));
        if (renderItem) {
          for (const id of layout.order) container.append(renderItem(id));
        } else {
        container.innerHTML = layout.order.map((id, index) => modules.render(id, {presentation, description: descriptions[id], homeSlot: section === 'home' ? index : null})).join('');
        modules.bind(container, {navigate, actions});
        }
        if (!layout.order.length) message.textContent = 'All modules are hidden. Choose Customize to restore them.';
        return;
      }
      toolbar.append(button('Done', save), button('Cancel', () => {session.editing = false;message.textContent = '';draw();}), button('Reset layout', () => {draft = normalize(section, null);draw();}));
      for (const [index, id] of draft.order.entries()) {
        const item = modules.get(id), wrapper = document.createElement('div');wrapper.className = 'module-edit-item';wrapper.dataset.layoutId = id;
        wrapper.innerHTML = modules.render(id, {presentation, description: descriptions[id]});
        const display = wrapper.querySelector('button');display.disabled = true;
        const controls = document.createElement('div');controls.className = 'module-edit-controls';
        const earlier = button('←', () => {draft = move(draft, id, draft.order[index - 1]);draw(id);}, `Move ${item.title} earlier`);
        const later = button('→', () => {draft = move(draft, id, draft.order[index + 1]);draw(id);}, `Move ${item.title} later`);
        earlier.disabled = index === 0;later.disabled = index === draft.order.length - 1;
        controls.append(earlier, later);
        if (section === 'home') {
          const select = document.createElement('select');select.setAttribute('aria-label', `Replace ${item.title}`);
          const placeholder = document.createElement('option');placeholder.value = '';placeholder.textContent = 'Replace…';select.append(placeholder);
          for (const candidate of allowed(section).filter(value => !draft.order.includes(value))) {
            const option = document.createElement('option');option.value = candidate;option.textContent = modules.get(candidate).title;select.append(option);
          }
          select.onchange = () => {if (!session.saving) {draft = replace(draft, id, select.value);draw(select.value);}};controls.append(select);
        } else controls.append(button('Hide', () => {draft.order = draft.order.filter(value => value !== id);draft.hidden.push(id);draw();}, `Hide ${item.title}`));
        const handle = button('Move', () => {}, `Drag ${item.title}; or use the earlier and later buttons`);handle.className += ' module-drag-handle';
        let origin = null;
        handle.onpointerdown = event => {
          if (event.button !== 0 || session.saving) return;
          origin = {x:event.clientX,y:event.clientY};handle.setPointerCapture(event.pointerId);
        };
        handle.onpointermove = event => {
          if (!origin || Math.hypot(event.clientX-origin.x,event.clientY-origin.y)<8) return;
          wrapper.classList.add('module-dragging');
          container.querySelectorAll('.module-drop-target').forEach(el=>el.classList.remove('module-drop-target'));
          const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-layout-id]');
          if (target && container.contains(target)) target.classList.add('module-drop-target');
        };
        handle.onpointerup = event => {
          const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-layout-id]');
          const moved=origin && Math.hypot(event.clientX-origin.x,event.clientY-origin.y)>=8;
          origin=null;wrapper.classList.remove('module-dragging');
          container.querySelectorAll('.module-drop-target').forEach(el=>el.classList.remove('module-drop-target'));
          if (moved && target && container.contains(target)) {draft=move(draft,id,target.dataset.layoutId);draw(id);}
        };
        handle.onpointercancel = () => {origin=null;wrapper.classList.remove('module-dragging');container.querySelectorAll('.module-drop-target').forEach(el=>el.classList.remove('module-drop-target'));};
        controls.append(handle);wrapper.append(controls);container.append(wrapper);
      }
      if (section !== 'home' && draft.hidden.length) {
        const heading = document.createElement('h3');heading.textContent = 'Hidden modules';extras.append(heading);
        const note = document.createElement('p');note.textContent = 'Hiding a module never deletes its records.';extras.append(note);
        for (const id of draft.hidden) extras.append(button(`Restore ${modules.get(id).title}`, () => {draft.hidden = draft.hidden.filter(value => value !== id);draft.order.push(id);draw(id);}));
      }
      if (section === 'home') {
        const note = document.createElement('p');note.textContent = 'Home has up to eight shortcuts. Replaced tools remain available in their sections and the menu.';extras.append(note);
      }
      if (focusId) container.querySelector(`[data-layout-id="${focusId}"] .module-edit-controls button:not(:disabled)`)?.focus();
    }
    async function save() {
      if (session.saving || session.disposed) return;
      session.saving = true;
      toolbar.querySelectorAll('button').forEach(b => b.disabled = true);
      const next = normalize(section, draft);
      try {
        await window.MTMAccess.requireWrite('settings', settingKey);
        if (session.disposed || window.MTMSync.isSwitching() || identity(await window.MTMSync.state()) !== owner) throw new Error('The account or household changed. Reopen this section before saving.');
        const latest = await getSetting(settingKey, null);
        if (JSON.stringify(latest) !== JSON.stringify(original)) throw new Error('This layout changed on another device. Cancel and reopen the section before editing again.');
        await window.MTMSync.saveLayoutSetting(settingKey, next, original, state);
        if (session.disposed) return;
        original = clone(next);layout = next;session.editing = false;
        message.textContent = 'Layout saved on this device. It will sync with your household when connected.';
        draw();
      } catch (error) { message.textContent = error.message || 'Could not save the layout. Please try again.'; }
      finally {session.saving = false;toolbar.querySelectorAll('button').forEach(b => b.disabled = false);}
    }
    draw();
  }
  // Keep original DOM nodes and handlers, including their captured profile data.
  async function mountExisting({route, view, navigate}) {
    const section = {child:'growth', speech:'speech', health:'health', sensory:'sensory', skills:'skills', resources:'resources', food:'food', safety:'safety'}[route];
    if (!section) return;
    const cards = [...view.querySelectorAll('.card-button')];
    if (!cards.length) return; // Profile creation and empty states retain their own controls.
    const nodes = new Map(), descriptions = {};
    for (const id of modules.sections[section]) {
      const item = modules.get(id);
      const node = cards.find(card => item.shortcut ? card.matches(item.shortcut.selector) : card.dataset.go === item.destination.route);
      if (!node) throw new Error('A section card could not be matched: '+item.title);
      nodes.set(id,node);descriptions[id]=node.querySelector('small')?.textContent || item.description;
    }
    const groups = [...new Set([...nodes.values()].map(node=>node.parentElement))];
    const first = nodes.values().next().value;
    const container = document.createElement('div');container.className='grid section-grid module-cards';
    first.before(container);
    // Keep a single grid; Growth Journey's profile list and action buttons stay outside it.
    for (const node of nodes.values()) node.remove();
    const outerGrid = container.parentElement;
    if (outerGrid.classList.contains('grid')) outerGrid.before(container);
    for (const group of groups) {
      if (group.classList.contains('grid') && !group.children.length) {
        if (group.previousElementSibling?.matches('h2.section-title') && group !== outerGrid) group.previousElementSibling.remove();
        group.remove();
      }
    }
    if (section==='growth' && container.previousElementSibling?.matches('h2.section-title')) container.previousElementSibling.textContent='Progress and growth tools';
    // Render originals initially too, including when access rules disable customization.
    container.append(...nodes.values());
    await mount({section,container,presentation:'card',navigate,descriptions,renderItem:id=>nodes.get(id)});
    if (active && !active.disposed && container.isConnected) active.originalCards=[...nodes.values()];
  }
  function originalCard(selector) {
    return active && !active.disposed ? active.originalCards?.find(card=>card.matches(selector)) : null;
  }
  return Object.freeze({mountExisting, originalCard, key, normalize, move, replace, mount, dispose, requestEditor: section => {if (!modules.sections[section]) throw new Error('Unknown section');requestedEditor = section;}, isEditing: () => Boolean(active?.editing), isSaving: () => Boolean(active?.saving)});
})();
