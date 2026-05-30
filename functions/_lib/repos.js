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

// --- Portal data (Courses / Enrollments / Classes / Attendance / Resources) ---
//
// All of these are READ-only from the portal's perspective — the owner maintains
// the rows by editing the sheet. Every accessor is scoped to a single student_id
// (which the endpoints derive from the auth cookie, never from the request body).
// Joins are done in memory: read the tabs, build a lookup Map, stitch.

export const COURSES_TAB = "Courses";
export const ENROLLMENTS_TAB = "Enrollments";
export const CLASSES_TAB = "Classes";
export const ATTENDANCE_TAB = "Attendance";
export const RESOURCES_TAB = "Resources";

function courseMap(courses) {
  return new Map(courses.map((c) => [c.course_id, c]));
}

function enrolledCourseIds(enrollments, studentId) {
  return new Set(
    enrollments
      .filter((e) => e.student_id === studentId)
      .map((e) => e.course_id),
  );
}

// Enrollments for the student, each joined with its course record.
export async function listEnrolledCourses(env, studentId) {
  const [enrollments, courses] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, COURSES_TAB),
  ]);
  const byId = courseMap(courses);
  return enrollments
    .filter((e) => e.student_id === studentId)
    .map((e) => ({ ...e, course: byId.get(e.course_id) || null }));
}

// Classes belonging to the student's enrolled courses, with the course title attached.
export async function listStudentClasses(env, studentId) {
  const [enrollments, classes, courses] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, CLASSES_TAB),
    readTab(env, COURSES_TAB),
  ]);
  const mine = enrolledCourseIds(enrollments, studentId);
  const byId = courseMap(courses);
  return classes
    .filter((c) => mine.has(c.course_id))
    .map((c) => ({ ...c, course_title: byId.get(c.course_id)?.title || "" }));
}

// The student's attendance rows, joined to the class title + scheduled_at.
export async function listStudentAttendance(env, studentId) {
  const [attendance, classes] = await Promise.all([
    readTab(env, ATTENDANCE_TAB),
    readTab(env, CLASSES_TAB),
  ]);
  const classById = new Map(classes.map((c) => [c.class_id, c]));
  return attendance
    .filter((a) => a.student_id === studentId)
    .map((a) => {
      const cls = classById.get(a.class_id) || null;
      return {
        ...a,
        class_title: cls?.title || "",
        scheduled_at: cls?.scheduled_at || "",
      };
    });
}

// Resources for the student's enrolled courses, with the course title attached.
export async function listStudentResources(env, studentId) {
  const [enrollments, resources, courses] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, RESOURCES_TAB),
    readTab(env, COURSES_TAB),
  ]);
  const mine = enrolledCourseIds(enrollments, studentId);
  const byId = courseMap(courses);
  return resources
    .filter((r) => mine.has(r.course_id))
    .map((r) => ({ ...r, course_title: byId.get(r.course_id)?.title || "" }));
}

function isCounted(v) {
  return String(v).trim().toUpperCase() === "TRUE";
}

// Dashboard summary — reads the needed tabs once and assembles:
//  { courses, nextClass, attendance: { attended, total } }
export async function getDashboard(env, studentId) {
  const [enrollments, courses, classes, attendance] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, COURSES_TAB),
    readTab(env, CLASSES_TAB),
    readTab(env, ATTENDANCE_TAB),
  ]);
  const byId = courseMap(courses);
  const myEnrollments = enrollments.filter((e) => e.student_id === studentId);
  const mine = new Set(myEnrollments.map((e) => e.course_id));

  const enrolledCourses = myEnrollments.map((e) => ({
    ...e,
    course: byId.get(e.course_id) || null,
  }));

  // Next upcoming class across enrolled courses (earliest scheduled_at >= now).
  const now = Date.now();
  const upcoming = classes
    .filter((c) => mine.has(c.course_id))
    .map((c) => ({
      ...c,
      course_title: byId.get(c.course_id)?.title || "",
      _ts: Date.parse(c.scheduled_at),
    }))
    .filter((c) => !Number.isNaN(c._ts) && c._ts >= now)
    .sort((a, b) => a._ts - b._ts);
  const nextClass = upcoming.length ? upcoming[0] : null;
  if (nextClass) delete nextClass._ts;

  const myAttendance = attendance.filter((a) => a.student_id === studentId);
  const attended = myAttendance.filter((a) => isCounted(a.counted)).length;

  return {
    courses: enrolledCourses,
    nextClass,
    attendance: { attended, total: myAttendance.length },
  };
}

// --- Marketing site content ---

export const CONTENT_TAB = "Content";

// Flatten the Content tab (headers: key,value,notes) into a { key: value } map
// for the marketing pages' live-content loader (public/assets/js/content.js).
export async function getSiteContent(env) {
  const rows = await readTab(env, CONTENT_TAB);
  const map = {};
  for (const r of rows) {
    const key = (r.key || "").trim();
    if (key && r.value != null && r.value !== "") map[key] = String(r.value);
  }
  return map;
}
