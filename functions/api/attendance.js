// GET /api/attendance — the student's attendance records + a tally.

import { json, error, studentIdFromRequest } from "../_lib/auth.js";
import { listStudentAttendance } from "../_lib/repos.js";

const isCounted = (v) => String(v).trim().toUpperCase() === "TRUE";

export const onRequestGet = async ({ request, env }) => {
  const studentId = await studentIdFromRequest(env, request);
  if (!studentId) return error("Not authenticated", 401);

  try {
    const records = await listStudentAttendance(env, studentId);
    records.sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at));
    const attended = records.filter((r) => isCounted(r.counted)).length;
    return json({ records, summary: { attended, total: records.length } });
  } catch (err) {
    console.log(JSON.stringify({ level: "error", msg: "attendance_failed", err: String(err) }));
    return error("Service temporarily unavailable", 503);
  }
};
