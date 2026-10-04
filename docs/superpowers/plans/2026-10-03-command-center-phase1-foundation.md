# Command Center Phase 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-scroll Command Center with a tab-bar app shell (6 pages, global + / search / badges / shift mode / theme) and migrate existing data, keeping the same artifact URL.

**Architecture:** Source lives in `command-center/` as small plain-JS modules (no framework). Pure logic modules are unit-tested with `node --test`. `build.mjs` inlines CSS + JS into one `dist/command-center.html`, which is published to the existing artifact URL. Data uses the artifact database (`db` capability); page content for later phases plugs into page mount functions.

**Tech Stack:** HTML/CSS, vanilla ES modules, Node 20+ (`node:test`, no npm deps), artifact runtime `window.claude.*` (db, connectors, ask Claude).

**Spec:** `docs/superpowers/specs/2026-10-03-command-center-redesign-design.md`

## Global Constraints

- No patient identifiers: no field named or labelled patient, MRN, DOB, name-of-patient anywhere in forms or collections.
- Text ≥ 12px; contrast ≥ 4.5:1; tap targets ≥ 44px.
- Tabs, in order: Home, Work, Cards, Health, Well & Fit, Inbox; routes `#home #work #cards #health #wf #inbox`.
- Tab bar bottom on phone; left rail at viewport ≥ 900px.
- Accents: Work teal, Cards purple, Health lime, Well & Fit coral, Inbox blue; red = needs attention only; green = done.
- Dark default, light toggle; numbers in bold monospace.
- Back up current artifact HTML + DB export before first publish of the new version.
- Load `artifact-design` and `artifact-capabilities` skills before writing page/runtime code.

## Review Focus

1. Unknown hash (e.g. `#foo` or empty) → falls back to `#home`, no blank screen. (Task 2 test)
2. Quick-add with empty/whitespace text → no item created, input stays open. (Task 4 test)
3. Shift detection when calendar is unavailable/offline → uses saved override, else Day off; never throws. (Task 5 test)
4. Migration run twice → no duplicate records (idempotent by source id). (Task 7 test)
5. Storage/db call fails → page still renders with an inline "offline" note, not a crash. (Task 6 test)

---

### Task 1: Project scaffold, build script, style tokens

**Files:**
- Create: `command-center/src/index.html` (shell markup: `<main id="view">`, `<nav id="tabs">`, `<button id="fab">`, `<dialog id="quickadd">`, `<dialog id="ask">`, search input)
- Create: `command-center/src/styles.css` (tokens on `:root` + `[data-theme=light]`)
- Create: `command-center/build.mjs`
- Create: `command-center/test/build.test.mjs`
- Modify: `.gitignore` (add `command-center/dist/`)

**Interfaces:**
- Produces: `node command-center/build.mjs` → writes `command-center/dist/command-center.html` with all `<link rel=stylesheet>` and `<script type=module src>` from `src/` inlined; CSS tokens `--bg --surface --text --muted --accent --work --cards --health --wf --inbox --alert --done --font-num`.

- [ ] **Step 1: Write failing test** `build produces single file with no external src/href to ./` — asserts output exists, contains `--work:` token, and has no `src="./` or `href="./`.
- [ ] **Step 2: Run** `node --test command-center/test` → FAIL (no build.mjs).
- [ ] **Step 3: Implement** `build.mjs` (read index.html, replace local link/script tags with inline contents, bundle modules by concatenating in import order from `src/main.js`) and the token CSS. Token values: reuse current noir values (`--accent:#9a7fd8`, `--muted:#8a83a0`); pick per-area accents and verify each ≥ 4.5:1 on `--surface`.
- [ ] **Step 4: Run** tests → PASS.
- [ ] **Step 5: Commit** `feat(cc): scaffold, build script, style tokens`.

### Task 2: Router + tab bar

**Files:**
- Create: `command-center/src/router.js`, `command-center/src/tabs.js`
- Test: `command-center/test/router.test.mjs`

**Interfaces:**
- Produces: `export const ROUTES = ['home','work','cards','health','wf','inbox']`; `parseRoute(hash: string) -> string` (unknown/empty → `'home'`); `registerPage(id, {title, accent, mount(el), badge?() -> Promise<number>})`; `navigate(id)`.

- [ ] **Step 1: Failing tests:** `parseRoute('#cards')==='cards'`; `parseRoute('')==='home'`; `parseRoute('#foo')==='home'`; `parseRoute('#cards/123')==='cards'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** router (listens to `hashchange`, calls page `mount`), and tabs (renders 6 buttons with icon + label, active state uses page accent, `aria-current`). Layout switch at 900px via CSS only.
- [ ] **Step 4: Run** → PASS; open dist at 390px and 1200px, click every tab.
- [ ] **Step 5: Commit** `feat(cc): router and tab bar`.

### Task 3: Data layer

**Files:**
- Create: `command-center/src/db.js`
- Test: `command-center/test/db.test.mjs` (with in-memory fake of `window.claude.db`)

**Interfaces:**
- Consumes: artifact `db` capability (exact call shapes from `artifact-capabilities` skill).
- Produces: `db.list(coll) -> Promise<Doc[]>`, `db.get(coll,id)`, `db.put(coll,doc) -> Promise<Doc>` (assigns `id`, `updated_at`), `db.remove(coll,id)`; on failure resolves with `{offline:true}` and queues writes in localStorage (`cc.queue`), flushed by `db.flush()`.
- Collections: `tasks`, `settings`, `notes`, `workouts` (Phase 1); others added in later phases.

- [ ] **Step 1: Failing tests:** put then list returns doc with id; failing backend → `put` queues and `flush` replays once backend recovers; `put` rejects any doc containing keys matching `/patient|mrn|dob/i`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `db.js` (wrap every localStorage access in try/catch).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(cc): data layer with offline queue and PHI guard`.

