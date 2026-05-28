# International Vedic Academy

Marketing site + student portal for the academy, deployed as a single Cloudflare Pages project at <https://internationalvedicacademy.com>.

## What's in this repo

```
.
├── public/                ← Cloudflare Pages output (deployable artifacts)
│   ├── *.html             ← marketing pages (index, about-us, blog, contact, 5 courses)
│   ├── assets/            ← shared images + the live-content loader
│   ├── portal/            ← student portal frontend (login, dashboard, …)
│   └── _headers, _redirects, robots.txt, sitemap.xml, 404.html
├── functions/             ← Cloudflare Pages Functions (/api/* endpoints)
│   ├── _lib/              shared modules (Sheets API, JWT, bcrypt, validators, repos)
│   └── api/               health + auth/{login,register,me,logout}
├── scripts/               ← Node tooling (one-time data migrations)
├── content.example.csv    seed schema for the marketing-content Google Sheet (reference only)
├── package.json           jose + bcryptjs deps, dev/migrate scripts
├── .dev.vars.example      template for local function env vars
├── .gitignore
├── .serve.ps1             (gitignored) PowerShell static-file server for local preview
└── MEMORY.md              (gitignored) personal dev notes
```

Per-folder docs:
- [public/README.md](public/README.md) — marketing site + live-content editing.
- [public/portal/README.md](public/portal/README.md) — student portal frontend.
- [functions/README.md](functions/README.md) — Pages Functions architecture.
- [scripts/README.md](scripts/README.md) — Node tooling.

## Tech at a glance

- Static HTML + Bootstrap 5.3.3 (CDN) for the marketing site
- Vanilla ES modules for the portal frontend
- Cloudflare Pages Functions (no separate backend) for `/api/*`
- Google Sheets as the data layer: a **public** sheet for live marketing content + a **private** sheet (service-account access only) for student records
- Form submissions → Formspree (placeholder IDs to be substituted before launch)
- Auth → bcrypt-hashed passwords + JWT in an httpOnly cookie
- Free tier: hundreds of students fit comfortably

## Run locally

Option A — preview the static site only, no Node required:

```powershell
pwsh -ExecutionPolicy Bypass -File .\.serve.ps1
# opens http://localhost:8080/
```

Option B — full stack (Pages Functions + Google Sheets), requires Node 18+:

```powershell
npm install
copy .dev.vars.example .dev.vars   # fill in real values
npm run dev
# opens http://localhost:8788/
```

Note: `_redirects` and `_headers` run only on Cloudflare. Verify those on the deployed `*.pages.dev` or custom-domain URL.

## Deploy

1. Push to the git remote connected to Cloudflare Pages. CF auto-builds and deploys (~30 s).
2. **One-time Cloudflare dashboard setting**: Project → Settings → Builds & deployments → **Build output directory** = `public`.
3. **Environment variables** (Project → Settings → Environment variables → Production): see [`functions/README.md`](functions/README.md#environment-variables) for the full list.
4. **Custom domain**: Pages project → Custom domains → add `internationalvedicacademy.com` + `www.internationalvedicacademy.com`. Follow the DNS instructions Cloudflare shows.

## Conventions

- Lowercase, hyphenated filenames (Cloudflare URLs are case-sensitive).
- Marketing site keeps inline CSS/JS per page; student portal uses separated HTML/CSS/JS.
- Use CSS design tokens (`--gold`, `--cosmic-deep`, `--bg-cream`, …) instead of hardcoded hex.
- Never commit secrets. `service-account.json`, `.dev.vars`, and `MEMORY.md` are gitignored.
- Match the existing visual language: cream background, cosmic-dark sections, gold accents, serif headings.
