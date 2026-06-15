(function () {
  // Hydrates <div data-faq-course="..."> placeholders on course pages with
  // the FAQ accordion + language toggle. Data comes from /api/faqs (5-min
  // cache layered with localStorage for fast first paint, same pattern as
  // content.js). If a course has no FAQs in the sheet, the entire section
  // wrapper is hidden — no empty box.
  //
  // Placeholder markup (one per page):
  //   <section class="section-padding faq-section" style="...">
  //     <div class="container" style="max-width: 880px;">
  //       <div data-faq-course="numerology"
  //            data-faq-title="Numerology — FAQs"
  //            data-faq-subtitle="..."></div>
  //     </div>
  //   </section>

  var ENDPOINT_URL = "/api/faqs";
  var CACHE_KEY = "iva-faqs-cache-v1";
  var CACHE_TTL_MS = 5 * 60 * 1000;
  var LANG_LABEL = { en: "English", hi: "हिन्दी", bn: "বাংলা" };
  var LANG_ORDER = ["en", "hi", "bn"];

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
      if (!parsed || !parsed.faqs) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.faqs;
    } catch (e) {
      return null;
    }
  }

  function toCache(faqs) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ ts: Date.now(), faqs: faqs }),
      );
    } catch (e) {
      /* quota / private mode — ignore */
    }
  }

  function fetchFaqs() {
    return fetch(ENDPOINT_URL, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("faqs fetch failed: " + r.status);
        return r.json();
      })
      .then(function (data) {
        return (data && data.faqs) || {};
      });
  }

  function renderPane(courseId, lang, items, isDefault) {
    var accId = "faqAccordion-" + courseId + "-" + lang;
    var html =
      '<div class="faq-lang-pane" data-faq-pane="' + lang + '"' +
      (isDefault ? "" : " hidden") +
      (lang === "en" ? "" : ' lang="' + lang + '"') +
      '>' +
      '<div class="accordion" id="' + accId + '">';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var itemId = "faq-" + courseId + "-" + lang + "-" + (i + 1);
      var open = i === 0;
      html +=
        '<div class="accordion-item">' +
          '<h2 class="accordion-header">' +
            '<button class="accordion-button' + (open ? "" : " collapsed") +
              '" type="button" data-bs-toggle="collapse" data-bs-target="#' +
              itemId + '" aria-expanded="' + (open ? "true" : "false") +
              '" aria-controls="' + itemId + '">' +
              escapeHtml(item.question) +
            '</button>' +
          '</h2>' +
          '<div id="' + itemId + '" class="accordion-collapse collapse' +
            (open ? " show" : "") + '" data-bs-parent="#' + accId + '">' +
            '<div class="accordion-body">' + escapeHtml(item.answer) + '</div>' +
          '</div>' +
        '</div>';
    }
    html += "</div></div>";
    return html;
  }

  function renderPlaceholder(el, courseEntry) {
    // Build the list of available languages for this course in the canonical order.
    var langs = LANG_ORDER.filter(function (l) {
      return courseEntry[l] && courseEntry[l].length;
    });
    if (langs.length === 0) {
      hideSection(el);
      return;
    }

    var title = el.getAttribute("data-faq-title") || "FAQs";
    var subtitle = el.getAttribute("data-faq-subtitle") || "";

    var html =
      '<div class="text-center mb-4">' +
        '<h2 class="section-title title-gold-line-center">' + escapeHtml(title) + '</h2>' +
        (subtitle ? '<p class="text-secondary">' + escapeHtml(subtitle) + '</p>' : "") +
      '</div>';

    if (langs.length > 1) {
      html +=
        '<div class="faq-lang-toggle text-center mb-4" role="group" aria-label="FAQ language">';
      for (var i = 0; i < langs.length; i++) {
        var l = langs[i];
        var on = i === 0;
        html +=
          '<button type="button" class="btn btn-sm ' +
            (on ? "btn-gold active" : "btn-outline-gold") +
            '" data-faq-lang="' + l + '">' +
            escapeHtml(LANG_LABEL[l] || l) +
          '</button>';
      }
      html += "</div>";
    }

    for (var j = 0; j < langs.length; j++) {
      html += renderPane(el.getAttribute("data-faq-course"), langs[j], courseEntry[langs[j]], j === 0);
    }

    el.innerHTML = html;
    wireToggle(el);
  }

  function wireToggle(rootEl) {
    var buttons = rootEl.querySelectorAll(".faq-lang-toggle [data-faq-lang]");
    var panes = rootEl.querySelectorAll("[data-faq-pane]");
    if (!buttons.length) return;
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lang = btn.getAttribute("data-faq-lang");
        buttons.forEach(function (b) {
          var active = b === btn;
          b.classList.toggle("active", active);
          b.classList.toggle("btn-gold", active);
          b.classList.toggle("btn-outline-gold", !active);
        });
        panes.forEach(function (p) {
          p.hidden = p.getAttribute("data-faq-pane") !== lang;
        });
      });
    });
  }

  function hideSection(el) {
    // Walk up to the nearest <section>; hide it so we don't leave an empty wrapper.
    var section = el.closest("section");
    if (section) section.hidden = true;
    else el.hidden = true;
  }

  function apply(faqs) {
    var placeholders = document.querySelectorAll("[data-faq-course]");
    placeholders.forEach(function (el) {
      var courseId = el.getAttribute("data-faq-course");
      var entry = faqs[courseId];
      if (!entry) {
        hideSection(el);
        return;
      }
      renderPlaceholder(el, entry);
    });
  }

  function run() {
    var placeholders = document.querySelectorAll("[data-faq-course]");
    if (!placeholders.length) return;

    var cached = fromCache();
    if (cached) apply(cached);

    fetchFaqs()
      .then(function (faqs) {
        if (faqs && Object.keys(faqs).length) {
          apply(faqs);
          toCache(faqs);
        } else if (!cached) {
          // No data on first paint either → hide the section(s).
          placeholders.forEach(hideSection);
        }
      })
      .catch(function () {
        // Network / parse error — keep cache rendering or hide if first paint.
        if (!cached) placeholders.forEach(hideSection);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
