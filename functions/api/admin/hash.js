// POST /api/admin/hash — turn a plaintext password into the canonical PBKDF2
// hash string, for the in-sheet "Set / reset password" tool (Apps Script).
//
// Auth: a shared admin token in the `X-Admin-Token` header (env.ADMIN_TOKEN).
// This endpoint uses NO cookie/ambient credentials, so it is not CSRF-exploitable.
// It only hashes a value the caller already supplied — it never reads or returns
// any stored data.

import { json, error, hashPassword } from "../../_lib/auth.js";

export const onRequestPost = async ({ request, env }) => {
  if (!env.ADMIN_TOKEN || request.headers.get("X-Admin-Token") !== env.ADMIN_TOKEN) {
    return error("Forbidden", 403, "admin_token");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return error("request body must be JSON", 422);
  }

  const password = String(body.password ?? "");
  if (password.length < 6 || password.length > 200) {
    return error("password must be 6–200 characters", 422);
  }

  return json({ hash: await hashPassword(password) });
};
