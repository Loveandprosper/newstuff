import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'command-center.html');

function build() {
  execFileSync(process.execPath, [join(root, 'build.mjs')], { stdio: 'pipe' });
  return readFileSync(out, 'utf8');
}

test('build produces single file with no external src/href to ./', () => {
  const html = build();
  assert.ok(existsSync(out));
  assert.match(html, /--work:/);
  assert.doesNotMatch(html, /src="\.\//);
  assert.doesNotMatch(html, /href="\.\//);
  assert.match(html, /<script type="module">/);
});

function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('accent and text tokens have >= 4.5:1 contrast on --surface in both themes', () => {
  const css = readFileSync(join(root, 'src', 'styles.css'), 'utf8');
  const blocks = {
    dark: css.match(/:root\s*\{([^}]*)\}/)[1],
    light: css.match(/\[data-theme=light\]\s*\{([^}]*)\}/)[1],
  };
  const get = (b, k) => (b.match(new RegExp(`--${k}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
  for (const [theme, block] of Object.entries(blocks)) {
    const surface = get(block, 'surface');
    assert.ok(surface, `${theme} surface`);
    for (const k of ['text', 'muted', 'accent', 'work', 'cards', 'health', 'wf', 'inbox', 'alert', 'done']) {
      const v = get(block, k);
      assert.ok(v, `${theme} --${k} defined`);
      assert.ok(ratio(v, surface) >= 4.5, `${theme} --${k} ${v} on ${surface} = ${ratio(v, surface).toFixed(2)}`);
    }
  }
});
