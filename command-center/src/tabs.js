import { ROUTES, getPage, navigate, onRouteChange } from './router.js';

const svg = (d) => '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';

const TAB_DEFS = {
  home: { label: 'Home', accent: 'var(--accent)', icon: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>') },
  work: { label: 'Work', accent: 'var(--work)', icon: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3"/>') },
  cards: { label: 'Cards', accent: 'var(--cards)', icon: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>') },
  health: { label: 'Health', accent: 'var(--health)', icon: svg('<path d="M3 12h4l3-8 4 16 3-8h4"/>') },
  wf: { label: 'Well & Fit', accent: 'var(--wf)', icon: svg('<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>') },
  inbox: { label: 'Inbox', accent: 'var(--inbox)', icon: svg('<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>') },
};

export function renderTabs(nav, active) {
  nav.innerHTML = ROUTES.map((id) => {
    const t = TAB_DEFS[id];
    const page = getPage(id);
    const accent = (page && page.accent) || t.accent;
    const on = id === active;
    return '<button type="button" class="tab" data-route="' + id + '" style="--tab-accent:' + accent + '"' +
      (on ? ' aria-current="page"' : '') + '>' + t.icon + '<span>' + t.label.replace('&', '&amp;') + '</span></button>';
  }).join('');
}

export function initTabs() {
  if (typeof document === 'undefined') return;
  const nav = document.getElementById('tabs');
  if (!nav) return;
  nav.addEventListener('click', (e) => {
    const b = e.target.closest('[data-route]');
    if (b) navigate(b.dataset.route);
  });
  onRouteChange((id) => renderTabs(nav, id));
}
