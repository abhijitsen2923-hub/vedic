// GET /api/faqs — sheet-driven, multi-language FAQ content for every course.
//
// Reads the `FAQs` tab (course_id, lang, order, question, answer) and returns
// them grouped: { [course_id]: { en: [...], hi: [...], bn: [...] } }.
// No auth and no CSRF gate — public marketing copy. Successful responses are
// cached 5 min at the edge + browser (stale-while-revalidate so a refresh
// never blocks rendering); failures are NOT cached so a transient Sheets
// outage cannot pin an empty map.

import { json } from "../_lib/auth.js";
import { getCourseFaqs } from "../_lib/repos.js";

export const onRequestGet = async ({ env }) => {
  try {
    const faqs = await getCourseFaqs(env);
    return json(
      { faqs },
      {
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    return json({ faqs: {} }, { headers: { "Cache-Control": "no-store" } });
  }
};
