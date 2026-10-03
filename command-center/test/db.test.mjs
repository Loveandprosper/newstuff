import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/db.js';

function fakeBackend() {
  const store = new Map();
  const state = { fail: false };
  const guard = () => { if (state.fail) return Promise.reject({ code: 'unavailable', message: 'down' }); };
  const chk = (path) => { if (/bad id/.test(path)) throw new TypeError('bad path'); if (state.rejectId && path.endsWith('/' + state.rejectId)) return Promise.reject({ code: 'invalid_argument', message: 'no' }); };
  const chk0 = (path) => { if (/bad id/.test(path)) throw new TypeError('bad path'); };
  const docRef = (path) => { chk0(path); return {
    get: async () => { await guard(); const d = store.get(path); return { id: path.split('/').pop(), exists: d !== undefined, data: () => d }; },
    set: async (data) => { await guard(); await chk(path); store.set(path, structuredClone(data)); },
    delete: async () => { await guard(); await chk(path); store.delete(path); },
  }; };
  const collection = (name) => ({
    get: async () => {
      await guard();
      const docs = [...store].filter(([p]) => p.startsWith(name + '/') && p.split('/').length === 2)
        .map(([p, d]) => ({ id: p.split('/')[1], exists: true, data: () => d }));
      return { docs, size: docs.length, empty: !docs.length };
    },
  });
  return { store, state, backend: { doc: docRef, collection } };
}
function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
function setup() {
  const f = fakeBackend();
  const storage = memStorage();
  const db = createDb(Promise.resolve(f.backend), { storage });
  return { ...f, storage, db };
}

test('put then list returns doc with id and updated_at', async () => {
  const { db } = setup();
  const saved = await db.put('tasks', { title: 'a' });
  assert.ok(saved.id);
  assert.ok(saved.updated_at);
  const list = await db.list('tasks');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, saved.id);
  assert.equal(list[0].title, 'a');
  assert.deepEqual(await db.get('tasks', saved.id), list[0]);
});

test('put keeps a supplied id; remove deletes', async () => {
  const { db } = setup();
  await db.put('tasks', { id: 't1', title: 'x' });
  assert.equal((await db.get('tasks', 't1')).title, 'x');
  await db.remove('tasks', 't1');
  assert.equal(await db.get('tasks', 't1'), null);
});

test('failing backend queues put; flush replays once recovered', async () => {
  const { db, state, storage } = setup();
  state.fail = true;
  const r = await db.put('tasks', { id: 't1', title: 'offline' });
  assert.equal(r.offline, true);
  assert.equal(JSON.parse(storage.getItem('cc.queue')).length, 1);
  assert.deepEqual(await db.list('tasks'), { offline: true });
  assert.equal((await db.flush()).remaining, 1);
  state.fail = false;
  const res = await db.flush();
  assert.equal(res.flushed, 1);
  assert.equal(JSON.parse(storage.getItem('cc.queue')).length, 0);
  assert.equal((await db.get('tasks', 't1')).title, 'offline');
  assert.equal((await db.flush()).flushed, 0);
});

test('null backend is offline and queues remove too', async () => {
  const storage = memStorage();
  const db = createDb(Promise.resolve(null), { storage });
  assert.deepEqual(await db.get('tasks', 'a'), { offline: true });
  assert.equal((await db.remove('tasks', 'a')).offline, true);
  assert.equal(JSON.parse(storage.getItem('cc.queue'))[0].op, 'remove');
});

test('put rejects PHI-like keys at any depth, nothing queued or written', async () => {
  const { db, store, storage } = setup();
  await assert.rejects(db.put('notes', { patientName: 'x' }));
  await assert.rejects(db.put('notes', { a: { b: [{ MRN: '1' }] } }));
  await assert.rejects(db.put('notes', { DOB: '1' }));
  assert.equal(store.size, 0);
  assert.equal(storage.getItem('cc.queue'), null);
});

test('works without storage (throwing localStorage)', async () => {
  const bad = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const db = createDb(Promise.resolve(null), { storage: bad });
  assert.equal((await db.put('tasks', { title: 'z' })).offline, true);
});

