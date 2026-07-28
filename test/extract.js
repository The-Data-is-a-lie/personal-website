/* Pulls SiteCore straight out of index.html and evaluates it.
   The point is that the tests run against the shipped code rather than a
   copy — a copy would keep passing while the real function drifted.
   SiteCore touches no DOM, so a bare vm context plus crypto is enough. */
const fs = require('node:fs');
const path = require('node:path');

const HTML = path.join(__dirname, '..', 'index.html');
const RESUME = path.join(__dirname, '..', 'resume.html');

function loadCore() {
  const html = fs.readFileSync(HTML, 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const src = blocks.find((b) => b.includes('var SiteCore='));
  if (!src) throw new Error('SiteCore block not found in index.html');

  // new Function rather than node:vm — a vm context is a separate realm, so the
  // arrays hx() returns would fail a strict deepEqual against host arrays.
  const core = new Function(`${src}\n;return SiteCore;`)();
  if (!core) throw new Error('SiteCore block evaluated but exported nothing');
  return core;
}

/* every theme the site can apply, earned ones included */
function allThemes(core) {
  return core.THEMES.concat([core.NAT20, core.NAT1]);
}

/* a stand-in for localStorage; the storage seam is why this is possible */
function fakeStorage(seed) {
  const data = Object.assign({}, seed);
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

/* The custom properties a page hardcodes in a :root block, as
   { "--bg": "#0A0C16", ... }. Same reasoning as loadCore: read the shipped
   file, so a fallback that drifts away from the derivation gets caught.
   Pass a media query to read the :root nested inside that @media block
   instead of the page's base one. */
function rootVars(file, media) {
  let css = fs.readFileSync(file, 'utf8');

  if (media) {
    // from the @media opening brace to the :root that follows it; the inner
    // block is all rootVars needs, so no brace matching is required
    const at = css.indexOf(`@media (${media})`);
    if (at === -1) throw new Error(`no @media (${media}) in ${path.basename(file)}`);
    css = css.slice(at);
  }

  const block = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!block) throw new Error(`no :root block in ${path.basename(file)}${media ? ` under ${media}` : ''}`);

  const vars = {};
  for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    vars[name] = value.trim();
  }
  return vars;
}

/* A page's token reader, as shipped. */
function readerSource(file) {
  const src = [...fs.readFileSync(file, 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .find((b) => b.includes('site.tokens'));
  if (!src) throw new Error(`no site.tokens reader found in ${path.basename(file)}`);
  return src;
}

/* The same reader with comments and whitespace removed. Both pages carry this
   block and a test pins them equal — but each page's comment explains itself in
   its own terms, and prose is not the thing that has to match. Behaviour is. */
function readerCode(file) {
  return readerSource(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* That reader pulled out of the shipped page and made callable. Same bargain
   as loadCore: it touches only `document` and `localStorage`, so two fakes are
   enough and there is no copy to drift.
   Returns the custom properties it would have set. */
function runReader(file, storage) {
  const applied = {};
  const doc = { documentElement: { style: { setProperty: (k, v) => { applied[k] = v; } } } };
  new Function('document', 'localStorage', readerSource(file))(doc, storage);
  return applied;
}

module.exports = {
  loadCore, allThemes, fakeStorage, rootVars, readerSource, readerCode, runReader, HTML, RESUME,
};
