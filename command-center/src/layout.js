// Block layout: collapse (always), and when unlocked, move/hide blocks per page.
// Saved in settings doc `layout-<pageId>` and mirrored to localStorage `cc.layout.<pageId>`.
import { db } from './db.js';
import { currentRoute, onRouteChange } from './router.js';

const LAY_KEY = 'cc.layout.';
const layCache = {};
let layUnlocked = false;

// Saved ids first (those still present), then unknown/new ids in default order.
export function layApplyOrder(defaultIds, saved) {
  const order = saved && Array.isArray(saved.order) ? saved.order : [];
  const out = order.filter((id, i) => defaultIds.includes(id) && order.indexOf(id) === i);
  defaultIds.forEach((id) => { if (!out.includes(id)) out.push(id); });
  return out;
}

export function layMove(ids, id, dir) {
  const out = ids.slice();
  const i = out.indexOf(id);
  const j = i + (dir === 'up' || dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= out.length) return out;
  out[i] = out[j]; out[j] = id;
  return out;
}

export function layToggle(list, id) {
  const l = Array.isArray(list) ? list : [];
  return l.includes(id) ? l.filter((x) => x !== id) : l.concat(id);
}

function layClean(d) {
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const out = { order: arr(d && d.order), hidden: arr(d && d.hidden), collapsed: arr(d && d.collapsed) };
  if (d && typeof d.updated_at === 'string') out.updated_at = d.updated_at;
  return out;
}

export async function layLoad(pageId, store = db, storage) {
  const ls = storage !== undefined ? storage : layStorage();
  let local = null;
  try { const raw = ls && ls.getItem(LAY_KEY + pageId); if (raw) local = layClean(JSON.parse(raw)); } catch (e) { /* ignore */ }
  let remote = null;
  try {
    const r = await store.get('settings', 'layout-' + pageId);
    if (r && !r.offline && (r.order || r.hidden || r.collapsed)) remote = layClean(r);
  } catch (e) { /* offline */ }
  // Prefer whichever copy is newer (a queued db write may not have flushed yet).
  const useRemote = remote && (!local || String(remote.updated_at || '') > String(local.updated_at || ''));
  const out = (useRemote ? remote : local) || layClean(null);
  if (useRemote) { try { ls && ls.setItem(LAY_KEY + pageId, JSON.stringify(out)); } catch (e) { /* ignore */ } }
  return out;
}

export async function laySave(pageId, layout, store = db, storage, now) {
  const ls = storage !== undefined ? storage : layStorage();
  const d = layClean(layout);
  d.updated_at = now || new Date().toISOString();
  try { ls && ls.setItem(LAY_KEY + pageId, JSON.stringify(d)); } catch (e) { /* ignore */ }
  try { await store.put('settings', Object.assign({ id: 'layout-' + pageId }, d)); } catch (e) { /* queued or offline */ }
  return d;
}

function layStorage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
}

function layLocalSync(pageId) {
  try { const raw = layStorage() && layStorage().getItem(LAY_KEY + pageId); if (raw) return layClean(JSON.parse(raw)); } catch (e) { /* ignore */ }
  return layClean(null);
}

function layGet(pageId) {
  if (!layCache[pageId]) layCache[pageId] = layLocalSync(pageId);
  return layCache[pageId];
}

const layVer = {};
let laySaveChain = Promise.resolve();

function laySet(pageId, d) {
  layCache[pageId] = d;
  layVer[pageId] = (layVer[pageId] || 0) + 1;
  laySaveChain = laySaveChain.then(() => laySave(pageId, d)).catch(() => {});
  layApply();
}

