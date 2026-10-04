// Ask Claude sheet: 3 page-specific prompts + free text, sent via the `sample` capability.
import { currentRoute, getPage } from './router.js';

export const ASK_PROMPTS = {
  home: ['Plan my day', "What's most urgent?", 'Summarize today'],
  work: ["Prep me for tomorrow's cases", 'Draft a vendor email', 'Summarize work tasks'],
  cards: ['Build a card from notes', "What's missing on this card?", 'Compare two cards'],
  health: ["Plan this week's workouts", "Suggest today's workout", 'Caption my last workout'],
  wf: ['What should I write next?', 'Fix-this-first ideas', 'Summarize site status'],
  inbox: ['Triage my tasks', 'Draft a reply', 'What can I archive?'],
};

const ASK_RULES = 'You are the assistant inside Mychael\'s personal Command Center (a surgical tech who also runs the Well & Fit site and the @mykfytt Instagram). ' +
  'Answer briefly in plain English, skimmable, with short bullets. Never ask for, repeat or store patient names, MRNs, dates of birth or any other patient identifiers; ' +
  'if the request seems to need them, work without them and say so.';

export function askBuildInput(pageId, question, context) {
  const page = getPage(pageId);
  const title = (page && page.title) || pageId;
  return [{ role: 'user', content: ASK_RULES + '\n\nCurrent page: ' + title + '\nWhat is on screen:\n' + String(context || '(nothing)').slice(0, 6000) + '\n\nQuestion: ' + question }];
}

let askSample;
async function askGetSample() {
  if (askSample !== undefined) return askSample;
  try {
    askSample = typeof claude !== 'undefined' && claude && typeof claude.use === 'function' ? (await claude.use('sample')) || null : null;
  } catch (e) { askSample = null; }
  return askSample;
}

function askEsc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

let askCtrl = null;

// Runs one question; a newer call aborts this one, and a superseded call never writes to `out`.
export async function askRun(out, sample, input) {
  if (askCtrl) askCtrl.abort();
  const ctrl = new AbortController();
  askCtrl = ctrl;
  const live = () => !ctrl.signal.aborted;
  out.textContent = 'Thinking…';
  try {
    const { text } = await sample(input, {
      signal: ctrl.signal,
      onText: (u) => { if (live()) out.textContent = u.text; },
    });
    if (live()) out.textContent = text;
  } catch (e) {
    if (!live() || (e && e.code === 'cancelled')) return;
    out.textContent = "Couldn't get an answer" + (e && e.message ? ': ' + e.message : '.');
  }
}

async function askSend(dlg, pageId, q) {
  const out = dlg.querySelector('.ask-out');
  const question = String(q || '').trim();
  if (!question) return;
  const sample = await askGetSample();
  if (!sample) { out.textContent = 'Ask Claude works when this page is opened on claude.ai.'; return; }
  const view = document.getElementById('view');
  await askRun(out, sample, askBuildInput(pageId, question, view ? view.innerText || view.textContent : ''));
}

export function openAsk(pageId) {
  if (typeof document === 'undefined') return;
  const dlg = document.getElementById('ask');
  if (!dlg) return;
  const id = ASK_PROMPTS[pageId] ? pageId : 'home';
  dlg.innerHTML = '<form class="ask-form" method="dialog"><h2>Ask Claude</h2>' +
    '<div class="ask-prompts">' + ASK_PROMPTS[id].map((p) => '<button type="button" class="ask-chip" data-q="' + askEsc(p) + '">' + askEsc(p) + '</button>').join('') + '</div>' +
    '<input class="ask-input" type="text" placeholder="Or type a question (no patient info)" aria-label="Your question">' +
    '<div class="ask-actions"><button type="submit" value="send" class="ask-send">Ask</button><button type="button" class="ask-close">Close</button></div>' +
    '<div class="ask-out" aria-live="polite"></div></form>';
  dlg.querySelector('.ask-prompts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]');
    if (b) askSend(dlg, id, b.dataset.q);
  });
  dlg.querySelector('.ask-form').addEventListener('submit', (e) => { e.preventDefault(); askSend(dlg, id, dlg.querySelector('.ask-input').value); });
  dlg.querySelector('.ask-close').addEventListener('click', () => { if (askCtrl) askCtrl.abort(); dlg.close(); });
  if (!dlg.open) dlg.showModal();
}

export const ask = { open: openAsk };

export async function initAsk() {
  if (typeof document === 'undefined') return;
  const bar = document.getElementById('topbar');
  if (!bar || document.getElementById('ask-btn')) return;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.id = 'ask-btn'; btn.className = 'topbtn'; btn.textContent = 'Ask';
  btn.setAttribute('aria-label', 'Ask Claude about this page');
  btn.hidden = true;
  btn.addEventListener('click', () => openAsk(currentRoute() || 'home'));
  bar.insertBefore(btn, document.getElementById('shift-toggle'));
  btn.hidden = !(await askGetSample());
}
