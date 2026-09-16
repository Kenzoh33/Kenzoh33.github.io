# Rochak Ghimire — Personal Portfolio

This is the source for my personal site, [kenzoh33.github.io](https://kenzoh33.github.io). It's where I put my projects, research, and background for anyone deciding whether to give me a callback.

## Tech stack

Plain HTML, CSS, and vanilla JavaScript. No framework, no bundler, no build step, no `npm install`. I wanted a site that's fast by default, easy to maintain, and doesn't hide behind a template's defaults.

JavaScript is used only for progressive enhancement (scroll-reveal on content, driven by `IntersectionObserver`). Every page is fully readable and navigable with JavaScript turned off, and everything respects `prefers-reduced-motion`.

## Running it locally

No dev server required. From the project root:

```
python3 -m http.server
```

Then open `http://localhost:8000` in a browser. Any static file server works the same way, or just open the HTML files directly.

## Structure

```
/
├── index.html            Home (name, status, one-line positioning)
├── about.html            Bio, interests, contact links
├── research.html         HAX Lab and SAIRI/CEAMLS research
├── projects.html         Project index
├── /projects             One page per project
├── achievements.html
├── resume.html           Inline PDF viewer + download
├── /assets               Resume PDF, favicon, images
├── /css
└── /js
```

Contact info (email, GitHub, LinkedIn) lives at the bottom of the About page rather than a separate page.

## Contact

- Email: rochakghimire2@gmail.com
- GitHub: [github.com/Kenzoh33](https://github.com/Kenzoh33)
- LinkedIn: [linkedin.com/in/rochakghimire](https://linkedin.com/in/rochakghimire)
