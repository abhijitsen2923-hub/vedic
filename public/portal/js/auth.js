// Login + Register form controller.
// Toggleable between two modes. Both reach the same backend pattern but different endpoints.

import { api } from "./api-client.js";

const form = document.getElementById("auth-form");
const errorBox = document.getElementById("auth-error");
const submitBtn = document.getElementById("auth-submit");
const toggleLink = document.getElementById("toggle-mode");
const titleEl = document.getElementById("auth-title");
const subtitleEl = document.getElementById("auth-subtitle");
const nameField = document.getElementById("name-field");
const phoneField = document.getElementById("phone-field");
const academyCodeField = document.getElementById("academy-code-field");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const academyCodeInput = document.getElementById("academy_code");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

let mode = "login";

function showRegisterFields(show) {
  nameField.hidden = !show;
  phoneField.hidden = !show;
  academyCodeField.hidden = !show;
  nameInput.required = show;
  academyCodeInput.required = show;
  passwordInput.autocomplete = show ? "new-password" : "current-password";
}

function setMode(next) {
  mode = next;
  if (mode === "register") {
    titleEl.textContent = "Begin your journey";
    subtitleEl.textContent = "Create your IVA student account.";
    submitBtn.textContent = "Create account";
    toggleLink.textContent = "Already have an account? Sign in";
    showRegisterFields(true);
  } else {
    titleEl.textContent = "Welcome back";
    subtitleEl.textContent = "Sign in to continue your cosmic journey.";
    submitBtn.textContent = "Sign in";
    toggleLink.textContent = "New here? Create an account";
    showRegisterFields(false);
  }
  hideError();
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add("visible");
}

function hideError() {
  errorBox.textContent = "";
  errorBox.classList.remove("visible");
}

toggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  setMode(mode === "login" ? "register" : "login");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  submitBtn.disabled = true;
  const previousLabel = submitBtn.textContent;
  submitBtn.textContent = mode === "login" ? "Signing in…" : "Creating…";

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  try {
    if (mode === "login") {
      await api.login(email, password);
    } else {
      await api.register({
        name: nameInput.value.trim(),
        email,
        phone: phoneInput.value.trim(),
        password,
        academy_code: academyCodeInput.value.trim(),
      });
    }
    location.href = "/portal/dashboard.html";
  } catch (err) {
    showError(err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = previousLabel;
  }
});

setMode("login");
