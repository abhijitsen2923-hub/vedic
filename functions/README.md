# functions/ — Cloudflare Pages Functions

Server-side code for the student portal. Each file under `api/` becomes an HTTP endpoint at the matching URL path: `functions/api/auth/login.js` → `POST /api/auth/login`. No separate backend, no Docker, no PaaS — Cloudflare runs these JS files at the edge.

Functions live at the **repo root** (not inside `public/`), as per Cloudflare's convention. Cloudflare Pages picks up the `functions/` folder automatically when the project is git-connected.

## Layout

```
functions/
├── _lib/                     shared modules (underscore prefix = not routed)
│   ├── sheets.js             Google Sheets REST API client (service-account JWT exchange + readers/writers)
│   ├── auth.js               JWT sign/verify, bcrypt compare, cookie helpers, JSON response helpers
│   ├── validate.js           input validators (email, password, profile patch) + small utilities
│   └── repos.js              domain accessors (Students; Courses/Enrollments/etc. arrive in Phase 2)
└── api/
    ├── health.js             GET  /api/health
    └── auth/
        ├── login.js          POST /api/auth/login
        ├── register.js       POST /api/auth/register
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
| `IVA_SHEET_ID` | The private "IVA Portal DB" Sheet ID. Different from the public marketing-content sheet. |
| `JWT_SECRET` | 64+ hex chars. Generate once: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Never rotate without invalidating all sessions. |
| `JWT_EXP_HOURS` | Session length. Default `24`. |
| `ACADEMY_CODE` | Shared signup secret. Owner gives this to enrolled students so they can self-register; gates `POST /api/auth/register`. Changeable any time from the CF dashboard (applies on next request). |
| `ENVIRONMENT` | `development` for local (relaxes `Secure` cookie flag); leave unset or `production` in prod. |

## Phase status

Phase 1 (shipped) — auth surface + health.
Phase 2 (next) — `/api/dashboard`, `/api/courses`, `/api/profile`.
Phase 3 — classes + attendance. Phase 4 — resources/recordings. Phase 5 — rate limiting + password change.

See [../public/portal/README.md](../public/portal/README.md) for the matching UI side.
