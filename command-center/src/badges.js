// Tab badges: a red count on each tab for items needing attention, hidden at 0.
import { ROUTES, getPage, onRouteChange } from './router.js';
import { db } from './db.js';
import { shellDate } from './pages/shell.js';

export function badgeCount(items) {
  if (!Array.isArray(items)) return 0;
  return items.filter((i) => i && i.attention === true).length;
}

// Open task that is high priority, or due today / overdue.
export function taskNeedsAttention(t, now = new Date()) {
  if (!t || t.done) return false;
  if (t.priority === 'high') return true;
  return typeof t.due === 'string' && t.due.slice(0, 10) <= shellDate(now) && /^\d{4}-\d{2}-\d{2}/.test(t.due);
}

export function badgeMark(tasks, now = new Date()) {
  return (Array.isArray(tasks) ? tasks : []).map((t) => ({ ...t, attention: taskNeedsAttention(t, now) }));
}

let badgeLast = {};

function badgePaint() {
  if (typeof document === 'undefined') return;
  for (const id of ROUTES) {
    const btn = document.querySelector('#tabs [data-route="' + id + '"]');
    if (!btn) continue;
    let dot = btn.querySelector('.badge');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'badge num';
      btn.appendChild(dot);
    }
    const n = badgeLast[id] || 0;
    dot.textContent = n > 99 ? '99+' : String(n);
    dot.hidden = n === 0;
    dot.setAttribute('aria-label', n + ' need attention');
  }
}

export async function refreshBadges() {
  badgePaint(); // tabs re-render on navigation: repaint last counts right away
  let tasks;
  try { tasks = await db.list('tasks'); } catch (e) { tasks = null; }
  if (!Array.isArray(tasks)) return; // offline: keep last counts
  const marked = badgeMark(tasks);
  const next = {};
  for (const id of ROUTES) {
    const page = getPage(id);
    let n = 0;
    try { n = page && typeof page.badge === 'function' ? Number(await page.badge(marked)) || 0 : 0; } catch (e) { n = 0; }
    next[id] = n;
  }
  badgeLast = next;
  badgePaint();
}

export function initBadges() {
  if (typeof document === 'undefined') return;
  onRouteChange(() => { refreshBadges(); });
  refreshBadges();
}
