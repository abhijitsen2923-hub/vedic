// GET /api/classes — the student's classes (already filtered to modules the
// student hasn't completed; see listStudentClasses), split into upcoming vs
// past. The Classes.status column overrides the timestamp split when set to
// "upcoming" or "ended"; otherwise scheduled_at vs now decides.

import { json, error, studentIdFromRequest } from "../_lib/auth.js";
import { listStudentClasses, isClassUpcoming } from "../_lib/repos.js";
import { parseSheetDate } from "../_lib/dates.js";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  try {
    const all = await listStudentClasses(env, studentId);
    const now = Date.now();
    const upcoming = [];
    const past = [];
    for (const c of all) {
      (isClassUpcoming(c, now) ? upcoming : past).push(c);
    }
    upcoming.sort(
      (a, b) => parseSheetDate(a.scheduled_at) - parseSheetDate(b.scheduled_at),
    );
    past.sort(
      (a, b) => parseSheetDate(b.scheduled_at) - parseSheetDate(a.scheduled_at),
    );
    return json({ upcoming, past });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "classes_failed", err: String(err) }));
    return error("Service temporarily unavailable", 503);
  }
};
