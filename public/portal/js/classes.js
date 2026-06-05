// Classes — upcoming (with a join link) and past sessions for enrolled courses.

import { initShell, escapeHtml, formatDateTime } from "./portal-shell.js";
import { api } from "./api-client.js";

function isHttp(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function classRow(c, { withJoin } = {}) {
  const courseLabel = c.course_missing
    ? '<span class="badge badge--muted">Course removed</span>'
    : escapeHtml(c.course_title || "");
  const join =
    withJoin && isHttp(c.meet_link)
      ? `<a class="btn btn--sm" href="${escapeHtml(c.meet_link)}" target="_blank" rel="noopener">Join</a>`
      : "";
  const duration = c.duration_min ? ` · ${escapeHtml(c.duration_min)} min` : "";
  return `
    <article class="list-card${c.course_missing ? " list-card--muted" : ""}">
      <div class="list-card__body">
        <h3>${escapeHtml(c.title || "Class")}</h3>
        <p class="muted">${courseLabel}</p>
        <p class="muted">${formatDateTime(c.scheduled_at)}${duration}</p>
      </div>
      <div class="list-card__action">${join}</div>
    </article>`;
}

(async () => {
  await initShell("classes");
  const upEl = document.getElementById("upcoming");
  const pastEl = document.getElementById("past");
  try {
    const { upcoming, past } = await api.classes();
    upEl.innerHTML = upcoming && upcoming.length
      ? upcoming.map((c) => classRow(c, { withJoin: true })).join("")
      : `<p class="empty-state">No upcoming classes.</p>`;
    pastEl.innerHTML = past && past.length
      ? past.map((c) => classRow(c)).join("")
      : `<p class="empty-state">No past classes yet.</p>`;
  } catch {
    upEl.innerHTML = "";
    pastEl.innerHTML = "";
    document.getElementById("page-error").hidden = false;
  }
})();
