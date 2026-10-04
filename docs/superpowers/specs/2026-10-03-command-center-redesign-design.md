# Command Center Redesign — Design Spec

Date: 2026-10-03
Status: Draft for review
Artifact: https://claude.ai/artifact/FSioRAKHA1QL8BWff8AZT3 (same URL is kept)

## 1. Goal

Rebuild the Command Center as one phone-first app with a tab bar, so that:
- each screen shows only what matters right now (less clutter, clear order),
- common jobs take fewer taps (optimized workflows),
- key tools get their own page (Preference Card Builder, Workout Logger),
- every area connects to the others (cards ↔ cases ↔ vendors/staff, email → task, workout → Instagram),
- it can keep growing with Claude ("Ask Claude" buttons, shared database).

Used mostly on a phone at work (no computer available); must also use extra space well on desktop.

## 2. Hard rules

- **No patient identifiers anywhere.** Cards and cases store surgeon, procedure, room, time only. No field exists for patient name, MRN, DOB or similar.
- Text ≥ 12px, contrast ≥ 4.5:1, tap targets ≥ 44px (glove-friendly).
- Instagram posts are queued for approval by default; nothing posts without Mychael's OK unless he switches to auto.
- Back up the current artifact HTML and database before switching.

## 3. Structure

Single HTML artifact, hash-based routing (`#home`, `#work`, `#cards`, `#health`, `#wf`, `#inbox`).

**Tab bar:** bottom on phone, left rail on desktop (≥ 900px).
`Home · Work · Cards · Health · Well & Fit · Inbox`

**Global (every page):**
- **+ Quick add** — one line of text → suggested destination (task / event / card / workout / note) → one tap to confirm.
- **Ask Claude** — 2–3 page-specific prompts plus free text.
- **Needs-attention badges** on tabs (e.g. case tomorrow with no card, unread work email, drafts waiting).
- **Search** across cards, tasks, vendors, staff, workouts.
- **Shift mode** — Workday / Day off, auto-detected from calendar, one-tap override. Reorders Home.
- **Light / dark** toggle (dark default).
- **Offline-tolerant** — card pick lists and workout logger work without signal and sync on reconnect.

## 4. Pages

### Home
- **Next up card** (changes through the day): leave-in time + drive time, next case with [Open card] [Navigate], or today's workout on days off.
- Leave-time alert when traffic adds delay (shown on open; push is optional extra via a scheduled routine).
- Today's events; important tasks from all categories; weather.
- **End day** button: check off done, roll leftovers to tomorrow, save a summary (same as `/endofday`).

### Work (accent: teal)
- OR cases pulled from calendar, each auto-linked to its matching card (surgeon + procedure). Missing card → "Build card" button.
- **8 pm prep**: tomorrow's cases, flags missing cards.
- Work task list (category = Work).
- **Vendor list**: company, rep, phone, email, products; tap-to-call/text.
- **Staff list**: name, role, phone; "on with me today" view.

### Cards — Preference Card Builder (accent: purple)
- Own page, reachable from tab bar, from any case, and from search.
- One card per **surgeon + procedure**. Search, add, edit, duplicate, delete.
- All fields editable: surgeon, procedure, vendor(s), staff, gloves/gown, positioning, prep, supplies, instruments, sutures, meds, notes. Users can add custom sections.
- Each item has **quantity** and **status: open / hold** (e.g. `0 Vicryl CT-1 — ×2 open, ×2 hold`).
- Surgeon, vendor and staff are picked from lists (type once, reuse).
- "Last updated" date + change note per card.
- **Pick list mode**: checklist view with progress (`3/9 pulled`), resets per case.

### Health (accent: lime)
**Workout logger**
- Auto-fills from the last workout on the same weekday (weights and reps pre-loaded); fully editable before and during.
- Add exercise → dropdown of previously used exercises (or type new) → choose number of sets.
- **Supersets**: group 2+ exercises; labeled A1/A2 etc. and noted in exports.
- **Autosave** after every change; resume an unfinished workout.
- Rest timer starts when a set is logged; shows next set.
- Progression hint ("hit 3×10 at 60 lb — try 65?").

