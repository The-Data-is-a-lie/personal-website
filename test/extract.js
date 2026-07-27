/* Pulls SiteCore straight out of index.html and evaluates it.
   The point is that the tests run against the shipped code rather than a
   copy — a copy would keep passing while the real function drifted.
   SiteCore touches no DOM, so a bare vm context plus crypto is enough. */
const fs = require('node:fs');
const path = require('node:path');

const HTML = path.join(__dirname, '..', 'index.html');

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

module.exports = { loadCore, allThemes, fakeStorage, HTML };
