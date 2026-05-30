(function () {
  // Live marketing copy is served by our own same-origin endpoint, which reads
  // the `Content` tab of the (private) Google Sheet via the service account.
  // No sheet ID lives in the browser — see functions/api/content.js.
  const CONTENT_URL = '/api/content';
  const CACHE_KEY = 'iva-content-cache-v1';
  const CACHE_TTL_MS = 5 * 60 * 1000;

  function apply(map) {
    document.querySelectorAll('[data-content]').forEach(function (el) {
      var key = el.getAttribute('data-content');
      if (map.has(key)) el.textContent = map.get(key);
    });
  }

  function fromCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.entries) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return new Map(parsed.entries);
    } catch (e) { return null; }
  }

  function toCache(map) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        ts: Date.now(),
        entries: Array.from(map.entries())
      }));
    } catch (e) { /* quota or disabled - ignore */ }
  }

  function fetchContent() {
    return fetch(CONTENT_URL, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('content fetch failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var obj = (data && data.content) || {};
        var map = new Map();
        Object.keys(obj).forEach(function (k) {
          if (obj[k] != null) map.set(String(k).trim(), String(obj[k]));
        });
        return map;
      });
  }

  function run() {
    var cached = fromCache();
    if (cached) apply(cached);

    fetchContent().then(function (map) {
      if (map && map.size) { apply(map); toCache(map); }
    }).catch(function () { /* network/parse error - defaults stay */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
