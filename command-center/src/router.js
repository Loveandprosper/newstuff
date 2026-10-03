// Hash router. Pure parsing is testable in node; DOM work is guarded.
export const ROUTES = ['home', 'work', 'cards', 'health', 'wf', 'inbox'];

const pages = {};
let current = null;
let routerCtrl = null; // aborts the previous page's in-flight mount
let routerMounted = null;
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
      if (routerCtrl) routerCtrl.abort();
      const prev = routerMounted && pages[routerMounted];
      if (prev && typeof prev.unmount === 'function') { try { prev.unmount(); } catch (e) { /* ignore */ } }
      routerCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      routerMounted = page ? id : null;
      el.innerHTML = '';
      if (page) {
        const signal = routerCtrl ? routerCtrl.signal : undefined;
        // A broken page must not break navigation or leave a blank screen.
        const fail = (e) => {
          if (signal && signal.aborted) return;
          if (typeof console !== 'undefined') console.warn('Page ' + id + ' failed to load', e);
          el.innerHTML = '';
          const p = document.createElement('p');
          p.className = 'pg-error';
          p.setAttribute('role', 'alert');
          p.textContent = "Couldn't load this tab";
          el.appendChild(p);
        };
        try {
          const r = page.mount(el, { signal });
          if (r && typeof r.catch === 'function') r.catch(fail);
        } catch (e) { fail(e); }
      }
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
