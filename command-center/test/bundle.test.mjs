import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { bundle } from '../build.mjs';

const fx = (d) => join(dirname(fileURLToPath(import.meta.url)), 'fixtures', d);
const run = (d) => bundle(join(fx(d), 'main.js'), fx(d));

test('bundle orders dependencies first and emits diamond import once', () => {
  const out = run('ok');
  const pos = (m) => out.indexOf(`// ---- ${m} ----`);
  assert.ok(pos('a.js') >= 0 && pos('a.js') < pos('b.js'));
  assert.ok(pos('a.js') < pos('c.js'));
  assert.ok(pos('b.js') < pos('main.js') && pos('c.js') < pos('main.js'));
  assert.equal(out.match(/const A = 1;/g).length, 1);
});

test('bundle leaves no import/export statements', () => {
  const out = run('ok');
  assert.doesNotMatch(out, /^\s*(import|export)\b/m);
});

for (const d of ['default', 'named', 'star', 'bare']) {
  test(`bundle throws on unsupported form: ${d}`, () => {
    assert.throws(() => run(d), /Unsupported module syntax/);
  });
}
