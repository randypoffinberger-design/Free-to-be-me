/* Privacy boundary: no key values, element targets, text, URLs or family data. */
(function (root) {
  'use strict';
  function createInteractionUsage({ now = () => performance.now(), visible = () => document.visibilityState === 'visible', online = () => navigator.onLine } = {}) {
    let last = null, seconds = 0, pending = false, feature = '';
    function reset(clearFeature = true) { last = null; seconds = 0; pending = false; if (clearFeature) feature = ''; }
    function interact(event) {
      if (!event?.isTrusted || !visible() || !online()) return;
      const at = now();
      // Credit only gaps bracketed by actual input, at most 15 seconds apart.
      // A visible idle page, hidden time and time after the last input earn zero.
      if (last !== null && at >= last && at - last <= 15000) seconds = Math.min(60, seconds + (at - last) / 1000);
      last = at; pending = true;
    }
    function take(openedFeature) {
      if (!visible() || !online()) { reset(); return null; }
      if (!pending && openedFeature === undefined) return null;
      const result = { activeSeconds: Math.floor(seconds), activeFeature: feature };
      seconds = 0; pending = false;
      if (openedFeature !== undefined) { feature = openedFeature; last = null; }
      return result;
    }
    return { interact, take, reset };
  }
  root.MTMInteractionUsage = createInteractionUsage;
  if (typeof module === 'object' && module.exports) module.exports = createInteractionUsage;
})(typeof window === 'object' ? window : globalThis);