### Task 4: Quick add (+) and search

**Files:**
- Create: `command-center/src/quickadd.js`, `command-center/src/search.js`
- Test: `command-center/test/quickadd.test.mjs`, `command-center/test/search.test.mjs`

**Interfaces:**
- Consumes: `db.put`, `db.list`.
- Produces: `classify(text: string) -> {kind:'task'|'event'|'card'|'workout'|'note'|null, title, category?, when?}`; `search(query, collections) -> Promise<{coll,id,title}[]>`.

- [ ] **Step 1: Failing tests:** `classify('  ').kind===null`; `classify('call Stryker rep Tue')` → kind task, category Work, when = next Tuesday; `classify('chest day')` → workout; `classify('Lap chole Dr. X 7am')` → event; search `'stry'` finds task "call Stryker rep".
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** rule-based classifier (keyword lists per kind; weekday/time parsing); FAB opens dialog → shows suggested kind as chips user can change → Save. Search is case-insensitive substring over `title` fields.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(cc): quick add and global search`.

### Task 5: Shift mode + theme

**Files:**
- Create: `command-center/src/shift.js`, `command-center/src/theme.js`
- Test: `command-center/test/shift.test.mjs`

**Interfaces:**
- Produces: `detectShift(events: {title,start}[] | null, override: 'work'|'off'|null) -> 'work'|'off'`; `applyShift(mode)` sets `document.body.dataset.shift`; `setTheme('dark'|'light')` saved in `settings`.

- [ ] **Step 1: Failing tests:** override wins; events with title matching `/\bOR\b|case|shift/i` today → `'work'`; `events=null` and no override → `'off'`; no throw on malformed events.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; header toggle shows `⚡ Workday / Day off`, tap flips and saves override for today only.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(cc): shift mode and theme toggle`.

### Task 6: Six page shells, badges, Ask Claude

**Files:**
- Create: `command-center/src/pages/{home,work,cards,health,wf,inbox}.js`, `command-center/src/ask.js`, `command-center/src/badges.js`
- Test: `command-center/test/badges.test.mjs`

**Interfaces:**
- Consumes: `registerPage`, `db`, `detectShift`.
- Produces: each page registers with title/accent and a `mount` that renders its section headers and existing data (Home: weather, today's events, important tasks ordered by shift; Inbox: tasks by category; others: placeholder sections named per spec §4); `ask.open(pageId)` shows 3 page-specific prompts + free text and sends via the ask-Claude capability; `badgeCount(items) -> number`.

- [ ] **Step 1: Failing tests:** `badgeCount([])===0`; counts only items with `attention:true`; page `mount` with db returning `{offline:true}` renders "offline" note (DOM via minimal fake element).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** pages, badges on tabs (red dot with number, hidden at 0), Ask Claude sheet. Port weather/calendar connector calls from current artifact unchanged.
- [ ] **Step 4: Run** → PASS; manual pass on 390px: every tab, +, search, Ask, shift toggle, theme toggle.
- [ ] **Step 5: Commit** `feat(cc): page shells, badges, Ask Claude`.

### Task 7: Backup, migration, publish

**Files:**
- Create: `command-center/src/migrate.js`
- Test: `command-center/test/migrate.test.mjs`
- Create: `backups/2026-10-03-command-center-v97.html` (copy of current scratchpad working copy)

**Interfaces:**
- Consumes: old DB collections (list them first with ArtifactData `list` on the artifact URL), `db.put`.
- Produces: `migrate(oldDocs: {coll, doc}[]) -> {created:number, skipped:number}`; idempotent via `source_id`.

- [ ] **Step 1: Inspect** old collections with ArtifactData and record their names/fields at the top of `migrate.js` as a mapping table.
- [ ] **Step 2: Failing tests:** mapping a sample old task yields new `tasks` doc with `category`; running migrate twice → second run `created===0`; any old field matching PHI regex is dropped.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** → PASS.
- [ ] **Step 5: Save backup**, export old DB to `backups/2026-10-03-db.json` (confirm it contains no patient identifiers before committing; if unsure, keep it only in scratchpad).
- [ ] **Step 6: Build** and publish `dist/command-center.html` to `https://claude.ai/artifact/FSioRAKHA1QL8BWff8AZT3` with `db` + ask-Claude capabilities; run migration once; verify counts match.
- [ ] **Step 7: Commit** `feat(cc): migration and phase 1 publish`.

---

**Done when:** all `node --test command-center/test` pass, the published artifact shows 6 working tabs on phone and desktop, old data appears in the new pages, and the backup exists.
