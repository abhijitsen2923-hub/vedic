// Shared chrome for every logged-in portal page.
// initShell(activeKey):
//   1. enforces auth via requireAuth() (redirects to login on 401),
//   2. renders the header brand + nav (active link highlighted) + greeting + sign-out,
//   3. returns the student object so the page can render its data.
//
// Each page has an empty <header class="app-header" id="app-header"></header>;
// this fills it. Keeps the per-page scripts tiny and the nav defined in one place.

import { api, requireAuth, getCachedStudent, clearCachedStudent } from "./api-client.js";

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

// Owner's working timezone — naked datetime strings ("2026-05-29T18:00:00")
// from the sheet are anchored here so the viewer's browser can convert.
const SHEET_TZ_OFFSET = "+05:30";
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const NAKED_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

// Mirror of functions/_lib/dates.js for the browser. Kept inline (not imported
// from the backend module) so the static portal can stay framework-free.
function parseSheetDate(s) {
  if (typeof s !== "string" || !s) return NaN;
  if (DATE_ONLY_RE.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  if (NAKED_DATETIME_RE.test(s)) {
    return Date.parse(s + SHEET_TZ_OFFSET);
  }
  return Date.parse(s);
}

// "2026-05-29T18:00:00" → "29 May 2026, 6:00 pm IST" (viewer in IST) or
// "29 May 2026, 8:30 am EDT" (viewer in EDT). Timezone label is the viewer's,
// since that's the clock they actually read times against.
export function formatDateTime(s) {
  const ts = parseSheetDate(s);
  if (Number.isNaN(ts)) return escapeHtml(s || "—");
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatDate(s) {
  const ts = parseSheetDate(s);
  if (Number.isNaN(ts)) return escapeHtml(s || "—");
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Builds the header chrome once (nav + greeting + logout). `firstName` may be
// empty on first paint and filled in once the student is known.
function buildHeader(activeKey, firstName) {
  const header = document.getElementById("app-header");
  if (!header) return;

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
      <span class="user-greeting" id="user-greeting">${firstName ? "Hi, " + escapeHtml(firstName) : ""}</span>
      <button id="logout-btn" class="ghost-btn" type="button">Sign out</button>
    </div>`;

  header.querySelector("#logout-btn").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    clearCachedStudent();
    try {
      await api.logout();
    } catch {
      /* cookie is httpOnly; the redirect below is enough — next protected call 401s */
    }
    location.href = "/portal/login.html";
  });
}

function setGreeting(name) {
  const g = document.getElementById("user-greeting");
  const first = (name || "").split(" ")[0];
  if (g && first) g.textContent = `Hi, ${first}`;
}

// initShell(activeKey): paints the header/nav IMMEDIATELY (no blank wait), using
// the per-tab cached student if present. When cached, it returns right away and
// lets the page's own data endpoint enforce auth (401 → redirect) — this skips a
// redundant /api/auth/me round-trip on every navigation and right after login.
// With no cache (e.g. a fresh tab / direct link), it verifies via requireAuth.
export async function initShell(activeKey) {
  const cached = getCachedStudent();
  buildHeader(activeKey, cached ? cached.name : "");

  if (cached) return cached;

  const student = await requireAuth(); // redirects to login on 401, then throws
  setGreeting(student.name);
  return student;
}
