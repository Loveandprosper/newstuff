import test from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../src/search.js';

const data = {
  tasks: [{ id: 't1', title: 'call Stryker rep' }, { id: 't2', title: 'buy milk' }],
  notes: [{ id: 'n1', title: 'STRYKER pricing' }],
  workouts: { offline: true },
};
const fake = { list: async (c) => data[c] };

test('finds substring case-insensitively across collections', async () => {
  const r = await search('stry', ['tasks', 'notes', 'workouts'], fake);
  assert.deepEqual(r, [{ coll: 'tasks', id: 't1', title: 'call Stryker rep' }, { coll: 'notes', id: 'n1', title: 'STRYKER pricing' }]);
});
test('empty query and no match give []', async () => {
  assert.deepEqual(await search('  ', ['tasks'], fake), []);
  assert.deepEqual(await search('zzz', ['tasks'], fake), []);
});
