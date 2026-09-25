const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

function harness({ token = 'test-token', ua = '', touch = 0, standalone = false, pwa = false, respond } = {}) {
  let saved = { id: 'current', token, serverUrl: 'https://api.example/mtm' };
  const requests = [], intervals = [], timeouts = new Map(), events = {};
  let timerId = 0, beforeRead = () => {};
  const document = { visibilityState: 'visible', addEventListener(type, callback) { events[type] = callback; } };
  const navigator = { onLine: true, userAgent: ua, maxTouchPoints: touch, standalone };
  const window = { MTM_APP_VERSION: '0.10.1', matchMedia: () => ({ matches: pwa }),
    addEventListener(type, callback) { (events[type] ||= []).push(callback); } };
  const db = { transaction() {
    const transaction = { objectStore() { return {
      get() {
        const request = {};
        queueMicrotask(() => {
          beforeRead();
          request.result = structuredClone(saved);
          request.onsuccess();
          queueMicrotask(() => transaction.oncomplete?.());
        });
        return request;
      },
      put(value) { saved = structuredClone(value); const request = {}; queueMicrotask(() => request.onsuccess?.()); return request; }
    }; } };
    return transaction;
  } };
  vm.runInNewContext(read('sync.js'), { db, window, document, navigator, AbortController,
    setInterval(callback, ms) { intervals.push({ callback, ms }); },
    setTimeout(callback) { timeouts.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timeouts.delete(id); },
    fetch: async (url, options) => {
      requests.push({ url, options, body: JSON.parse(options.body || '{}') });
      return respond ? respond(options) : { ok: true, json: async () => ({ ok: true }) };
    }
  });
  return { sync: window.MTMSync, window, document, navigator, requests, intervals, timeouts, events,
    saved: () => saved, beforeRead(callback) { beforeRead = callback; } };
}

test('usage sends authenticated coarse labels; heartbeat has no feature or private fields', async () => {
  const h = harness({ ua: 'iPhone Safari/605.1', pwa: true });
  await h.sync.trackActivity('home');
  assert.equal(h.requests[0].url, 'https://api.example/mtm/v1/analytics/activity');
  assert.equal(h.requests[0].options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual(h.requests[0].body, { platform: 'ios', client: 'pwa', version: '0.10.1', feature: 'home' });
  assert.equal(h.intervals.filter(x => x.ms === 60000).length, 1);
  h.intervals.find(x => x.ms === 60000).callback();
  await flush();
  assert.equal(h.requests[1].body.feature, undefined);
  await h.sync.trackActivity('private search text');
  assert.equal(h.requests[2].body.feature, undefined);
  assert.equal(h.timeouts.size, 0);
});

test('hidden, offline and signed-out clients send nothing; foreground and online resume immediately', async () => {
  const h = harness();
  h.document.visibilityState = 'hidden'; await h.sync.trackActivity('home');
  h.events.visibilitychange(); await flush(); assert.equal(h.requests.length, 0);
  h.document.visibilityState = 'visible'; h.navigator.onLine = false;
  await h.sync.trackActivity(); assert.equal(h.requests.length, 0);
  h.navigator.onLine = true; h.events.visibilitychange(); await flush();
  assert.equal(h.requests.length, 1);
  for (const handler of h.events.online) handler();
  await flush(); assert.equal(h.requests.length, 2);
  const signedOut = harness({ token: '' });
  await signedOut.sync.trackActivity('home'); assert.equal(signedOut.requests.length, 0);
  const interrupted = harness();
  interrupted.beforeRead(() => { interrupted.document.visibilityState = 'hidden'; });
  await interrupted.sync.trackActivity(); assert.equal(interrupted.requests.length, 0);
});

test('device detection handles desktop-mode iPads, iOS standalone and major operating systems', async () => {
  for (const [options, platform, client] of [
    [{ ua: 'Macintosh Safari/605', touch: 5 }, 'ipados', 'safari'],
    [{ ua: 'iPad Safari/605' }, 'ipados', 'safari'],
    [{ ua: 'iPhone Safari/605', standalone: true }, 'ios', 'pwa'],
    [{ ua: 'Android Chrome/140' }, 'android', 'chrome'],
    [{ ua: 'Windows Chrome/140 Edg/140' }, 'windows', 'edge'],
    [{ ua: 'Macintosh Safari/605' }, 'macos', 'safari'],
    [{ ua: 'Linux Firefox/140' }, 'linux', 'firefox'],
    [{ ua: 'unrecognized' }, 'unknown', 'browser']
  ]) {
    const h = harness(options); await h.sync.trackActivity();
    assert.equal(h.requests[0].body.platform, platform);
    assert.equal(h.requests[0].body.client, client);
  }
});

test('analytics 401, server, parsing and network errors are silent and do not flag reauthentication', async () => {
  for (const respond of [
    async () => ({ ok: false, status: 401, json: async () => ({ error: 'Expired' }) }),
    async () => ({ ok: false, status: 500, json: async () => ({ error: 'Unavailable' }) }),
    async () => ({ ok: false, status: 502, json: async () => { throw Error('Not JSON'); } }),
    async () => { throw Error('Offline'); }
  ]) {
    const h = harness({ respond }); await h.sync.trackActivity('profile');
    assert.equal(h.saved().reauthRequired, undefined);
    assert.equal(h.saved().lastError, undefined);
    assert.equal(h.timeouts.size, 0);
  }
});

test('stalled usage request is aborted without affecting the next heartbeat', async () => {
  let attempts = 0;
  const h = harness({ respond: options => ++attempts > 1
    ? { ok: true, json: async () => ({ ok: true }) }
    : new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(Error('Aborted')))) });
  const pending = h.sync.trackActivity(); await flush();
  for (const timeout of h.timeouts.values()) timeout();
  await pending; await h.sync.trackActivity(); assert.equal(h.requests.length, 2);
});

test('resolved navigation counts visits, not sync rerenders or access-denied destinations', async () => {
  const source = read('app.js'), calls = [];
  const mapping = source.slice(source.indexOf('const ANALYTICS_FEATURES'), source.indexOf('const ACCESS'));
  const navigation = source.slice(source.indexOf('async function performNavigation('), source.indexOf('\nfunction navigate('));
  const window = { MTMLayouts: { mountExisting: async () => {}, isSaving: () => false, dispose() {} }, MTMSync: { trackActivity: feature => { calls.push(feature); } },
    MTMAccess: { route: async route => route === 'health' ? 'subscription' : route, readonlyChrome: async () => {} } };
  const context = vm.createContext({ window, routes: Object.fromEntries(['home', 'child', 'myDay', 'health', 'subscription'].map(r => [r, async () => {}])),
    currentRoute: '', routeStack: [], profileAgeTimer: null, communityRefreshTimer: null, screenTimerInterval: null,
    navigate() {}, applyRouteChrome() {}, closeDrawer() {}, view: { focus() {} }, history: { replaceState() {} }, console });
  vm.runInContext(mapping + navigation, context);
  for (const route of ['home', 'home', 'child', 'child', 'myDay', 'child', 'home', 'health', 'health']) {
    await context.performNavigation(route);
  }
  assert.deepEqual(calls, ['home', 'profile', 'my-day', 'profile', 'home', '']);
  window.MTMSync.trackActivity = () => { throw Error('Analytics failed'); };
  await context.performNavigation('home'); assert.equal(context.currentRoute, 'home');
  window.MTMSync.trackActivity = async () => { throw Error('Analytics rejected'); };
  await context.performNavigation('child'); await flush(); assert.equal(context.currentRoute, 'child');
});
