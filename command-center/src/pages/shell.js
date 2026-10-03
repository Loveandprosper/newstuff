// Shared helpers for page shells: escaping, section markup, task rows, offline note.
export const OFFLINE_NOTE = 'Offline — showing saved data';

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function shellDate(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate());
}

export function shellSection(id, title, body) {
  return '<section class="pg-sec" data-section="' + esc(id) + '"><h2>' + esc(title) + '</h2>' + body + '</section>';
}

export function shellPlaceholder(text) {
  return '<p class="pg-empty">' + esc(text || 'Coming in a later update.') + '</p>';
}

export function shellOffline() {
  return '<p class="pg-offline" role="status">' + OFFLINE_NOTE + '</p>';
}

export function shellTaskList(tasks, empty) {
  if (!tasks.length) return '<p class="pg-empty">' + esc(empty || 'Nothing here.') + '</p>';
  return '<ul class="pg-list">' + tasks.map((t) => {
    const meta = [t.category, t.due, t.priority === 'high' ? 'high' : ''].filter(Boolean).join(' · ');
    return '<li class="pg-row' + (t.attention ? ' pg-attn' : '') + '"><span>' + esc(t.title || '(untitled)') + '</span>' +
      (meta ? '<span class="pg-meta">' + esc(meta) + '</span>' : '') + '</li>';
  }).join('') + '</ul>';
}

// Loads open tasks. Returns { tasks, offline }.
export async function shellLoadTasks(db) {
  let r;
  try { r = await db.list('tasks'); } catch (e) { r = { offline: true }; }
  if (!Array.isArray(r)) return { tasks: [], offline: true };
  return { tasks: r.filter((t) => t && !t.done && t.kind !== 'note'), offline: false };
}

export function shellHeader(title) {
  return '<h1 class="pg-title">' + esc(title) + '</h1>';
}
