// Domain-specific accessors over the Google Sheet tabs.
// Each function returns plain JS objects (record shape).
// Phase 1 only needs Students; later phases add Courses/Enrollments/Classes/Attendance/Resources.

import { readTab, appendRow, updateRowWhere } from "./sheets.js";
import { normalizeEmail } from "./validate.js";

// --- Students ---

export const STUDENTS_TAB = "Students";

export function publicProfile(student) {
  // Strip the password hash and any internal fields before returning to the client.
  if (!student) return null;
  const {
    password_hash, // eslint-disable-line no-unused-vars
    ...rest
  } = student;
  return rest;
}

export async function getStudentByEmail(env, email) {
  const normalized = normalizeEmail(email);
  const rows = await readTab(env, STUDENTS_TAB);
  return rows.find((r) => normalizeEmail(r.email) === normalized) || null;
}

export async function getStudentById(env, studentId) {
  const rows = await readTab(env, STUDENTS_TAB);
  return rows.find((r) => r.student_id === studentId) || null;
}

export async function createStudent(env, record) {
  await appendRow(env, STUDENTS_TAB, record);
  return record;
}

export async function updateStudent(env, studentId, patch) {
  const updated = await updateRowWhere(
    env,
    STUDENTS_TAB,
    (r) => r.student_id === studentId,
    patch,
  );
  if (!updated) throw new Error("student not found");
  return getStudentById(env, studentId);
}