test('bad id or collection is rejected and not queued', async () => {
  const { db, storage } = setup();
  await assert.rejects(db.put('tasks', { id: 'bad id' }), TypeError);
  await assert.rejects(db.remove('tasks', 'a/b'), TypeError);
  await assert.rejects(db.put('ta sks', { id: 'x' }), TypeError);
  assert.equal(storage.getItem('cc.queue'), null);
});

test('non-transient backend error rejects the write instead of queueing', async () => {
  const { db, state, storage } = setup();
  state.rejectId = 'p1';
  await assert.rejects(db.put('tasks', { id: 'p1' }), (e) => e.code === 'invalid_argument');
  assert.equal(storage.getItem('cc.queue'), null);
});

test('flush drops a poison entry and still applies later ones', async () => {
  const { db, state, storage } = setup();
  state.fail = true;
  await db.put('tasks', { id: 'p1', title: 'poison' });
  await db.put('tasks', { id: 'ok', title: 'fine' });
  state.fail = false;
  state.rejectId = 'p1';
  const r = await db.flush();
  assert.equal(r.flushed, 1);
  assert.equal(r.remaining, 0);
  assert.equal(JSON.parse(storage.getItem('cc.queue')).length, 0);
  assert.equal((await db.get('tasks', 'ok')).title, 'fine');
  assert.equal(await db.get('tasks', 'p1'), null);
});

test('newer put is not overwritten by an older queued put', async () => {
  const { db, state } = setup();
  state.fail = true;
  await db.put('tasks', { id: 't1', title: 'old' });
  state.fail = false;
  const r = await db.put('tasks', { id: 't1', title: 'new' });
  assert.notEqual(r.offline, true);
  assert.equal((await db.get('tasks', 't1')).title, 'new');
  assert.equal((await db.flush()).flushed, 0);
  assert.equal((await db.get('tasks', 't1')).title, 'new');
});

test('write behind a queue stays queued while backend is down', async () => {
  const { db, state, storage } = setup();
  state.fail = true;
  await db.put('tasks', { id: 'a', title: '1' });
  const r = await db.put('tasks', { id: 'b', title: '2' });
  assert.equal(r.offline, true);
  assert.equal(JSON.parse(storage.getItem('cc.queue')).length, 2);
});

test('flush stops at first transient failure and keeps the rest', async () => {
  const { db, state, storage, store } = setup();
  state.fail = true;
  await db.put('tasks', { id: 'a', title: '1' });
  await db.put('tasks', { id: 'b', title: '2' });
  await db.put('tasks', { id: 'c', title: '3' });
  state.fail = false;
  let n = 0;
  const origSet = store.set.bind(store);
  store.set = (k, v) => { if (++n === 2) { state.fail = true; } return origSet(k, v); };
  const r = await db.flush();
  assert.equal(r.flushed, 2);
  assert.equal(r.remaining, 1);
  assert.deepEqual(JSON.parse(storage.getItem('cc.queue')).map((e) => e.id), ['c']);
});

test('a generic TypeError from the backend (e.g. fetch network failure) is queued, not dropped', async () => {
  const storage = memStorage();
  let down = true;
  const store = new Map();
  const backend = { doc: (path) => ({
    set: async (d) => { if (down) throw new TypeError('Failed to fetch'); store.set(path, d); },
    delete: async () => {},
    get: async () => ({ exists: store.has(path), id: path.split('/').pop(), data: () => store.get(path) }),
  }) };
  const db = createDb(Promise.resolve(backend), { storage });
  const r = await db.put('tasks', { id: 'n1', title: 'x' });
  assert.equal(r.queued, true);
  assert.equal(JSON.parse(storage.getItem('cc.queue')).length, 1);
  down = false;
  const f = await db.flush();
  assert.equal(f.flushed, 1);
  assert.equal(store.get('tasks/n1').title, 'x');
});

test('put keeps a supplied updated_at only with keepUpdatedAt', async () => {
  const { db } = setup();
  const a = await db.put('tasks', { id: 'a', updated_at: '2020-01-01T00:00:00.000Z' });
  assert.notEqual(a.updated_at, '2020-01-01T00:00:00.000Z');
  const b = await db.put('tasks', { id: 'b', updated_at: '2020-01-01T00:00:00.000Z' }, { keepUpdatedAt: true });
  assert.equal(b.updated_at, '2020-01-01T00:00:00.000Z');
});
