// Attendance — a tally plus a table of the student's attendance records.

import { initShell, escapeHtml, formatDateTime } from "./portal-shell.js";
import { api } from "./api-client.js";

const counted = (v) => String(v).trim().toUpperCase() === "TRUE";

(async () => {
  await initShell("attendance");
  const summaryEl = document.getElementById("summary");
  const recordsEl = document.getElementById("records");
  try {
    const { records, summary } = await api.attendance();
    summaryEl.textContent = `You've been marked present for ${summary.attended} of ${summary.total} recorded ${summary.total === 1 ? "class" : "classes"}.`;

    if (!records || !records.length) {
      recordsEl.innerHTML = `<p class="empty-state">No attendance recorded yet.</p>`;
      return;
    }

    const rows = records
      .map(
        (r) => `
        <tr>
          <td>${escapeHtml(r.class_title || "—")}</td>
          <td>${formatDateTime(r.scheduled_at)}</td>
          <td>${
            counted(r.counted)
              ? '<span class="badge badge--ok">Present</span>'
              : '<span class="badge badge--muted">Absent</span>'
          }</td>
        </tr>`,
      )
      .join("");

    recordsEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Class</th><th>When</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch {
    summaryEl.textContent = "";
    recordsEl.innerHTML = "";
    document.getElementById("page-error").hidden = false;
  }
})();
