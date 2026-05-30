# public/ — Cloudflare Pages deploy root

Everything in this folder is served by Cloudflare Pages at <https://internationalvedicacademy.com>. Cloudflare's "Build output directory" setting must be `public` (set once in the dashboard).

## Layout

```
public/
├── index.html                 marketing landing
├── about-us.html
├── blog.html
├── contact.html
├── numerology.html
├── palmistry.html
├── tarot-card.html
├── vastu-shastra.html
├── vedic-astrology.html
├── 404.html                   branded not-found page (served by Cloudflare on any 404)
├── robots.txt                 allows everything except /portal/* (planned)
├── sitemap.xml                lists all marketing pages
├── _headers                   security headers + cache rules
├── _redirects                 301s for legacy capitalized URLs + .php URLs
├── assets/
│   ├── img/                   background.png, subheading.jpg, logo.png
│   └── js/content.js          fetches /api/content and live-updates marketing copy
└── portal/                    student portal (separate readme inside)
```

## Marketing pages convention

Every marketing page is a self-contained `.html` with **inline `<style>` and `<script>`**. We intentionally do not extract a shared `styles.css`/`site.js` for these — it would touch ~12K lines across 9 pages with real visual-regression risk and provides no Cloudflare-deployment benefit. If a maintainability refactor happens later, it's documented as a Phase 2 in [MEMORY.md](../MEMORY.md).

Shared design tokens (`--gold`, `--cosmic-deep`, …) are copied across each page. To change a token globally today, find-and-replace across `public/*.html` — not elegant, but predictable.

## Live content editing

`assets/js/content.js` fetches **our own same-origin endpoint `/api/content`** (no Google Sheet ID in the browser), parses the returned `{ content: { key: value } }` map, and swaps `textContent` on any element tagged with `data-content="<key>"`. Caches 5 min in `localStorage`. Falls back gracefully to the HTML defaults on any failure.

Behind that endpoint, the Worker reads the `Content` tab of the **single private** "IVA Portal DB" Google Sheet via the service account (see [../functions/README.md](../functions/README.md)). The sheet is never exposed publicly, and the marketing content lives in the same workbook as the student data — just a different tab.

Editable fields (17 total):
- 4 stat cards (`stats.{students,countries,mentors,success}.{number,label}`)
- Hero (`hero.headline.{lead,gold}`, `hero.subhead`, `hero.badge.{line1,line2}`)
- Contact (`contact.{phone,email,address}`)
- Footer (`footer.copyright`)

To recreate the content from scratch: in the "IVA Portal DB" sheet add a tab named `Content` with columns `key | value | notes` and the keys above. The seed schema lives at [`../content.example.csv`](../content.example.csv) and [`../portal-seed/Content.csv`](../portal-seed/Content.csv) (repo root, not deployed) — `File → Import → Upload` either into the sheet as a new tab to skip typing the 17 rows by hand. No code change is needed; the browser only ever calls `/api/content`.

## Forms (Formspree)

The CTA enroll form on `index.html`, the contact form on `contact.html`, and the enroll form on each of the 5 course pages all POST to Formspree.

- `index.html` + 5 course pages share the same enroll form ID (placeholder `YYYYYYYY`). Submissions tag a `course=<X>` field; the homepage CTA also tags `source=homepage-cta`.
- `contact.html` has its own form ID (placeholder `XXXXXXXX`).
- Substitute the real IDs in those 6 files when Formspree is configured. Submissions go to whatever email address the Formspree account uses.

## Auth'd area

The `portal/` subfolder is the student portal — see [portal/README.md](portal/README.md). Its frontend talks to `/api/*` (served by `functions/` at the repo root) using same-origin fetches with cookie auth.
