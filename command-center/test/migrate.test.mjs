import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, migrateRunOnce } from '../src/migrate.js';

function fakeDb(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async put(coll, doc, opts) { if (seed.__fail && seed.__fail.includes(doc.id)) throw new Error('boom'); this.lastOpts = opts; store.set(coll + '/' + doc.id, structuredClone(doc)); return doc; },
    async get(coll, id) { return store.get(coll + '/' + id) || null; },
    async list(coll) { return [...store].filter(([k]) => k.startsWith(coll + '/')).map(([, v]) => v); },
  };
}
const old = (over = {}) => ({ coll: 'tasks', doc: { id: 't1', title: 'Call', category: 'wellandfit', done: false, due: null, order: 1, priority: 'high', ...over } });

test('maps category, keeps id and fields, sets source_id and migrated', async () => {
  const db = fakeDb();
  const r = await migrate([old()], db);
  assert.deepEqual(r, { created: 1, skipped: 0, failed: 0 });
  const t = db.store.get('tasks/t1');
  assert.equal(t.category, 'Well & Fit');
  assert.equal(t.id, 't1');
  assert.equal(t.source_id, 't1');
  assert.equal(t.migrated, true);
  assert.equal(t.title, 'Call');
  assert.equal(t.priority, 'high');
});

test('category mapping table', async () => {
  const db = fakeDb();
  const cats = { work: 'Work', personal: 'Personal', health: 'Health', fitness: 'Health', weird: 'Personal' };
  let i = 0;
  const docs = Object.keys(cats).map((c) => old({ id: 'c' + i++, category: c }));
  docs.push(old({ id: 'none', category: undefined }));
  await migrate(docs, db);
  Object.values(cats).forEach((v, n) => assert.equal(db.store.get('tasks/c' + n).category, v));
  assert.equal(db.store.get('tasks/none').category, 'Personal');
});

test('second run creates nothing', async () => {
  const db = fakeDb();
  await migrate([old()], db);
  const again = await migrate((await db.list('tasks')).map((doc) => ({ coll: 'tasks', doc })), db);
  assert.equal(again.created, 0);
  assert.equal(again.skipped, 1);
});

test('PHI-keyed fields are dropped at any depth', async () => {
  const db = fakeDb();
  await migrate([old({ patientName: 'x', MRN: '1', extra: { dob: 'y', keep: 1 }, list: [{ patient_id: 'z', ok: 2 }] })], db);
  const t = db.store.get('tasks/t1');
  assert.deepEqual(Object.keys(t).filter((k) => /patient|mrn|dob/i.test(k)), []);
  assert.deepEqual(t.extra, { keep: 1 });
  assert.deepEqual(t.list, [{ ok: 2 }]);
});

test('non-task collections are skipped', async () => {
  const db = fakeDb();
  const r = await migrate([{ coll: 'workouts', doc: { id: 'w1' } }, old()], db);
  assert.deepEqual(r, { created: 1, skipped: 1, failed: 0 });
  assert.equal(db.store.has('workouts/w1'), false);
});

test('migrateRunOnce runs once and records settings/migration', async () => {
  const db = fakeDb({ 'tasks/t1': old().doc });
  const r1 = await migrateRunOnce(db);
  assert.equal(r1.created, 1);
  assert.equal(db.store.get('settings/migration').version, 1);
  const r2 = await migrateRunOnce(db);
  assert.equal(r2.created, 0);
});

test('migrateRunOnce does nothing when offline', async () => {
  const db = { get: async () => ({ offline: true }), list: async () => ({ offline: true }), put: async () => assert.fail('no write') };
  assert.equal(await migrateRunOnce(db), null);
});

test('keeps original category as legacy_category and preserves updated_at', async () => {
  const db = fakeDb();
  await migrate([old({ updated_at: '2025-01-01T00:00:00.000Z' })], db);
  const t = db.store.get('tasks/t1');
  assert.equal(t.legacy_category, 'wellandfit');
  assert.equal(t.updated_at, '2025-01-01T00:00:00.000Z');
  assert.deepEqual(db.lastOpts, { keepUpdatedAt: true });
});

test('tasks created by the new app (new label, no legacy slug) are skipped, not flagged', async () => {
  const db = fakeDb();
  const r = await migrate([old({ id: 'n1', category: 'Health' })], db);
  assert.deepEqual(r, { created: 0, skipped: 1, failed: 0 });
  assert.equal(db.store.has('tasks/n1'), false);
});

test('failed puts are counted and the marker is still written with failed count', async () => {
  const warn = console.warn; console.warn = () => {};
  try {
    const db = fakeDb({ 'tasks/t1': old().doc, 'tasks/t2': old({ id: 't2' }).doc, __fail: ['t1'] });
    db.store.delete('__fail');
    const r = await migrateRunOnce(db);
    assert.equal(r.created, 1);
    assert.equal(r.failed, 1);
    const m = db.store.get('settings/migration');
    assert.equal(m.version, 1);
    assert.equal(m.failed, 1);
    assert.ok(m.at);
  } finally { console.warn = warn; }
});