// Idempotent: only touches the DOM where it differs from the desired state.
export function layApply() {
  if (typeof document === 'undefined') return;
  const view = document.getElementById('view');
  const pageId = currentRoute();
  if (!view || !pageId) return;
  const secs = Array.from(view.querySelectorAll('section.pg-sec[data-section]'));
  if (!secs.length) return;
  const d = layGet(pageId);
  const ids = secs.map((s) => s.dataset.section);
  const ordered0 = d.order.length ? null : layVisualIds(secs);
  const ordered = ordered0 || layApplyOrder(ids, d);
  const hasOrder = d.order.length > 0;
  ordered.forEach((id, idx) => {
    const s = secs[ids.indexOf(id)];
    const want = hasOrder ? String(idx) : '';
    if (s.style.order !== want) s.style.order = want;
    const hidden = d.hidden.includes(id);
    const collapsed = d.collapsed.includes(id);
    s.classList.toggle('lay-hidden', hidden);
    s.classList.toggle('lay-collapsed', collapsed);
    s.toggleAttribute('hidden', hidden && !layUnlocked);
    const btn = s.querySelector(':scope > h2 > .pg-hd');
    if (btn) {
      const exp = collapsed ? 'false' : 'true';
      if (btn.getAttribute('aria-expanded') !== exp) btn.setAttribute('aria-expanded', exp);
      const ind = btn.querySelector('.pg-ind');
      const ch = collapsed ? '▸' : '▾';
      if (ind && ind.textContent !== ch) ind.textContent = ch;
    }
    let ctl = s.querySelector(':scope > .lay-ctl');
    if (layUnlocked) {
      const first = idx === 0; const last = idx === ordered.length - 1;
      const sig = [first, last, hidden].join();
      if (!ctl || ctl.dataset.sig !== sig) {
        if (!ctl) { ctl = document.createElement('div'); ctl.className = 'lay-ctl'; s.insertBefore(ctl, s.firstChild); }
        ctl.dataset.sig = sig;
        const name = (btn ? btn.textContent.replace(/^[▾▸]\s*/, '') : id);
        ctl.innerHTML = '<button type="button" class="lay-btn" data-lay="up" aria-label="Move ' + layEsc(name) + ' up"' + (first ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="lay-btn" data-lay="down" aria-label="Move ' + layEsc(name) + ' down"' + (last ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="lay-btn" data-lay="hide" aria-label="' + (hidden ? 'Show ' : 'Hide ') + layEsc(name) + '">' + (hidden ? 'Show' : 'Hide') + '</button>';
      }
    } else if (ctl) ctl.remove();
  });
  // Reorder DOM too (for non-flex containers), only if out of order.
  if (hasOrder) {
    const parent = secs[0].parentNode;
    const same = secs.every((s) => s.parentNode === parent);
    if (same && ordered.join() !== ids.join()) {
      const anchor = secs[secs.length - 1].nextSibling;
      ordered.forEach((id) => parent.insertBefore(secs[ids.indexOf(id)], anchor));
    }
  }
}

// Current on-screen order (CSS `order` from shift rules, then DOM order).
function layVisualIds(secs) {
  const o = (s) => { const v = parseInt(getComputedStyle(s).order, 10); return isNaN(v) ? 0 : v; };
  return secs.map((s, i) => ({ id: s.dataset.section, o: o(s), i }))
    .sort((a, b) => a.o - b.o || a.i - b.i).map((x) => x.id);
}

function layEsc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function layOnClick(e) {
  const t = e.target.closest && e.target.closest('button');
  if (!t) return;
  const sec = t.closest('section.pg-sec[data-section]');
  const pageId = currentRoute();
  if (!sec || !pageId) return;
  const id = sec.dataset.section;
  const d = layGet(pageId);
  if (t.classList.contains('pg-hd')) {
    laySet(pageId, Object.assign({}, d, { collapsed: layToggle(d.collapsed, id) }));
  } else if (t.dataset.lay && layUnlocked) {
    const secs = Array.from(document.querySelectorAll('#view section.pg-sec[data-section]'));
    const cur = d.order.length ? layApplyOrder(secs.map((s) => s.dataset.section), d) : layVisualIds(secs);
    if (t.dataset.lay === 'hide') {
      laySet(pageId, Object.assign({}, d, { hidden: layToggle(d.hidden, id) }));
      const hb = sec.querySelector('[data-lay="hide"]');
      if (hb) hb.focus();
    } else {
      laySet(pageId, Object.assign({}, d, { order: layMove(cur, id, t.dataset.lay) }));
      const nb = sec.querySelector('[data-lay="' + t.dataset.lay + '"]');
      if (nb && !nb.disabled) nb.focus(); else { const h = sec.querySelector('.pg-hd'); if (h) h.focus(); }
    }
  }
}

function laySetLocked(locked, btn) {
  layUnlocked = !locked;
  if (btn) {
    btn.textContent = locked ? '🔒' : '🔓';
    btn.setAttribute('aria-label', locked ? 'Unlock layout' : 'Lock layout');
    btn.setAttribute('aria-pressed', String(!locked));
  }
  if (typeof document !== 'undefined') document.body.classList.toggle('lay-unlocked', !locked);
  layApply();
}

export function initLayout() {
  if (typeof document === 'undefined') return;
  const bar = document.getElementById('topbar');
  const view = document.getElementById('view');
  let btn = null;
  if (bar) {
    btn = document.createElement('button');
    btn.type = 'button'; btn.id = 'lay-toggle'; btn.className = 'topbtn';
    bar.appendChild(btn);
    btn.addEventListener('click', () => laySetLocked(layUnlocked, btn));
  }
  laySetLocked(true, btn);
  if (view) {
    view.addEventListener('click', layOnClick);
    if (typeof MutationObserver !== 'undefined') {
      let pending = false;
      new MutationObserver(() => {
        if (pending) return;
        pending = true;
        Promise.resolve().then(() => { pending = false; layApply(); });
      }).observe(view, { childList: true, subtree: true });
    }
  }
  onRouteChange((id) => {
    laySetLocked(true, btn);
    layLoadInto(id);
  });
  const id = currentRoute();
  if (id) layLoadInto(id);
}

// Ignores the load result if the user edited this page's layout meanwhile.
function layLoadInto(id) {
  const v = layVer[id] || 0;
  layLoad(id).then((d) => {
    if ((layVer[id] || 0) !== v) return;
    layCache[id] = d;
    if (currentRoute() === id) layApply();
  }).catch(() => {});
}
