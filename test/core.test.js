const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore, fakeStorage } = require('./extract.js');

const C = loadCore();

test('hx parses six-digit hex', () => {
  assert.deepEqual(C.hx('#000000'), [0, 0, 0]);
  assert.deepEqual(C.hx('#ffffff'), [255, 255, 255]);
  assert.deepEqual(C.hx('#E7B24C'), [231, 178, 76]);
});

test('hx expands three-digit shorthand', () => {
  assert.deepEqual(C.hx('#fff'), C.hx('#ffffff'));
  assert.deepEqual(C.hx('#0a0'), [0, 170, 0]);
});

test('toHex round-trips through hx', () => {
  for (const c of ['#000000', '#ffffff', '#e7b24c', '#0a0c16']) {
    assert.equal(C.toHex(C.hx(c)), c);
  }
});

test('toHex clamps out-of-range channels', () => {
  assert.equal(C.toHex([-40, 300, 128]), '#00ff80');
});

test('mix returns its endpoints', () => {
  assert.equal(C.mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(C.mix('#000000', '#ffffff', 1), '#ffffff');
});

test('mix returns the midpoint', () => {
  assert.equal(C.mix('#000000', '#ffffff', 0.5), '#808080');
});

test('lum matches known sRGB luminance', () => {
  assert.equal(C.lum('#ffffff'), 1);
  assert.equal(C.lum('#000000'), 0);
  // mid grey is far below 0.5 because sRGB is gamma-encoded
  assert.ok(Math.abs(C.lum('#808080') - 0.2159) < 0.001);
});

test('contrast is symmetric and bounded by 21:1', () => {
  assert.ok(Math.abs(C.contrast('#ffffff', '#000000') - 21) < 1e-9);
  assert.equal(C.contrast('#ffffff', '#000000'), C.contrast('#000000', '#ffffff'));
  assert.equal(C.contrast('#123456', '#123456'), 1);
});

test('randInt stays within its range', () => {
  for (let i = 0; i < 5000; i++) {
    const v = C.randInt(1, 20);
    assert.ok(v >= 1 && v <= 20, `out of range: ${v}`);
  }
  assert.equal(C.randInt(7, 7), 7);
});

test('randInt is not biased toward the low end', () => {
  // rejection sampling exists to prevent modulo bias; a plain
  // `x % 20` would over-weight the first buckets. 5 sigma window,
  // so this is ~1-in-100000 to flake rather than a coin toss.
  const draws = 100000;
  const buckets = new Array(21).fill(0);
  for (let i = 0; i < draws; i++) buckets[C.randInt(1, 20)]++;

  const expected = draws / 20;
  const sigma = Math.sqrt(draws * (1 / 20) * (19 / 20));
  for (let face = 1; face <= 20; face++) {
    const drift = Math.abs(buckets[face] - expected);
    assert.ok(drift < 5 * sigma, `face ${face}: ${buckets[face]} vs ${expected} expected`);
  }
});

test('makeRollState scripts a 20, then a 1, then goes honest', () => {
  const store = fakeStorage();
  const state = C.makeRollState(store);

  assert.equal(state.stage(), 0);
  assert.equal(state.next(), 20);
  assert.equal(state.stage(), 1);
  assert.equal(state.next(), 1);
  assert.equal(state.stage(), 2);

  for (let i = 0; i < 200; i++) {
    const v = state.next();
    assert.ok(v >= 1 && v <= 20);
  }
  assert.equal(state.stage(), 2, 'stage must stop advancing once honest');
});

test('makeRollState resumes mid-script from storage', () => {
  const state = C.makeRollState(fakeStorage({ 'site.rollStage': '1' }));
  assert.equal(state.next(), 1, 'a returning visitor at stage 1 gets the natural 1');
});

test('makeRollState migrates the old site.got20 flag', () => {
  // visitors who rolled the 20 under the previous scheme must not get it again
  const state = C.makeRollState(fakeStorage({ 'site.got20': '1' }));
  assert.equal(state.stage(), 1);
  assert.equal(state.next(), 1);
});

test('makeRollState survives storage that throws', () => {
  const hostile = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  const state = C.makeRollState(hostile);
  assert.equal(state.stage(), 0);
  assert.equal(state.next(), 20, 'the opening still plays without persistence');
  assert.equal(state.next(), 1);
});
