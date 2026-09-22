/* An empty document isolates enhanced measurement from private app content. */
(() => {
  const origin = 'https://randypoffinberger-design.github.io';
  if (location.origin !== origin || window.parent === window) return;
  const id = 'G-28YF2Y4987';
  const debug = new URLSearchParams(location.search || '').get('debug') === '1' ? { debug_mode: true } : {};
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag('js', new Date());
  const safePage = origin + '/Free-to-be-me/';
  gtag('config', id, { send_page_view: false, page_location: safePage, page_referrer: '', page_title: 'More Than Measured', allow_google_signals: false, allow_ad_personalization_signals: false });
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== origin || event.data?.type !== 'mtm-conversion') return;
    const { name, params: p } = event.data;
    let params;
    if (name === 'sign_up') params = { method: 'email' };
    else if (['household_created', 'child_profile_created', 'first_record_created'].includes(name)) params = {};
    else if (name === 'trial_start') params = { trial_days: 7 };
    else if (['begin_checkout', 'purchase'].includes(name)) {
      const plan = p?.items?.[0]?.item_variant;
      if (!['monthly', 'yearly'].includes(plan) || p.currency !== 'USD' || !Number.isFinite(p.value) || p.value <= 0) return;
      params = { currency: 'USD', value: p.value, items: [{ item_id: 'mtm_' + plan, item_name: 'MTM household subscription', item_variant: plan, quantity: 1 }] };
      if (name === 'purchase') {
        if (!/^in_[A-Za-z0-9]+$/.test(p.transaction_id || '')) return;
        params.transaction_id = p.transaction_id;
      }
    } else return;
    gtag('event', name, { ...params, ...debug, send_to: id, page_location: safePage, page_referrer: '', page_title: 'More Than Measured' });
  });
  const script = document.createElement('script'); script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.append(script);
  window.parent.postMessage('mtm-analytics-ready', origin);
})();
