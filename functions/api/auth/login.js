// POST /api/auth/login — validates email + password, sets the iva_token cookie.
//
// Passwords are stored as plaintext in the Sheet's `password` column. We do a
// timing-safe equality check (avoids leaking match-position via response time)
// rather than a hash compare.

import {
  json,
  error,
  issueToken,
  buildAuthCookie,
  timingSafeEqual,
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

  // The Sheet column is `password`. Fall back to legacy `password_hash` so an
  // un-renamed sheet still authenticates while the owner migrates the header.
  const stored = student.password ?? student.password_hash;
  if (!timingSafeEqual(body.password, stored)) {
    return error("Invalid credentials", 401);
  }

  const token = await issueToken(env, student.student_id);
  return json(
    { student: publicProfile(student) },
    {
      status: 200,
      headers: { "Set-Cookie": buildAuthCookie(token, env) },
    },
  );
};
