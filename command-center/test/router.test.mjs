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

function fakeDom() {
  const view = {
    children: [], innerHTML: '', textContent: '',
    appendChild(c) { this.children.push(c); this.textContent = c.textContent; },
  };
  Object.defineProperty(view, 'innerHTML', { get() { return ''; }, set() { view.children = []; view.textContent = ''; } });
  globalThis.document = {
    title: '',
    getElementById: (id) => (id === 'view' ? view : null),
    createElement: () => ({ textContent: '', setAttribute() {} }),
  };
  return view;
}

test('a page whose mount throws or rejects shows "Couldn\'t load this tab"', async () => {
  const { registerPage, navigate } = await import('../src/router.js');
  const warn = console.warn; console.warn = () => {};
  try {
    const view = fakeDom();
    registerPage('work', { title: 'Work', mount() { throw new Error('sync boom'); } });
    navigate('work');
    assert.equal(view.textContent, "Couldn't load this tab");
    registerPage('cards', { title: 'Cards', mount: async () => { throw new Error('async boom'); } });
    navigate('cards');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(view.textContent, "Couldn't load this tab");
    registerPage('health', { title: 'Health', mount(el) { el.textContent = 'ok'; } });
    navigate('health');
    assert.equal(view.textContent, 'ok');
  } finally { console.warn = warn; delete globalThis.document; }
});
