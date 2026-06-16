// Domain-specific accessors over the Google Sheet tabs.
// Each function returns plain JS objects (record shape).
// Phase 1 only needs Students; later phases add Courses/Enrollments/Classes/Attendance/Resources.

import { readTab, appendRow, updateRowWhere } from "./sheets.js";
import { normalizeEmail } from "./validate.js";
import { parseSheetDate } from "./dates.js";

// --- Students ---

export const STUDENTS_TAB = "Students";

// Sheet columns that hold credentials and must never reach the client. Any
// student-row field whose name (case-insensitive) is in this set is stripped
// by publicProfile. Adding a new credential-shaped column to the sheet later
// only requires extending this set.
const CREDENTIAL_KEYS = new Set([
  "password",
  "password_hash",
  "pw",
  "pwd",
  "hash",
  "salt",
  "password_reset_token",
]);

export function publicProfile(student) {
  if (!student) return null;
  const out = {};
  for (const [k, v] of Object.entries(student)) {
    if (!CREDENTIAL_KEYS.has(String(k).toLowerCase())) out[k] = v;
  }
  return out;
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
// course_missing=true signals to the frontend that the Enrollments.course_id
// points at a deleted/non-existent Course row (so it can render a "Course
// removed" state instead of a blank card).
function withComputedProgress(enrollment, course) {
  const current = clampedCurrentModule(enrollment, course);
  const total = Number(course?.total_modules) || 0;
  const progress_pct = total > 0 ? Math.floor((current / total) * 100) : 0;
  return {
    ...enrollment,
    current_module: current,
    progress_pct,
    course: course || null,
    course_missing: !course,
  };
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
  const ts = parseSheetDate(c.scheduled_at);
  return !Number.isNaN(ts) && ts >= nowMs;
}

// Three-state attendance: "present" (counted=TRUE), "absent" (FALSE), "pending"
// (blank or anything else). The owner uses blank to mean "I haven't graded
// this class yet" — distinguishing that from explicit FALSE makes the rate
// meaningful (pending excluded from the denominator).
export function attendanceState(record) {
  const v = String(record?.counted ?? "").trim().toUpperCase();
  if (v === "TRUE") return "present";
  if (v === "FALSE") return "absent";
  return "pending";
}

// Real participation minutes if both join + leave timestamps are filled.
// Returns null otherwise — the UI renders "—" so missing data is visible.
function computeParticipationMin(record) {
  const j = parseSheetDate(record?.joined_at);
  const l = parseSheetDate(record?.left_at);
  if (Number.isNaN(j) || Number.isNaN(l) || l <= j) return null;
  return Math.max(0, Math.floor((l - j) / 60000));
}

// Enrollments for the student, each joined with its course record + computed progress.
// Logs a warning per broken FK (Enrollment points at a Course that no longer
// exists); withComputedProgress flags it so the UI can render a "Course
// removed" muted card.
export async function listEnrolledCourses(env, studentId) {
  const [enrollments, courses] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, COURSES_TAB),
  ]);
  const byId = courseMap(courses);
  return enrollments
    .filter((e) => e.student_id === studentId)
    .map((e) => {
      const course = byId.get(e.course_id);
      if (!course) {
        console.log(
          JSON.stringify({
            level: "warn",
            msg: "enrollment_fk_missing",
            enrollment_id: e.enrollment_id,
            course_id: e.course_id,
            student_id: e.student_id,
          }),
        );
      }
      return withComputedProgress(e, course);
    });
}

// Classes belonging to the student's enrolled courses, filtered to modules the
// student hasn't completed yet. Course title attached for the UI; course_missing
// flag signals to the frontend that a parent Course row was deleted.
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
    .map((c) => {
      const course = byId.get(c.course_id);
      return {
        ...c,
        course_title: course?.title || "",
        course_missing: !course,
      };
    });
}

