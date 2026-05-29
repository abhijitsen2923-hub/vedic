// GET /api/health — confirms the function runtime and Sheets connectivity.
// Useful for first deploy: hit this endpoint to verify env vars + service account.

import { listTabs } from "../_lib/sheets.js";
import { json } from "../_lib/auth.js";

export const onRequestGet = async ({ env }) => {
  const out = {
    status: "ok",
    time: new Date().toISOString(),
    env: env.ENVIRONMENT || "production",
  };
  try {
    const tabs = await listTabs(env);
    out.sheet_reachable = true;
    out.sheet_tabs = tabs;
  } catch (err) {
    out.sheet_reachable = false;
    out.sheet_error = String(err.message || err);
  }
  return json(out);
};
