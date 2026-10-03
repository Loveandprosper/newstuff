// Data layer over the artifact `db` capability, with an offline write queue
// (localStorage key "cc.queue") and a guard that refuses patient identifiers.
const DB_QUEUE_KEY = 'cc.queue';
const DB_PHI_KEY = /patient|mrn|dob/i;

function dbDefaultStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
}

function dbAssertNoPhi(value, path = '') {
  if (Array.isArray(value)) {
    value.forEach((v, i) => dbAssertNoPhi(v, path + '[' + i + ']'));
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value)) {
      if (DB_PHI_KEY.test(k)) throw new Error('Refusing to store field "' + path + k + '": patient identifiers are not allowed');
      dbAssertNoPhi(value[k], path + k + '.');
    }
  }
}

function dbNewId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createDb(backendPromise, opts = {}) {
  const storage = opts.storage !== undefined ? opts.storage : dbDefaultStorage();
  const now = opts.now || (() => new Date().toISOString());
  const newId = opts.newId || dbNewId;

  const readQueue = () => {
    try {
      const q = JSON.parse(storage.getItem(DB_QUEUE_KEY) || '[]');
      return Array.isArray(q) ? q : [];
    } catch (e) { return []; }
  };
  const writeQueue = (q) => {
    try { storage.setItem(DB_QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* storage unavailable */ }
  };
  const enqueue = (entry) => writeQueue(readQueue().concat(entry));

  // Resolves the backend, or null if unavailable.
  const backend = async () => {
    try { return (await backendPromise) || null; } catch (e) { return null; }
  };

  const apply = async (b, e) => {
    const ref = b.doc(e.coll + '/' + e.id);
    if (e.op === 'remove') await ref.delete();
    else await ref.set(e.doc);
  };

  // Try a write now; on any failure queue it and report offline.
  const write = async (entry, result) => {
    const b = await backend();
    if (b) {
      try { await apply(b, entry); return result; } catch (e) { /* fall through to queue */ }
    }
    enqueue(entry);
    return { offline: true, queued: true, ...(entry.doc ? { doc: entry.doc } : {}) };
  };

  let flushing = null;
  const flush = () => {
    if (flushing) return flushing;
    flushing = (async () => {
      const q = readQueue();
      if (!q.length) return { flushed: 0, remaining: 0 };
      const b = await backend();
      if (!b) return { flushed: 0, remaining: q.length };
      let done = 0;
      for (const e of q) {
        try { await apply(b, e); done++; } catch (err) { break; }
      }
      // Re-read so entries queued while flushing are kept.
      const rest = readQueue().slice(done);
      writeQueue(rest);
      return { flushed: done, remaining: rest.length };
    })().finally(() => { flushing = null; });
    return flushing;
  };

  const snap = (s) => ({ ...s.data(), id: s.id });

  return {
    async list(coll) {
      const b = await backend();
      if (!b) return { offline: true };
      try { return (await b.collection(coll).get()).docs.map(snap); } catch (e) { return { offline: true }; }
    },
    async get(coll, id) {
      const b = await backend();
      if (!b) return { offline: true };
      try {
        const s = await b.doc(coll + '/' + id).get();
        return s.exists ? snap(s) : null;
      } catch (e) { return { offline: true }; }
    },
    async put(coll, doc) {
      dbAssertNoPhi(doc);
      const full = { ...doc, id: doc.id || newId(), updated_at: now() };
      return write({ op: 'put', coll, id: full.id, doc: full }, full);
    },
    async remove(coll, id) {
      return write({ op: 'remove', coll, id }, { id });
    },
    flush,
  };
}

async function dbRealBackend() {
  if (typeof claude === 'undefined' || !claude || typeof claude.use !== 'function') return null;
  return claude.use('db');
}

let dbLazy = null;
const dbLazyPromise = { then: (a, b) => (dbLazy || (dbLazy = dbRealBackend())).then(a, b) };

export const db = createDb(dbLazyPromise);
