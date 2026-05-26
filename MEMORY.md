# International Vedic Academy — Project Memory

A working summary of the site and what's left to build, kept in the project root so you (and Claude in future sessions) can pick up cold.

---

## 1. What this is

A static marketing / landing site for an online academy teaching Vedic sciences — Astrology, Tarot, Numerology, Vastu Shastra, Palmistry.

- **Working dir:** `c:\Users\kisho\Downloads\vedic\vedic`
- **Repo:** local git, branch `main`. Not yet pushed to a remote.
- **Backend:** none — pure static; forms POST to Formspree.
- **Build tooling:** none — no npm, no bundler, no preprocessor.
- **Hosting target:** Cloudflare Pages (git-connected auto-deploy).

## 2. Tech stack

| Layer | Choice |
|---|---|
| Markup | Plain HTML (all PHP removed) |
| CSS | Bootstrap 5.3.3 (CDN) + inline `<style>` per page (Phase 2: extract to `assets/css/styles.css`) |
| Fonts | Google Fonts — `Fraunces`, `Cormorant Garamond` (serif display), `Inter` (sans) |
| JS | Vanilla — IntersectionObserver fade-ins, FAQ accordion, reviews carousel, blog localStorage |
| Forms | Formspree (placeholders `XXXXXXXX` for contact, `YYYYYYYY` for enroll) |
| Assets | `assets/img/background.png`, `assets/img/subheading.jpg`, `assets/img/logo.png` |
| Hosting | Cloudflare Pages |

## 3. Design tokens (used consistently)

```
Cream base    --bg-cream #f7f1e3   --bg-cream-deep #f0e8d3
Cosmic dark   --cosmic-deep #0a0618  --cosmic-mid #1a1535  --cosmic-violet #4a2f8e
Gold          --gold #d4a24c   --gold-bright #f0c878   --gold-deep #a8791f
```

## 4. Pages — current state

| File | Status |
|---|---|
| [index.html](index.html) | Primary landing (converted from `index.php`; navbar inlined) |
| [about-us.html](about-us.html) | About + heritage page |
| [blog.html](blog.html) | Blog index with localStorage-only comments/posts |
| [contact.html](contact.html) | Contact form → Formspree (replace `XXXXXXXX`) |
| [numerology.html](numerology.html) | Course page with calculator + enroll form |
| [palmistry.html](palmistry.html) | Course page with interactive-palm + enroll form |
| [tarot-card.html](tarot-card.html) | Course page + enroll form |
| [vastu-shastra.html](vastu-shastra.html) | Course page with interactive-vastu + enroll form |
| [vedic-astrology.html](vedic-astrology.html) | Course page + enroll form |
| `404.html`, `_headers`, `_redirects`, `robots.txt`, `sitemap.xml` | Cloudflare Pages config + branded 404 |

## 5. Status — what landed in the Cloudflare migration

- All PHP removed; `index.php` → `index.html`, `navbar.php` deleted.
- All course filenames lowercased + hyphenated (`Numerology.html` → `numerology.html` etc.).
- Image assets moved `image/` → `assets/img/` with lowercase names.
- Navbar dropdown hrefs corrected to the new lowercase filenames; `active` class moved to the correct nav item per page.
- Bootstrap aligned to 5.3.3 across every page.
- Contact form + 5 enroll forms wired to Formspree (placeholder IDs — `XXXXXXXX` / `YYYYYYYY`). Each form has a honeypot, hidden subject, async fetch handler with inline status, and a guard that warns if the ID isn't replaced.
- Cloudflare Pages config: `_headers` (CSP, HSTS, X-Frame-Options, cache for `/assets/*` and HTML), `_redirects` (301 for legacy capitalized URLs + `.php` URLs), `404.html` (branded), `robots.txt`, `sitemap.xml` (uses placeholder `https://example.com`).
- `.gitignore` + git history; 8 commits on `main`.

## 6. Deferred — to do before / after first deploy

