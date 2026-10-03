// Well & Fit: site stats, fix this first, drafts, W&F tasks, growth, repurpose.
import { registerPage } from '../router.js';
import { db } from '../db.js';
import { taskNeedsAttention, badgeCount } from '../badges.js';
import { shellSection, shellPlaceholder, shellOffline, shellTaskList, shellLoadTasks, shellHeader } from './shell.js';

const wfOnly = (tasks) => (tasks || []).filter((t) => t && t.category === 'Well & Fit');

export async function mountWf(el, deps = {}) {
  const d = { db, now: new Date(), ...deps };
  const head = shellHeader('Well & Fit') + shellSection('stats', 'Site stats', shellPlaceholder()) +
    shellSection('fix', 'Fix this first', shellPlaceholder()) + shellSection('drafts', 'Drafts', shellPlaceholder());
  const tail = shellSection('growth', 'Growth recommendations', shellPlaceholder()) + shellSection('repurpose', 'Repurpose', shellPlaceholder());
  el.innerHTML = head + shellSection('tasks', 'Well & Fit tasks', shellPlaceholder('Loading…')) + tail;
  const { tasks, offline } = await shellLoadTasks(d.db);
  const list = wfOnly(tasks).map((t) => ({ ...t, attention: taskNeedsAttention(t, d.now) }));
  el.innerHTML = head + shellSection('tasks', 'Well & Fit tasks', (offline ? shellOffline() : '') + shellTaskList(list, 'No open Well & Fit tasks.')) + tail;
}

registerPage('wf', { title: 'Well & Fit', accent: 'var(--wf)', mount: (el) => mountWf(el), badge: (tasks) => badgeCount(wfOnly(tasks)) });
