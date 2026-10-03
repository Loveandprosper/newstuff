// Inbox: email accounts (later) and tasks grouped by category.
import { registerPage } from '../router.js';
import { db } from '../db.js';
import { taskNeedsAttention, badgeCount } from '../badges.js';
import { shellSection, shellPlaceholder, shellOffline, shellTaskList, shellLoadTasks, shellHeader } from './shell.js';

export const INBOX_CATEGORIES = ['Work', 'Personal', 'Health', 'Well & Fit'];

export function inboxGroup(tasks) {
  const g = {};
  for (const c of INBOX_CATEGORIES) g[c] = [];
  for (const t of tasks || []) {
    if (!t || t.done) continue;
    g[INBOX_CATEGORIES.includes(t.category) ? t.category : 'Personal'].push(t);
  }
  return g;
}

export async function mountInbox(el, deps = {}) {
  const d = { db, now: new Date(), ...deps };
  el.innerHTML = shellHeader('Inbox') + shellPlaceholder('Loading…');
  const { tasks, offline } = await shellLoadTasks(d.db);
  const g = inboxGroup(tasks.map((t) => ({ ...t, attention: taskNeedsAttention(t, d.now) })));
  el.innerHTML = shellHeader('Inbox') + (offline ? shellOffline() : '') +
    shellSection('email', 'Email', shellPlaceholder('Email accounts arrive in a later update.')) +
    INBOX_CATEGORIES.map((c) => shellSection('tasks-' + c.replace(/\W+/g, '').toLowerCase(), c + ' tasks', shellTaskList(g[c], 'No open ' + c + ' tasks.'))).join('');
}

registerPage('inbox', { title: 'Inbox', accent: 'var(--inbox)', mount: (el) => mountInbox(el), badge: (tasks) => badgeCount(tasks) });
