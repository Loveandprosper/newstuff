import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, quickAddSave } from '../src/quickadd.js';

const WED = new Date(2026, 9, 7); // Wed 2026-10-07; next Tuesday = 2026-10-13
const TUE = new Date(2026, 9, 6); // a Tuesday: "Tue" means the following week

test('blank text has no kind', () => {
  assert.equal(classify('  ').kind, null);
});
test('task with weekday', () => {
  const c = classify('call Stryker rep Tue', WED);
  assert.equal(c.kind, 'task');
  assert.equal(c.category, 'Work');
  assert.equal(c.when, '2026-10-13');
  assert.equal(c.title, 'call Stryker rep');
});
test('"Tue" on a Tuesday is strictly after today', () => {
  assert.equal(classify('call Stryker rep Tue', TUE).when, '2026-10-13');
  assert.equal(classify('call mom next Tuesday', TUE).when, '2026-10-13');
});
test('workout', () => assert.equal(classify('chest day', WED).kind, 'workout'));
test('event with time', () => {
  const c = classify('Lap chole Dr. X 7am', WED);
  assert.equal(c.kind, 'event');
  assert.equal(c.when, '07:00');
});
test('event with date and pm time', () => {
  assert.equal(classify('dinner tomorrow 6:30pm', WED).when, '2026-10-08T18:30');
});
test('card and note', () => {
  assert.equal(classify('Amex annual fee', WED).kind, 'card');
  assert.equal(classify('idea about the garden', WED).kind, 'note');
});
test('save routes kinds to collections', async () => {
  const calls = [];
  const fake = { put: async (c, d) => { calls.push([c, d]); return { id: 'x' }; } };
  await quickAddSave({ kind: 'task', title: 'a', when: '2026-10-13', category: 'Work' }, fake);
  await quickAddSave({ kind: 'event', title: 'b', when: '07:00' }, fake);
  await quickAddSave({ kind: 'note', title: 'c' }, fake);
  await quickAddSave({ kind: 'workout', title: 'd' }, fake);
  assert.deepEqual(calls.map((c) => c[0]), ['tasks', 'tasks', 'notes', 'workouts']);
  assert.equal(calls[0][1].date, '2026-10-13');
  assert.equal(calls[1][1].kind, 'event');
  assert.equal(calls[1][1].time, '07:00');
  await assert.rejects(quickAddSave({ kind: null, title: 'z' }, fake));
});
