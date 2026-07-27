# ADR-0001 — The site is a single file, but the repo is not

**Status:** accepted · 2026-07-27

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
