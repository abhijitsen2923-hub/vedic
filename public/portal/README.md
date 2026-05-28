# public/portal/ — student portal frontend

The logged-in area for enrolled students. Mounted at `/portal/*` (e.g. <https://internationalvedicacademy.com/portal/login.html>). Backed by Cloudflare Pages Functions at `/api/*` and a **private** Google Sheet — see [../../functions/README.md](../../functions/README.md) for the API side.

## Layout

```
portal/
├── login.html            login + register toggle (one page, two modes)
├── dashboard.html        Phase 1 placeholder — full UI lands in Phase 2
├── css/
│   └── portal.css        shared design tokens, auth-page layout, app-page chrome
└── js/
    ├── api-client.js     single fetch wrapper (cookie auth, error shape, 401 handling)
    ├── auth.js           login + register form controller
    └── dashboard.js      placeholder: requires auth, shows profile JSON
```

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
await api.register({ name, email, password, phone, academy_code });
await api.me();                        // → { student }
await api.logout();                    // → clears cookie

await requireAuth();                   // hits /api/auth/me, redirects to login on 401
```

Errors throw `Error` instances with `.status`, `.code`, and `.details` populated from the Function's JSON error response. A 401 from a protected endpoint redirects the browser to `/portal/login.html` (except when already on the login page).

## Phase 1 (shipped) vs roadmap

Shipped: login, register, logout, /api/auth/me round-trip; dashboard placeholder.

Pending phases (see `C:\Users\kisho\.claude\plans\…` for detail):
- **Phase 2** — dashboard data, my-courses, profile (read + edit)
- **Phase 3** — classes (next + join), attendance summary + log
- **Phase 4** — resources + recordings + remaining mostly-static pages
- **Phase 5** — rate limiting, password change, sitemap/robots tweaks for `/portal/*`

Until those land, do not link from marketing pages to portal sub-pages other than `/portal/login.html`.

## Visual coherence with the marketing site

The portal CSS uses the same design tokens as the marketing site:

```
--bg-cream, --bg-cream-deep, --bg-white
--ink, --ink-soft, --ink-muted
--cosmic-deep, --cosmic-mid, --cosmic-purple
--gold, --gold-bright, --gold-deep
```

When adjusting visuals on the portal, prefer changing tokens in `css/portal.css` to keep the marketing-site overall feel intact.
