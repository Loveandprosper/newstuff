// One-time migration of old Command Center data into the new app.
// The new app shares the SAME database as the old one, so tasks are updated in place.
//
// Old collection -> Phase 1 handling
//   tasks        {title, category, done, due 'YYYY-MM-DD'|null, note, order, priority,
//                 repeat?, someday?, changeId?, doneAt?}  -> migrated in place (below)
//   workouts, workoutLogs, articles, caseChanges, repHistory, settings, state
//                -> left untouched in Phase 1 (counted as skipped)
//
// Task category mapping (old lowercase slug -> new label)
//   work -> Work | wellandfit -> Well & Fit | personal -> Personal
//   health -> Health | fitness -> Health
//   already-new labels (Work, Personal, Health, Well & Fit) unchanged
//   unknown or missing -> Personal
//
// Written doc: same id, all other fields kept (original updated_at preserved), plus
// source_id (= original id), migrated:true and legacy_category (= original category value,
// so the old app still reads its slug). Tasks the new app created (new-style label already,
// no legacy slug) are skipped, not flagged.
// Any field (any depth) whose key matches /patient|mrn|dob/i is dropped before writing.
import { db } from './db.js';

const MIG_PHI_KEY = /patient|mrn|dob/i;
const MIG_NEW_LABELS = ['Work', 'Personal', 'Health', 'Well & Fit'];
const MIG_CATEGORIES = {
  work: 'Work', wellandfit: 'Well & Fit', personal: 'Personal', health: 'Health', fitness: 'Health',
  'well & fit': 'Well & Fit',
};

export function migMapCategory(c) {
  if (typeof c !== 'string') return 'Personal';
  return MIG_CATEGORIES[c.trim().toLowerCase()] || 'Personal';
}

function migStrip(v) {
  if (Array.isArray(v)) return v.map(migStrip);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) if (!MIG_PHI_KEY.test(k)) out[k] = migStrip(v[k]);
    return out;
  }
  return v;
}

export async function migrate(oldDocs, dbImpl = db) {
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of oldDocs || []) {
    const doc = item && item.doc;
    if (!item || item.coll !== 'tasks' || !doc || !doc.id || doc.migrated === true || doc.source_id
      || (MIG_NEW_LABELS.includes(doc.category) && doc.legacy_category === undefined)) {
      skipped++;
      continue;
    }
    const next = migStrip(doc);
    next.legacy_category = doc.category === undefined ? null : doc.category;
    next.category = migMapCategory(doc.category);
    next.source_id = doc.id;
    next.migrated = true;
    try {
      await dbImpl.put('tasks', next, { keepUpdatedAt: true });
      created++;
    } catch (e) {
      failed++;
      if (typeof console !== 'undefined') console.warn('Migration: could not update task ' + doc.id, e);
    }
  }
  return { created, skipped, failed };
}

// Runs the migration once per database; safe offline (does nothing if the db is unreachable).
export async function migrateRunOnce(dbImpl = db) {
  try {
    const done = await dbImpl.get('settings', 'migration');
    if (done && done.offline) return null;
    if (done) return { created: 0, skipped: 0, failed: 0, already: true };
    const tasks = await dbImpl.list('tasks');
    if (!Array.isArray(tasks)) return null;
    const result = await migrate(tasks.map((doc) => ({ coll: 'tasks', doc })), dbImpl);
    await dbImpl.put('settings', { id: 'migration', version: 1, at: new Date().toISOString(), failed: result.failed });
    return result;
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('Migration did not run', e);
    return null;
  }
}