**Stats over time:** PRs per exercise, weekly volume, streak/consistency, weekly muscle balance, optional private body stats (weight, photos — never posted unless chosen).

**Instagram (@mykfytt)**
- **One tap from finished workout** → add topic/keywords → pick template → pick caption style → queue to Buffer.
- Templates: Today's session, PR alert, Superset breakdown, Weekly recap.
- Caption styles: hype, educational, short.
- Best-time-to-post suggestion from Buffer stats.
- Content calendar auto-filled from workouts. Starter idea bank:
  1. Gym after a long OR shift
  2. 8-weeks-ago vs now progress
  3. Form tip of the week (from most-logged lifts)
  4. What I eat on a work day
  5. Auto weekly recap carousel

### Well & Fit (accent: coral)
- Site stats; **Fix this first** (top 3 highest-impact fixes, e.g. missing featured image, SEO title too long).
- Drafts list; Well & Fit task list (category = Well & Fit); growth recommendations.
- Repurpose: article → @mykfytt post and post → article idea.

### Inbox (accent: blue)
- Separate view per email account.
- Per-email actions: → Task, → Calendar, Archive, Reply with Claude.
- Tasks with categories: Work, Personal, Health, Well & Fit.
- Quiet hours: work email hidden on days off unless urgent.

## 5. Data (artifact database)

| Collection | Key fields | Links |
|---|---|---|
| `cards` | surgeon_id, procedure, sections[{name, items[{name, qty_open, qty_hold, note}]}], vendor_ids, staff_ids, updated_at, change_note | surgeons, vendors, staff |
| `surgeons` | name, specialty | — |
| `vendors` | company, rep, phone, email, products | — |
| `staff` | name, role, phone | — |
| `tasks` | title, category, due, priority, done, source_email_id | email |
| `exercises` | name, muscle_group | — |
| `workouts` | date, weekday, status (in_progress/done), blocks[{superset_label, exercises[{exercise_id, sets[{weight, reps, done}]}]}] | exercises, posts |
| `posts` | workout_id, template, topic, caption, status (draft/queued/posted), buffer_id | workouts |
| `body_stats` | date, weight, photo_ref (private) | — |
| `settings` | shift override, theme, quiet hours, home/work address | — |

OR cases are **read live from the calendar**, not stored; matched to cards by surgeon + procedure text.
Existing tasks, notes and workouts are migrated into these collections.

## 6. Visual style — Noir Purple (refined)

- Background near-black; cards dark gray; one purple primary accent (buttons, active tab).
- Per-area accents: Work teal, Cards purple, Health lime, Well & Fit coral, Inbox blue.
- Red only for needs-attention; green for done.
- Rounded cards, generous spacing, simple line icons.
- Clean sans-serif for text; bold monospace for numbers (weights, times, quantities).
- Light-mode variant with the same tokens.
- Instagram templates use a matching @mykfytt look.

## 7. Build phases

Each phase ships a working version for testing before the next.

1. **Foundation** — tab bar + 6 pages, style tokens, + button, search, badges, shift mode, theme, data migration (with backup).
2. **Cards + Work** — card builder, pick lists, case↔card linking, 8 pm prep, vendors, staff.
3. **Health** — logger (auto-fill, supersets, autosave, rest timer, progression), stats, muscle balance.
4. **Instagram** — one-tap flow, templates, captions, Buffer queue, content calendar.
5. **Home + Inbox + Well & Fit** — next-up card, leave-time, end-day, email actions, quiet hours, fix-this-first, repurpose.

## 8. Known limits

- Drive time needs location permission; live traffic depends on available connectors — verified in phase 5.
- Instagram autopost requires @mykfytt connected in Buffer (business/creator account may be required).
- Time-based alerts appear on open; true phone push needs a scheduled routine (optional extra).
- Offline covers cards and workouts; email/calendar need connection.

## 9. Testing

- Each phase: syntax check, open on phone width (390px) and desktop, walk through each workflow listed above.
- Verify no patient-identifier fields exist in any form or collection.
- Verify migration counts match the old data before switching.
