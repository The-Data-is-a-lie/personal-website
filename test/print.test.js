/* The résumé now inherits the site theme, so its screen colours are whatever
   theme the visitor last picked — but the printed page must stay black on white
   in every one of them. That holds only because @media print overrides every
   themed declaration, and it fails silently: add a themed element, forget the
   print override, and the break shows up on paper months later.

   So rather than eyeball a print preview once, assert the invariant: every
   declaration outside the print block that resolves a colour through var()
   has a matching override inside it. See docs/adr/0001, amendment 2. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { RESUME } = require('./extract.js');

/* Elements the print block removes outright, so their colours never resolve.
   Anything added here needs a reason that survives the question "what happens
   when this prints in Parchment?" */
const NOT_PRINTED = new Set([
  '.back', // display:none — a link back to the site means nothing on paper
  '.back:hover', // hover does not exist on paper either
  '::selection', // selection highlight is not part of the printed document
]);

/* Comments are stripped first, deliberately. Left in, a comment sitting above a
   rule is captured as part of that rule's selector, and the rule stops matching
   anything — the test would pass by not looking. */
const css = fs
  .readFileSync(RESUME, 'utf8')
  .match(/<style>([\s\S]*?)<\/style>/)[1]
  .replace(/\/\*[\s\S]*?\*\//g, '');

const printStart = css.indexOf('@media print');
assert.ok(printStart > -1, 'resume.html has no @media print block');
const screenCss = css.slice(0, printStart);
const printCss = css.slice(printStart);

const norm = (s) => s.trim().replace(/\s+/g, ' ');

/* selector -> Set of properties it declares, for one slab of CSS */
function rules(source) {
  const out = [];
  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = norm(selector);
    if (sel.startsWith('@') || sel === ':root' || sel === '*') continue;

    const props = new Map();
    for (const [, prop, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      props.set(prop.trim(), value.trim());
    }
    // a selector list ".a,.b{}" covers both members
    for (const one of sel.split(',')) out.push([norm(one), props]);
  }
  return out;
}

const printRules = rules(printCss);
const overridden = (selector, prop) =>
  printRules.some(([sel, props]) => sel === selector && props.has(prop));

test('every themed colour on the résumé has a print override', () => {
  const gaps = [];
  let checked = 0;

  for (const [selector, props] of rules(screenCss)) {
    if (NOT_PRINTED.has(selector)) continue;

    for (const [prop, value] of props) {
      if (!value.includes('var(--')) continue;
      // only colour-bearing properties matter on paper; font-size:var(--step-2)
      // and font-family:var(--mono) print fine as they are
      if (!/^(color|background|background-color|border(-\w+)?(-color)?)$/.test(prop)) continue;

      checked++;
      if (!overridden(selector, prop)) gaps.push(`${selector} { ${prop}: ${value} }`);
    }
  }

  // A parser that quietly matches nothing passes this test perfectly, which is
  // the failure mode worth guarding — the count is the guard.
  assert.ok(checked >= 13, `expected to check ~13 themed declarations, checked ${checked}`);
  assert.deepEqual(
    gaps,
    [],
    `themed declarations that would print in colour:\n  ${gaps.join('\n  ')}`,
  );
});

test('the not-printed allowlist has no stale entries', () => {
  // An allowlisted selector that no longer exists is a hole waiting for a
  // future rule to reuse the name and skip the check.
  const present = new Set(rules(screenCss).map(([sel]) => sel));
  for (const sel of NOT_PRINTED) {
    assert.ok(present.has(sel), `${sel} is allowlisted but no longer in resume.html`);
  }
});

test('the print block resolves nothing through a theme variable', () => {
  // An override that is itself var()-based would track the theme and defeat
  // the point. Every colour in here should be a literal.
  const themed = [];
  for (const [selector, props] of printRules) {
    for (const [prop, value] of props) {
      if (value.includes('var(--')) themed.push(`${selector} { ${prop}: ${value} }`);
    }
  }
  assert.deepEqual(themed, [], `print block depends on theme vars:\n  ${themed.join('\n  ')}`);
});

test('the résumé reads the cached tokens before first paint', () => {
  // In <body>, or deferred, the page paints arcane and then repaints — a
  // visible flash for anyone on a light theme.
  const html = fs.readFileSync(RESUME, 'utf8');
  const reader = html.indexOf('site.tokens');
  const bodyOpen = html.indexOf('<body');

  assert.ok(reader > -1, 'resume.html no longer reads site.tokens');
  assert.ok(reader < bodyOpen, 'the token reader must run in <head>, before <body>');
  assert.ok(
    !/<script[^>]+(defer|async)[^>]*>[\s\S]*?site\.tokens/.test(html),
    'the token reader must not be deferred or async',
  );
});
