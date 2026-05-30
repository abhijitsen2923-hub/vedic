// Shared chrome for every logged-in portal page.
// initShell(activeKey):
//   1. enforces auth via requireAuth() (redirects to login on 401),
//   2. renders the header brand + nav (active link highlighted) + greeting + sign-out,
//   3. returns the student object so the page can render its data.
//
// Each page has an empty <header class="app-header" id="app-header"></header>;
// this fills it. Keeps the per-page scripts tiny and the nav defined in one place.

import { api, requireAuth } from "./api-client.js";

const NAV = [
  { key: "dashboard", label: "Dashboard", href: "dashboard.html" },
  { key: "courses", label: "Courses", href: "courses.html" },
  { key: "classes", label: "Classes", href: "classes.html" },
  { key: "attendance", label: "Attendance", href: "attendance.html" },
  { key: "resources", label: "Resources", href: "resources.html" },
  { key: "profile", label: "Profile", href: "profile.html" },
];

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// "2026-05-29T18:00:00" -> "29 May 2026, 6:00 PM" (falls back to the raw string).
export function formatDateTime(s) {
  const ts = Date.parse(s);
  if (Number.isNaN(ts)) return escapeHtml(s || "—");
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(s) {
  const ts = Date.parse(s);
  if (Number.isNaN(ts)) return escapeHtml(s || "—");
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function initShell(activeKey) {
  const header = document.getElementById("app-header");
  const student = await requireAuth(); // redirects to login on 401, then throws
  const firstName = (student.name || "").split(" ")[0] || "there";

  if (header) {
    const links = NAV.map(
      (n) =>
        `<a href="${n.href}"${n.key === activeKey ? ' class="active" aria-current="page"' : ""}>${n.label}</a>`,
    ).join("");

    header.innerHTML = `
      <a class="brand-row" href="dashboard.html" aria-label="Dashboard home">
        <img src="/assets/img/logo.png" class="brand-logo brand-logo--sm" alt="International Vedic Academy" />
      </a>
      <nav class="portal-nav" aria-label="Portal sections">${links}</nav>
      <div class="app-header__actions">
        <span class="user-greeting">Hi, ${escapeHtml(firstName)}</span>
        <button id="logout-btn" class="ghost-btn" type="button">Sign out</button>
      </div>`;

    const logoutBtn = header.querySelector("#logout-btn");
    logoutBtn.addEventListener("click", async () => {
      logoutBtn.disabled = true;
      try {
        await api.logout();
      } catch {
        /* cookie is httpOnly; the redirect below is enough — next protected call 401s */
      }
      location.href = "/portal/login.html";
    });
  }

  return student;
}
