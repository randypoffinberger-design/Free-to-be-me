/* Conversion-only analytics. Google runs in an empty frame, never in the family-data UI. */
window.MTMAnalytics = (() => {
  const active = location.origin === 'https://randypoffinberger-design.github.io' && location.pathname.startsWith('/Free-to-be-me/');
  const apiOrigin = 'https://api.serenityvalleyworks.com/mtm';
  let frame, ready = false;
  const queue = [], memory = new Map(), checking = new Set();
  function read(key) { try { return JSON.parse(localStorage.getItem('mtm-ga4:' + key)) ?? memory.get(key); } catch { return memory.get(key); } }
  function write(key, value) { memory.set(key, value); try { localStorage.setItem('mtm-ga4:' + key, JSON.stringify(value)); } catch {} }
  function send(name, params, key) {
    if (!active || read('sent:' + key)) return;
    // A repeat checkout or page refresh must not count as another conversion.
    write('sent:' + key, true);
    queue.push({ type: 'mtm-conversion', name, params });
    flush();
  }
  function flush() {
    if (ready) while (queue.length) frame.contentWindow.postMessage(queue.shift(), location.origin);
  }
  if (active) {
    frame = document.createElement('iframe');
    frame.hidden = true; frame.title = 'MTM conversion measurement';
    frame.src = 'analytics-frame.html' + (new URLSearchParams(location.search || '').get('analytics_debug') === '1' ? '?debug=1' : ''); frame.referrerPolicy = 'no-referrer';
    window.addEventListener('message', event => {
      if (event.source === frame.contentWindow && event.origin === location.origin && event.data === 'mtm-analytics-ready') { ready = true; flush(); }
    });
    document.body.append(frame);
  }
  function item(plan) { return { item_id: 'mtm_' + plan, item_name: 'MTM household subscription', item_variant: plan, quantity: 1 }; }
  async function checkPurchase(state, householdId) {
    const key = 'pending:' + state.user?.id + ':' + householdId;
    const pending = read(key);
    if (!pending || checking.has(key)) return;
    if (Date.now() - pending.created > 7 * 86400000) { write(key, null); return; }
    checking.add(key);
    try {
      const result = await window.MTMSync.api('/v1/households/' + encodeURIComponent(householdId) + '/billing/receipt', {
        method: 'POST', body: JSON.stringify({ sessionId: pending.sessionId })
      });
      const current = await window.MTMSync.state();
      if (current.user?.id !== state.user?.id || current.householdId !== householdId || current.token !== state.token) return;
      const receipt = result.purchase;
      if (receipt && /^in_[A-Za-z0-9]+$/.test(receipt.transaction_id) && receipt.currency === 'USD' && Number.isFinite(receipt.value) && receipt.value > 0 && ['monthly', 'yearly'].includes(receipt.plan)) {
        send('purchase', { transaction_id: receipt.transaction_id, currency: 'USD', value: receipt.value, items: [item(receipt.plan)] }, 'purchase:' + receipt.transaction_id);
        write(key, null);
      } else if (['expired', 'test'].includes(result.status)) write(key, null);
    } catch { /* Optional measurement never blocks access or billing. Retry on the next access refresh. */ }
    finally { checking.delete(key); }
  }
  function response(path, options, data, state) {
    try {
      if (!active || (state.serverUrl || apiOrigin).replace(/\/+$/, '') !== apiOrigin) return;
      const method = options.method || 'GET';
      if (method === 'POST' && path === '/v1/auth/register' && data.user?.id) {
        send('sign_up', { method: 'email' }, 'signup:' + data.user.id);
      }
      if (method === 'POST' && state.user?.id) {
        let events = [];
        if (path === '/v1/households' && data.household?.id) events = data.analyticsEvents || [];
        if (path === '/v1/sync/push') events = (data.results || []).filter(r => r.status === 'accepted').flatMap(r => r.analyticsEvents || []);
        for (const event of events) {
          const allowed = path === '/v1/households' ? ['household_created'] : ['child_profile_created', 'first_record_created'];
          if (allowed.includes(event.name) && /^[0-9a-f-]{36}$/i.test(event.key || '')) send(event.name, {}, 'funnel:' + event.key);
        }
      }
      const match = path.match(/^\/v1\/households\/([^/]+)\/(trial|billing\/checkout|access)$/);
      if (!match || !state.user?.id) return;
      const householdId = decodeURIComponent(match[1]);
      if (method === 'POST' && match[2] === 'trial' && data.trialStarted === true && data.entitlement?.kind === 'trial' && data.entitlement.trialEndsAt) {
        send('trial_start', { trial_days: 7 }, 'trial:' + householdId + ':' + data.entitlement.trialEndsAt);
      }
      if (method === 'POST' && match[2] === 'billing/checkout' && typeof data.url === 'string' && new URL(data.url).origin === 'https://checkout.stripe.com') {
        const plan = JSON.parse(options.body || '{}').plan;
        if (!['monthly', 'yearly'].includes(plan)) return;
        if (/^cs_(live|test)_[A-Za-z0-9]+$/.test(data.checkoutId || '')) {
          write('pending:' + state.user.id + ':' + householdId, { sessionId: data.checkoutId, created: Date.now() });
        }
        if (data.livemode === false) return;
        send('begin_checkout', { currency: 'USD', value: plan === 'monthly' ? 12.99 : 99.99, items: [item(plan)] }, 'checkout:' + (data.checkoutId || data.url));
        // Give the frame a bounded opportunity to send before Stripe navigation.
        return new Promise(resolve => setTimeout(resolve, 350));
      }
      if (method === 'GET' && match[2] === 'access' && state.householdId === householdId) void checkPurchase(state, householdId);
    } catch { /* Analytics errors must never change the original API result. */ }
  }
  return { response };
})();
