(function () {
  // Owner: paste your Google Sheet ID here. Get it from the sheet URL:
  // docs.google.com/spreadsheets/d/<SHEET_ID>/edit
  // The sheet must be shared as "Anyone with the link -> Viewer".
  const SHEET_ID = '1D1Uh61KEE2As9D0iffeYvIhHlLGtRj33nhJ-T3Kd7lM';
  const SHEET_NAME = 'Content';
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

  function fetchSheet() {
    if (SHEET_ID === 'PASTE_SHEET_ID_HERE') return Promise.resolve(null);
    var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID +
              '/gviz/tq?tqx=out:json&headers=1&sheet=' + encodeURIComponent(SHEET_NAME);
    return fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('sheet fetch failed: ' + r.status);
      return r.text();
    }).then(function (text) {
      var m = text.match(/setResponse\(([\s\S]+)\);?\s*$/);
      if (!m) throw new Error('unexpected gviz response shape');
      var json = JSON.parse(m[1]);
      var rows = (json.table && json.table.rows) || [];
      var map = new Map();
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].c || [];
        var k = cells[0] && cells[0].v;
        var v = cells[1] && cells[1].v;
        if (k && v != null) map.set(String(k).trim(), String(v));
      }
      return map;
    });
  }

  function run() {
    var cached = fromCache();
    if (cached) apply(cached);

    fetchSheet().then(function (map) {
      if (map && map.size) { apply(map); toCache(map); }
    }).catch(function () { /* network/parse error - defaults stay */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
