# International Vedic Academy

Marketing site for an online academy teaching Vedic Astrology, Tarot, Numerology, Vastu Shastra, and Palmistry. Static HTML + Bootstrap 5, deployed on Cloudflare Pages.

## Live

- Production: `https://vedic-academy.pages.dev` *(update once deployed; custom domain TBD)*

## Tech

- Plain HTML (no framework, no build step)
- Bootstrap 5.3.3 + Bootstrap Icons (CDN)
- Google Fonts — Fraunces, Cormorant Garamond, Inter
- Vanilla JS (IntersectionObserver, FAQ accordion, reviews carousel, blog localStorage)
- Forms → [Formspree](https://formspree.io) → email to site owner
- Hosting → [Cloudflare Pages](https://pages.cloudflare.com) (git-connected auto-deploy from `main`)

## Project structure

```
.
├── index.html, about-us.html, blog.html, contact.html
├── numerology.html, palmistry.html, tarot-card.html, vastu-shastra.html, vedic-astrology.html
├── 404.html, robots.txt, sitemap.xml
├── _headers          ← Cloudflare Pages security + cache headers
├── _redirects        ← 301 redirects for legacy (capitalized) URLs
└── assets/
    ├── css/          (reserved for future shared styles — currently all inline)
    ├── js/           (reserved for future shared scripts — currently all inline)
    └── img/          background.png, subheading.jpg, logo.png
```

All styles and scripts currently live **inline** inside each HTML page. Extracting them to shared files is an optional maintainability refactor; the site ships fine as-is.

## Local development

Requires Node (for `http-server`) **or** Python 3.

```powershell
# Option A — Node (one-time, no install)
npx http-server . -p 8080 -c-1

# Option B — Python
python -m http.server 8080
```

Open <http://localhost:8080>.

**Note:** `_redirects` and `_headers` only execute on Cloudflare — verify those on the deployed `*.pages.dev` URL.

## Responsive design

Every content page has been tuned for four breakpoints:

| Viewport | Behavior |
|---|---|
| ≥ 1200px (desktop) | Full multi-column layouts, generous padding |
| 992–1199px (laptop / small desktop) | Bootstrap grid kicks in; sections start tightening |
| 768–991px (tablet) | Navbar collapses to hamburger; grids → 2 columns; section padding ~40px |
| 481–767px (mobile) | Grids → 1 column; decorative floating cards hidden; tighter typography |
| ≤ 480px (small mobile / iPhone SE) | Reduced section padding, smaller buttons, edge gutters at 16px |

When editing, keep the `@media (max-width: 768px)` and `@media (max-width: 480px)` blocks at the bottom of each page's inline `<style>` in sync.

## Live content editing (Google Sheets)

Marketing numbers, hero copy, contact info, and the footer copyright are wired to a Google Sheet. Edit a cell, save → the site reflects the change within seconds for new visitors (up to ~5 minutes for repeat visitors due to localStorage caching).

### Editable fields (v1)

17 fields in total, grouped by key prefix:

- 4 stat cards — `stats.students.*`, `stats.countries.*`, `stats.mentors.*`, `stats.success.*` (each has `.number` + `.label`)
- Hero — `hero.headline.lead`, `hero.headline.gold`, `hero.subhead`, `hero.badge.line1`, `hero.badge.line2`
- Contact (on `contact.html`) — `contact.phone`, `contact.email`, `contact.address`
- Footer — `footer.copyright` (shared by 7 pages)

Anything not in this list (FAQ, testimonials, why-choose-us, certificate sample, course modules, govt-recognition dates) is still hard-coded in the HTML for v1.

### Setup (already done)

The site is wired to a Google Sheet at the ID set in [`assets/js/content.js`](assets/js/content.js). The sheet uses one tab named **`Content`** with three columns: `key`, `value`, `notes` (the `notes` column is ignored by the loader). The sheet's General Access must be **"Anyone with the link → Viewer"** for the gviz endpoint to work.

If you ever need to **recreate the sheet from scratch** (deleted, lost, switching accounts):

1. Create a new Google Sheet, rename the tab to **`Content`**.
2. Row 1 (header): `key` | `value` | `notes`.
3. Fill one row per key listed above. Use the live HTML defaults as starting values — find each one by grepping the codebase for the matching `data-content="<key>"` attribute.
4. **Share → General access → "Anyone with the link" → Viewer**.
5. Copy the Sheet ID from the URL (`docs.google.com/spreadsheets/d/<SHEET_ID>/edit`) and paste it into the `SHEET_ID` constant in `assets/js/content.js`. Commit.

### Day-to-day editing

You don't touch the code for these 17 fields — just open the Google Sheet, edit a `value` cell, save (Sheets auto-saves). The site fetches the latest values on the next page load.

**Caching note:** `content.js` caches results in browser localStorage for 5 minutes per visitor to avoid hammering the sheet. A returning visitor sees the old value for up to 5 minutes; a new visitor (or anyone who hard-refreshes with Ctrl+Shift+R) sees the latest immediately.

### Safety net

- If the sheet is unreachable (offline, deleted, made private, gviz down) → the HTML default values stay visible. The site never breaks.
- If a `key` in the sheet doesn't match anything on the page → silently ignored, no error.
- If a `data-content` attribute on the page doesn't have a matching key in the sheet → the HTML default stays.

### Adding more editable fields later

1. Add a new row in the sheet with a unique `key` (e.g., `cta.button.label`).
2. In the HTML, find the element you want editable and add `data-content="cta.button.label"` to it (keep the current text as default).
3. Commit the HTML change. The sheet value takes effect on the next page load.

## Forms (email delivery)

Contact and enroll forms POST to Formspree. Before first deploy:

1. Sign up at [formspree.io](https://formspree.io) using the email you want submissions delivered to.
2. Create two forms in the Formspree dashboard:
   - **IVA Contact** — for the contact page
   - **IVA Enroll** — shared by all 5 course pages
3. Copy the two form IDs (8-char codes like `mzbqyywd`).
4. Substitute into the code:
   - `contact.html` — replace `XXXXXXXX` (2 occurrences) with the Contact form ID.
   - `numerology.html`, `palmistry.html`, `tarot-card.html`, `vastu-shastra.html`, `vedic-astrology.html` — replace `YYYYYYYY` (2 occurrences each) with the Enroll form ID.
5. Push. Cloudflare auto-deploys. Test by submitting the contact form.

To **change the destination email later**, log into Formspree → Form Settings → Notification Email. No code changes, no redeploy.

Each enroll form tags the submission with a hidden `course` field so you can filter or route inside Formspree.

## Deploy

1. Push to `main` on GitHub. Cloudflare Pages auto-deploys (~30s).
2. Branch pushes get preview URLs at `<branch>.vedic-academy.pages.dev`.
3. **Cloudflare Pages settings:** Framework preset = *None*, Build command = (blank), Build output directory = `/`.

## Image optimization (manual, recommended before first deploy)

`assets/img/background.png` (1.6 MB) and `assets/img/subheading.jpg` (2.1 MB) are larger than ideal for a marketing site. Use [squoosh.app](https://squoosh.app) (drag, encode to WebP at ~75 quality, download) and replace the files. Then update CSS `url(assets/img/background.png)` → `url(assets/img/background.webp)` and `<img>` tags accordingly.

## Conventions

- Use CSS design tokens (`--gold`, `--cosmic-deep`, `--bg-cream`, etc.) — don't hardcode hex.
- Lowercase, hyphenated filenames (Cloudflare is case-sensitive — `Numerology.html` would 404).
- No build tooling. If you add a dependency, justify it in the PR.
- Match the existing visual language: cream background, cosmic-dark sections, gold accents, serif headings.
