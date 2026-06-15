// GET /api/careers — sheet-driven job openings for the marketing careers page.
//
// Reads the `Careers` tab (job_id, role_title, location, type, description,
// apply_url, posted_date, is_active, order) and returns the active openings
// sorted by `order`. No auth — public marketing copy. Successful responses
// are cached 5 min at the edge + browser (stale-while-revalidate so a refresh
// never blocks rendering); failures are NOT cached so a transient Sheets
// outage cannot pin an empty list.

import { json } from "../_lib/auth.js";
import { getOpenJobs } from "../_lib/repos.js";

export const onRequestGet = async ({ env }) => {
  try {
    const jobs = await getOpenJobs(env);
    return json(
      { jobs },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return json({ jobs: [] }, { headers: { "Cache-Control": "no-store" } });
  }
};
