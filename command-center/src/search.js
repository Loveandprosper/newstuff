// Global search: case-insensitive substring match over `title` fields.
import { db } from './db.js';

export const SEARCH_COLLECTIONS = ['tasks', 'notes', 'workouts'];

export async function search(query, collections = SEARCH_COLLECTIONS, dbImpl = db) {
  const q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return [];
  const results = [];
  for (const coll of collections) {
    let rows;
    try { rows = await dbImpl.list(coll); } catch (e) { continue; }
    if (!Array.isArray(rows)) continue; // offline marker
    for (const r of rows) {
      if (r && typeof r.title === 'string' && r.title.toLowerCase().includes(q)) {
        results.push({ coll, id: r.id, title: r.title });
      }
    }
  }
  return results;
}

const srchEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initSearch() {
  if (typeof document === 'undefined') return;
  const input = document.getElementById('search');
  if (!input) return;
  const box = document.createElement('div');
  box.id = 'search-results';
  box.setAttribute('role', 'listbox');
  box.hidden = true;
  input.insertAdjacentElement('afterend', box);
  let seq = 0;
  input.addEventListener('input', async () => {
    const my = ++seq;
    const found = await search(input.value);
    if (my !== seq) return;
    box.hidden = !input.value.trim();
    box.innerHTML = found.length
      ? found.map((r) => '<div class="search-hit" role="option"><span class="search-coll">' + srchEsc(r.coll) + '</span> ' + srchEsc(r.title) + '</div>').join('')
      : '<div class="search-hit">No matches</div>';
  });
}
