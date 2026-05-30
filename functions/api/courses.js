// GET /api/courses — the logged-in student's enrolled courses (with progress).

import { json, error, studentIdFromRequest } from "../_lib/auth.js";
import { listEnrolledCourses } from "../_lib/repos.js";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  try {
    const courses = await listEnrolledCourses(env, studentId);
    return json({ courses });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "courses_failed", err: String(err) }));
    return error("Service temporarily unavailable", 503);
  }
};
