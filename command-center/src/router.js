// Hash router. Pure parsing is testable in node; DOM work is guarded.
export const ROUTES = ['home', 'work', 'cards', 'health', 'wf', 'inbox'];

const pages = {};
let current = null;
let onChange = [];

export function parseRoute(hash) {
  const id = String(hash || '').replace(/^#/, '').split('/')[0];
  return ROUTES.includes(id) ? id : 'home';
}

export function registerPage(id, page) {
  pages[id] = page;
}

export function getPage(id) {
  return pages[id];
}

export function currentRoute() {
  return current;
}

export function onRouteChange(fn) {
  onChange.push(fn);
}

export function navigate(id) {
  const target = ROUTES.includes(id) ? id : 'home';
  if (typeof window === 'undefined') return render(target);
  if (parseRoute(window.location.hash) === target && window.location.hash.replace(/^#/, '').split('/')[0] === target) return render(target);
  window.location.hash = '#' + target; // hashchange triggers render
}

function render(id) {
  current = id;
  if (typeof document !== 'undefined') {
    const el = document.getElementById('view');
    const page = pages[id];
    if (el) {
      el.innerHTML = '';
      if (page) page.mount(el);
      else el.textContent = 'Coming soon';
      document.title = (page ? page.title : id) + ' · Command Center';
    }
  }
  onChange.forEach((fn) => fn(id));
}

export function startRouter() {
  if (typeof window === 'undefined') return;
  const go = () => render(parseRoute(window.location.hash));
  window.addEventListener('hashchange', go);
  go();
}
