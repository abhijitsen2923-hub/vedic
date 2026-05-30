# portal-seed/ — bootstrap the private "IVA Portal DB" Google Sheet

Drop the eight CSVs in this folder into Google Sheets as tabs of one workbook, set up the `icon_type` dropdown, and both the student portal **and** the marketing site's live content have data to read. None of these files are deployed — they live at the repo root, not under `public/`.

This is now the **single** spreadsheet for the whole site: the portal tabs (student data) plus the `Content` tab that drives the marketing pages' editable copy. The site never reads it from the browser — the Worker reads every tab server-side via the service account, so the file stays private.

## Files

| File | Purpose | Becomes tab |
|---|---|---|
| `Students.csv` | 1 demo student (Riya Sharma) | `Students` |
| `Courses.csv` | 3 demo courses | `Courses` |
| `Enrollments.csv` | Riya enrolled in all 3 | `Enrollments` |
| `Classes.csv` | 4 classes (3 upcoming, 1 ended) | `Classes` |
| `Attendance.csv` | 1 attendance row for the ended class | `Attendance` |
| `Resources.csv` | 5 demo lecture/reading links | `Resources` |
| `IconTypes.csv` | Reference list for the `icon_type` dropdown | `IconTypes` |
| `Content.csv` | Editable marketing copy (stats, hero, contact, footer) served via `/api/content` | `Content` |
| `hash-password.html` | Local-only bcrypt utility — open in browser | *(not imported)* |

## One-time setup — import into ONE workbook

1. Go to <https://sheets.new>. Name the spreadsheet **"IVA Portal DB"**. This is **one** Google Sheet (workbook). All eight tabs will live inside it — both student data and marketing content. The whole file stays **private**; nothing is shared publicly.
2. Leave the default `Sheet1` for now; you can't delete the only tab.
3. For **each** CSV in this folder (8 imports total, all into the same workbook):
   - `File → Import → Upload` → drop the CSV.
   - **Import location**: `Insert new sheet(s)` ← this adds a tab to the current workbook; do not pick "Create new spreadsheet".
   - **Separator type**: `Detect automatically` (or `Comma`).
   - **Convert text to numbers, dates, and formulas**: ✓ checked.
   - Click **Import data**.
4. You'll now have 8 tabs named `Students`, `Courses`, `Enrollments`, `Classes`, `Attendance`, `Resources`, `IconTypes`, `Content` (Google Sheets preserves the file capitalization). Delete the original `Sheet1`.
5. Set up the `icon_type` dropdown (one-time):
   - Open the `Courses` tab → select column **F** from row 2 onward (`F2:F`).
   - `Data → Data validation → Add rule`.
   - **Criteria**: `Dropdown (from a range)`.
   - **Range**: `IconTypes!A2:A`.
   - **If invalid data**: `Show a warning`.
   - Click **Done**. Every cell in `icon_type` now shows a dropdown of the 8 valid keys.
6. Share with the service account: click **Share** → paste the service-account email (e.g., `iva-portal-fn@<project>.iam.gserviceaccount.com`) → role **Editor** → uncheck "Notify". Sheet stays restricted.
7. Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`).
8. Paste it into the Cloudflare Pages environment variable `IVA_SHEET_ID` (Project → Settings → Environment variables → Production).

Verify at `https://internationalvedicacademy.com/api/health` — expect `sheet_reachable: true` and the 8 tab names in `sheet_tabs`. Then hit `https://internationalvedicacademy.com/api/content` — expect a JSON `{ "content": { … } }` map of the marketing copy.

### Editing marketing copy later

The `Content` tab is the live source for editable site text. Edit a `value` cell and the change appears on the site within ~5–10 min (edge cache + the browser's 5-min local cache). Keep the `key` column unchanged — those map to `data-content="…"` attributes in the HTML.

## Demo login

After the import + service-account share:

- Email: `riya.sharma@email.com`
- Password: `password123`

The `password_hash` in `Students.csv` is the real bcrypt hash for `password123` (extracted from the legacy Flask app, committed here so the demo works out of the box).

## Add new students later — sheet-driven workflow

There's no self-signup. To enroll a new student, **you add the row to the Students tab**. Workflow:

1. Open `portal-seed/hash-password.html` (double-click it; opens in your browser as a `file://` URL).
2. Type the password you want to give the student → click **Hash it** → click **Copy hash**.
3. Open the `Students` tab in the Google Sheet → append a new row:

| Column | Example |
|---|---|
| `student_id` | `STDNT-002` (next free ID) |
| `name` | `Jane Doe` |
| `email` | `jane.doe@example.com` |
| `phone` | `+91 98700 12345` |
| `password_hash` | *(paste the bcrypt hash from step 2)* |
| `tier` | `Bronze` / `Silver` / `Gold` |
| `avatar_initials` | `JD` |
| `joined_date` | `2026-05-28` |

4. Tell the student their email + the plaintext password you picked. Don't save the plaintext anywhere; bcrypt is one-way so you can't recover it if you forget.
5. Student goes to `/portal/login.html` and logs in.

To enroll the new student in a course, add a row to the `Enrollments` tab linking the new `student_id` to a `course_id`.

## Refreshing stale dates

The `Classes.csv` rows have fixed dates in late May 2026 to give a sane demo. Once those dates pass, the "upcoming" rows will look ended. Open the `Classes` tab → edit `scheduled_at` cells to push them forward (any ISO format like `2026-09-01T18:00:00` works).

## Alternative: the migration script (if you ever install Node)

`scripts/migrate-excel-to-sheet.mjs` reads the legacy Flask Excel files and writes them to the Sheet in one command. Same end result as importing the CSVs by hand, just one step instead of seven. Use whichever fits your workflow. Until Node is installed, the CSVs above are the path.
