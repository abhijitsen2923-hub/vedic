(function () {
  // Hydrates the horoscopes page with sheet-driven weekly content.
  // Same fetch+cache pattern as content.js / faqs.js / careers.js.
  //
  // Expected DOM (lives in public/horoscopes.html):
  //   <p id="horoscope-week-label">         ← page lead text (gets the week label)
  //   <div id="horoscope-grid">              ← 12 tile cards on first paint
  //   <div id="horoscope-reading" hidden>   ← switcher + content panel after a tile click
  //   <div id="horoscope-loading">          ← skeleton until first render

  var ENDPOINT_URL = "/api/horoscopes";
  var CACHE_KEY = "iva-horoscopes-cache-v1";
  var CACHE_TTL_MS = 5 * 60 * 1000;

  // Static 12-sign catalog. Owner edits only the sheet content; this list
  // never changes between weeks.
  var SIGNS = [
    { id: "aries",       name: "Aries",       dates: "Mar 21 – Apr 19", glyph: "♈" },
    { id: "taurus",      name: "Taurus",      dates: "Apr 20 – May 20", glyph: "♉" },
    { id: "gemini",      name: "Gemini",      dates: "May 21 – Jun 20", glyph: "♊" },
    { id: "cancer",      name: "Cancer",      dates: "Jun 21 – Jul 22", glyph: "♋" },
    { id: "leo",         name: "Leo",         dates: "Jul 23 – Aug 22", glyph: "♌" },
    { id: "virgo",       name: "Virgo",       dates: "Aug 23 – Sep 22", glyph: "♍" },
    { id: "libra",       name: "Libra",       dates: "Sep 23 – Oct 22", glyph: "♎" },
    { id: "scorpio",     name: "Scorpio",     dates: "Oct 23 – Nov 21", glyph: "♏" },
    { id: "sagittarius", name: "Sagittarius", dates: "Nov 22 – Dec 21", glyph: "♐" },
    { id: "capricorn",   name: "Capricorn",   dates: "Dec 22 – Jan 19", glyph: "♑" },
    { id: "aquarius",    name: "Aquarius",    dates: "Jan 20 – Feb 18", glyph: "♒" },
    { id: "pisces",      name: "Pisces",      dates: "Feb 19 – Mar 20", glyph: "♓" }
  ];

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fromCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.horoscopes) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.horoscopes;
    } catch (e) { return null; }
  }

  function toCache(horoscopes) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), horoscopes: horoscopes }));
    } catch (e) { /* private mode / quota — ignore */ }
  }

  function fetchHoroscopes() {
    return fetch(ENDPOINT_URL, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("horoscopes fetch failed: " + r.status);
        return r.json();
      })
      .then(function (data) { return (data && data.horoscopes) || {}; });
  }

  function paragraphHtml(text) {
    var paras = String(text || "").split(/\n\s*\n/);
    return paras
      .map(function (p) {
        var inner = escapeHtml(p.trim()).replace(/\n/g, "<br>");
        return inner ? "<p>" + inner + "</p>" : "";
      })
      .filter(Boolean)
      .join("");
  }

  function pickWeekLabel(horoscopes) {
    // Use the first non-empty week_label across all signs (they're usually all
    // the same). Fallback to "This Week".
    for (var i = 0; i < SIGNS.length; i++) {
      var entry = horoscopes[SIGNS[i].id];
      if (entry && entry.week_label) return entry.week_label;
    }
    return "This Week";
  }

  function renderGrid(els, horoscopes) {
    var html = SIGNS.map(function (sign) {
      var entry = horoscopes[sign.id] || {};
      var empty = !entry.content;
      var btnLabel = empty ? "Coming soon" : "Read →";
      return (
        '<button type="button" class="horoscope-tile' + (empty ? " is-empty" : "") + '"' +
          ' data-sign="' + escapeHtml(sign.id) + '">' +
          '<div class="glyph" aria-hidden="true">' + sign.glyph + '</div>' +
          '<h3>' + escapeHtml(sign.name) + '</h3>' +
          '<p class="dates">' + escapeHtml(sign.dates) + '</p>' +
          '<span class="btn-read">' + btnLabel + '</span>' +
        '</button>'
      );
    }).join("");
    els.grid.innerHTML = html;

    Array.prototype.forEach.call(els.grid.querySelectorAll("[data-sign]"), function (btn) {
      btn.addEventListener("click", function () {
        showReading(btn.getAttribute("data-sign"), els, horoscopes);
      });
    });
  }

  function buildSwitcherHtml(activeSignId) {
    var chips = SIGNS.map(function (sign) {
      var active = sign.id === activeSignId ? " active" : "";
      return (
        '<button type="button" class="chip' + active + '"' +
          ' data-sign="' + escapeHtml(sign.id) + '"' +
          ' aria-label="' + escapeHtml(sign.name) + '"' +
          ' aria-pressed="' + (active ? "true" : "false") + '">' +
          '<span class="glyph" aria-hidden="true">' + sign.glyph + '</span>' +
          '<span class="label">' + escapeHtml(sign.name) + '</span>' +
        '</button>'
      );
    }).join("");
    return chips + '<button type="button" class="back" data-back="1">← Back</button>';
  }

  function buildPanelHtml(sign, entry) {
    var weekLabel = (entry && entry.week_label) ? entry.week_label : "This Week";
    var hasContent = entry && entry.content;
    var body = hasContent
      ? '<div class="content">' + paragraphHtml(entry.content) + '</div>'
      : '<div class="empty">We\'re updating this week\'s horoscope for ' +
        escapeHtml(sign.name) + '. Check back soon.</div>';
    return (
      '<div class="head">' +
        '<span class="glyph" aria-hidden="true">' + sign.glyph + '</span>' +
        '<h2>' + escapeHtml(sign.name) + '</h2>' +
      '</div>' +
      '<p class="meta">' + escapeHtml(sign.dates) + ' &middot; ' + escapeHtml(weekLabel) + '</p>' +
      body
    );
  }

  function renderReading(els, horoscopes, signId) {
    var sign = SIGNS.find(function (s) { return s.id === signId; }) || SIGNS[0];
    var entry = horoscopes[sign.id] || {};

    els.reading.innerHTML =
      '<div class="horoscope-switcher" role="toolbar" aria-label="Switch zodiac sign">' +
        buildSwitcherHtml(sign.id) +
      '</div>' +
      '<div class="horoscope-reading-panel">' +
        buildPanelHtml(sign, entry) +
      '</div>';

    // Wire chip clicks
    Array.prototype.forEach.call(els.reading.querySelectorAll(".chip[data-sign]"), function (btn) {
      btn.addEventListener("click", function () {
        renderReading(els, horoscopes, btn.getAttribute("data-sign"));
      });
    });
    // Wire back button
    var back = els.reading.querySelector(".back[data-back]");
    if (back) {
      back.addEventListener("click", function () { showGrid(els); });
    }
  }

  function showReading(signId, els, horoscopes) {
    if (els.grid) els.grid.hidden = true;
    if (els.reading) els.reading.hidden = false;
    renderReading(els, horoscopes, signId);
    // Soft scroll to top of the reading section so the switcher is visible.
    if (els.reading && els.reading.scrollIntoView) {
      els.reading.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function showGrid(els) {
    if (els.reading) {
      els.reading.hidden = true;
      els.reading.innerHTML = "";
    }
    if (els.grid) els.grid.hidden = false;
    if (els.grid && els.grid.scrollIntoView) {
      els.grid.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function apply(horoscopes, els) {
    if (els.loading) els.loading.hidden = true;
    // Update the hero lead with the week label
    if (els.weekLabel) {
      var label = pickWeekLabel(horoscopes);
      els.weekLabel.textContent = label + " — choose your sign to read the week ahead.";
    }
    renderGrid(els, horoscopes);
  }

  function getEls() {
    var grid = document.getElementById("horoscope-grid");
    if (!grid) return null;
    return {
      grid: grid,
      reading: document.getElementById("horoscope-reading"),
      loading: document.getElementById("horoscope-loading"),
      weekLabel: document.getElementById("horoscope-week-label"),
    };
  }

  function run() {
    var els = getEls();
    if (!els) return; // not the horoscope page

    var cached = fromCache();
    if (cached) apply(cached, els);

    fetchHoroscopes()
      .then(function (horoscopes) {
        apply(horoscopes || {}, els);
        if (horoscopes && Object.keys(horoscopes).length) toCache(horoscopes);
      })
      .catch(function () {
        // Network / parse error — if no cache yet, render the grid with empty
        // entries so users still see the 12 signs (each as "Coming soon").
        if (!cached) apply({}, els);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
