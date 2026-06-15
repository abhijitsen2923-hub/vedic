// Google Sheets REST API helper for Cloudflare Pages Functions.
// Auths via a service account whose JSON key is stored in env.GOOGLE_SERVICE_ACCOUNT_JSON.
// The sheet ID lives in env.IVA_SHEET_ID. The sheet must be shared with the
// service account's email (role: Editor). The sheet itself is NOT publicly readable.

import { SignJWT } from "jose";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

// In-memory access token cache, scoped per Worker isolate.
let cachedToken = null; // { token, expiresAt }

function pemToArrayBuffer(pem) {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importServiceAccountKey(pem) {
  const ab = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    ab,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function fetchAccessToken(env) {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.token;
  }

  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");
  const sa = JSON.parse(raw);

  const key = await importServiceAccountKey(sa.private_key);
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
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Google token exchange failed: ${r.status} ${text}`);
  }
  const data = await r.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

function sheetsUrl(spreadsheetId, range) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
}

async function googleFetch(env, url, init = {}) {
  const token = await fetchAccessToken(env);
  const r = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Sheets API ${r.status}: ${text}`);
  }
  return r.json();
}

// Columns that should be parsed as numbers (Sheets API returns every cell as a
// string). Single source of truth so downstream code can do real comparisons
// like `module_number > current_module` without "10" sorting before "2".
const NUMERIC_COLUMNS = {
  Courses: ["total_modules"],
  Enrollments: ["current_module", "progress_pct"],
  Classes: ["module_number", "duration_min"],
  Resources: ["module_number"],
  FAQs: ["order"],
};

// Required header columns per tab. readTab throws if any are missing — the
// thrown error string lands in the structured error log so owner can see
// exactly which sheet header needs fixing.
//
// Extra columns are NOT an error: the sheet may evolve faster than the code
// expects (e.g. owner adds a "notes" scratch column). Extras emit a one-line
// warning per request so they don't go entirely unnoticed.
//
// module_number on Resources is intentionally absent — it's an optional gate,
// and code falls through to "always visible" when the column is missing.
const EXPECTED_HEADERS = {
  Students: ["student_id", "name", "email", "phone", "password", "tier", "avatar_initials", "joined_date"],
  Courses: ["course_id", "title", "instructor_name", "total_modules", "category", "icon_type"],
  Enrollments: ["enrollment_id", "student_id", "course_id", "current_module", "progress_pct", "enrolled_on"],
  Classes: ["class_id", "course_id", "title", "module_number", "scheduled_at", "duration_min", "meet_link", "status"],
  Attendance: ["attendance_id", "student_id", "class_id", "joined_at", "left_at", "counted"],
  Resources: ["resource_id", "course_id", "title", "type", "format", "url_or_location", "uploaded_by", "upload_date"],
  Content: ["key", "value"],
  IconTypes: ["icon_type", "svg_or_emoji"],
  FAQs: ["course_id", "lang", "order", "question", "answer"],
};

function validateHeaders(tab, headers) {
  const expected = EXPECTED_HEADERS[tab];
  if (!expected) return; // unknown tab → skip validation, let it through

  const present = new Set(headers);
  const missing = expected.filter((h) => !present.has(h));
  if (missing.length) {
    throw new Error(
      `Sheet tab "${tab}" is missing required column(s): ${missing.join(", ")}. ` +
        `Header row has: ${headers.join(", ") || "(empty)"}`,
    );
  }

  const extra = headers.filter((h) => h && !expected.includes(h));
  if (extra.length) {
    console.log(
      JSON.stringify({ level: "warn", msg: "sheet_extra_columns", tab, extra }),
    );
  }
}

function coerceRow(tab, headers, row) {
  const numeric = NUMERIC_COLUMNS[tab];
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const raw = row[i] ?? "";
    if (numeric && numeric.indexOf(h) !== -1) {
      const trimmed = String(raw).trim();
      if (trimmed === "") {
        obj[h] = null;
      } else {
        const n = Number(trimmed);
        obj[h] = Number.isFinite(n) ? n : null;
      }
    } else {
      obj[h] = raw;
    }
  }
  return obj;
}

// Returns rows as objects keyed by the header row.
// `tab` is the tab name; we fetch the entire tab range.
// Throws if any required header is missing (see EXPECTED_HEADERS) — callers
// catch this in their try/catch and return 503 with the error message logged.
export async function readTab(env, tab) {
  const data = await googleFetch(env, sheetsUrl(env.IVA_SHEET_ID, tab));
  const values = data.values || [];
  if (values.length < 1) return [];
  const headers = values[0];
  validateHeaders(tab, headers);
  return values.slice(1).map((row) => coerceRow(tab, headers, row));
}

// Append a row to a tab. `record` keys must match the header row of the tab.
export async function appendRow(env, tab, record) {
  const headers = await readHeaders(env, tab);
  const row = headers.map((h) => record[h] ?? "");
  const url =
    sheetsUrl(env.IVA_SHEET_ID, tab) +
    ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS";
  return googleFetch(env, url, {
    method: "POST",
    body: JSON.stringify({ values: [row] }),
  });
}

// Update a single row matching predicate(record). Re-reads the tab to find the row index.
// Returns true if a row was updated, false if none matched.
export async function updateRowWhere(env, tab, predicate, patch) {
  const rows = await readTab(env, tab);
  const headers = await readHeaders(env, tab);
  const idx = rows.findIndex(predicate);
  if (idx === -1) return false;
  const merged = { ...rows[idx], ...patch };
  const newRow = headers.map((h) => merged[h] ?? "");
  // Sheet row number: header is row 1, data rows start at 2
  const rowNumber = idx + 2;
  const range = `${tab}!A${rowNumber}:${columnLetter(headers.length)}${rowNumber}`;
  const url = sheetsUrl(env.IVA_SHEET_ID, range) + "?valueInputOption=RAW";
  await googleFetch(env, url, {
    method: "PUT",
    body: JSON.stringify({ values: [newRow] }),
  });
  return true;
}

async function readHeaders(env, tab) {
  const data = await googleFetch(env, sheetsUrl(env.IVA_SHEET_ID, `${tab}!1:1`));
  return (data.values && data.values[0]) || [];
}

function columnLetter(n) {
  // 1 -> A, 26 -> Z, 27 -> AA
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Healthcheck — confirms the sheet is reachable and returns the list of tab names.
export async function listTabs(env) {
  const token = await fetchAccessToken(env);
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.IVA_SHEET_ID}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`Sheets API ${r.status}`);
  const data = await r.json();
  return (data.sheets || []).map((s) => s.properties.title);
}
