// Resources — lecture recordings / reading material for enrolled courses,
// grouped by course.

import { initShell, escapeHtml, formatDate } from "./portal-shell.js";
import { api } from "./api-client.js";

function isHttp(url) {
  return /^https?:\/\//i.test(String(url || ""));
}

function resourceItem(r) {
  const title = escapeHtml(r.title || "Resource");
  const badges =
    `<span class="badge badge--muted">${escapeHtml(r.type || "")}</span>` +
    (r.format ? `<span class="badge badge--muted">${escapeHtml(r.format)}</span>` : "");
  const titleHtml = isHttp(r.url_or_location)
    ? `<a href="${escapeHtml(r.url_or_location)}" target="_blank" rel="noopener">${title}</a>`
    : title;
  const where = isHttp(r.url_or_location)
    ? ""
    : `<p class="muted">${escapeHtml(r.url_or_location || "")}</p>`;
  return `
    <article class="list-card">
      <div class="list-card__body">
        <h3>${titleHtml}</h3>
        <p class="resource-badges">${badges}</p>
        ${where}
        <p class="muted">${escapeHtml(r.uploaded_by || "")}${r.upload_date ? " · " + formatDate(r.upload_date) : ""}</p>
      </div>
    </article>`;
}

function groupByCourse(resources) {
  const groups = new Map();
  for (const r of resources) {
    const key = r.course_title || "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return groups;
}

(async () => {
  await initShell("resources");
  const root = document.getElementById("resources");
  try {
    const { resources } = await api.resources();
    if (!resources || !resources.length) {
      root.innerHTML = `<p class="empty-state">No resources available yet.</p>`;
      return;
    }
    const groups = groupByCourse(resources);
    let html = "";
    for (const [course, items] of groups) {
      html += `<h2 class="section-title">${escapeHtml(course)}</h2>`;
      html += items.map(resourceItem).join("");
    }
    root.innerHTML = html;
  } catch {
    root.innerHTML = "";
    document.getElementById("page-error").hidden = false;
  }
})();
