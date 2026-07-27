# ADR-0001 — Self-contained pages, and a repo that is not

**Status:** accepted · 2026-07-27 · **amended twice, 2026-07-27** (see *Amendments* below)

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

## Amendment 1 — `resume.html` (2026-07-27)

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

---

## Amendment 2 — the résumé follows the theme (2026-07-27)

Amendment 1 left the résumé permanently *arcane*. Switch the site to Parchment, click
through, and the résumé stayed dark. It now follows whatever theme was last picked.

### It follows the theme without gaining a theme engine

The load-bearing sentence in Amendment 1 was "**`resume.html` derives nothing** … there is
no derived value that can drift out of step with `SiteCore.deriveTokens`". That is still
true, and it is what made this cheap.

`applyTheme` already computes the finished token set. It now also caches it —
`localStorage["site.tokens"]`, a flat `{"--bg":"#0A0C16", …}` object with a `v:1` stamp.
`resume.html` carries six lines in `<head>` that read that object and `setProperty` each
key. It applies pre-computed strings. It still derives nothing, still has no colour maths,
still has no picker.

`SiteCore.cssVars(theme)` is new and is the only place the token → property-name mapping
lives; `applyTheme` loops it instead of restating it across nine `setProperty` calls.

### Why not a shared `core.js`

The obvious alternative — pull `SiteCore` into a file both pages load — was rejected for
the reason Amendment 1 rejected a shared stylesheet: it costs `index.html` its
self-containment for the sake of one small page. (The table above rules out *ES* modules
because `file://` blocks them. A classic `<script src>` would in fact work from disk, so
that row is not the objection here. The extra request is.)

### Consequences

- **Print is untouched.** `@media print` sets `background`/`color` directly rather than
  through `var()`, so the inline custom properties never reach it. The PDF is
  black-on-white in every theme, verified in both a light and a dark one.
- **Graceful by default.** No cached tokens — never visited `index.html`, or arrived on a
  pasted résumé URL — means the hardcoded `:root` block stands, exactly as before.
- **The reader is parser-blocking, in `<head>`, on purpose.** It touches no network. Run
  after first paint, it would flash arcane before a light theme landed.
- **A stale cache is possible.** Change `deriveTokens` and someone who deep-links the
  résumé before reloading the site gets the old palette for one visit. `v:1` is the escape
  hatch: bump it and stale caches are ignored rather than applied. Nothing enforces
  remembering to; the blast radius is one visit and slightly-off greys.
- **The two `:root` fallback blocks are now tested.** `test/tokens.test.js` asserts both
  pages' literals equal `cssVars(arcane)`, and that every token has a fallback at all.
  Amendment 1 rested on a comment claiming those numbers were right. They were — but
  nothing would have caught it if a later `MUTED`/`FAINT` tweak had made them wrong.
