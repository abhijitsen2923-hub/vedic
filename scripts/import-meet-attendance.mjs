#!/usr/bin/env node
/**
 * Bulk-imports a Google Meet attendance CSV into the Attendance tab of the
 * private "IVA Portal DB" Google Sheet.
 *
 * Prereqs (same as migrate-excel-to-sheet.mjs):
 *   - Node 18+
 *   - `npm install` in this repo (installs `jose`)
 *   - ./service-account.json — service-account key, Sheet shared as Editor
 *   - Env: IVA_SHEET_ID = the target sheet ID
 *          GOOGLE_SERVICE_ACCOUNT_JSON_PATH = path to the key (default ./service-account.json)
 *
 * Usage:
 *   IVA_SHEET_ID=<id> node scripts/import-meet-attendance.mjs \
 *     --class-id CLASS-005 \
 *     --csv ./meet-export.csv \
 *     [--counted true|false]
 *
 * Behaviour:
 *   - Maps Meet rows to Students by case-insensitive email match.
 *   - Skips rows whose student already has an Attendance entry for the same
 *     class_id (so re-runs are idempotent).
 *   - Unknown emails are logged to stderr and counted as "unknown" — never
 *     written to the sheet.
 *   - First-join / last-leave timestamps from the Meet CSV are parsed best-
 *     effort; if either doesn't parse, that field is left blank.
 *   - --counted defaults to "true" (Meet attendance was high enough that the
 *     class counts toward the rate). Pass `--counted false` to mark every
 *     imported row absent (rare; use only if you set --counted=false BY
 *     MISTAKE on the first run, then manually fix on the sheet).
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SignJWT, importPKCS8 } from "jose";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// --- Args ----------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = "true";
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

// --- Auth (mirrors migrate-excel-to-sheet.mjs) ---------------------------

async function getAccessToken(sa) {
  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new Error(`Token exchange failed: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

async function readTab(sheetId, token, tab) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`Read "${tab}" failed: ${r.status} ${await r.text()}`);
  const data = await r.json();
  const values = data.values || [];
  if (!values.length) return { headers: [], rows: [] };
  const headers = values[0];
  const rows = values.slice(1).map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i] ?? ""));
    return obj;
  });
  return { headers, rows };
}

async function appendRows(sheetId, token, tab, headers, records) {
  const values = records.map((rec) => headers.map((h) => rec[h] ?? ""));
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    },
  );
  if (!r.ok) throw new Error(`Append to "${tab}" failed: ${r.status} ${await r.text()}`);
}

// --- CSV parsing (no dependency — Meet exports are simple, quoted) -------

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (cur !== "" || row.length) { row.push(cur); rows.push(row); row = []; cur = ""; }
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else cur += ch;
    }
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h || "").trim());
  return rows.slice(1).filter((r) => r.some((c) => c !== "")).map((r) => {
    const o = {};
    headers.forEach((h, i) => (o[h] = (r[i] ?? "").trim()));
    return o;
  });
}

function pickField(row, candidates) {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find((x) => x.toLowerCase() === c.toLowerCase());
    if (k && row[k] !== "") return row[k];
  }
  return "";
}

// Best-effort ISO datetime — Meet exports use formats like "2026-06-15 18:00"
// or "Jun 15, 2026 6:00:00 PM". Falls back to "" on parse failure.
function toIsoNaive(s) {
  if (!s) return "";
  const ts = Date.parse(s);
  if (Number.isNaN(ts)) return "";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Stable 5-char id from (class, student) so the same (class, email) pair
// always produces the same attendance_id — keeps reruns deterministic
// without a Date.now() that would drift.
function attendanceId(classId, studentId) {
  let h = 0;
  const s = `${classId}|${studentId}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "ATTND-" + h.toString(36).toUpperCase().padStart(5, "0").slice(-5);
}

// --- Main ----------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const classId = args["class-id"];
  const csvPath = args.csv;
  const counted = (args.counted || "true").toLowerCase() === "true" ? "TRUE" : "FALSE";

  if (!classId || !csvPath) {
    console.error("Usage: node scripts/import-meet-attendance.mjs --class-id CLASS-XXX --csv path/to/meet.csv [--counted true|false]");
    process.exit(1);
  }
  const sheetId = process.env.IVA_SHEET_ID;
  if (!sheetId) {
    console.error("IVA_SHEET_ID env var is required");
    process.exit(1);
  }
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH || "./service-account.json";
  if (!existsSync(keyPath)) {
    console.error(`Service-account key not found at ${keyPath}`);
    process.exit(1);
  }
  if (!existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}`);
    process.exit(1);
  }

  const sa = JSON.parse(await readFile(keyPath, "utf8"));
  console.log(`Authenticating as ${sa.client_email}…`);
  const token = await getAccessToken(sa);

  const [students, classes, attendance] = await Promise.all([
    readTab(sheetId, token, "Students"),
    readTab(sheetId, token, "Classes"),
    readTab(sheetId, token, "Attendance"),
  ]);

  const klass = classes.rows.find((c) => c.class_id === classId);
  if (!klass) {
    console.error(`class_id "${classId}" not found in Classes tab.`);
    process.exit(1);
  }
  console.log(`Target class: ${classId} — "${klass.title || ""}"`);

  const emailToStudent = new Map();
  for (const s of students.rows) {
    const e = String(s.email || "").trim().toLowerCase();
    if (e) emailToStudent.set(e, s);
  }

  const alreadyRecorded = new Set(
    attendance.rows
      .filter((a) => a.class_id === classId)
      .map((a) => a.student_id),
  );

  const meetText = await readFile(resolve(csvPath), "utf8");
  const meetRows = parseCsv(meetText);
  console.log(`Meet CSV: ${meetRows.length} row(s) parsed.`);

  const toAppend = [];
  let unknown = 0;
  let skipped = 0;
  for (const m of meetRows) {
    const email = pickField(m, ["Email", "Email Address", "email"]).toLowerCase();
    if (!email) continue;
    const student = emailToStudent.get(email);
    if (!student) {
      console.error(`  unknown email (no Students row): ${email}`);
      unknown++;
      continue;
    }
    if (alreadyRecorded.has(student.student_id)) {
      skipped++;
      continue;
    }
    const firstJoin = pickField(m, ["First Join", "First join", "Join Time", "Joined", "first_join"]);
    const lastLeave = pickField(m, ["Last Leave", "Last leave", "Leave Time", "Left", "last_leave"]);
    toAppend.push({
      attendance_id: attendanceId(classId, student.student_id),
      student_id: student.student_id,
      class_id: classId,
      joined_at: toIsoNaive(firstJoin),
      left_at: toIsoNaive(lastLeave),
      counted,
    });
    alreadyRecorded.add(student.student_id); // prevent duplicate within same CSV
  }

  if (toAppend.length === 0) {
    console.log(`Imported 0 rows, skipped ${skipped} (already present), ${unknown} unknown email(s). Nothing to write.`);
    return;
  }

  const headers = attendance.headers.length
    ? attendance.headers
    : ["attendance_id", "student_id", "class_id", "joined_at", "left_at", "counted"];
  await appendRows(sheetId, token, "Attendance", headers, toAppend);

  console.log(`Imported ${toAppend.length} row(s), skipped ${skipped} (already present), ${unknown} unknown email(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
