// Domain-specific accessors over the Google Sheet tabs.
// Each function returns plain JS objects (record shape).
// Phase 1 only needs Students; later phases add Courses/Enrollments/Classes/Attendance/Resources.

import { readTab, appendRow, updateRowWhere } from "./sheets.js";
import { normalizeEmail } from "./validate.js";

// --- Students ---

export const STUDENTS_TAB = "Students";

export function publicProfile(student) {
  // Strip the password (and any legacy `password_hash` cell still around) before
  // returning to the client. Frontend never sees the credential.
  if (!student) return null;
  const {
    password, // eslint-disable-line no-unused-vars
    password_hash, // eslint-disable-line no-unused-vars  (legacy column name, dropped silently if present)
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

// current_module clamped against the course's total_modules (a typo in the
// sheet that sets current_module=99 on a 10-module course caps at 10, not
// blows up the progress %). Returns the integer count of completed modules.
function clampedCurrentModule(enrollment, course) {
  const total = Number(course?.total_modules) || 0;
  const raw = Number(enrollment.current_module) || 0;
  return total > 0 ? Math.min(raw, total) : raw;
}

// Enrich an enrollment with the joined course + computed progress %. The raw
// `progress_pct` cell from the sheet is ignored — always recomputed here as
// floor(current_module / total_modules * 100) so the number can't drift.
function withComputedProgress(enrollment, course) {
  const current = clampedCurrentModule(enrollment, course);
  const total = Number(course?.total_modules) || 0;
  const progress_pct = total > 0 ? Math.floor((current / total) * 100) : 0;
  return { ...enrollment, current_module: current, progress_pct, course: course || null };
}

// Per-course "modules completed by this student" map. Classes / Resources for
// module_number ≤ that value are filtered out (the student already passed
// that module). module_number=0 or blank → always visible (general sessions).
function studentProgressByCourse(enrollments, courses, studentId) {
  const byCourse = courseMap(courses);
  return new Map(
    enrollments
      .filter((e) => e.student_id === studentId)
      .map((e) => [e.course_id, clampedCurrentModule(e, byCourse.get(e.course_id))]),
  );
}

// True when `module_number` indicates the row should be visible given the
// student's current progress on that course. Rows without a module_number
// (null / 0 / blank) are treated as "applies to everyone".
function passesModuleGate(moduleNumber, currentModule) {
  const m = Number(moduleNumber) || 0;
  if (m === 0) return true;
  return m > currentModule;
}

// Honor the Classes.status column as an override on top of the timestamp split.
// "ended" → force into past (cancellation / manual close).
// "upcoming" → force into upcoming (overrides a stale timestamp).
// blank / anything else → fall back to scheduled_at vs now.
export function isClassUpcoming(c, nowMs) {
  const status = String(c.status || "").trim().toLowerCase();
  if (status === "ended") return false;
  if (status === "upcoming") return true;
  const ts = Date.parse(c.scheduled_at);
  return !Number.isNaN(ts) && ts >= nowMs;
}

// Enrollments for the student, each joined with its course record + computed progress.
export async function listEnrolledCourses(env, studentId) {
  const [enrollments, courses] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, COURSES_TAB),
  ]);
  const byId = courseMap(courses);
  return enrollments
    .filter((e) => e.student_id === studentId)
    .map((e) => withComputedProgress(e, byId.get(e.course_id)));
}

// Classes belonging to the student's enrolled courses, filtered to modules the
// student hasn't completed yet. Course title attached for the UI.
export async function listStudentClasses(env, studentId) {
  const [enrollments, classes, courses] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, CLASSES_TAB),
    readTab(env, COURSES_TAB),
  ]);
  const byId = courseMap(courses);
  const progress = studentProgressByCourse(enrollments, courses, studentId);
  return classes
    .filter((c) => progress.has(c.course_id))
    .filter((c) => passesModuleGate(c.module_number, progress.get(c.course_id)))
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

// Resources for the student's enrolled courses, filtered the same way as
// classes: a resource tagged module_number=M is hidden until the student has
// completed M modules. Rows without a module_number stay visible to all
// enrolled students (general references, assignments, etc.).
// NOTE: the Resources tab needs a `module_number` column for the gate to do
// anything; until the column is added, all rows pass through unfiltered (the
// "module_number=0/blank → always visible" rule covers the missing-column case).
export async function listStudentResources(env, studentId) {
  const [enrollments, resources, courses] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, RESOURCES_TAB),
    readTab(env, COURSES_TAB),
  ]);
  const byId = courseMap(courses);
  const progress = studentProgressByCourse(enrollments, courses, studentId);
  return resources
    .filter((r) => progress.has(r.course_id))
    .filter((r) => passesModuleGate(r.module_number, progress.get(r.course_id)))
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

  const enrolledCourses = myEnrollments.map((e) =>
    withComputedProgress(e, byId.get(e.course_id)),
  );

  // Next upcoming class across enrolled courses — must clear the module gate
  // for the student's current progress on that course, AND be upcoming per
  // either status="upcoming" or scheduled_at >= now.
  const progress = studentProgressByCourse(enrollments, courses, studentId);
  const now = Date.now();
  const upcoming = classes
    .filter((c) => progress.has(c.course_id))
    .filter((c) => passesModuleGate(c.module_number, progress.get(c.course_id)))
    .filter((c) => isClassUpcoming(c, now))
    .map((c) => ({
      ...c,
      course_title: byId.get(c.course_id)?.title || "",
      _ts: Date.parse(c.scheduled_at),
    }))
    .sort((a, b) => {
      // Valid timestamps first (earliest at front); NaN timestamps sink to the
      // bottom so status="upcoming" rows without a date don't outrank real ones.
      const aBad = Number.isNaN(a._ts);
      const bBad = Number.isNaN(b._ts);
      if (aBad && bBad) return 0;
      if (aBad) return 1;
      if (bBad) return -1;
      return a._ts - b._ts;
    });
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
