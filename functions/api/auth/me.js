// GET /api/auth/me — returns the current student's public profile (401 if not signed in).

import { json, error, studentIdFromRequest } from "../../_lib/auth.js";
import { getStudentById, publicProfile } from "../../_lib/repos.js";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  const student = await getStudentById(env, studentId);
  if (!student) return error("Student not found", 404);

  return json({ student: publicProfile(student) });
};
