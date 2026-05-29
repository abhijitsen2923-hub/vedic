// Single entry-point Worker for the unified Workers + Static Assets deploy.
//
// Cloudflare's UI on this account doesn't expose the Pages Functions auto-mount
// flow, so instead of relying on filesystem-routed `functions/api/**`, we
// import each handler explicitly and route by URL here. The handler signatures
// (`{ request, env, params, waitUntil }` → `Response`) are identical to the
// Pages Functions convention, so the per-endpoint files in `functions/` are
// reused as-is without modification.
//
// When we add path-parameter routes in Phase 2 (e.g. `/api/courses/:id`),
// replace the exact-match lookup below with a tiny pattern matcher. For the
// auth + health surface in Phase 1 we don't need it.

import { onRequestGet as healthGet } from "../functions/api/health.js";
import { onRequestPost as loginPost } from "../functions/api/auth/login.js";
import { onRequestPost as registerPost } from "../functions/api/auth/register.js";
import { onRequestGet as meGet } from "../functions/api/auth/me.js";
import { onRequestPost as logoutPost } from "../functions/api/auth/logout.js";

const routes = {
  "GET /api/health":         healthGet,
  "POST /api/auth/login":    loginPost,
  "POST /api/auth/register": registerPost,
  "GET /api/auth/me":        meGet,
  "POST /api/auth/logout":   logoutPost,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const key = `${request.method} ${url.pathname}`;
    const handler = routes[key];

    if (handler) {
      return handler({
        request,
        env,
        params: {},
        waitUntil: ctx.waitUntil.bind(ctx),
      });
    }

    // Any other /api/* path → JSON 404. Don't fall through to static assets
    // (we'd otherwise return an HTML 404.html for an API call, which clients
    // can't parse as an error).
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // Everything else → static assets in `public/`. The asset binding handles
    // index resolution (e.g. `/portal/` → `/portal/index.html` if it exists)
    // and the `not_found_handling: "404-page"` setting in wrangler.jsonc
    // routes truly missing paths to `public/404.html`.
    return env.ASSETS.fetch(request);
  },
};
