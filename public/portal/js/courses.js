// Courses — the student's enrolled courses with progress.

import { initShell, escapeHtml, formatDate } from "./portal-shell.js";
import { api } from "./api-client.js";

function courseCard(enrollment) {
  if (enrollment.course_missing) {
    return `
    <article class="course-card course-card--missing">
      <span class="badge badge--muted">Course removed</span>
      <h3 class="muted">Course no longer available</h3>
      <p class="muted small">Contact the academy if this is unexpected.</p>
      <p class="course-card__meta muted">Enrolled ${formatDate(enrollment.enrolled_on)}</p>
    </article>`;
  }
  const c = enrollment.course || {};
  const pct = Number(enrollment.progress_pct) || 0;
  const total = c.total_modules || "—";
  const current = enrollment.current_module || 0;
  return `
    <article class="course-card">
      <span class="badge">${escapeHtml(c.category || "Course")}</span>
      <h3>${escapeHtml(c.title || "Untitled course")}</h3>
      <p class="muted">${escapeHtml(c.instructor_name || "")}</p>
      <div class="progress"><div class="progress__bar" style="width:${pct}%"></div></div>
      <p class="course-card__meta">Module ${escapeHtml(current)} of ${escapeHtml(total)} · ${pct}%</p>
      <p class="course-card__meta muted">Enrolled ${formatDate(enrollment.enrolled_on)}</p>
    </article>`;
}

(async () => {
  await initShell("courses");
  const grid = document.getElementById("courses");
  try {
    const { courses } = await api.courses();
    grid.innerHTML = courses && courses.length
      ? courses.map(courseCard).join("")
      : `<p class="empty-state">You're not enrolled in any courses yet.</p>`;
  } catch {
    grid.innerHTML = "";
    document.getElementById("page-error").hidden = false;
  }
})();
