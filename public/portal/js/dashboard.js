// Dashboard — summary of the student's next class, attendance, and course progress.

import { initShell, escapeHtml, formatDateTime } from "./portal-shell.js";
import { api } from "./api-client.js";

function courseCard(enrollment) {
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
    </article>`;
}

(async () => {
  const student = await initShell("dashboard");
  const first = (student.name || "").split(" ")[0] || "there";
  document.getElementById("welcome").textContent = `Welcome back, ${first}.`;

  try {
    const { courses, nextClass, attendance } = await api.dashboard();

    const nc = document.getElementById("next-class");
    if (nextClass) {
      nc.innerHTML = `
        <p class="stat-card__value">${escapeHtml(nextClass.title || "Class")}</p>
        <p class="muted">${escapeHtml(nextClass.course_title || "")}</p>
        <p class="muted">${formatDateTime(nextClass.scheduled_at)}</p>`;
    } else {
      nc.innerHTML = `<p class="muted">No upcoming classes scheduled.</p>`;
    }

    const att = attendance || { attended: 0, total: 0 };
    document.getElementById("attendance-summary").innerHTML =
      `<p class="stat-card__value">${att.attended} / ${att.total}</p>
       <p class="muted">classes attended</p>`;

    const grid = document.getElementById("courses");
    grid.innerHTML = courses && courses.length
      ? courses.map(courseCard).join("")
      : `<p class="empty-state">You're not enrolled in any courses yet.</p>`;
  } catch {
    document.getElementById("dash-error").hidden = false;
    document.getElementById("next-class").innerHTML = "";
    document.getElementById("attendance-summary").innerHTML = "";
    document.getElementById("courses").innerHTML = "";
  }
})();
