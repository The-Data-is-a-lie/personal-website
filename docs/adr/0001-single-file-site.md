# ADR-0001 — Self-contained pages, and a repo that is not

**Status:** accepted · 2026-07-27 · **amended 2026-07-27** (see *Amendment* below)

## Context

`index.html` holds the markup, the stylesheet and the script for the whole site.
Around 840 lines, no build step, no runtime dependencies, no external requests —
system font stacks, inline SVG, a data-URI favicon. GitHub Pages serves the
repository root directly, so deploying is `git push`.

Any architecture review looks at one 840-line file and proposes splitting it into
modules. That proposal keeps coming back, so it is worth settling.

## Decision

**The served artifact stays one self-contained file.** No build step, no bundler,
no runtime dependencies, no extra requests.

**The repository may carry dev-only tooling.** A `package.json` and a `test/`
directory are fine, because they never reach a visitor. Deploying is still
"push `index.html`".

## Why not split it

- Splitting into ES modules costs extra requests on a page whose entire selling
  point is that it loads as one thing. Splitting with a bundler adds a build step.
- Either option breaks the property that makes this repo pleasant to work in:
  open `index.html` in a browser and you are already running the site. No install,
  no dev server, no watch process.
- GitHub Pages serves the root as-is. A build step means either committing build
  output or adding CI, both of which are more moving parts than the site has
  content.

## Consequences

- Code inside the DOM-wiring IIFE has no interface and therefore no test surface.
  That is accepted.
- The pure half — colour maths, the dice RNG, the roll state machine, the theme
  seeds — was pulled into a separate `SiteCore` block precisely so it *does* have
  one. It touches no DOM, so `test/extract.js` can read it out of `index.html` and
  evaluate it in node with no shim. See ADR-0002 for what that bought.
- Tests run against the shipped file, never a copy, so they cannot silently drift.
- If DOM behaviour ever needs testing, the cheap move is exposing a single handle
  on `window` and shimming what it touches — not adopting a build system.

## Alternatives rejected

| Option | Why not |
| --- | --- |
| ES modules, no bundler | Extra requests; `file://` blocks module loading, so open-and-edit dies |
| Bundler + build step | Commit build output or add CI; more machinery than the site has content |
| Copy pure functions into `test/` | Tests would verify a copy and keep passing while the real code drifted |

---

## Amendment — `resume.html` (2026-07-27)

The site is now **two pages**, not one. `index.html` and `resume.html`.

The decision above was written as "one self-contained file". The correct rule was always
**self-contained *pages***: no build step, no bundler, no runtime dependencies, and every
page openable directly from disk. Adding a second static page keeps all of that. Nothing
about the reasoning changed — only the count.

### Why the résumé is a page

A résumé needs a URL you can paste into an application and a layout that prints. Inside a
collapsible panel on the home page it had neither.

### Why it does not share a stylesheet

`resume.html` carries its own ~60 lines of CSS and duplicates six values from the
*parchment* theme (`--bg`, `--ink`, `--accent`, the two font stacks, `--radius`).

Extracting a shared `styles.css` was the obvious alternative and was rejected: it would
cost `index.html` its self-containment for the sake of a page that shares almost nothing
with it. Of the 238 rules in `index.html`, only 24 were résumé-specific and 7 were shared
base rules — the other ~207 are cards, hero, banner, d20 and canvas, none of which a
résumé wants.

The duplication is safe because **`resume.html` derives nothing**. It has no theme engine
and no runtime token computation, so there is no derived value that can drift out of step
with `SiteCore.deriveTokens`. It is a document with fixed colours, and those colours were
chosen from a palette `test/contrast.test.js` already verifies.

If a third page ever appears, revisit this — two copies is a judgement call, three is a
problem.

### Consequence: `disclosure()` has one caller

Removing the inline résumé leaves the build notes as the only `disclosure()` caller. The
module was justified in part on having two, so the seam is hypothetical again by the
standard we set. It stays because the notes genuinely need measured height and the
alternative is inlining 40 lines back into a call site — but it is worth being honest that
the résumé's clipping bug is now fixed by deletion rather than by the abstraction.
