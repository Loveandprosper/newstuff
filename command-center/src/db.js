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

// Segments allowed by the db path grammar (letters, digits, _ - . ~ : @ +).
function dbCheckPath(coll, id) {
  for (const [what, v] of [['collection', coll], ['id', id]]) {
    if (typeof v !== 'string' || !/^[A-Za-z0-9_.~:@+-]{1,200}$/.test(v) || v === '.' || v === '..') {
      throw new TypeError('Invalid ' + what + ' for database path: ' + String(v));
    }
  }
}

// Errors retrying can never fix (bad arguments, full quota). Anything else is transient.
function dbIsPermanent(err) {
  if (err instanceof TypeError) return true;
  const code = err && err.code;
  return code === 'invalid_argument' || code === 'quota_exceeded' || code === 'transform_error';
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

  // Entries and own ids are tracked so a caller can learn its write was dropped.
  let seq = 0;

  const flushNow = async () => {
    const q = readQueue();
    if (!q.length) return { flushed: 0, remaining: 0, dropped: [] };
    const b = await backend();
    if (!b) return { flushed: 0, remaining: q.length, dropped: [] };
    let consumed = 0;
    const dropped = [];
    let flushed = 0;
    for (const e of q) {
      try { await apply(b, e); flushed++; } catch (err) {
        if (!dbIsPermanent(err)) break;
        dropped.push(e.seq); // poison entry: retrying can never succeed
      }
      consumed++;
    }
    // Re-read so entries queued while flushing are kept.
    const rest = readQueue().slice(consumed);
    writeQueue(rest);
    return { flushed, remaining: rest.length, dropped };
  };

  let flushing = null;
  const flush = () => {
    if (flushing) return flushing;
    flushing = flushNow().finally(() => { flushing = null; });
    return flushing;
  };

  // Writes keep their order: if anything is already queued, append and flush.
  const write = async (entry, result) => {
    dbCheckPath(entry.coll, entry.id);
    entry.seq = ++seq + '-' + Date.now();
    if (!readQueue().length) {
      const b = await backend();
      if (b) {
        try { await apply(b, entry); return result; } catch (e) {
          if (dbIsPermanent(e)) throw e;
        }
      }
      enqueue(entry);
    } else {
      enqueue(entry);
      const r = await flush();
      if (r.dropped.includes(entry.seq)) throw new Error('Write rejected by the database');
      if (!readQueue().some((x) => x.seq === entry.seq)) return result;
    }
    return { offline: true, queued: true, ...(entry.doc ? { doc: entry.doc } : {}) };
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
