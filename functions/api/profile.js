// GET  /api/profile — the logged-in student's public profile.
// PATCH /api/profile — update editable fields (name, phone) for that student.

import {
  json,
  error,
  studentIdFromRequest,
  requireClientHeader,
} from "../_lib/auth.js";
import { getStudentById, updateStudent, publicProfile } from "../_lib/repos.js";
import { validateProfilePatch, trim } from "../_lib/validate.js";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  try {
    const student = await getStudentById(env, studentId);
    if (!student) return error("Student not found", 404);
    return json({ student: publicProfile(student) });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "profile_get_failed", err: String(err) }));
    return error("Service temporarily unavailable", 503);
  }
};

export const onRequestPatch = async ({ request, env }) => {
  const csrf = requireClientHeader(request);
  if (csrf) return csrf;

  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return error("request body must be JSON", 422);
  }

  const errs = validateProfilePatch(body);
  if (errs.length) return json({ error: "Invalid input", details: errs }, { status: 422 });

  // Only these two fields are editable by the student.
  const patch = {};
  if ("name" in body) patch.name = trim(body.name);
  if ("phone" in body) patch.phone = trim(body.phone);
  if (Object.keys(patch).length === 0) {
    return error("No editable fields provided", 422);
  }

  try {
    const updated = await updateStudent(env, studentId, patch);
    return json({ student: publicProfile(updated) });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "profile_patch_failed", err: String(err) }));
    return error("Could not update profile", 503);
  }
};
