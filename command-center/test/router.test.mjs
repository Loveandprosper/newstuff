import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, parseRoute } from '../src/router.js';

test('parseRoute maps hashes to routes', () => {
  assert.equal(parseRoute('#cards'), 'cards');
  assert.equal(parseRoute(''), 'home');
  assert.equal(parseRoute('#foo'), 'home');
  assert.equal(parseRoute('#cards/123'), 'cards');
  assert.equal(parseRoute(undefined), 'home');
});

test('ROUTES order', () => {
  assert.deepEqual(ROUTES, ['home', 'work', 'cards', 'health', 'wf', 'inbox']);
});
