import test from 'node:test';
import assert from 'node:assert/strict';
import { layApplyOrder, layMove, layToggle, layLoad, laySave } from '../src/layout.js';

test('layApplyOrder: saved first, unknown ids keep default position after', () => {
  assert.deepEqual(layApplyOrder(['a', 'b', 'c', 'd'], { order: ['c', 'x', 'a'] }), ['c', 'a', 'b', 'd']);
  assert.deepEqual(layApplyOrder(['a', 'b'], null), ['a', 'b']);
  assert.deepEqual(layApplyOrder(['a', 'b'], { order: ['b', 'b'] }), ['b', 'a']);
});

test('layMove up/down and edges', () => {
  assert.deepEqual(layMove(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c']);
  assert.deepEqual(layMove(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b']);
  assert.deepEqual(layMove(['a', 'b', 'c'], 'a', 'up'), ['a', 'b', 'c']);
  assert.deepEqual(layMove(['a', 'b', 'c'], 'c', 'down'), ['a', 'b', 'c']);
  assert.deepEqual(layMove(['a', 'b'], 'zz', 'up'), ['a', 'b']);
});

test('layToggle adds and removes', () => {
  assert.deepEqual(layToggle([], 'a'), ['a']);
  assert.deepEqual(layToggle(['a', 'b'], 'a'), ['b']);
  assert.deepEqual(layToggle(undefined, 'a'), ['a']);
});

function fakeStore() {
  const m = new Map();
  return { async get(c, id) { return m.get(c + '/' + id) || null; }, async put(c, doc) { m.set(c + '/' + doc.id, { ...doc }); return doc; }, m };
}
function fakeLs() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; }

test('save/load round trip via fake db and storage', async () => {
  const store = fakeStore(); const ls = fakeLs();
  const d = { order: ['weather', 'next'], hidden: ['endday'], collapsed: ['tasks'] };
  await laySave('home', d, store, ls, '2026-10-03T10:00:00Z');
  const strip = (x) => { const { updated_at, ...rest } = x; return rest; };
  assert.ok(store.m.has('settings/layout-home'));
  assert.deepEqual(strip(JSON.parse(ls.m['cc.layout.home'])), d);
  assert.deepEqual(strip(await layLoad('home', store, fakeLs())), d);
  // offline db falls back to local mirror
  const off = { async get() { return { offline: true }; } };
  assert.deepEqual(strip(await layLoad('home', off, ls)), d);
  assert.deepEqual(await layLoad('work', off, fakeLs()), { order: [], hidden: [], collapsed: [] });
});

test('newer local mirror wins over older remote doc (unflushed write)', async () => {
  const store = fakeStore(); const ls = fakeLs();
  await store.put('settings', { id: 'layout-home', order: ['a'], hidden: [], collapsed: [], updated_at: '2026-10-03T09:00:00Z' });
  ls.setItem('cc.layout.home', JSON.stringify({ order: ['b'], hidden: ['x'], collapsed: [], updated_at: '2026-10-03T10:00:00Z' }));
  assert.deepEqual((await layLoad('home', store, ls)).order, ['b']);
  await store.put('settings', { id: 'layout-home', order: ['c'], hidden: [], collapsed: [], updated_at: '2026-10-03T11:00:00Z' });
  assert.deepEqual((await layLoad('home', store, ls)).order, ['c']);
  assert.deepEqual(JSON.parse(ls.m['cc.layout.home']).order, ['c']);
});

test('hide/show only changes hidden, order stays empty (shift ordering kept)', () => {
  const d = { order: [], hidden: [], collapsed: [] };
  const next = { ...d, hidden: layToggle(d.hidden, 'endday') };
  assert.deepEqual(next.order, []);
  assert.deepEqual(layApplyOrder(['next', 'weather', 'endday'], next), ['next', 'weather', 'endday']);
});

test('applying an order twice is idempotent', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const once = layApplyOrder(ids, { order: ['c', 'a'] });
  assert.deepEqual(layApplyOrder(once, { order: ['c', 'a'] }), once);
  assert.deepEqual(layApplyOrder(ids, { order: once }), once);
});
