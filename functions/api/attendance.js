// GET /api/attendance — the student's attendance records + a tri-state tally.
// `summary.rate` excludes pending rows from the denominator so it stays
// meaningful while the owner is still filling in the `counted` column.

import { json, error, studentIdFromRequest } from "../_lib/auth.js";
import { listStudentAttendance } from "../_lib/repos.js";
import { parseSheetDate } from "../_lib/dates.js";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  try {
    const records = await listStudentAttendance(env, studentId);
    records.sort(
      (a, b) => parseSheetDate(b.scheduled_at) - parseSheetDate(a.scheduled_at),
    );

    const counts = { present: 0, absent: 0, pending: 0 };
    for (const r of records) counts[r.state]++;
    const graded = counts.present + counts.absent;

    return json({
      records,
      summary: {
        attended: counts.present,
        absent: counts.absent,
        pending: counts.pending,
        total: records.length,
        rate: graded ? Math.round((counts.present / graded) * 100) : null,
      },
    });
  } catch (err) {
    console.log(
      JSON.stringify({
        level: "error",
        msg: "attendance_failed",
        err: String(err),
      }),
    );
    return error("Service temporarily unavailable", 503);
  }
};
