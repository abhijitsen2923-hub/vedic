(function () {
  // Hydrates the careers page with sheet-driven job openings.
  // Same fetch+cache pattern as content.js / faqs.js.
  //
  // Expected DOM (lives in public/careers.html):
  //   <select id="careers-select">
  //   <div id="careers-panel">
  //     <h2 id="careers-title">, <p id="careers-meta">,
  //     <div id="careers-description">, <a id="careers-apply">
  //   <div id="careers-empty" hidden>
  //   <div id="careers-controls">
  //
  // If the API returns no active jobs the controls hide and the empty-state
  // message shows instead.

  var ENDPOINT_URL = "/api/careers";
  var CACHE_KEY = "iva-careers-cache-v1";
  var CACHE_TTL_MS = 5 * 60 * 1000;

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
      if (!parsed || !parsed.jobs) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.jobs;
    } catch (e) { return null; }
  }

  function toCache(jobs) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), jobs: jobs }));
    } catch (e) { /* private mode / quota — ignore */ }
  }

  function fetchJobs() {
    return fetch(ENDPOINT_URL, { headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("careers fetch failed: " + r.status);
        return r.json();
      })
      .then(function (data) { return (data && data.jobs) || []; });
  }

  function paragraphHtml(text) {
    // Plain text → paragraphs split on a blank line (\n\n). Single newlines
    // inside a paragraph become <br>. HTML-escaped to avoid injection.
    var paras = String(text || "").split(/\n\s*\n/);
    return paras
      .map(function (p) {
        var inner = escapeHtml(p.trim()).replace(/\n/g, "<br>");
        return inner ? "<p>" + inner + "</p>" : "";
      })
      .filter(Boolean)
      .join("");
  }

  function metaLine(job) {
    var bits = [];
    if (job.location) bits.push(escapeHtml(job.location));
    if (job.type) bits.push(escapeHtml(job.type));
    if (job.posted_date) bits.push("Posted " + escapeHtml(job.posted_date));
    return bits.join(" &middot; ");
  }

  function renderJob(job, els) {
    els.title.textContent = job.role_title || "Job opening";
    els.meta.innerHTML = metaLine(job);
    els.description.innerHTML = paragraphHtml(job.description);
    els.apply.setAttribute("href", job.apply_url || "#");
  }

  function populate(jobs, els) {
    els.select.innerHTML = jobs
      .map(function (j, i) {
        var sel = i === 0 ? " selected" : "";
        return '<option value="' + escapeHtml(j.job_id || ("idx-" + i)) +
               '"' + sel + ">" + escapeHtml(j.role_title) + "</option>";
      })
      .join("");
    renderJob(jobs[0], els);
    els.select.addEventListener("change", function () {
      var pick = jobs.find(function (j, i) {
        var v = j.job_id || ("idx-" + i);
        return v === els.select.value;
      });
      if (pick) renderJob(pick, els);
    });
  }

  function apply(jobs, els) {
    if (!jobs || !jobs.length) {
      if (els.controls) els.controls.hidden = true;
      if (els.empty) els.empty.hidden = false;
      return;
    }
    if (els.controls) els.controls.hidden = false;
    if (els.empty) els.empty.hidden = true;
    populate(jobs, els);
  }

  function getEls() {
    var sel = document.getElementById("careers-select");
    if (!sel) return null;
    return {
      select: sel,
      controls: document.getElementById("careers-controls"),
      empty: document.getElementById("careers-empty"),
      title: document.getElementById("careers-title"),
      meta: document.getElementById("careers-meta"),
      description: document.getElementById("careers-description"),
      apply: document.getElementById("careers-apply"),
    };
  }

  function run() {
    var els = getEls();
    if (!els) return; // not the careers page

    var cached = fromCache();
    if (cached) apply(cached, els);

    fetchJobs()
      .then(function (jobs) {
        apply(jobs, els);
        if (jobs && jobs.length) toCache(jobs);
      })
      .catch(function () {
        // Network / parse error — keep cache rendering or show empty state.
        if (!cached) apply([], els);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
