/* Every theme must be readable, not just the one being looked at.
   Twelve themes x several token pairs is more than anyone checks by eye,
   which is exactly why it belongs in a test. See docs/adr/0002. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore, allThemes } = require('./extract.js');

const C = loadCore();
const AA = 4.5; // WCAG 2.1 AA for normal-size text

/* Pairs that actually occur on the page. --faint is checked against both
   --surface and --bg because it is used on cards and on bare background. */
function pairs(k) {
  return [
    ['ink on bg', k.ink, k.bg],
    ['muted on bg', k.muted, k.bg],
    ['muted on surface', k.muted, k.surface],
    ['faint on bg', k.faint, k.bg],
    ['faint on surface', k.faint, k.surface],
    ['accent-ink on accent', k.accentInk, k.accent],
  ];
}

for (const theme of allThemes(C)) {
  test(`${theme.id} clears AA on every text pair`, () => {
    const k = C.deriveTokens(theme);
    const failures = [];

    for (const [label, fg, bg] of pairs(k)) {
      const ratio = C.contrast(fg, bg);
      if (ratio < AA) failures.push(`${label}: ${ratio.toFixed(2)}:1 (${fg} on ${bg})`);
    }

    assert.deepEqual(failures, [], `${theme.id} below ${AA}:1 —\n  ${failures.join('\n  ')}`);
  });
}

test('the muted and faint tiers stay visually distinct', () => {
  // Pushing both to pass AA risks collapsing them into one another; a theme
  // where they are indistinguishable has lost a level of hierarchy.
  for (const theme of allThemes(C)) {
    const k = C.deriveTokens(theme);
    const gap = Math.abs(C.lum(k.muted) - C.lum(k.faint));
    assert.ok(gap > 0.02, `${theme.id}: muted and faint differ by only ${gap.toFixed(4)} luminance`);
  }
});

test('accent-ink picks the better of its two candidates', () => {
  for (const theme of allThemes(C)) {
    const k = C.deriveTokens(theme);
    const dark = C.mix(k.bg, '#000000', 0.12);
    const best = Math.max(C.contrast(dark, k.accent), C.contrast('#ffffff', k.accent));
    assert.equal(
      C.contrast(k.accentInk, k.accent).toFixed(4),
      best.toFixed(4),
      `${theme.id}: chose the lower-contrast option for --accent-ink`,
    );
  }
});
