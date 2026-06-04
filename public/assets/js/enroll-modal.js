(function () {
  // Shared enroll popup form — injected into every marketing page.
  // Auto-opens 2.5s after landing (once per session), and on click of any
  // [data-enroll-modal] element. Submits to the same Formspree enroll form
  // (mqeozdpo) as the inline forms, with source="enroll-popup" + page=<path>
  // so the dashboard distinguishes popup leads from inline leads.

  var FORMSPREE_ACTION = 'https://formspree.io/f/mqeozdpo';
  var AUTO_OPEN_DELAY_MS = 2500;
  var KEY_SUBMITTED = 'iva.enroll.submitted';
  var KEY_DISMISSED = 'iva.enroll.dismissed';
  var AUTO_OPEN_PATHS = [
    '/', '/index.html',
    '/numerology.html', '/palmistry.html', '/tarot-card.html',
    '/vastu-shastra.html', '/vedic-astrology.html',
    '/about-us.html'
  ];

  var MODAL_HTML = [
    '<div class="modal fade" id="enrollModal" tabindex="-1" aria-labelledby="enrollModalLabel" aria-hidden="true">',
    '  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">',
    '    <div class="modal-content iva-modal-content">',
    '      <button type="button" class="btn-close iva-modal-close" data-bs-dismiss="modal" aria-label="Close"></button>',
    '      <div class="modal-body p-4 p-md-5">',
    '        <h3 id="enrollModalLabel" class="iva-modal-title">Begin Your Journey</h3>',
    '        <p class="iva-modal-sub">Fill the form — our team will reach out shortly.</p>',
    '        <form id="enroll-modal-form" action="' + FORMSPREE_ACTION + '" method="POST" novalidate>',
    '          <input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">',
    '          <input type="hidden" name="_subject" value="New enrollment from popup">',
    '          <input type="hidden" name="source" value="enroll-popup">',
    '          <input type="hidden" name="page" value="">',
    '          <div class="mb-3"><input type="text" name="name" class="form-control" placeholder="Full Name *" required></div>',
    '          <div class="mb-3"><input type="tel" name="phone" class="form-control" placeholder="Phone Number *" required></div>',
    '          <div class="mb-3"><input type="email" name="_replyto" class="form-control" placeholder="Email Address *" required></div>',
    '          <div class="mb-3">',
    '            <select name="course" class="form-select" required>',
    '              <option value="">Select Course *</option>',
    '              <option>Vedic Astrology</option>',
    '              <option>Tarot Card Reading</option>',
    '              <option>Numerology</option>',
    '              <option>Palmistry</option>',
    '              <option>Vastu Shastra</option>',
    '              <option>Not sure yet — need guidance</option>',
    '            </select>',
    '          </div>',
    '          <button type="submit" class="btn btn-gold w-100 py-2 fw-bold">Submit Inquiry →</button>',
    '          <p class="form-status mt-3 mb-0" role="status" aria-live="polite"></p>',
    '        </form>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  var MODAL_CSS = [
    '.iva-modal-content{background:var(--bg-cream,#fff7e6);border:0;border-radius:18px;box-shadow:0 24px 60px rgba(40,20,5,.35);position:relative;overflow:hidden}',
    '.iva-modal-content::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(135deg,#f0c878,#d4a24c)}',
    '.iva-modal-close{position:absolute;top:14px;right:14px;z-index:2;opacity:.6}',
    '.iva-modal-close:hover{opacity:1}',
    '.iva-modal-title{font-family:"Playfair Display",Georgia,serif;font-size:1.6rem;margin:0 0 .25rem;color:var(--cosmic-deep,#1a0e2e);font-weight:600}',
    '.iva-modal-sub{color:#5c4a36;margin-bottom:1.25rem;font-size:.95rem}',
    '#enroll-modal-form .form-control,#enroll-modal-form .form-select{border-radius:50px;background:#fff;border:1px solid #e6d5b4;padding:.65rem 1rem;font-size:.95rem}',
    '#enroll-modal-form .form-control:focus,#enroll-modal-form .form-select:focus{border-color:#d4a24c;box-shadow:0 0 0 .2rem rgba(212,162,76,.18)}',
    '#enroll-modal-form .btn-gold{background:linear-gradient(135deg,#f0c878,#d4a24c);border:0;border-radius:50px;color:#1a0e2e;letter-spacing:.3px}',
    '#enroll-modal-form .btn-gold:hover{filter:brightness(1.05);color:#1a0e2e}',
    '#enroll-modal-form .form-status{font-size:.9rem;text-align:center;min-height:1.2em}'
  ].join('');

  function injectMarkup() {
    if (document.getElementById('enrollModal')) return;
    var style = document.createElement('style');
    style.id = 'iva-enroll-modal-style';
    style.textContent = MODAL_CSS;
    document.head.appendChild(style);

    var wrapper = document.createElement('div');
    wrapper.innerHTML = MODAL_HTML;
    document.body.appendChild(wrapper.firstElementChild);

    var pageField = document.querySelector('#enroll-modal-form input[name="page"]');
    if (pageField) pageField.value = window.location.pathname || '/';
  }

  function getBootstrapModal() {
    if (!window.bootstrap || !window.bootstrap.Modal) return null;
    var el = document.getElementById('enrollModal');
    if (!el) return null;
    return window.bootstrap.Modal.getOrCreateInstance(el);
  }

  function validate(form) {
    var bad = [];
    var required = form.querySelectorAll('[required]');
    for (var i = 0; i < required.length; i++) {
      var el = required[i];
      var v = (el.value || '').trim();
      if (!v) { bad.push(el); continue; }
      if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { bad.push(el); continue; }
      if (el.type === 'tel' && v.replace(/\D/g, '').length < 7) { bad.push(el); continue; }
    }
    return bad;
  }

  function wireSubmit() {
    var f = document.getElementById('enroll-modal-form');
    if (!f) return;
    var s = f.querySelector('.form-status');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var bad = validate(f);
      if (bad.length) {
        s.textContent = 'Please fill all required fields correctly.';
        s.style.color = '#8b1a1a';
        try { bad[0].focus(); } catch (_) {}
        return;
      }
      s.textContent = 'Sending...';
      s.style.color = '';
      try {
        var r = await fetch(f.action, {
          method: 'POST',
          body: new FormData(f),
          headers: { Accept: 'application/json' }
        });
        if (r.ok) {
          s.textContent = 'Thanks — we will contact you shortly.';
          s.style.color = '#2d5016';
          f.reset();
          try { sessionStorage.setItem(KEY_SUBMITTED, '1'); } catch (_) {}
          setTimeout(function () {
            var m = getBootstrapModal();
            if (m) m.hide();
          }, 1800);
        } else {
          var d = await r.json().catch(function () { return {}; });
          s.textContent = d.errors
            ? d.errors.map(function (x) { return x.message; }).join(', ')
            : 'Something went wrong.';
          s.style.color = '#8b1a1a';
        }
      } catch (_) {
        s.textContent = 'Network error. Please try again.';
        s.style.color = '#8b1a1a';
      }
    });
  }

  function wireTriggers() {
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-enroll-modal]');
      if (!t) return;
      var m = getBootstrapModal();
      if (!m) return; // Bootstrap missing → fall through to href="#enroll" anchor
      e.preventDefault();
      m.show();
    });
  }

  function wireDismissTracking() {
    var el = document.getElementById('enrollModal');
    if (!el) return;
    el.addEventListener('hidden.bs.modal', function () {
      try { sessionStorage.setItem(KEY_DISMISSED, '1'); } catch (_) {}
    });
  }

  function maybeAutoOpen() {
    try {
      if (sessionStorage.getItem(KEY_SUBMITTED) || sessionStorage.getItem(KEY_DISMISSED)) return;
    } catch (_) { /* private mode */ }
    var path = window.location.pathname || '/';
    if (AUTO_OPEN_PATHS.indexOf(path) === -1) return;
    setTimeout(function () {
      var m = getBootstrapModal();
      if (m) m.show();
    }, AUTO_OPEN_DELAY_MS);
  }

  function run() {
    injectMarkup();
    wireSubmit();
    wireTriggers();
    wireDismissTracking();
    maybeAutoOpen();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
