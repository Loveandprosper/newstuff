import test from 'node:test';
import assert from 'node:assert/strict';
import { registerPage, navigate } from '../src/router.js';
import { mountWork } from '../src/pages/work.js';
import { askRun } from '../src/ask.js';

const deferred = () => { let r; const p = new Promise((res) => { r = res; }); return { p, r }; };

test('router: slow mount of A resolving after navigating to B leaves B in #view', async () => {
  const view = { innerHTML: '' };
  globalThis.document = { getElementById: (id) => (id === 'view' ? view : null), title: '' };
  const gate = deferred();
  let unmounted = 0;
  registerPage('cards', { title: 'A', mount: async (el, ctx) => { await gate.p; if (ctx.signal.aborted) return; el.innerHTML = 'PAGE A'; }, unmount: () => { unmounted++; } });
  registerPage('health', { title: 'B', mount: (el) => { el.innerHTML = 'PAGE B'; } });
  try {
    navigate('cards');
    navigate('health');
    gate.r();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(view.innerHTML, 'PAGE B');
    assert.equal(unmounted, 1);
  } finally { delete globalThis.document; }
});

test('work mount bails after await when its signal is aborted', async () => {
  const gate = deferred();
  const db = { list: () => gate.p.then(() => [{ title: 'x', category: 'Work' }]) };
  const ctrl = new AbortController();
  const el = { innerHTML: '' };
  const done = mountWork(el, { db, signal: ctrl.signal });
  const before = el.innerHTML;
  ctrl.abort();
  el.innerHTML = 'OTHER PAGE';
  gate.r();
  await done;
  assert.equal(el.innerHTML, 'OTHER PAGE');
  assert.ok(before.includes('Loading'));
});

test('ask: superseded call never writes; cancelled is silent', async () => {
  const out = { textContent: '' };
  const first = deferred();
  const sample1 = (input, opts) => new Promise((res, rej) => {
    opts.signal.addEventListener('abort', () => { opts.onText({ text: 'late stream' }); rej({ code: 'cancelled' }); });
    first.p.then(() => res({ text: 'OLD' }));
  });
  const p1 = askRun(out, sample1, 'q1');
  const p2 = askRun(out, async () => ({ text: 'NEW' }), 'q2');
  await p2; first.r(); await p1;
  assert.equal(out.textContent, 'NEW');
  // a stale resolve (sample ignoring the signal) also never overwrites
  const slow = deferred();
  const p3 = askRun(out, () => slow.p, 'q3');
  await askRun(out, async () => ({ text: 'NEWEST' }), 'q4');
  slow.r({ text: 'STALE' }); await p3;
  assert.equal(out.textContent, 'NEWEST');
});
