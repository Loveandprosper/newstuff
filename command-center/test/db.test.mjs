import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/db.js';

function fakeBackend() {
  const store = new Map();
  const state = { fail: false };
  const guard = () => { if (state.fail) return Promise.reject({ code: 'unavailable', message: 'down' }); };
  const docRef = (path) => ({
    get: async () => { await guard(); const d = store.get(path); return { id: path.split('/').pop(), exists: d !== undefined, data: () => d }; },
    set: async (data) => { await guard(); store.set(path, structuredClone(data)); },
    delete: async () => { await guard(); store.delete(path); },
  });
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
