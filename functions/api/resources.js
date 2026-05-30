// GET /api/resources — resources for the student's enrolled courses.

import { json, error, studentIdFromRequest } from "../_lib/auth.js";
import { listStudentResources } from "../_lib/repos.js";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  try {
    const resources = await listStudentResources(env, studentId);
    return json({ resources });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "resources_failed", err: String(err) }));
    return error("Service temporarily unavailable", 503);
  }
};
