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
├── content.example.csv        schema for the live-content Google Sheet (reference only)
├── assets/
│   ├── img/                   background.png, subheading.jpg, logo.png
│   └── js/content.js          fetches a public Google Sheet and live-updates marketing copy
└── portal/                    student portal (separate readme inside)
```

## Marketing pages convention

Every marketing page is a self-contained `.html` with **inline `<style>` and `<script>`**. We intentionally do not extract a shared `styles.css`/`site.js` for these — it would touch ~12K lines across 9 pages with real visual-regression risk and provides no Cloudflare-deployment benefit. If a maintainability refactor happens later, it's documented as a Phase 2 in [MEMORY.md](../MEMORY.md).

Shared design tokens (`--gold`, `--cosmic-deep`, …) are copied across each page. To change a token globally today, find-and-replace across `public/*.html` — not elegant, but predictable.

## Live content editing

`assets/js/content.js` fetches a Google Sheet (public, "Anyone with link → Viewer") via the `gviz/tq` endpoint, parses 17 key/value rows, and swaps `textContent` on any element tagged with `data-content="<key>"`. Caches 5 min in `localStorage`. Falls back gracefully to the HTML defaults on any failure.

Editable fields (17 total):
- 4 stat cards (`stats.{students,countries,mentors,success}.{number,label}`)
- Hero (`hero.headline.{lead,gold}`, `hero.subhead`, `hero.badge.{line1,line2}`)
- Contact (`contact.{phone,email,address}`)
- Footer (`footer.copyright`)

To recreate the sheet from scratch (deleted, lost, switching accounts): create a new Google Sheet, tab name `Content`, columns `key | value | notes`, fill with the keys above, share as "Anyone with the link → Viewer", paste the new Sheet ID into the `SHEET_ID` constant at the top of `assets/js/content.js`. The `content.example.csv` in this folder is the seed schema.

## Forms (Formspree)

The CTA enroll form on `index.html`, the contact form on `contact.html`, and the enroll form on each of the 5 course pages all POST to Formspree.

- `index.html` + 5 course pages share the same enroll form ID (placeholder `YYYYYYYY`). Submissions tag a `course=<X>` field; the homepage CTA also tags `source=homepage-cta`.
- `contact.html` has its own form ID (placeholder `XXXXXXXX`).
- Substitute the real IDs in those 6 files when Formspree is configured. Submissions go to whatever email address the Formspree account uses.

## Auth'd area

The `portal/` subfolder is the student portal — see [portal/README.md](portal/README.md). Its frontend talks to `/api/*` (served by `functions/` at the repo root) using same-origin fetches with cookie auth.
