// POST /api/auth/register — gates self-signup by env.ACADEMY_CODE,
// appends a row to the Students tab, sets the iva_token cookie.
//
// The login.html UI no longer exposes this (owner-driven student creation),
// but the endpoint is kept for easy re-enable. Stores the password as plaintext
// in the Sheet's `password` column — matching the model documented in
// portal-seed/README.md.

import {
  json,
  error,
  issueToken,
  buildAuthCookie,
  requireClientHeader,
} from "../../_lib/auth.js";
import {
  validateRegister,
  normalizeEmail,
  trim,
  avatarInitials,
  newId,
} from "../../_lib/validate.js";
import {
  getStudentByEmail,
  createStudent,
  publicProfile,
} from "../../_lib/repos.js";

export const onRequestPost = async ({ request, env }) => {
  const csrf = requireClientHeader(request);
  if (csrf) return csrf;

  let body;
  try {
    body = await request.json();
  } catch {
    return error("request body must be JSON", 422);
  }
  const errs = validateRegister(body);
  if (errs.length) return json({ error: "Invalid input", details: errs }, { status: 422 });

  const expected = env.ACADEMY_CODE;
  if (!expected) {
    console.log(JSON.stringify({ level: "error", msg: "academy_code_env_missing" }));
    return error("Signup is not configured", 503);
  }
  if (trim(body.academy_code) !== expected) {
    return error("Invalid academy code", 403, "bad_academy_code");
  }

  const email = normalizeEmail(body.email);
  const existing = await getStudentByEmail(env, email);
  if (existing) {
    return error("An account with this email already exists", 409, "email_exists");
  }

  const name = trim(body.name);
  const phone = trim(body.phone);

  const student = {
    student_id: newId("STDNT"),
    name,
    email,
    phone,
    password: body.password, // plaintext, owner-managed sheet column
    tier: "Bronze",
    avatar_initials: avatarInitials(name),
    joined_date: new Date().toISOString().slice(0, 10),
  };

  try {
    await createStudent(env, student);
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "students_repo_write_failed", err: String(err) }));
    return error("Could not create account", 503);
  }

  const token = await issueToken(env, student.student_id);
  return json(
    { student: publicProfile(student) },
    {
      status: 201,
      headers: { "Set-Cookie": buildAuthCookie(token, env) },
    },
  );
};
