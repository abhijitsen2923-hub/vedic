// POST /api/auth/login — validates email + password, sets the iva_token cookie.

import {
  json,
  error,
  issueToken,
  buildAuthCookie,
  comparePassword,
  requireClientHeader,
} from "../../_lib/auth.js";
import { validateLogin, normalizeEmail } from "../../_lib/validate.js";
import { getStudentByEmail, publicProfile } from "../../_lib/repos.js";

export const onRequestPost = async ({ request, env }) => {
  const csrf = requireClientHeader(request);
  if (csrf) return csrf;

  let body;
  try {
    body = await request.json();
  } catch {
    return error("request body must be JSON", 422);
  }
  const errs = validateLogin(body);
  if (errs.length) return json({ error: "Invalid input", details: errs }, { status: 422 });

  const email = normalizeEmail(body.email);
  let student;
  try {
    student = await getStudentByEmail(env, email);
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "students_repo_read_failed", err: String(err) }));
    return error("Service temporarily unavailable", 503);
  }

  if (!student) return error("Invalid credentials", 401);
  const ok = await comparePassword(body.password, student.password_hash);
  if (!ok) return error("Invalid credentials", 401);

  const token = await issueToken(env, student.student_id);
  return json(
    { student: publicProfile(student) },
    {
      status: 200,
      headers: { "Set-Cookie": buildAuthCookie(token, env) },
    },
  );
};
