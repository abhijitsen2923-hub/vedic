// GET /api/classes — the student's classes, split into upcoming vs past by
// comparing scheduled_at to the current time (more reliable than the stored
// `status` column, which can go stale).

import { json, error, studentIdFromRequest } from "../_lib/auth.js";
import { listStudentClasses } from "../_lib/repos.js";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  try {
    const all = await listStudentClasses(env, studentId);
    const now = Date.now();
    const upcoming = [];
    const past = [];
    for (const c of all) {
      const ts = Date.parse(c.scheduled_at);
      (!Number.isNaN(ts) && ts >= now ? upcoming : past).push(c);
    }
    upcoming.sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
    past.sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));
    return json({ upcoming, past });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "classes_failed", err: String(err) }));
    return error("Service temporarily unavailable", 503);
  }
};
