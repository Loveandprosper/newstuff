// Home: next up, weather, today's events, important tasks. Section order follows shift (CSS on body[data-shift]).
import { registerPage } from '../router.js';
import { db } from '../db.js';
import { refreshShift } from '../shift.js';
import { getMcp, watchWeather, watchTodayEvents } from '../connectors.js';
import { taskNeedsAttention } from '../badges.js';
import { esc, shellDate, shellSection, shellPlaceholder, shellOffline, shellTaskList, shellLoadTasks, shellHeader } from './shell.js';

let homeUnsubs = [];

export function homeImportant(tasks, now = new Date()) {
  const today = shellDate(now);
  return tasks.filter((t) => t && !t.done && (t.priority === 'high' || (typeof t.due === 'string' && t.due.slice(0, 10) === today)))
    .map((t) => ({ ...t, attention: taskNeedsAttention(t, now) }));
}

function homeSlot(el, name, html) {
  const s = el && typeof el.querySelector === 'function' ? el.querySelector('[data-slot="' + name + '"]') : null;
  if (s) s.innerHTML = html;
}

function homeWeatherHtml(w) {
  if (w.error) return '<p class="pg-err">' + esc(w.error) + '</p>';
  const parts = [];
  if (w.now) parts.push('<p><span class="num pg-big">' + esc(w.now.temp) + '</span> ' + esc(w.now.phrase) + ' · feels <span class="num">' + esc(w.now.realFeel) + '</span></p>');
  if (w.day) parts.push('<p class="pg-meta">Today <span class="num">' + esc(w.day.high) + ' / ' + esc(w.day.low) + '</span> · ' + esc(w.day.phrase) + ' · rain <span class="num">' + esc(w.day.precip) + '</span></p>');
  if (w.alert) parts.push('<p class="pg-attn-text">⚠ ' + esc(w.alert) + '</p>');
  return parts.join('') || shellPlaceholder('Loading weather…');
}

function homeEventsHtml(events, err) {
  if (err) return '<p class="pg-err">' + esc(err) + '</p>';
  if (!events.length) return '<p class="pg-empty">Nothing on the calendar today.</p>';
  return '<ul class="pg-list">' + events.map((e) => {
    const t = e.allDay ? 'all day' : new Date(e.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return '<li class="pg-row"><span class="num pg-time">' + esc(t) + '</span><span>' + esc(e.title) + (e.location ? '<span class="pg-meta"> · ' + esc(e.location) + '</span>' : '') + '</span></li>';
  }).join('') + '</ul>';
}

export async function mountHome(el, deps = {}) {
  const d = { db, now: new Date(), ...deps };
  homeUnsubs.forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
  homeUnsubs = [];
  const live = '<p class="pg-empty">Live data shows when opened on claude.ai.</p>';
  const render = (taskHtml) => {
    el.innerHTML = shellHeader('Home') + '<div class="pg-home">' +
      shellSection('next', 'Next up', shellPlaceholder()) +
      shellSection('weather', 'Weather', '<div data-slot="weather">' + shellPlaceholder('Loading weather…') + '</div>') +
      shellSection('events', "Today's events", '<div data-slot="events">' + shellPlaceholder('Loading calendar…') + '</div>') +
      shellSection('tasks', 'Important tasks', '<div data-slot="tasks">' + taskHtml + '</div>') +
      shellSection('endday', 'End day', shellPlaceholder()) + '</div>';
  };
  render(shellPlaceholder('Loading tasks…'));
  const { tasks, offline } = await shellLoadTasks(d.db);
  render((offline ? shellOffline() : '') + shellTaskList(homeImportant(tasks, d.now), 'No urgent tasks.'));

  const mcp = 'mcp' in deps ? deps.mcp : await getMcp();
  if (!mcp) { homeSlot(el, 'weather', live); homeSlot(el, 'events', live); return; }
  let wx = {};
  homeUnsubs.push(watchWeather(mcp, (u) => { wx = u.error ? { error: u.error } : { ...wx, ...u, error: undefined }; homeSlot(el, 'weather', homeWeatherHtml(wx)); }));
  homeUnsubs.push(watchTodayEvents(mcp, (events, err) => {
    homeSlot(el, 'events', homeEventsHtml(events || [], err));
    if (events) refreshShift(events);
  }));
}

registerPage('home', { title: 'Home', accent: 'var(--accent)', mount: (el) => mountHome(el), badge: () => 0 });
