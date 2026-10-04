// Builds dist/command-center.html: one file with all local CSS and JS inlined.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

// Bundle ES modules from an entry: each module once, dependencies first.
// Supports only relative named imports and `export function/const/let/class`.
export function bundle(entry, base = src) {
  const seen = new Set();
  const out = [];
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    let code = readFileSync(file, 'utf8');
    const importRe = /^\s*import\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"];?[ \t]*$/gm;
    for (const m of code.matchAll(importRe)) visit(resolve(dirname(file), m[1]));
    code = code.replace(importRe, '').replace(/^export\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/gm, '');
    const bad = code.match(/^\s*(?:export\b|import\b(?!\s*\())[^\n]*/m);
    if (bad) throw new Error(`Unsupported module syntax in ${file}: "${bad[0].trim()}" (only relative named imports and export function/const/let/class are supported)`);
    out.push(`// ---- ${file.slice(base.length + 1)} ----\n${code.trim()}\n`);
  };
  visit(resolve(entry));
  return out.join('\n');
}

const safe = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');

function build() {
let html = readFileSync(join(src, 'index.html'), 'utf8');
html = html.replace(/<link\s+[^>]*rel="stylesheet"[^>]*href="(\.[^"]+)"[^>]*>/g,
  (_, p) => `<style>\n${safe(readFileSync(join(src, p), 'utf8'))}</style>`);
html = html.replace(/<script\s+type="module"\s+src="(\.[^"]+)"\s*><\/script>/g,
  (_, p) => `<script type="module">\n${safe(bundle(join(src, p)))}</script>`);

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'command-center.html'), html);
console.log('built command-center/dist/command-center.html');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) build();