// The student's attendance rows, joined to the class title + scheduled_at,
// enriched with the tri-state (present/absent/pending) and the real
// participation duration in minutes (computed from joined_at + left_at).
// class_missing=true flags rows whose class_id no longer resolves to a Class
// row (deleted from the sheet); the frontend renders these as "Class removed".
export async function listStudentAttendance(env, studentId) {
  const [attendance, classes] = await Promise.all([
    readTab(env, ATTENDANCE_TAB),
    readTab(env, CLASSES_TAB),
  ]);
  const classById = new Map(classes.map((c) => [c.class_id, c]));
  return attendance
    .filter((a) => a.student_id === studentId)
    .map((a) => {
      const cls = classById.get(a.class_id);
      if (!cls) {
        console.log(
          JSON.stringify({
            level: "warn",
            msg: "attendance_fk_missing",
            attendance_id: a.attendance_id,
            class_id: a.class_id,
            student_id: a.student_id,
          }),
        );
      }
      return {
        ...a,
        class_title: cls?.title || "",
        scheduled_at: cls?.scheduled_at || "",
        class_duration_min: cls?.duration_min ?? null,
        class_missing: !cls,
        state: attendanceState(a),
        participation_min: computeParticipationMin(a),
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

// Dashboard summary — reads the needed tabs once and assembles:
//  { courses, nextClass, attendance: { attended, absent, pending, total, rate } }
export async function getDashboard(env, studentId) {
  const [enrollments, courses, classes, attendance] = await Promise.all([
    readTab(env, ENROLLMENTS_TAB),
    readTab(env, COURSES_TAB),
    readTab(env, CLASSES_TAB),
    readTab(env, ATTENDANCE_TAB),
  ]);
  const byId = courseMap(courses);
  const myEnrollments = enrollments.filter((e) => e.student_id === studentId);

  const enrolledCourses = myEnrollments.map((e) => {
    const course = byId.get(e.course_id);
    if (!course) {
      console.log(
        JSON.stringify({
          level: "warn",
          msg: "enrollment_fk_missing",
          enrollment_id: e.enrollment_id,
          course_id: e.course_id,
          student_id: e.student_id,
        }),
      );
    }
    return withComputedProgress(e, course);
  });

  // Next upcoming class across enrolled courses — must clear the module gate
  // for the student's current progress on that course, AND be upcoming per
  // either status="upcoming" or scheduled_at >= now.
  const progress = studentProgressByCourse(enrollments, courses, studentId);
  const now = Date.now();
  const upcoming = classes
    .filter((c) => progress.has(c.course_id))
    .filter((c) => passesModuleGate(c.module_number, progress.get(c.course_id)))
    .filter((c) => isClassUpcoming(c, now))
    .map((c) => {
      const course = byId.get(c.course_id);
      return {
        ...c,
        course_title: course?.title || "",
        course_missing: !course,
        _ts: parseSheetDate(c.scheduled_at),
      };
    })
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
  const counts = { present: 0, absent: 0, pending: 0 };
  for (const a of myAttendance) counts[attendanceState(a)]++;
  const graded = counts.present + counts.absent;

  return {
    courses: enrolledCourses,
    nextClass,
    attendance: {
      attended: counts.present,
      absent: counts.absent,
      pending: counts.pending,
      total: myAttendance.length,
      rate: graded ? Math.round((counts.present / graded) * 100) : null,
    },
  };
}

// --- Course FAQs (sheet-driven, trilingual) ---

export const FAQS_TAB = "FAQs";

// Reads the FAQs tab and groups rows by course_id then by lang. Each language
// list is sorted by `order`. Empty cells (missing question or answer) are
// skipped — a row needs both to count as a usable FAQ.
//
// Shape:
//   {
//     [course_id]: {
//       en: [{ order, question, answer }, ...],
//       hi: [...],
//       bn: [...]
//     },
//     ...
//   }
export async function getCourseFaqs(env) {
  const rows = await readTab(env, FAQS_TAB);
  const map = {};
  for (const r of rows) {
    const courseId = String(r.course_id || "").trim();
    const lang = String(r.lang || "").trim().toLowerCase();
    if (!courseId || !lang) continue;
    const question = String(r.question || "").trim();
    const answer = String(r.answer || "").trim();
    if (!question || !answer) continue;
    if (!map[courseId]) map[courseId] = {};
    if (!map[courseId][lang]) map[courseId][lang] = [];
    map[courseId][lang].push({
      order: Number(r.order) || 0,
      question,
      answer,
    });
  }
  for (const cid of Object.keys(map)) {
    for (const lang of Object.keys(map[cid])) {
      map[cid][lang].sort((a, b) => a.order - b.order);
    }
  }
  return map;
}

// --- Careers (sheet-driven job openings) ---

export const CAREERS_TAB = "Careers";

// Returns currently-active job openings, sorted by `order`. A row is "active"
// only when is_active=TRUE (case-insensitive) AND both role_title and
// apply_url are non-empty — without either, the listing has no useful content
// to render, so we drop the row silently.
export async function getOpenJobs(env) {
  const rows = await readTab(env, CAREERS_TAB);
  return rows
    .filter((r) => {
      if (String(r.is_active || "").trim().toUpperCase() !== "TRUE") return false;
      if (!String(r.role_title || "").trim()) return false;
      if (!String(r.apply_url || "").trim()) return false;
      return true;
    })
    .map((r) => ({
      job_id: String(r.job_id || "").trim(),
      role_title: String(r.role_title).trim(),
      location: String(r.location || "").trim(),
      type: String(r.type || "").trim(),
      description: String(r.description || "").trim(),
      apply_url: String(r.apply_url).trim(),
      posted_date: String(r.posted_date || "").trim(),
      order: Number(r.order) || 0,
    }))
    .sort((a, b) => a.order - b.order);
}

// --- Weekly horoscopes (sheet-driven, one row per zodiac sign) ---

export const HOROSCOPES_TAB = "Horoscopes";

// Returns { [sign_id]: { week_label, content } }. Blank content rows still
// appear in the map (so the frontend can render a "Coming soon" placeholder
// for that sign); only rows with a missing sign_id are dropped.
export async function getWeeklyHoroscopes(env) {
  const rows = await readTab(env, HOROSCOPES_TAB);
  const map = {};
  for (const r of rows) {
    const signId = String(r.sign_id || "").trim().toLowerCase();
    if (!signId) continue;
    map[signId] = {
      week_label: String(r.week_label || "").trim(),
      content: String(r.content || "").trim(),
    };
  }
  return map;
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
