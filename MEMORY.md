# International Vedic Academy — Project Memory

A working summary of the site and what's left to build, kept in the project root so you (and Claude in future sessions) can pick up cold.

---

## 1. What this is

A static marketing / landing site for an online academy teaching Vedic sciences — Astrology, Tarot, Numerology, Vastu Shastra, Palmistry.

- **Working dir:** `c:\Users\kisho\Downloads\vedic\vedic`
- **Repo:** not under git yet
- **Backend:** none — just one PHP include (`navbar.php`)
- **Build tooling:** none — no npm, no bundler, no preprocessor

## 2. Tech stack

| Layer | Choice |
|---|---|
| Markup | Plain HTML + a single `.php` page using `include` |
| CSS | Bootstrap 5.3.2 from CDN + inline `<style>` per page (no shared stylesheet) |
| Fonts | Google Fonts — `Fraunces`, `Cormorant Garamond` (serif display), `Inter` (sans) |
| JS | Vanilla — IntersectionObserver fade-ins, FAQ accordion, reviews carousel |
| Assets | `image/BACKGROUND.png`, `image/Subheadin.jpg`, `image/logo.png` |

## 3. Design tokens (used consistently)

```
Cream base    --bg-cream #f7f1e3   --bg-cream-deep #f0e8d3
Cosmic dark   --cosmic-deep #0a0618  --cosmic-mid #1a1535  --cosmic-violet #4a2f8e
Gold          --gold #d4a24c   --gold-bright #f0c878   --gold-deep #a8791f
```

## 4. Pages — current state

| File | Status | Notes |
|---|---|---|
| [index.php](index.php) | Primary landing, uses `navbar.php` | Hero, stats, courses, why-us, journey, certificate, reviews, govt-startup, FAQ, CTA, footer |
| [index.html](index.html) | Older copy, pre-navbar-extraction | Likely superseded by `index.php` — confirm before editing both |
| [navbar.php](navbar.php) | Shared navbar partial | Only `index.php` currently includes it |
| [Numerology.html](Numerology.html) | Course page | course-hero + calculator + syllabus + enroll |
| [Palmistry.html](Palmistry.html) | Course page | + interactive-palm section |
| [Tarot-Card.html](Tarot-Card.html) | Course page | hero + syllabus + enroll |
| [Vastu-Shastra.html](Vastu-Shastra.html) | Course page | + interactive-vastu section |
| [Vedic-Astrology.html](Vedic-Astrology.html) | Course page | hero + syllabus + enroll |
| [about-us.html](about-us.html) | Standalone, inline navbar | Hinglish comments |
| [blog.html](blog.html) | Standalone, inline navbar | "Thoughts, Art & Technology" header |
| [contact.html](contact.html) | Standalone, inline navbar | JS `alert()` form — no backend wired |

## 5. Known issues / loose ends

- [navbar.php:18](navbar.php#L18) points to `about.php`, [navbar.php:20](navbar.php#L20) points to `Numerology.php` — neither file exists. Hrefs are broken until the `.html → .php` migration finishes.
- Only `index.php` uses the shared navbar; every other page still hardcodes its own.
- `index.html` and `index.php` likely duplicate ~95% of content — risk of edits drifting apart.
- Comments are mixed English (`index.php`) and Hinglish (`about-us.html`, `blog.html`, `contact.html`) — multiple authors.
- Contact form (`contact.html`) is a JS `alert()`, not a real submit.
- Footer says "© 2026 International Vedic Academy".

---

## 6. Development roadmap

### Phase 1 — Consolidate (small, do first)
- [ ] **Decide:** keep `index.php` and delete `index.html`, OR keep both and document why.
- [ ] **Fix broken navbar links** — either rename target files to `.php` or change hrefs to `.html`.
- [ ] **Convert remaining pages to PHP + use `navbar.php`:** `about-us`, `blog`, `contact`, and all 5 course pages.
- [ ] **Add a shared footer partial** (`footer.php`) — the footer is currently duplicated on every page.
- [ ] Initialize git (`git init`) so we stop editing blind.

### Phase 2 — Extract shared CSS
- [ ] Pull the design tokens + base layout out of every page's inline `<style>` into `assets/css/styles.css`.
- [ ] Keep page-specific overrides inline only where they truly differ.
- [ ] Move inline JS (FAQ accordion, reviews carousel, fade-in observer) into `assets/js/site.js`.

### Phase 3 — Wire up real functionality
- [ ] **Enroll Now button** — currently `href="#"` everywhere. Decide: form modal, scroll to CTA section, or external link.
- [ ] **Contact form** — replace the `alert()` with a real PHP handler (`contact.php`) that emails or stores submissions.
- [ ] **Enroll CTA form on `index.php`** — same: needs a backend handler.
- [ ] Add basic input validation (email format, required fields) and a success/error UI state.

### Phase 4 — Content & SEO
- [ ] Real course content / syllabi (current text is placeholder-ish in spots).
- [ ] Real student testimonials in the reviews carousel.
- [ ] Per-page `<meta description>` + Open Graph tags.
- [ ] Favicon + apple-touch-icon (none currently linked).
- [ ] `sitemap.xml` and `robots.txt`.

### Phase 5 — Performance & polish
- [ ] Compress `image/BACKGROUND.png` (1.6 MB) and `image/Subheadin.jpg` (2.1 MB) — currently loaded on every page.
- [ ] Self-host Google Fonts or use `font-display: swap` + preconnect (already preconnected, good).
- [ ] Self-host Bootstrap (or at least pin SRI hash) instead of CDN.
- [ ] Lighthouse pass — target 90+ on mobile.
- [ ] Add `loading="lazy"` to non-hero images.

### Phase 6 — Deploy
- [ ] Pick host (cPanel / shared PHP host / Hostinger — anything that runs PHP).
- [ ] Domain + HTTPS.
- [ ] Basic analytics (Plausible / GA4).
- [ ] Form submission destination (email inbox or DB).

---

## 7. Conventions when editing

- **Use the design tokens** in section 3 rather than re-typing hex codes.
- **Don't introduce build tooling** unless we explicitly agree to it — site is intentionally zero-dependency.
- **Prefer editing existing pages** over creating new ones.
- **Match the existing visual language** — cream background, cosmic-dark section breaks, gold accents, serif headings, sans body.
