// POST /api/auth/logout — clears the iva_token cookie. Idempotent.

import { json, buildClearCookie, requireClientHeader } from "../../_lib/auth.js";

export const onRequestPost = async ({ request, env }) => {
  const csrf = requireClientHeader(request);
  if (csrf) return csrf;
  return json(
    { ok: true },
    { headers: { "Set-Cookie": buildClearCookie(env) } },
  );
};
