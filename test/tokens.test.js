/* cssVars is the one place the token -> custom-property mapping lives.
   index.html applies it and caches it; resume.html reads that cache back.
   Both pages also hardcode an arcane fallback in :root for first paint, and
   those two literal blocks are the things most likely to rot — nothing at
   runtime reads them once the script has run, so a drifted value is invisible
   until someone loads the page with JS off or without a cached theme.
   See docs/adr/0001. */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  loadCore, allThemes, rootVars, fakeStorage, runResumeReader, HTML, RESUME,
} = require('./extract.js');

const C = loadCore();
const ARCANE = C.THEMES.find((t) => t.id === 'arcane');
const arcaneVars = C.cssVars(ARCANE);

/* the seeds are written uppercase, the mixed values come back lowercase */
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

test('every token cssVars produces has a pre-JS fallback in index.html', () => {
  // Catches adding a token to deriveTokens and forgetting the :root literal,
  // which shows as a one-frame flash of the wrong colour and nothing else.
  const declared = rootVars(HTML);
  const missing = Object.keys(arcaneVars).filter((k) => !(k in declared));
  assert.deepEqual(missing, [], `index.html :root is missing ${missing.join(', ')}`);
});

test("index.html's :root fallbacks equal arcane", () => {
  const declared = rootVars(HTML);
  for (const [name, value] of Object.entries(arcaneVars)) {
    assert.ok(
      same(declared[name], value),
      `index.html :root has ${name}:${declared[name]}, arcane derives ${value}`,
    );
  }
});

test("resume.html's :root fallbacks equal arcane", () => {
  // resume.html declares a subset — it has no cards, so no --surface — plus
  // static values (fonts, --radius, the type scale) that no theme touches.
  const declared = rootVars(RESUME);
  const themed = Object.keys(declared).filter((k) => k in arcaneVars);

  assert.ok(themed.length >= 7, `expected resume.html to theme several tokens, found ${themed.length}`);
  for (const name of themed) {
    assert.ok(
      same(declared[name], arcaneVars[name]),
      `resume.html :root has ${name}:${declared[name]}, arcane derives ${arcaneVars[name]}`,
    );
  }
});

test('the cached payload is flat strings, with room for its version key', () => {
  // resume.html walks this object and calls setProperty on every key but `v`.
  // A non-string value or a token literally named "v" would break that loop.
  for (const theme of allThemes(C)) {
    const vars = C.cssVars(theme);
    assert.ok(!('v' in vars), `${theme.id}: a token named "v" collides with the version key`);

    for (const [name, value] of Object.entries(vars)) {
      assert.equal(typeof value, 'string', `${theme.id}: ${name} is not a string`);
      assert.ok(name.startsWith('--'), `${theme.id}: ${name} is not a custom property name`);
    }

    const payload = JSON.parse(JSON.stringify(Object.assign({ v: 1 }, vars)));
    assert.equal(payload.v, 1);
    delete payload.v;
    assert.deepEqual(payload, vars, `${theme.id}: payload does not round-trip through JSON`);
  }
});

/* The handoff itself: what index.html writes is what resume.html applies.
   These run the reader out of the shipped resume.html against a fake
   localStorage, so they cover the behaviour without a browser. */

/* exactly what applyTheme caches */
function cache(theme) {
  return JSON.stringify(Object.assign({ v: 1 }, C.cssVars(theme)));
}

test('the résumé applies a theme the site cached', () => {
  for (const theme of allThemes(C)) {
    const applied = runResumeReader(fakeStorage({ 'site.tokens': cache(theme) }));

    assert.deepEqual(applied, C.cssVars(theme), `${theme.id} did not round-trip to the résumé`);
    assert.ok(!('v' in applied), `${theme.id}: the version key leaked into setProperty`);
  }
});

test('the résumé falls back to its own :root when nothing is cached', () => {
  // Someone who lands on a pasted résumé URL having never opened the site.
  assert.deepEqual(runResumeReader(fakeStorage({})), {});
});

test('the résumé ignores a cache it does not understand', () => {
  const parchment = C.THEMES.find((t) => t.id === 'parchment');
  const vars = C.cssVars(parchment);

  const junk = {
    'a future version': JSON.stringify(Object.assign({ v: 2 }, vars)),
    'no version at all': JSON.stringify(vars),
    'truncated json': '{"v":1,"--bg":"#F3',
    'not an object': '"arcane"',
    'null': 'null',
    'empty string': '',
  };

  for (const [label, value] of Object.entries(junk)) {
    assert.deepEqual(
      runResumeReader(fakeStorage({ 'site.tokens': value })),
      {},
      `${label} should have been ignored, leaving the :root fallback in place`,
    );
  }
});

test('cssVars agrees with deriveTokens', () => {
  // cssVars is a renaming, not a second derivation. If it ever grows logic of
  // its own, the contrast sweep in contrast.test.js stops covering what ships.
  for (const theme of allThemes(C)) {
    const k = C.deriveTokens(theme);
    const v = C.cssVars(theme);
    assert.equal(v['--bg'], k.bg);
    assert.equal(v['--ink'], k.ink);
    assert.equal(v['--accent'], k.accent);
    assert.equal(v['--surface'], k.surface);
    assert.equal(v['--surface-2'], k.surface2);
    assert.equal(v['--line'], k.line);
    assert.equal(v['--muted'], k.muted);
    assert.equal(v['--faint'], k.faint);
    assert.equal(v['--accent-ink'], k.accentInk);
    assert.equal(v['--field-op'], k.fieldOp);
  }
});
