# personal-website

My personal site — a single static page, no build step, no dependencies.

**Live:** https://the-data-is-a-lie.github.io/personal-website/

## What's here

| Path | Purpose |
| --- | --- |
| `index.html` | The site — markup, inline CSS, and inline vanilla JS |
| `resume.html` | Standalone printable résumé. Self-contained; shares nothing with `index.html` |
| `.nojekyll` | Tells GitHub Pages to serve files as-is instead of running Jekyll |
| `test/` | Dev-only. Never served |
| `docs/adr/` | Why the site is shaped the way it is |
| `package.json` | Dev-only. Declares the test script; no dependencies |

Everything served is self-contained: system font stacks, inline SVG icons, no
external requests. Open `index.html` in a browser to work on it locally.

## Deploying

GitHub Pages serves `main` from the repository root. Push to `main` and the site
rebuilds automatically — usually live within a minute.

## Tests

```
npm test
```

Node's built-in runner, so there is nothing to install. The tests read the
`SiteCore` block straight out of `index.html` and evaluate it, which means they
exercise the shipped code rather than a copy.

They cover the colour maths, the dice RNG (rejection sampling — a biased d20 is
invisible by inspection), the scripted-opening state machine, and a contrast
sweep asserting every theme clears WCAG AA on every text pair.

## Notes

- Themes are generated at runtime from a `[background, accent, ink]` seed per
  theme, so adding one means adding a single entry to the `THEMES` array. The
  contrast sweep will cover it automatically.
- The `MUTED` and `FAINT` constants in `SiteCore` are contrast-gated rather than
  chosen by eye — see [ADR-0002](docs/adr/0002-contrast-gated-theme-tokens.md)
  before changing them.
- The email address is no longer hidden from scrapers — that was more friction for
  recruiters than it was worth against bots. `resume.html` prints it plainly; the
  home page's Contact me pill reveals it on click so it can be copied, then opens a
  mail client on the second click.
