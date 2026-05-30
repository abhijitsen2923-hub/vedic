// GET /api/content — public marketing copy for the live-content loader.
//
// The marketing pages used to fetch a *public* Google Sheet directly from the
// browser (gviz). That required the sheet to be world-readable, so it couldn't
// share a file with the private student data. Now there is ONE private
// spreadsheet: this endpoint reads its `Content` tab server-side with the same
// service account used for the portal, so the file stays private and no sheet
// ID is ever exposed to the browser.
//
// No auth and no CSRF gate — it's a safe GET serving public copy. Successful
// responses are cached 5 min at the edge + browser (with stale-while-revalidate
// so a refresh never blocks rendering); failures are NOT cached so a transient
// Sheets outage can't pin an empty map (the browser falls back to HTML defaults
// and the next request retries immediately).

import { json } from "../_lib/auth.js";
import { getSiteContent } from "../_lib/repos.js";

export const onRequestGet = async ({ env }) => {
  try {
    const content = await getSiteContent(env);
    return json(
      { content },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    // Sheets unreachable / env not set → empty map, never cached.
    return json({ content: {} }, { headers: { "Cache-Control": "no-store" } });
  }
};
