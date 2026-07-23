# personal-website

My personal site — a single static page, no build step, no dependencies.

**Live:** https://the-data-is-a-lie.github.io/personal-website/

## What's here

| Path | Purpose |
| --- | --- |
| `index.html` | The whole site — markup, inline CSS, and inline vanilla JS |
| `.nojekyll` | Tells GitHub Pages to serve files as-is instead of running Jekyll |

Everything is self-contained: system font stacks, inline SVG icons, no external
requests. Open `index.html` in a browser to work on it locally.

## Deploying

GitHub Pages serves `main` from the repository root. Push to `main` and the site
rebuilds automatically — usually live within a minute.

## Notes

- Themes are generated at runtime from a `[background, accent, ink]` seed per
  theme, so adding one means adding a single entry to the `THEMES` array.
- The email address is assembled in JS rather than written into the markup, to
  keep it away from scrapers.
