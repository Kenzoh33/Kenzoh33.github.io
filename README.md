# Rochak Ghimire: Personal Portfolio

This is the source for my personal site, [rochakghimire.com](https://rochakghimire.com). It's where I put my research, projects, and background for anyone deciding whether to give me a callback.

I'm a Computer Science junior and Clara Adams Honors College Scholar at Morgan State University, looking for Summer 2027 internships in software engineering, AI, and machine learning.

## Tech stack

Plain HTML, CSS, and vanilla JavaScript. No framework, no bundler, no build step, no `npm install`. I wanted a site that's fast by default, easy to maintain, and doesn't hide behind a template's defaults.

- **HTML:** 12 hand-written pages with semantic markup, one `h1` per page, a skip link, and Open Graph tags for link previews.
- **CSS:** one stylesheet (`css/styles.css`) built on custom properties, Grid, Flexbox, and `clamp()` for fluid type.
  - Light and dark themes, following the system setting until a visitor picks one.
  - Cross-page fades with `@view-transition`.
  - A reading-progress bar driven by `animation-timeline: scroll()`, with no JavaScript.
  - Layouts for phone, tablet, and desktop.
- **Type:** Newsreader for headings and Archivo for body text, loaded from Google Fonts as variable fonts.
- **JavaScript:** progressive enhancement only.
  - `main.js` handles the theme toggle, scroll-reveal through `IntersectionObserver`, and the phone nav.
  - `count-up.js` animates the key numbers on Home.
  - `palette.js` is a command palette: Cmd/Ctrl+K or `/` to jump to any page or project.
  - `turntable.js` runs the About page turntable, which plays beats synthesized live with the Web Audio API. No audio files are loaded.
- **Pixel art:** the small sprites are drawn as text grids and turned into PNGs by `scripts/pixel-art/build.py`. It uses only the Python standard library and writes the PNG bytes by hand with `zlib` and `struct`.
- **Images:** WebP with PNG or JPEG fallbacks through `<picture>`.
- **Hosting:** GitHub Pages, served from `main` on my custom domain.

Every page stays readable and navigable with JavaScript turned off, and all motion respects `prefers-reduced-motion`.

## Running it locally

No dev server required. From the project root:

```
python3 -m http.server
```

Then open `http://localhost:8000` in a browser. Any static file server works the same way.

To rebuild the pixel-art sprites after editing a grid in `scripts/pixel-art/icons/`:

```
python3 scripts/pixel-art/build.py
```

## Structure

```
/
├── index.html            Home: hero, selected work, then a short section for each page
├── about.html            Bio, interests, contact links
├── research.html         HAX Lab and the SAIRI internship at CEAMLS
├── projects.html         Project index
├── /projects             One case study per project
│   ├── myvoice.html
│   ├── redis-clone.html
│   ├── moodlens.html
│   ├── advprom.html
│   ├── developers-driver.html
│   └── photo-cleaner.html
├── achievements.html
├── resume.html           Inline PDF viewer and download
├── /assets               Resume PDF, favicon, images, pixel-art sprites
├── /css                  styles.css
├── /js                   main.js, count-up.js, palette.js, turntable.js
├── /scripts/pixel-art    Sprite generator
└── CNAME                 Custom domain for GitHub Pages
```

## License

The code is MIT licensed. The writing, photos, resume, and pixel art are mine and all rights reserved. See [LICENSE](LICENSE) for the details.

## Contact

- Email: rochakghimire2@gmail.com
- GitHub: [github.com/Kenzoh33](https://github.com/Kenzoh33)
- LinkedIn: [linkedin.com/in/rochakghimire](https://linkedin.com/in/rochakghimire)
