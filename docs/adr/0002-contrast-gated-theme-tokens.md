# ADR-0002 — Theme tokens are contrast-gated, not hand-tuned

**Status:** accepted · 2026-07-27

## Context

Every theme derives its full palette from three seeds — background, accent, ink —
via `SiteCore.deriveTokens`. Twelve themes ship (ten in the picker, two unlocked by
the d20). Nobody cycles all twelve and checks legibility, so nobody noticed that
**WCAG AA (4.5:1) failed on all twelve**:

| token pair | before | note |
| --- | --- | --- |
| `--accent-ink` on `--accent` | **1.93:1** on *arcane* | the default theme, on the hero GitHub button |
| `--faint` on `--surface` | **2.47:1** on light themes | 15 rules of 9–12px text |

`--accent-ink` was picked by `lum(accent) > .55`. Gold sits just below that cut, so
the branch chose **white text on a gold button**.

`--faint` was `mix(ink, bg, .54)` — far enough toward the background to wash out
entirely on the light themes.

## Decision

**`--accent-ink` is chosen by measured contrast, not a luminance threshold.** Compute
both candidates and keep whichever scores higher:

```js
var dark = mix(bg, "#000000", .12);
accentInk = contrast(dark, accent) >= contrast("#ffffff", accent) ? dark : "#ffffff";
```

Six themes improve, none regress, *arcane* goes 1.93:1 → **10.17:1**.

**`--muted` and `--faint` move together, from `.34`/`.54` to `.16`/`.32`.**

**`test/contrast.test.js` enforces it.** Every theme, every text pair on the page,
≥ 4.5:1 — plus an assertion that the two tiers stay visually distinct, and one that
`--accent-ink` really did pick the better candidate.

## Why both ratios had to move

Raising `--faint` alone collapses it into `--muted`. Light themes have little
contrast headroom: `--muted` was itself only 4.78:1, so there is no room for a
second, fainter tier that also clears AA. Lowering `--muted` to `.16` opens that room.

Measured worst-case luminance gap between the two tiers:

| ratios | muted/bg | faint/surface | tier gap |
| --- | --- | --- | --- |
| `.34` / `.54` (before) | 4.77 | **2.47** ✗ | 0.1402 |
| `.34` / `.32` | 4.77 | 4.62 | **0.0107** — tiers merge |
| `.16` / `.32` (chosen) | 8.34 | 4.62 | 0.0678 |

## Consequences

- Secondary and tertiary text are more prominent than they were designed to be, and
  the gap between them is roughly half what it was. This is the accepted cost.
- Adding a theme is still one array entry, and the sweep covers it automatically.
- The `MUTED` and `FAINT` constants in `SiteCore` are **contrast-gated, not taste**.
  Do not restore `.34`/`.54` because the quiet text looks loud — that reintroduces a
  2.47:1 failure. The test will stop you; this file explains why.
- `deriveTokens` moved into `SiteCore` so the tests exercise the real derivation
  rather than a restatement of it that could drift.
- The `:root` fallbacks must equal `deriveTokens(arcane)` exactly. They had drifted,
  so first paint briefly showed an indigo surface the script then replaced.

## Alternative rejected: solve the faint ratio per theme

Stepping each theme's ratio down from `.54` until it clears 4.5:1 preserves the dark
themes almost exactly (they only reach `.45`–`.52`). It fails on light themes, which
is where the problem was:

| theme | solved ratio | tier gap |
| --- | --- | --- |
| parchment | .32 | 0.0108 |
| gold | .32 | 0.0109 |
| forest | .33 | 0.0054 |
| **slate** | **.34** | **0.0000** — identical to `--muted` |

An adaptive rule that degenerates precisely where it is needed is worse than a fixed
pair that works everywhere.
