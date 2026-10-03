// Shift mode: "work" (workday) or "off" (day off). Detected from today's calendar events,
// with a manual override that only applies on the day it was set.
import { db } from './db.js';

export const SHIFT_PATTERN = /\bOR\b|case|shift/i;

function shiftLocalDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function shiftToday(now = new Date()) { return shiftLocalDate(now); }

// override: 'work' | 'off' | null (already resolved for today by the caller)
export function detectShift(events, override, now = new Date()) {
  if (override === 'work' || override === 'off') return override;
  if (!Array.isArray(events)) return 'off';
  const today = shiftLocalDate(now);
  for (const ev of events) {
    try {
      if (!ev || typeof ev.title !== 'string' || !SHIFT_PATTERN.test(ev.title)) continue;
      const d = ev.start instanceof Date ? ev.start : new Date(ev.start);
      if (isNaN(d.getTime())) continue;
      if (shiftLocalDate(d) === today) return 'work';
    } catch (e) { /* malformed event: skip */ }
  }
  return 'off';
}

export function applyShift(mode) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.dataset.shift = mode;
  const btn = document.getElementById('shift-toggle');
  if (btn) {
    btn.textContent = mode === 'work' ? '⚡ Workday' : '⚡ Day off';
    btn.setAttribute('aria-pressed', mode === 'work' ? 'true' : 'false');
  }
}

let shiftEvents = null;
let shiftOverride = null;

async function shiftLoadOverride(now = new Date()) {
  try {
    const doc = await db.get('settings', 'shift');
    if (doc && !doc.offline && (doc.mode === 'work' || doc.mode === 'off') && doc.date === shiftLocalDate(now)) {
      return doc.mode;
    }
  } catch (e) { /* ignore */ }
  return null;
}

// Call with the latest calendar events whenever they load.
export function refreshShift(events) {
  shiftEvents = events === undefined ? null : events;
  const mode = detectShift(shiftEvents, shiftOverride);
  applyShift(mode);
  return mode;
}

export async function initShift() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('shift-toggle');
  refreshShift(null);
  if (btn) {
    btn.addEventListener('click', async () => {
      const next = document.body.dataset.shift === 'work' ? 'off' : 'work';
      shiftOverride = next;
      applyShift(next);
      try { await db.put('settings', { id: 'shift', mode: next, date: shiftToday() }); } catch (e) { /* offline queue handles it */ }
    });
  }
  shiftOverride = await shiftLoadOverride();
  refreshShift(shiftEvents);
}
