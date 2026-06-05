# scripts/ — Node tooling (run locally)

One-off and rare maintenance scripts that run on your machine, not on Cloudflare. Anything here is **not** deployed.

> **No Node installed?** Skip this whole folder — see [`../portal-seed/README.md`](../portal-seed/README.md) for the manual CSV-import path that achieves the same end result without any tooling.

## `migrate-excel-to-sheet.mjs`

One-time bootstrap: read the legacy Flask app's six Excel workbooks and copy them into the private "IVA Portal DB" Google Sheet (six tabs, one per workbook). Safe to re-run — it clears and rewrites each tab.

### Prerequisites

- Node 18+ (`winget install OpenJS.NodeJS` on Windows).
- `npm install` in this repo root (installs `xlsx` + `jose`).
- A Google Cloud project with the Sheets API enabled, a service account, and a downloaded JSON key saved at `./service-account.json` (gitignored). The target Sheet must be shared with the service account's email as **Editor**.

### Run

PowerShell:

```powershell
$env:IVA_SHEET_ID = "1AbC…the-sheet-id-from-the-URL"
npm run migrate-sheet
```

Or with explicit paths:

```powershell
$env:IVA_SHEET_ID = "…"
$env:GOOGLE_SERVICE_ACCOUNT_JSON_PATH = ".\service-account.json"
$env:EXCEL_DIR = "..\..\astro\astro\backend\data"
node scripts/migrate-excel-to-sheet.mjs
```

### What it does

1. Authenticates as the service account via a signed JWT → exchanges for an access token.
2. For each tab (`Students`, `Courses`, `Enrollments`, `Classes`, `Attendance`, `Resources`):
   - Creates the tab if it doesn't exist.
   - Clears the tab.
   - Reads the matching `iva_<tab>.xlsx` from `EXCEL_DIR` (default `../astro/astro/backend/data`).
   - Writes the values as rows, header row first.
3. Logs how many rows were written per tab.

### Idempotency

Safe to re-run. The script clears each tab before writing, so re-running produces the same end state as a fresh run. **Warning**: if you've added new student records in the Sheet that weren't in the Excel source, re-running will overwrite them. Only re-run when you really want the Excel source to be authoritative again — normally that's just once, at initial bootstrap.

### After the first run

You can delete the legacy `astro/astro` Flask app — the Sheet becomes the single source of truth. The script's only purpose is the one-time seed.

## `import-meet-attendance.mjs`

Bulk-imports a Google Meet attendance CSV into the `Attendance` tab. Run it after each class instead of typing rows by hand.

### Prerequisites

Same as `migrate-excel-to-sheet.mjs` — Node 18+, `npm install`, `./service-account.json`, `IVA_SHEET_ID` env.

### Run

```powershell
$env:IVA_SHEET_ID = "…"
node scripts/import-meet-attendance.mjs `
  --class-id CLASS-005 `
  --csv .\meet-export.csv
# optional: --counted false  (defaults to true)
```

### Expected CSV columns

Standard Google Meet attendance export. The script auto-detects these columns case-insensitively:

- `Email` (or `Email Address`) — **required**; used to look up the student
- `First Join` (or `Join Time`) — parsed into `joined_at`; left blank if missing/unparseable
- `Last Leave` (or `Leave Time`) — parsed into `left_at`; left blank if missing/unparseable

Everything else in the CSV is ignored.

### What it does

1. Auths as the service account; pulls `Students`, `Classes`, `Attendance`.
2. Verifies `--class-id` exists in the `Classes` tab; aborts if not.
3. Builds an `email → student_id` map (case-insensitive, trimmed).
4. For each Meet row:
   - Unknown email → logged to stderr, counted as "unknown", skipped.
   - Student already recorded for this class → counted as "skipped" (idempotency).
   - Otherwise → builds a row with a deterministic `attendance_id` (stable hash of class_id + student_id, so the same student in the same class always gets the same id).
5. Appends new rows to the `Attendance` tab. Prints `Imported N, skipped M, U unknown`.

### Idempotency

Safe to re-run. The deterministic `attendance_id` plus the already-recorded check mean a second run does nothing. Useful if the first run failed partway, or if the Meet CSV was updated.

### Limits

- `--counted` flag applies to every imported row (no per-student opt-out). For per-student fine-tuning, edit the sheet after importing.
- Meet timestamps are parsed best-effort via `Date.parse`. Some exports use locale-specific formats — if `joined_at` / `left_at` come out blank, the timestamp format wasn't recognised; you can fill them in manually on the sheet.
