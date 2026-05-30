# public/portal/ — student portal frontend

The logged-in area for enrolled students. Mounted at `/portal/*` (e.g. <https://internationalvedicacademy.com/portal/login.html>). Backed by Cloudflare Pages Functions at `/api/*` and a **private** Google Sheet — see [../../functions/README.md](../../functions/README.md) for the API side.

## Layout

```
portal/
├── login.html            login-only (signup UI hidden — see below)
├── dashboard.html        summary: next class, attendance, course progress
├── courses.html          enrolled courses + progress
├── classes.html          upcoming (with join link) + past classes
├── attendance.html       attendance tally + table
├── resources.html        recordings / readings, grouped by course
├── profile.html          view + edit name/phone
├── css/
│   └── portal.css        shared design tokens, auth-page layout, app-page chrome
└── js/
    ├── api-client.js     single fetch wrapper (cookie auth, error shape, 401 handling)
    ├── portal-shell.js   initShell(active): requireAuth + renders header/nav + logout
    ├── auth.js           login form controller (login-only)
    ├── dashboard.js      ┐
    ├── courses.js        │ one controller per page; each does
    ├── classes.js        │   `const student = await initShell("<key>");`
    ├── attendance.js     │   then fetches its data via api.* and renders
    ├── resources.js      │
    └── profile.js        ┘
```

Every logged-in page has an empty `<header class="app-header" id="app-header">` that `portal-shell.js` fills with the brand + nav (Dashboard · Courses · Classes · Attendance · Resources · Profile) + Sign out. Add a new page by copying any page's HTML skeleton + a small `js/<page>.js` that calls `initShell("<key>")`.

## Conventions

- **HTML / CSS / JS strictly separated**. No inline `<style>` or `<script>` in the portal pages (the marketing site does that — the portal does not).
- **ES modules**. Page scripts use `import { api } from "./js/api-client.js"`. All `fetch` calls go through `api-client.js` so the auth/error contract is enforced in one place.
- **Cookie auth**. The browser never sees the JWT — `iva_token` is set httpOnly by the Function and sent automatically on same-origin requests.
- **CSRF gate**. Writes carry an `X-IVA-Client: portal` header (added automatically by `api-client.js`). Functions reject writes without it.
- **`noindex, nofollow`** meta tags on every portal page — student pages never reach search engines.

## `api-client.js` contract

```js
import { api, requireAuth } from "./api-client.js";

await api.login(email, password);      // → sets cookie via Set-Cookie
await api.me();                        // → { student }
await api.logout();                    // → clears cookie

// Portal data (all scoped server-side to the logged-in student):
await api.dashboard();                 // → { courses, nextClass, attendance }
await api.courses();                   // → { courses }
await api.classes();                   // → { upcoming, past }
await api.attendance();                // → { records, summary }
await api.resources();                 // → { resources }
await api.profile();                   // → { student }
await api.updateProfile({ name, phone }); // PATCH → { student }

await requireAuth();                   // hits /api/auth/me, redirects to login on 401
```

`api.register(...)` still exists but the signup UI is hidden (see below). Errors throw `Error` instances with `.status`, `.code`, and `.details` populated from the Function's JSON error response. A 401 from a protected endpoint redirects the browser to `/portal/login.html` (except when already on the login page).

## Data freshness

Portal pages fetch on load and the endpoints read the sheet live (no caching), so any edit to the sheet (new enrollment, updated progress, new class/resource row) appears on the **next page load/refresh** — no redeploy. Keep the header row / column names and the ID foreign keys (`student_id`, `course_id`, `class_id`) intact or joins silently drop rows.

## Signup disabled (login-only)

Students are created owner-side (append a row to the `Students` tab + hash the password with `portal-seed/hash-password.html`), so self-signup is hidden: `login.html` shows only Email + Password, and `auth.js` only logs in. The `POST /api/auth/register` endpoint and `api.register()` are still present, so re-enabling is just restoring the toggle link + register fields in `login.html` and the register branch in `auth.js`.

## Roadmap

Shipped: login/logout, dashboard, courses, classes, attendance, resources, profile (read + edit).
- **Phase 5 (next)** — rate limiting, password change, sitemap/robots tweaks for `/portal/*`.

You can now link students to `/portal/login.html`; the rest is reachable after sign-in via the nav.

## Visual coherence with the marketing site

The portal CSS uses the same design tokens as the marketing site:

```
--bg-cream, --bg-cream-deep, --bg-white
--ink, --ink-soft, --ink-muted
--cosmic-deep, --cosmic-mid, --cosmic-purple
--gold, --gold-bright, --gold-deep
```

When adjusting visuals on the portal, prefer changing tokens in `css/portal.css` to keep the marketing-site overall feel intact.
