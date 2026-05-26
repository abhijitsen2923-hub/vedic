# International Vedic Academy

Marketing site for an online academy teaching Vedic Astrology, Tarot, Numerology, Vastu Shastra, and Palmistry. Static HTML + Bootstrap 5, deployed on Cloudflare Pages.

## Live

- Production: `https://vedic-academy.pages.dev` *(update once deployed; custom domain TBD)*

## Tech

- Plain HTML (no framework, no build step)
- Bootstrap 5.3.3 + Bootstrap Icons (CDN)
- Google Fonts — Fraunces, Cormorant Garamond, Inter
- Vanilla JS (IntersectionObserver, FAQ accordion, reviews carousel, blog localStorage)
- Forms → [Formspree](https://formspree.io)
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
    ├── css/          (shared styles + per-page overrides — Phase 2 extraction)
    ├── js/           (shared scripts + per-page logic — Phase 2 extraction)
    └── img/          background.png, subheading.jpg, logo.png
```

Most styles and scripts currently live **inline** inside each HTML page. Extracting them into `assets/css/styles.css` + `assets/js/site.js` is a Phase 2 maintainability win documented in [`MEMORY.md`](MEMORY.md).

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

## Forms

Contact and enroll forms POST to Formspree. Before first deploy, **sign up at [formspree.io](https://formspree.io)** and create two forms:

1. *Contact* — substitute its ID into `contact.html` (replace `XXXXXXXX`)
2. *Enroll* — substitute its ID into each course page (`numerology.html`, `palmistry.html`, `tarot-card.html`, `vastu-shastra.html`, `vedic-astrology.html`) — replace `YYYYYYYY`

Each course page tags the submission with a hidden `course` field so you can route them in Formspree if you ever split them.

## Deploy

1. Push to `main` on GitHub. Cloudflare Pages auto-deploys (~30s).
2. Branch pushes get preview URLs at `<branch>.vedic-academy.pages.dev`.
3. **Cloudflare Pages settings:** Framework preset = *None*, Build command = (blank), Build output directory = `/`.

## Image optimization (manual, before first deploy)

`assets/img/background.png` (1.6 MB) and `assets/img/subheading.jpg` (2.1 MB) are larger than ideal. Use [squoosh.app](https://squoosh.app) (drag, encode to WebP at ~75 quality, download) and replace the files. Then update CSS `url(assets/img/background.png)` → `url(assets/img/background.webp)` and `<img>` tags accordingly.

## Conventions

- Use CSS design tokens (`--gold`, `--cosmic-deep`, `--bg-cream`, etc.) — don't hardcode hex.
- Lowercase, hyphenated filenames (Cloudflare is case-sensitive — `Numerology.html` would 404).
- No build tooling. If you add a dependency, justify it in the PR.
- Match the existing visual language: cream background, cosmic-dark sections, gold accents, serif headings.

## See also

- [`MEMORY.md`](MEMORY.md) — full development roadmap and known issues.