### Before first deploy
- [ ] Sign up at [formspree.io](https://formspree.io), create a *Contact* form and an *Enroll* form, and substitute the two IDs (`XXXXXXXX` in `contact.html`; `YYYYYYYY` in the 5 course pages).
- [ ] Replace `https://example.com` in `sitemap.xml` and `robots.txt` with the real domain once chosen.
- [ ] Create a GitHub repo and push (`gh` CLI not installed locally — use the web UI or install `gh`).
- [ ] In the Cloudflare dashboard: Workers & Pages → Pages → Connect to Git → select the repo → build settings Framework=None, Build command blank, Output directory `/`.

### After first deploy
- [ ] Compress `assets/img/background.png` (1.6 MB) and `assets/img/subheading.jpg` (2.1 MB) via [squoosh.app](https://squoosh.app). Target WebP ~250–300 KB. Update CSS `url()` and `<img src>` references accordingly. (Deferred during migration because Node/squoosh-cli isn't installed locally.)
- [ ] Add SRI hashes to the Bootstrap CDN `<link>` and `<script>` tags. Look up current hashes at <https://www.bootstrapcdn.com/legacy/bootstrap/> or <https://getbootstrap.com>.
- [ ] Lighthouse pass on the deployed URL — target 90+ on mobile.
- [ ] Add a favicon + apple-touch-icon (none linked yet).
- [ ] Per-page real `<meta description>` + Open Graph cards.

### Phase 2 — Shared CSS / JS extraction (maintainability refactor, not a deploy blocker)

Each page currently has its own complete inline `<style>` (~500–3000 lines). Migration deferred this because it's a high-touch refactor with visual-regression risk and doesn't affect Cloudflare-readiness.

When ready:
- Extract the `:root{}` design tokens + `body`, navbar (`.navbar`, `.bg-cosmic`, logo styles), `.btn-gold`, footer, and shared utilities into `assets/css/styles.css`. Add `<link rel="stylesheet" href="assets/css/styles.css">` to each page after Bootstrap.
- Per-page sections (`.hero`, `.courses-section`, `.calculator`, `.interactive-palm`, `.interactive-vastu`, blog comment styles, etc.) stay inline OR move to `assets/css/pages/<page>.css`.
- Move the IntersectionObserver fade-in, FAQ accordion, reviews carousel, and Formspree submit handler into `assets/js/site.js`.
- Per-page scripts (numerology calculator, palmistry/vastu interactives, blog localStorage) go to `assets/js/pages/<page>.js`.

### Phase 3 — Content & functionality
- [ ] Replace placeholder testimonials with real ones in the reviews carousel.
- [ ] Real course syllabi (current copy is somewhat templated).
- [ ] Decide what the navbar's "Enroll Now" button should do — currently `href="contact.html#enroll"` on `index.html` but `href="#"` on the older course-page navbars.
- [ ] Blog comments are localStorage-only — if real comments are wanted, wire a CMS (e.g., Decap, Sanity) or a Cloudflare D1 + Pages Function backend.
- [ ] Basic analytics (Plausible or GA4).

## 7. Known cosmetic issues (not deploy blockers)

- Two navbar styles still live in the codebase: `index.html` uses the SVG-icon + text logo brand; the other pages use `<img src="assets/img/logo.png">`. Unify in Phase 2.
- Comments are mixed English (`index.html`) and Hinglish (`about-us.html`, `blog.html`, `contact.html`) — multiple authors.
- Footer says "© 2026 International Vedic Academy" (year is intentional from existing copy).
- `blog.html` navbar only has a Home link — no Blog/About/Contact/Courses — visually inconsistent with the rest of the site.

## 8. Conventions when editing

- **Use the design tokens** in section 3 rather than re-typing hex codes.
- **Don't introduce build tooling** unless we explicitly agree to it — site is intentionally zero-dependency.
- **Lowercase, hyphenated filenames** — Cloudflare is case-sensitive (`Numerology.html` would 404).
- **Match the existing visual language** — cream background, cosmic-dark section breaks, gold accents, serif headings, sans body.
- **PowerShell file-write trap**: `Get-Content -Raw` + `Set-Content -Encoding utf8` corrupted em-dashes during this migration (UTF-8 read as ANSI). Always use `[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)` and `WriteAllText` with `New-Object System.Text.UTF8Encoding($false)` (UTF-8 without BOM) when doing batch file mutations.
