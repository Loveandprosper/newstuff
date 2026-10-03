// Work: OR cases, 8 pm prep, work tasks, vendors, staff.
import { registerPage } from '../router.js';
import { db } from '../db.js';
import { taskNeedsAttention, badgeCount } from '../badges.js';
import { shellSection, shellPlaceholder, shellOffline, shellTaskList, shellLoadTasks, shellHeader } from './shell.js';

const workOnly = (tasks) => (tasks || []).filter((t) => t && t.category === 'Work');

export async function mountWork(el, deps = {}) {
  const d = { db, now: new Date(), ...deps };
  const head = shellHeader('Work') + shellSection('cases', 'OR cases', shellPlaceholder()) + shellSection('prep', '8 pm prep', shellPlaceholder());
  const tail = shellSection('vendors', 'Vendor list', shellPlaceholder()) + shellSection('staff', 'Staff list', shellPlaceholder());
  el.innerHTML = head + shellSection('tasks', 'Work tasks', shellPlaceholder('Loading…')) + tail;
  const { tasks, offline } = await shellLoadTasks(d.db);
  const list = workOnly(tasks).map((t) => ({ ...t, attention: taskNeedsAttention(t, d.now) }));
  el.innerHTML = head + shellSection('tasks', 'Work tasks', (offline ? shellOffline() : '') + shellTaskList(list, 'No open work tasks.')) + tail;
}

registerPage('work', { title: 'Work', accent: 'var(--work)', mount: (el) => mountWork(el), badge: (tasks) => badgeCount(workOnly(tasks)) });
