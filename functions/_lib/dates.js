// Shared date parsing for sheet-flavored strings.
//
// The Google Sheet mixes two date formats:
//   "2025-03-20"             — date-only (Enrollments.enrolled_on, Resources.upload_date)
//   "2026-05-29T18:00:00"    — naked ISO datetime (Classes.scheduled_at, Attendance.joined_at/left_at)
//
// Per the ECMA spec, Date.parse interprets the first as UTC midnight and the
// second as the viewer's local time. Both behaviours are wrong for the IVA
// data model: the date-only string should anchor to the local calendar date
// (no off-by-one on negative UTC offsets), and naked datetimes should anchor
// to the owner's working timezone (India / IST) since that's how owner enters
// them. After this normalisation, the viewer's browser converts to whatever
// local time their clock reports — which is exactly what Intl.DateTimeFormat
// does automatically once Date holds a real instant.
//
// Anything that doesn't match either pattern falls through to Date.parse so
// that genuine ISO-with-offset strings (if any sneak in) are respected as-is.

export const SHEET_TZ_OFFSET = "+05:30"; // IST — change here if owner relocates.

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const NAKED_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

export function parseSheetDate(s) {
  if (typeof s !== "string" || !s) return NaN;
  if (DATE_ONLY_RE.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  if (NAKED_DATETIME_RE.test(s)) {
    return Date.parse(s + SHEET_TZ_OFFSET);
  }
  return Date.parse(s);
}
