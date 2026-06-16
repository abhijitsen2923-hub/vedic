// GET /api/horoscopes — sheet-driven weekly horoscope content per zodiac sign.
//
// Reads the `Horoscopes` tab and returns a { [sign_id]: { week_label,
// content } } map. No auth — public marketing copy. Successful responses are
// cached 5 min at the edge + browser (stale-while-revalidate so a refresh
// never blocks rendering); failures are NOT cached so a transient Sheets
// outage cannot pin an empty map.

import { json } from "../_lib/auth.js";
import { getWeeklyHoroscopes } from "../_lib/repos.js";

export const onRequestGet = async ({ env }) => {
  try {
    const horoscopes = await getWeeklyHoroscopes(env);
    return json(
      { horoscopes },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return json({ horoscopes: {} }, { headers: { "Cache-Control": "no-store" } });
  }
};
