# functions/ — Cloudflare Pages Functions

Server-side code for the student portal. Each file under `api/` becomes an HTTP endpoint at the matching URL path: `functions/api/auth/login.js` → `POST /api/auth/login`. No separate backend, no Docker, no PaaS — Cloudflare runs these JS files at the edge.

Functions live at the **repo root** (not inside `public/`), as per Cloudflare's convention. Cloudflare Pages picks up the `functions/` folder automatically when the project is git-connected.

## Layout

```
functions/
├── _lib/                     shared modules (underscore prefix = not routed)
│   ├── sheets.js             Google Sheets REST API client (service-account JWT exchange + readers/writers)
│   ├── auth.js               JWT sign/verify, timingSafeEqual, cookie helpers, JSON response helpers
│   ├── validate.js           input validators (email, password, profile patch) + small utilities
│   └── repos.js              domain accessors (Students + site Content; Courses/Enrollments/etc. arrive in Phase 2)
└── api/
    ├── health.js             GET  /api/health
    ├── content.js            GET  /api/content     (public marketing copy from the Content tab)
    ├── dashboard.js          GET  /api/dashboard   (student summary: courses, next class, attendance)
    ├── courses.js            GET  /api/courses     (student's enrolled courses + progress)
    ├── classes.js            GET  /api/classes     (upcoming + past classes for enrolled courses)
    ├── attendance.js         GET  /api/attendance  (student's attendance records + tally)
    ├── resources.js          GET  /api/resources   (resources for enrolled courses)
    ├── profile.js            GET + PATCH /api/profile (read / edit name+phone)
    └── auth/
        ├── login.js          POST /api/auth/login
        ├── register.js       POST /api/auth/register  (live, but signup UI is hidden — see portal README)
        ├── me.js             GET  /api/auth/me
        └── logout.js         POST /api/auth/logout
```

## Endpoint conventions

Every endpoint follows the same shape, so the frontend can handle them uniformly.

**Method handler exports** — one per HTTP method:
```js
export const onRequestGet = async ({ request, env, params }) => { … };
export const onRequestPost = async ({ request, env }) => { … };
```

**Response helpers** (from `_lib/auth.js`):
```js
return json({ student });                          // 200 with JSON body
return json({ courses }, { status: 201 });         // any other status
return error("Invalid credentials", 401);          // → { error: "Invalid credentials" }
return error("Email exists", 409, "email_exists"); // → { error, code }
```

**Status codes used by this project**:
| Status | Meaning |
|---|---|
| 200 / 201 | Success |
| 401 | Not authenticated (no/invalid token cookie) |
| 403 | Authenticated but forbidden (e.g., bad academy code, missing CSRF header) |
| 404 | Resource not found |
| 409 | Conflict (e.g., email already registered) |
| 422 | Validation failed — body includes `details: [string, …]` |
| 503 | Upstream issue (Sheets unreachable, missing env vars) |

**CSRF gate**: all unsafe methods (POST/PATCH/PUT/DELETE) require the `X-IVA-Client: portal` header. `requireClientHeader(request)` returns a 403 response if missing; endpoints early-return that. The portal frontend's `api-client.js` adds the header automatically.

**Cookies**: `auth.js` exports `buildAuthCookie(token, env)` and `buildClearCookie(env)`. They emit `HttpOnly; SameSite=Lax; Secure; Path=/; Max-Age=…` in production and drop `Secure` in dev (local wrangler runs over plain HTTP).

**Auth gate**: protected endpoints call `await studentIdFromRequest(env, request)`; if it returns `null`, respond 401.

## How to add a new endpoint

Example: `GET /api/courses` listing the current student's enrollments.

1. Create `functions/api/courses/index.js`:
   ```js
   import { json, error, studentIdFromRequest } from "../../_lib/auth.js";
   import { listEnrolledCourses } from "../../_lib/repos.js"; // add this in repos.js

   export const onRequestGet = async ({ request, env }) => {
     const studentId = await studentIdFromRequest(env, request);
     if (!studentId) return error("Not authenticated", 401);
     const courses = await listEnrolledCourses(env, studentId);
     return json({ courses });
   };
   ```
2. Add `listEnrolledCourses(env, studentId)` to `_lib/repos.js` using `readTab(env, "Enrollments")` + `readTab(env, "Courses")` + a join.
3. In the portal frontend, add a method to `api-client.js`:
   ```js
   courses: () => request("/api/courses"),
   ```
4. Deploy. No build step beyond `npm install` (which Cloudflare runs automatically).

## Environment variables

All set in **Cloudflare Pages → Settings → Environment variables** (Production). Mirror them in `.dev.vars` for local `wrangler pages dev`.

| Variable | What it is |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON of the service-account key. The function parses it on first request and caches the access token in memory (per Worker isolate). |
| `IVA_SHEET_ID` | The single private "IVA Portal DB" Sheet ID. Holds **all** tabs — student data **and** the `Content` tab that drives the marketing pages. There is no separate public marketing sheet. Required for live marketing content (pages fall back to HTML defaults if unset). |
| `JWT_SECRET` | 64+ hex chars. Generate once: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Never rotate without invalidating all sessions. |
| `JWT_EXP_HOURS` | Session length. Default `24`. |
| `ACADEMY_CODE` | Shared signup secret that gates `POST /api/auth/register`. The self-signup UI is hidden, so this is unused at the moment but kept for easy re-enable. Changeable any time. |
| `ENVIRONMENT` | `development` for local (relaxes `Secure` cookie flag); leave unset or `production` in prod. |

## Passwords

Passwords are stored as **plaintext** in the Students tab's `password` column (column E). Login does a **timing-safe equality check** between the submitted password and the cell value — no hashing, no salt, no derive step. The owner manages passwords by typing them into the sheet:

- **New student**: append a row, type the password, tell the student.
- **Reset**: overwrite the `password` cell, tell the student.

This trades the "stolen hash can't be cracked to plaintext" property of bcrypt/PBKDF2 for sheet-edit simplicity. The sheet must stay **Restricted** (only the service account + owner can read). The login endpoint also falls back to a legacy `password_hash` column name if present, so a sheet that hasn't been renamed yet still authenticates while the owner renames the header.

## Phase status

Phase 1 (shipped) — auth surface + health.
Phase 2–4 (shipped) — `/api/dashboard`, `/api/courses`, `/api/classes`, `/api/attendance`, `/api/resources`, `/api/profile` (GET + PATCH). All are auth-gated and scoped to the logged-in student (id from the cookie, never a request param), read-only except profile (name/phone). Reads are live (no caching) so sheet edits show on the next page load.
Phase 5 (next) — rate limiting + password change.

See [../public/portal/README.md](../public/portal/README.md) for the matching UI side.
