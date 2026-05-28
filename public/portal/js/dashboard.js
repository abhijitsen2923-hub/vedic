// Dashboard placeholder. Phase 1 only confirms the auth round-trip works —
// shows the student's public profile + provides a logout button.

import { api, requireAuth } from "./api-client.js";

const greeting = document.getElementById("user-greeting");
const welcomeTitle = document.getElementById("welcome-title");
const profileDump = document.getElementById("profile-dump");
const logoutBtn = document.getElementById("logout-btn");

logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  try {
    await api.logout();
  } catch {
    /* even if the request fails, the cookie is httpOnly so the user can't manually clear it.
       The redirect below puts them at the login page; next attempted protected call will 401. */
  }
  location.href = "/portal/login.html";
});

(async () => {
  try {
    const student = await requireAuth();
    const firstName = (student.name || "").split(" ")[0] || "there";
    greeting.textContent = `Hi, ${firstName}`;
    welcomeTitle.textContent = `Welcome back, ${firstName}.`;
    profileDump.textContent = JSON.stringify(student, null, 2);
  } catch {
    profileDump.textContent = "Could not load your profile.";
  }
})();
