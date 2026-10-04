import test from 'node:test';
import assert from 'node:assert/strict';
import { detectShift } from '../src/shift.js';

const now = new Date(2026, 9, 3, 12, 0, 0);
const today = (h) => new Date(2026, 9, 3, h, 0, 0).toISOString();
const other = new Date(2026, 9, 4, 8, 0, 0).toISOString();

test('override wins both ways', () => {
  assert.equal(detectShift([{ title: 'OR day', start: today(7) }], 'off', now), 'off');
  assert.equal(detectShift(null, 'work', now), 'work');
});
test('matching event today -> work', () => {
  for (const t of ['OR 4', 'Cases', 'night shift', 'or']) {
    assert.equal(detectShift([{ title: t, start: today(7) }], null, now), 'work', t);
  }
});
test('Date start objects work', () => {
  assert.equal(detectShift([{ title: 'OR', start: new Date(2026, 9, 3, 7) }], null, now), 'work');
});
test('non-matching or other-day events -> off', () => {
  assert.equal(detectShift([{ title: 'Lunch', start: today(12) }], null, now), 'off');
  assert.equal(detectShift([{ title: 'OR', start: other }], null, now), 'off');
  assert.equal(detectShift([{ title: 'ORANGE', start: today(9) }], null, now), 'off');
});
test('null events and no override -> off', () => {
  assert.equal(detectShift(null, null, now), 'off');
});
test('malformed events do not throw', () => {
  const bad = [null, undefined, 5, {}, { title: 7 }, { title: 'OR' }, { title: 'OR', start: 'garbage' }, { title: 'OR', start: {} }];
  assert.equal(detectShift(bad, null, now), 'off');
  assert.equal(detectShift('nope', null, now), 'off');
  assert.equal(detectShift([...bad, { title: 'shift', start: today(6) }], null, now), 'work');
});
