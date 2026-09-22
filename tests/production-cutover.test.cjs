const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'sync.js'), 'utf8');
const legacy = 'https://randys.tail96598f.ts.net/mtm';
const cloud = 'https://api.serenityvalleyworks.com/mtm';

function harness(saved, respond = async () => ({ ok: true, json: async () => ({ ok: true }) })) {
  let record = structuredClone(saved), writes = 0;
  const requests = [];
  const db = { transaction() {
    const transaction = { objectStore() { return {
      get() {
        const request = {};
        queueMicrotask(() => {
          request.result = structuredClone(record);
          request.onsuccess();
          queueMicrotask(() => transaction.oncomplete?.());
        });
        return request;
      },
      put(value) { record = structuredClone(value); writes++; const request={}; queueMicrotask(()=>request.onsuccess?.()); return request; },
    }; } };
    return transaction;
  } };
  const context = vm.createContext({ db, window: { addEventListener() {} },
    setInterval() {}, navigator: { onLine: true },
    fetch: async (url, options) => { requests.push({ url, options }); return respond(); },
  });
  vm.runInContext(source, context);
  return { sync: context.window.MTMSync, window: context.window, requests, record: () => record, writes: () => writes };
}

test('analytics receives successful API results only and cannot break registration', async () => {
  const data={user:{id:'new-user'}};
  const h=harness(undefined,async()=>({ok:true,json:async()=>data}));
  let calls=0;
  h.window.MTMAnalytics={response(path,options,result){calls++;assert.equal(path,'/v1/auth/register');assert.equal(result,data);throw Error('Analytics blocked');}};
  assert.equal(await h.sync.api('/v1/auth/register',{method:'POST'}),data);assert.equal(calls,1);
  const failed=harness(undefined,async()=>({ok:false,status:400,json:async()=>({error:'Not created'})}));
  failed.window.MTMAnalytics={response(){calls++;}};
  await assert.rejects(failed.sync.api('/v1/auth/register',{method:'POST'}));assert.equal(calls,1);
});

test('rejected saved sessions require sign-in without discarding account context', async () => {
  const saved={id:'current',serverUrl:cloud,token:'expired',localDataOwnerId:'owner',householdId:'family',cursor:12};
  const h=harness(saved,async()=>({ok:false,status:401,json:async()=>({error:'Authentication required.'})}));
  await assert.rejects(h.sync.api('/v1/households'),{status:401});
  assert.deepEqual(h.record(),{...saved,reauthRequired:true});
});

test('a delayed rejection cannot invalidate a newer sign-in',async()=>{
  const saved={id:'current',serverUrl:cloud,token:'old'};
  const h=harness(saved,async()=>{await h.sync.saveState({...saved,token:'new'});return {ok:false,status:401,json:async()=>({error:'Expired'})};});
  await assert.rejects(h.sync.api('/v1/account'),{status:401});
  assert.equal(h.record().token,'new');assert.equal(h.record().reauthRequired,undefined);
});

test('wrong passwords and temporary network failures do not invalidate saved access',async()=>{
  const saved={id:'current',serverUrl:cloud,token:'saved'};
  const login=harness(saved,async()=>({ok:false,status:401,json:async()=>({error:'Wrong password'})}));
  await assert.rejects(login.sync.api('/v1/auth/login'),{status:401});assert.deepEqual(login.record(),saved);
  const offline=harness(saved,async()=>{throw new TypeError('Network unavailable');});
  await assert.rejects(offline.sync.api('/v1/account'),TypeError);assert.deepEqual(offline.record(),saved);
});

test('saved production account migrates persistently before its first API request', async () => {
  const original = { id: 'current', serverUrl: legacy, token: 'fixture-token', user: { id: 'user-1' },
    localDataOwnerId: 'user-1', householdId: 'household-1', cursor: 433, lastSyncAt: 'fixture-time', extra: { preserved: true } };
  const h = harness(original);
  await h.sync.initializeAccountIsolation();
  assert.deepEqual(h.record(), { ...original, serverUrl: cloud });
  await h.sync.api('/v1/account');
  assert.equal(h.requests[0].url, cloud + '/v1/account');
  assert.equal(h.requests[0].options.headers.Authorization, 'Bearer fixture-token');
  await h.sync.state();
  assert.equal(h.writes(), 1, 'migration is idempotent');
});

test('new installs use cloud without configuration', async () => {
  const h = harness(undefined);
  assert.equal((await h.sync.state()).serverUrl, cloud);
  await h.sync.api('/health');
  assert.equal(h.requests[0].url, cloud + '/health');
});

test('only the exact legacy production URL is rewritten', async () => {
  for (const serverUrl of [cloud, 'http://localhost:8788', legacy + '-test', legacy + '/',
    'https://custom.example/mtm', 'https://randys.tail96598f.ts.net/other', '', undefined]) {
    const original = { id: 'current', serverUrl, cursor: 17 };
    const h = harness(original);
    assert.equal((await h.sync.state()).serverUrl, serverUrl);
    assert.deepEqual(h.record(), original);
    assert.equal(h.writes(), 0);
  }
});

test('production shell and worker use matching new build identifiers', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  for (const asset of ['styles.css', 'sync.js', 'offline-key.js', 'offline-access.js', 'access.js', 'app.js']) {
    assert.ok(html.includes(asset + '?v=0.10.1-production-7'));
    assert.ok(worker.includes(asset + '?v=0.10.1-production-7'));
  }
  assert.ok(app.includes('const ASSET_BUILD = "0.10.1-production-3"'));
  assert.ok(source.includes('const BUILD = "0.10.1-production-3"'));
  assert.ok(worker.includes("mtm-production-v0.10.1-7"));
  assert.ok(app.includes('version: "0.10.1", schemaVersion: 5'));
  assert.doesNotMatch(source, /syncServer|saveServer/);
  for (const match of worker.matchAll(/["']\.\/([^"']+)["']/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1].split(/[?#]/)[0])), match[1]);
  }
});

test('production offline key matches the installed server and contains only public material', () => {
  const context={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'offline-key.js'),'utf8'),context);
  const key=context.window.MTM_OFFLINE_PUBLIC_KEY;
  assert.equal(key.x,'VYFbiecq54Gc_66uhsw5u_XEMaDLBP_20oKXhmjvjXI');
  assert.equal(key.y,'iZMBmT_NWAIQSNDGO3wTEDYxyO43TrQJqHTlWKOPHwQ');
  assert.equal(key.crv,'P-256'); assert.equal(key.d,undefined);
  assert.equal(require('node:crypto').createPublicKey({key,format:'jwk'}).asymmetricKeyType,'ec');
});
