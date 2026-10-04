// Theme: dark default, light toggle. Saved in settings/theme and mirrored to localStorage.
import { db } from './db.js';

export async function setTheme(value) {
  const v = value === 'light' ? 'light' : 'dark';
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = v;
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = v === 'light' ? '☀' : '☾';
      btn.setAttribute('aria-label', v === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    }
  }
  try { localStorage.setItem('cc.theme', v); } catch (e) { /* storage blocked */ }
  try { await db.put('settings', { id: 'theme', value: v }); } catch (e) { /* offline queue handles it */ }
  return v;
}

export async function initTheme() {
  if (typeof document === 'undefined') return;
  let cached = null;
  try { cached = localStorage.getItem('cc.theme'); } catch (e) { /* ignore */ }
  document.documentElement.dataset.theme = cached === 'light' ? 'light' : 'dark';
  const btn = document.getElementById('theme-toggle');
  const paint = () => {
    const v = document.documentElement.dataset.theme;
    if (btn) {
      btn.textContent = v === 'light' ? '☀' : '☾';
      btn.setAttribute('aria-label', v === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    }
  };
  paint();
  if (btn) btn.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
  try {
    const doc = await db.get('settings', 'theme');
    if (doc && !doc.offline && (doc.value === 'light' || doc.value === 'dark')) {
      document.documentElement.dataset.theme = doc.value;
      try { localStorage.setItem('cc.theme', doc.value); } catch (e) { /* ignore */ }
      paint();
    }
  } catch (e) { /* keep cached */ }
}
