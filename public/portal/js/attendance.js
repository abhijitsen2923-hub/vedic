// Attendance — a tally plus a table of the student's attendance records.

import { initShell, escapeHtml, formatDateTime } from "./portal-shell.js";
import { api } from "./api-client.js";

const STATE_BADGE = {
  present: '<span class="badge badge--ok">Present</span>',
  absent: '<span class="badge badge--err">Absent</span>',
  pending: '<span class="badge badge--muted">Pending</span>',
};

function durationCell(r) {
  if (r.participation_min == null) return "—";
  if (r.class_duration_min) {
    return `${r.participation_min} / ${r.class_duration_min} min`;
  }
  return `${r.participation_min} min`;
}

function summaryLine(s) {
  if (!s || s.total === 0) return "No classes recorded yet.";
  const graded = s.attended + s.absent;
  const ratePart = s.rate != null ? ` <span class="muted">(${s.rate}%)</span>` : "";
  const pendingPart = s.pending
    ? ` <span class="muted">· ${s.pending} pending</span>`
    : "";
  const word = graded === 1 ? "class" : "classes";
  return `Present in <strong>${s.attended}</strong> of <strong>${graded}</strong> graded ${word}${ratePart}${pendingPart}.`;
}

(async () => {
  await initShell("attendance");
  const summaryEl = document.getElementById("summary");
  const recordsEl = document.getElementById("records");
  try {
    const { records, summary } = await api.attendance();
    summaryEl.innerHTML = summaryLine(summary);

    if (!records || !records.length) {
      recordsEl.innerHTML = `<p class="empty-state">No attendance recorded yet.</p>`;
      return;
    }

    const rows = records
      .map((r) => {
        const titleCell = r.class_missing
          ? '<span class="muted">Class removed</span>'
          : escapeHtml(r.class_title || "—");
        const badge = STATE_BADGE[r.state] || STATE_BADGE.pending;
        return `
        <tr${r.class_missing ? ' class="row--muted"' : ""}>
          <td>${titleCell}</td>
          <td>${formatDateTime(r.scheduled_at)}</td>
          <td>${durationCell(r)}</td>
          <td>${badge}</td>
        </tr>`;
      })
      .join("");

    recordsEl.innerHTML = `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Class</th><th>When</th><th>Duration</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch {
    summaryEl.textContent = "";
    recordsEl.innerHTML = "";
    document.getElementById("page-error").hidden = false;
  }
})();
