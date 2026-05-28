# scripts/ — Node tooling (run locally)

One-off and rare maintenance scripts that run on your machine, not on Cloudflare. Anything here is **not** deployed.

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
