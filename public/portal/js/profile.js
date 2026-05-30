// Profile — show read-only fields and let the student edit name + phone.

import { initShell, formatDate } from "./portal-shell.js";
import { api, cacheStudent } from "./api-client.js";

const form = document.getElementById("profile-form");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const saveBtn = document.getElementById("save-btn");
const errEl = document.getElementById("form-error");
const okEl = document.getElementById("form-ok");

function fill(student) {
  document.getElementById("pf-email").textContent = student.email || "—";
  document.getElementById("pf-tier").textContent = student.tier || "—";
  document.getElementById("pf-joined").textContent = student.joined_date
    ? formatDate(student.joined_date)
    : "—";
  nameInput.value = student.name || "";
  phoneInput.value = student.phone || "";
  // Keep the cached profile (header greeting) in sync after edits.
  cacheStudent(student);
}

function showError(msg) {
  okEl.hidden = true;
  errEl.textContent = msg;
  errEl.hidden = false;
}

(async () => {
  await initShell("profile");
  try {
    const { student } = await api.profile();
    fill(student);
  } catch {
    showError("Could not load your profile. Please refresh.");
  }
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.hidden = true;
  okEl.hidden = true;
  saveBtn.disabled = true;
  const previous = saveBtn.textContent;
  saveBtn.textContent = "Saving…";

  try {
    const { student } = await api.updateProfile({
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
    });
    fill(student);
    okEl.hidden = false;
  } catch (err) {
    const detail = Array.isArray(err.details) && err.details.length ? err.details.join(", ") : err.message;
    showError(detail);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = previous;
  }
});
