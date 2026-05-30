// GET /api/dashboard — summary for the logged-in student:
// enrolled courses, the next upcoming class, and an attendance tally.

import { json, error, studentIdFromRequest } from "../_lib/auth.js";
import { getDashboard } from "../_lib/repos.js";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  try {
    const data = await getDashboard(env, studentId);
    return json(data);
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "dashboard_failed", err: String(err) }));
    return error("Service temporarily unavailable", 503);
  }
};
