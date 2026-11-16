/* Vachuo · live web search for My tutor's "Look it up" panel, powered by Keenable.
 *
 * The design canvas can't reach the network, so it shows saved example results.
 * On the website this file provides window.vachuoSearch(query, {safe, max}), which the
 * tutor page calls. It uses Keenable's keyless public endpoint, so no API key is ever
 * placed in the browser. Only the learner's question is sent: no name, no work, no id.
 *
 * Later, for Keenable's faster "realtime" mode (needs an API key), point the page at
 * your own server instead, before this file loads:
 *   <script>window.VACHUO_KEENABLE = { endpoint: 'https://your-server.example/search' };</script>
 * That server should add the X-API-Key header and forward to https://api.keenable.ai/v1/search.
 */
(function () {
  var CFG = window.VACHUO_KEENABLE || {};
  var URL_PUBLIC = 'https://api.keenable.ai/v1/search/public';
  window.vachuoSearch = function (query, opts) {
    opts = opts || {};
    var body = { query: String(query || '').slice(0, 400), max_results: Math.max(1, Math.min(10, opts.max || 5)), snippet_max_length: 400 };
    if (opts.safe !== false) body.safety_mode = 'strict';
    if (CFG.endpoint) body.mode = CFG.mode || 'realtime';
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
    return fetch(CFG.endpoint || URL_PUBLIC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Keenable-Title': 'Vachuo' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('Keenable search failed: ' + r.status);
      return r.json();
    }).then(function (j) {
      return (j.results || []).map(function (x) {
        return { title: x.title || '', url: x.url || '', snippet: x.snippet || '', date: x.published_at || '' };
      });
    });
  };
})();
