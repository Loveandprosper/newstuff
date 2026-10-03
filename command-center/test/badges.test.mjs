import test from 'node:test';
import assert from 'node:assert/strict';
import { badgeCount, taskNeedsAttention } from '../src/badges.js';
import { mountHome } from '../src/pages/home.js';
import { mountInbox, inboxGroup } from '../src/pages/inbox.js';
import { mountWork } from '../src/pages/work.js';
import { homeImportant } from '../src/pages/home.js';
import { ASK_PROMPTS, askBuildInput } from '../src/ask.js';
import { ROUTES } from '../src/router.js';

const offlineDb = { list: async () => ({ offline: true }), get: async () => ({ offline: true }) };
const listDb = (tasks) => ({ list: async () => tasks, get: async () => null });
const fakeEl = () => ({ innerHTML: '' });
const now = new Date(2026, 9, 3, 12);

test('badgeCount: empty and non-arrays are 0', () => {
  assert.equal(badgeCount([]), 0);
  assert.equal(badgeCount(null), 0);
  assert.equal(badgeCount({ offline: true }), 0);
});
test('badgeCount counts only attention:true', () => {
  assert.equal(badgeCount([{ attention: true }, { attention: false }, {}, { attention: 'yes' }, null, { attention: true }]), 2);
});
test('taskNeedsAttention: open high-priority or due today/overdue', () => {
  assert.equal(taskNeedsAttention({ priority: 'high' }, now), true);
  assert.equal(taskNeedsAttention({ due: '2026-10-03' }, now), true);
  assert.equal(taskNeedsAttention({ due: '2026-10-01' }, now), true);
  assert.equal(taskNeedsAttention({ due: '2026-10-09' }, now), false);
  assert.equal(taskNeedsAttention({ priority: 'high', done: true }, now), false);
});
for (const [name, mount] of [['home', mountHome], ['inbox', mountInbox], ['work', mountWork]]) {
  test(name + ' mount shows offline note when db is offline', async () => {
    const el = fakeEl();
    await mount(el, { db: offlineDb, mcp: null, now });
    assert.match(el.innerHTML, /Offline — showing saved data/);
  });
}
test('inbox groups tasks by the four categories', async () => {
  const g = inboxGroup([{ title: 'a', category: 'Work' }, { title: 'b', category: 'Well & Fit' }, { title: 'c' }, { title: 'd', done: true, category: 'Health' }]);
  assert.deepEqual(Object.keys(g), ['Work', 'Personal', 'Health', 'Well & Fit']);
  assert.equal(g.Work.length, 1); assert.equal(g.Personal.length, 1); assert.equal(g['Well & Fit'].length, 1); assert.equal(g.Health.length, 0);
  const el = fakeEl();
  await mountInbox(el, { db: listDb([{ title: '<b>x</b>', category: 'Work' }]), now });
  assert.match(el.innerHTML, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(el.innerHTML, /Offline/);
});
test('home important = high priority or due today, any category, open only', () => {
  const t = [{ title: 'a', priority: 'high', category: 'Health' }, { title: 'b', due: '2026-10-03' }, { title: 'c', due: '2026-10-04' }, { title: 'd', priority: 'high', done: true }];
  assert.deepEqual(homeImportant(t, now).map((x) => x.title), ['a', 'b']);
});
test('ask: 3 prompts per page and instructions forbid patient identifiers', () => {
  for (const id of ROUTES) assert.equal(ASK_PROMPTS[id].length, 3, id);
  const input = askBuildInput('work', 'hi', 'ctx');
  assert.equal(input[input.length - 1].role, 'user');
  assert.match(JSON.stringify(input), /patient/i);
});
