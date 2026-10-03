// Quick add: rule-based classifier plus the "+" dialog (suggested kind as chips, then Save).
import { db } from './db.js';

const QA_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const QA_DAY_RE = /\b(?:next\s+)?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|sday|nesday|rsday|urday)?\b/i;
const QA_TIME_RE = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i;
const QA_WORKOUT_WORDS = /\b(workout|chest day|back day|leg day|arm day|shoulder day|push day|pull day|cardio|gym|squat|deadlift|bench press|hiit|yoga|lift|miles?)\b/i;
const QA_CARD = /\b(credit card|card|amex|visa|mastercard|points|miles bonus|annual fee|cashback|cash back)\b/i;
const QA_EVENT = /\b(meeting|appt|appointment|lunch|dinner|call with|surgery|lap chole|case|clinic|conference|flight|dr\.?)\b/i;
const QA_TASK = /\b(call|email|text|send|buy|order|pay|book|schedule|follow up|remind|renew|fix|finish|submit|review|pick up|drop off|ask|check|update|cancel|file|print|sign)\b/i;
const QA_WORK = /\b(stryker|rep|case|surgery|clinic|hospital|or|op note|chart|dictate|dr\.?|lap chole|meeting|vendor|consult)\b/i;

export const QA_KINDS = ['task', 'event', 'card', 'workout', 'note'];
const QA_COLLECTION = { task: 'tasks', note: 'notes', workout: 'workouts', event: 'tasks', card: 'tasks' };

function qaIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function qaNextWeekday(now, idx) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let delta = (idx - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7; // strictly after today
  d.setDate(d.getDate() + delta);
  return d;
}

export function classify(text, now = new Date()) {
  let rest = String(text == null ? '' : text).trim();
  if (!rest) return { kind: null, title: '' };

  let date = null;
  let time = null;
  const tm = rest.match(QA_TIME_RE);
  if (tm) {
    let h; let m;
    if (tm[3]) {
      h = Number(tm[1]) % 12; m = tm[2] ? Number(tm[2]) : 0;
      if (tm[3].toLowerCase() === 'pm') h += 12;
    } else { h = Number(tm[4]); m = Number(tm[5]); }
    time = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    rest = rest.replace(tm[0], ' ');
  }
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (/\btoday\b/i.test(rest)) { date = base; rest = rest.replace(/\btoday\b/i, ' '); }
  else if (/\btomorrow\b/i.test(rest)) { date = new Date(base); date.setDate(date.getDate() + 1); rest = rest.replace(/\btomorrow\b/i, ' '); }
  else {
    const dm = rest.match(QA_DAY_RE);
    if (dm) { date = qaNextWeekday(now, QA_DAYS.indexOf(dm[1].slice(0, 3).toLowerCase())); rest = rest.replace(dm[0], ' '); }
  }
  const title = rest.replace(/\s+/g, ' ').trim() || String(text).trim();

  let kind;
  if (QA_WORKOUT_WORDS.test(title)) kind = 'workout';
  else if (QA_CARD.test(title) && !/\b(call|case)\b/i.test(title)) kind = 'card';
  else if (time || QA_EVENT.test(title)) kind = 'event';
  else if (QA_TASK.test(title) || date) kind = 'task';
  else kind = 'note';

  const out = { kind, title };
  if (kind === 'task' || kind === 'event') out.category = QA_WORK.test(title) ? 'Work' : 'Personal';
  if (date) out.when = qaIso(date) + (time ? 'T' + time : '');
  else if (time) out.when = time;
  return out;
}

// Split the `when` string into date / time parts for storage.
function qaWhenParts(when) {
  if (!when) return {};
  const [d, t] = when.includes('T') ? when.split('T') : (when.includes(':') ? [null, when] : [when, null]);
  const o = {};
  if (d) o.date = d;
  if (t) o.time = t;
  return o;
}

export async function quickAddSave(c, dbImpl = db) {
  const coll = QA_COLLECTION[c.kind];
  if (!coll) throw new Error('Pick a type before saving');
  const doc = { title: c.title, ...qaWhenParts(c.when) };
  if (c.category) doc.category = c.category;
  if (coll === 'tasks') { doc.kind = c.kind; if (c.kind === 'task') doc.done = false; }
  return dbImpl.put(coll, doc);
}

const QA_LABEL = { task: 'Task', event: 'Event', card: 'Card', workout: 'Workout', note: 'Note' };
const qaEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initQuickAdd() {
  if (typeof document === 'undefined') return;
  const fab = document.getElementById('fab');
  const dlg = document.getElementById('quickadd');
  if (!fab || !dlg) return;
  let state = { kind: null, title: '', category: undefined, when: undefined };
  let kindChosen = false;

  const render = () => {
    dlg.innerHTML =
      '<form method="dialog" class="qa-form">' +
      '<label for="qa-text">Quick add</label>' +
      '<input id="qa-text" type="text" autocomplete="off" placeholder="e.g. call Stryker rep Tue" value="' + qaEsc(state.title) + '">' +
      '<div class="qa-chips" role="group" aria-label="Type">' +
      QA_KINDS.map((k) => '<button type="button" class="qa-chip" data-kind="' + k + '" aria-pressed="' + (state.kind === k) + '">' + QA_LABEL[k] + '</button>').join('') +
      '</div>' +
      '<p class="qa-meta" id="qa-meta"></p>' +
      '<div class="qa-actions"><button type="button" id="qa-cancel">Cancel</button><button type="button" id="qa-save">Save</button></div>' +
      '<p class="qa-status" id="qa-status" role="status"></p></form>';
    meta();
  };
  const meta = () => {
    const el = dlg.querySelector('#qa-meta');
    if (!el) return;
    el.textContent = [state.category, state.when].filter(Boolean).join(' · ');
    const save = dlg.querySelector('#qa-save');
    if (save) save.disabled = !state.kind || !state.title;
  };
  fab.addEventListener('click', () => {
    state = { kind: null, title: '', category: undefined, when: undefined };
    kindChosen = false;
    render();
    dlg.showModal();
    dlg.querySelector('#qa-text').focus();
  });
  dlg.addEventListener('input', (e) => {
    if (e.target.id !== 'qa-text') return;
    const c = classify(e.target.value);
    state = { kind: kindChosen ? state.kind : c.kind, title: c.title, category: c.category, when: c.when };
    dlg.querySelectorAll('.qa-chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === state.kind)));
    meta();
  });
  dlg.addEventListener('click', async (e) => {
    const chip = e.target.closest('.qa-chip');
    if (chip) {
      kindChosen = true;
      state.kind = chip.dataset.kind;
      dlg.querySelectorAll('.qa-chip').forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
      meta();
    } else if (e.target.id === 'qa-cancel') {
      dlg.close();
    } else if (e.target.id === 'qa-save') {
      const status = dlg.querySelector('#qa-status');
      try {
        const r = await quickAddSave(state);
        status.textContent = r && r.queued ? 'Saved offline, will sync' : 'Saved';
        setTimeout(() => dlg.close(), 400);
      } catch (err) { status.textContent = 'Could not save: ' + err.message; }
    }
  });
}
