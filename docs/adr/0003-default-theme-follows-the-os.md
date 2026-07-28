# ADR-0003 — The default theme follows the visitor's OS

**Status:** accepted · 2026-07-27

## Context

The site shipped with *arcane* hardcoded as the default for everyone. Nothing in either
page read `prefers-color-scheme` — the `<meta name="color-scheme" content="dark light">`
tags only advertise that the pages support both, they do not make them react.

A visitor whose machine is in light mode therefore got a dark page:

- On `index.html` a prompt appeared after 1.1s offering "Day mode", so they could fix it,
  but only after being shown the wrong thing.
- On `resume.html` there is no prompt and no picker. They got arcane with no way to say
  otherwise — and the résumé is the page pasted into job applications, so it is the one
  most likely to be someone's first contact.

## Decision

**With nothing cached, the OS preference picks the theme.** A light-mode visitor starts on
*parchment*, a dark-mode visitor on *arcane*.

**A saved theme always wins, in both directions.** Someone who has chosen Ember keeps Ember
on a light-mode machine, and someone who has chosen Parchment keeps it on a dark-mode one.

Parchment is the light default because the first-visit prompt has always called it "day
mode"; picking anything else would make the two disagree.

## How it works

A `@media (prefers-color-scheme: light)` block redefines the themed custom properties in
`:root` on both pages. It is *only* custom properties — no component styling — so it costs
nothing but the token values.

The cascade does the rest. The `<head>` reader writes a saved theme's tokens as **inline**
styles on `documentElement`, and inline styles beat any stylesheet rule, so the media query
can only ever decide for a visitor who has no cached theme. That ordering is what makes the
whole thing safe, and it is why the reader has to exist on both pages.

## Consequence: a pre-existing flash, fixed

`index.html` kept `:root` in a `<style>` inside `<body>`, while its `<head>` carried a
baseline reset with **literal** colours (`html{background:#0A0C16}`, `color:#ECE6D6`).

That meant anyone with a saved *light* theme got a full dark-to-light flash on **every
single load**, not just the first — the head painted dark, and the correct theme only
arrived once the body stylesheet and the bottom-of-body script had run.

Adding the light media query alone would have made this worse in the other direction, so
the fix came first: `:root` and the light block moved into `<head>`, the reset now resolves
through `var(--bg)`/`var(--ink)`, and the reader sits immediately after them. First paint is
now correct for every combination of OS setting and saved theme.

Moving `:root` also fixed a smaller bug: `html`'s background was a hardcoded dark navy, so
the overscroll area stayed dark under every light theme.

## Consequences

- The first-visit prompt states which mode it landed on, so it now ships both wordings and
  swaps them with a `.light` class. Keeping both strings in the markup rather than building
  them in JS means the copy stays in one editable place.
- `p-day` was renamed `p-switch`, because the button no longer always means "day".
- Each page's light block must declare **exactly** the themed tokens its base block
  declares. A token themed in one and missing from the other is a component that breaks for
  half the visitors — this already happened once, when `--surface` was absent from
  `resume.html` and the back button rendered transparent for anyone with no cached theme.
  `test/tokens.test.js` now enforces the parity in both directions.
- The two readers are byte-identical modulo comments, pinned by a test. ADR-0001 accepts
  the duplication; this is what stops it drifting.

## Alternatives rejected

| Option | Why not |
| --- | --- |
| Keep a fixed dark default plus the corrective prompt | Shows every light-mode visitor the wrong thing first, and does nothing at all for the résumé, which has no prompt |
| Detect in JS and set a `data-theme` attribute | Needs JS to run before paint anyway, and a media query already expresses "no preference stored" declaratively |
| A theme picker on the résumé | Does not help the visitor who never touches it, which is most of them; also needs the theme seeds and `deriveTokens`, reopening the shared-`core.js` question ADR-0001 turned down |
| Slate as the light default | More document-like for a résumé, but it is not what the prompt calls day mode, so clicking between the pages would shift palette |
