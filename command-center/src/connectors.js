// Live connector calls, ported unchanged from the previous Command Center artifact.
export const CONN_TZ = 'America/Denver';
export const WX_SERVER = 'AccuWeather®';
export const WX_DEFAULT_KEY = '351195';

export function connErrMsg(e, server) {
  const c = e && e.code;
  if (c === 'needs_reauth') return `Reconnect ${server} in claude.ai Settings → Connectors.`;
  if (c === 'server_not_connected' || c === 'selection_required') return `Add ${server} in claude.ai Settings → Connectors.`;
  if (c === 'not_in_manifest') return `${server} isn't allowed for this page. Turn it on from the page's connector settings.`;
  if (c === 'server_unavailable') return `${server} didn't respond. It will retry on the next refresh.`;
  if (c === 'blocked_by_policy' || c === 'approval_required') return `${server} is blocked by policy here.`;
  if (c === 'tool_error') return `${server} returned an error: ${e.message || ''}`;
  return `${server} couldn't load (${c || 'unknown error'}).`;
}

export function connParseLoose(p) { // some connectors append extra JSON after the payload
  if (p && typeof p === 'object') return p;
  if (typeof p !== 'string') return null;
  try { return JSON.parse(p); } catch (e) { /* fall through */ }
  let depth = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '{') depth++;
    else if (p[i] === '}' && --depth === 0) { try { return JSON.parse(p.slice(0, i + 1)); } catch (e) { return null; } }
  }
  return null;
}

const connYmd = (d) => d.toLocaleDateString('en-CA', { timeZone: CONN_TZ });

let connMcp;
export async function getMcp() {
  if (connMcp !== undefined) return connMcp;
  try {
    connMcp = typeof claude !== 'undefined' && claude && typeof claude.use === 'function' ? (await claude.use('mcp')) || null : null;
  } catch (e) { connMcp = null; }
  return connMcp;
}

// onUpdate({ now?: {temp, phrase, realFeel}, day?: {high, low, phrase, precip}, alert?, error? }). Returns unsubscribe.
export function watchWeather(mcp, onUpdate, key = WX_DEFAULT_KEY) {
  const unsubs = [];
  unsubs.push(mcp.watchTool(WX_SERVER, 'widgets-current-claude', { queryParams: { locationKey: key, unit: 'imperial' } }, (ev) => {
    if (ev.type === 'error') { onUpdate({ error: connErrMsg(ev.error, 'AccuWeather') }); return; }
    const p = connParseLoose(ev.result.payload) || {}; const c = p.currentConditions || {};
    const aq = p.currentAirQuality; const al = p.alerts || [];
    const alert = al.length ? al.map((a) => a.title || a.description || a.name || 'Weather alert').join(' · ')
      : (aq && /poor|unhealthy|hazard/i.test(aq.category || '') ? `Air quality: ${aq.category}` : '');
    onUpdate({ now: { temp: c.temperature || '--°', phrase: c.phrase || '', realFeel: c.realFeel || '?' }, alert });
  }, { refetchInterval: 1800000 }));
  unsubs.push(mcp.watchTool(WX_SERVER, 'widgets-todayTonightForecast-claude', { queryParams: { locationKey: key, unit: 'imperial', days: 2 } }, (ev) => {
    if (ev.type === 'error') return;
    const p = connParseLoose(ev.result.payload) || {}; const t = (p.dailyForecast || [])[0];
    if (!t) return;
    onUpdate({ day: { high: t.day.displayTemperature, low: t.night.displayTemperature, phrase: t.day.phrase, precip: t.day.precip } });
  }, { refetchInterval: 3600000 }));
  return () => unsubs.forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
}

// onEvents(events|null, errorText?) with events = [{ id, title, start, allDay, location }] for today only.
export function watchTodayEvents(mcp, onEvents) {
  const now = new Date(); const start = new Date(connYmd(now) + 'T00:00:00-06:00'); const end = new Date(start.getTime() + 2 * 864e5);
  return mcp.watchTool('Google Calendar', 'list_events', { startTime: start.toISOString(), endTime: end.toISOString(), orderBy: 'startTime', pageSize: 25, timeZone: CONN_TZ }, (ev) => {
    if (ev.type === 'error') { onEvents(null, connErrMsg(ev.error, 'Google Calendar')); return; }
    const p = connParseLoose(ev.result.payload) || {}; const items = p.events || p.items || [];
    const todayKey = connYmd(new Date());
    const today = items.filter((e) => { const s = e.start || {}; return (s.dateTime ? connYmd(new Date(s.dateTime)) : s.date) === todayKey; })
      .map((e) => { const s = e.start || {}; return { id: e.id, title: e.summary || '(no title)', start: s.dateTime || (s.date + 'T12:00:00'), allDay: !s.dateTime, location: e.location || '' }; });
    onEvents(today);
  }, { refetchInterval: 300000 });
}
