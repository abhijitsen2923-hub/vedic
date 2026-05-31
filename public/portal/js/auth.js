// Login form controller (login-only).
// Self-signup is intentionally disabled — students are created owner-side by
// adding a row to the Students tab (see portal-seed/). The register endpoint and
// api.register() still exist; to re-enable signup, restore the toggle + fields in
// login.html and the register branch here.

import { api, cacheStudent } from "./api-client.js";

const form = document.getElementById("auth-form");
const errorBox = document.getElementById("auth-error");
const submitBtn = document.getElementById("auth-submit");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add("visible");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.remove("visible");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  submitBtn.disabled = true;
  const previousLabel = submitBtn.textContent;
  submitBtn.innerHTML = '<span class="spinner spinner--btn"></span>Signing in…';

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    const res = await api.login(email, password);
    // Cache the profile so the dashboard paints instantly without re-fetching.
    if (res && res.student) cacheStudent(res.student);
    location.href = "/portal/dashboard.html";
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = previousLabel;
  }
});
