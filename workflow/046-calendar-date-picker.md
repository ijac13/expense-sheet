---
id: 046
title: Calendar-Style Date Picker (Home, History, Reports)
status: spec
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

Tapping a date field on Home, History, or Reports today uses whatever basic date input each screen currently has. Replace it with a calendar-style picker modal — like Google Calendar's — so picking a date is visual: see the month grid, step left/right between months, and jump to a year view for fast long-distance navigation.

## User Stories

- As the captain, I want to tap a date field on Home, History, or Reports and see a calendar modal, so I can visually pick a date instead of typing or stepping through one at a time.
- As the captain, I want to move the calendar left/right to change months, so I can quickly get to a nearby date.
- As the captain, I want to tap the month/year label to jump into a year view, so I can get to a date months or years away without repeated clicking.

## Success

- Tapping a date field on Home, History, and Reports opens a calendar modal instead of today's input.
- The calendar shows the current month with the selected date highlighted.
- Left/right arrows step one month at a time.
- Tapping the month/year label switches to a year-select view; picking a year returns to the month view for that year.
- Picking a day closes the modal and sets that date on the field that opened it.
- One shared component behind all three entry points — not three separate implementations.

### Out of Scope

- Changing what happens after a date is picked (existing logic per screen is untouched)
- Date-range selection (this is single-date picking; a report date-range picker, if wanted, is a separate ask)

## Plan

Build one shared calendar/date-picker component, reused across Home, History, and Reports the way entity 040 reused a shared edit surface across two entry points. Spec should identify each screen's current date-entry point before deciding the swap-in approach.

## Spec

### Goal

Replace every day-granularity date input on Home, History, and the Reports drill-down with one shared calendar modal — a month grid with left/right month stepping and a tap-the-title year view — so picking a date is visual instead of typed.

### Current Date-Entry Points

Read before designing the swap-in. The ideation names three screens; the code says the three screens contain **four** day-granularity fields across **three** components, and that two of the named screens share one of them.

| # | Where | Exact location | Control today | Granularity | Scope |
|---|---|---|---|---|---|
| 1 | Home — date stepper | `app/app/page.tsx:172-181` | `ChevronLeft` button + a **non-interactive `<span>`** label + `ChevronRight` button. No `<input>` of any kind. State is an ISO string (`page.tsx:36`) seeded by local calendar parts (`localDateStr`, `page.tsx:12-17`). | day | **IN** |
| 2 | Expense edit sheet — Date | `app/app/components/ExpenseEditSheet.tsx:223-228` | `<input type="date">` | day | **IN** |
| 3 | History filter — custom range From / To | `app/app/history/page.tsx:241-246` and `250-255` | two independent `<input type="date">`, rendered only when `datePreset === "custom"` (`:237`); both default to `""` (`DEFAULT_FILTERS`, `:35-37`) | day | **IN** |
| 4 | Reports — monthly navigation | `app/app/reports/page.tsx:549-559` | chevron buttons + non-interactive `<span>`; state is `year`/`month` **numbers** (`:399-400`), never an ISO date | **month** | OUT — Decision 2 |
| 5 | Reports — annual navigation | `app/app/reports/page.tsx:719-727` | chevron buttons + `<span>{annualYear}</span>`; state `annualYear` (`:403`) | **year** | OUT — Decision 2 |
| 6 | Subscriptions — Add start date | `app/app/subscriptions/page.tsx:515-521` (`data-testid="add-start-date"`) | `<input type="date">` | day | OUT — Decision 3 |
| 7 | Subscriptions — Cancel end date | `app/app/subscriptions/page.tsx:626-635` (`data-testid="cancel-end-date"`) | `<input type="date">` | day | OUT — Decision 3 |

Two findings that shape the whole design:

**Home has nothing to convert.** Every other site swaps an existing `<input type="date">`. Home's label is a `<span>` — the build must *add* a tap affordance, not replace one.

**"The date field on Reports" is the edit sheet, not a Reports-owned field.** `ExpenseEditSheet` is mounted from History (`app/app/history/page.tsx:564`) **and** from the Reports drill-down (`app/app/reports/DrillDown.tsx:167`). Row 2 is therefore two of the three named screens at once — the entity-040 shared-surface precedent already did the deduplication, and this entity inherits it for free.

### Design Decisions

Six decisions the build must not re-litigate, each forced by something in the current code.

**1. One component, ISO strings only at the boundary.**
`app/app/components/DatePickerModal.tsx` is the single definition of the calendar grid. Its interface is `{ value: string; onPick: (iso: string) => void; onClose: () => void }` — `YYYY-MM-DD` in, `YYYY-MM-DD` out, no `Date` object ever crossing the boundary. All four in-scope fields already hold ISO strings, and every local-date defect this repo has hit came from a `Date` round-trip (entity 053, Design Decision 4).

**2. Reports' period navigation stays as it is.**
Rows 4 and 5 select a *month* and a *year*. They hold no day and no ISO string. Three of the ideation's six success criteria — "shows the current month with the selected date highlighted", "picking a day closes the modal and sets the date" — have no meaning against them. Pointing a day-grid picker at a month selector would be scope bleed, which this stage's definition calls out as Bad. Reports' in-scope entry point is row 2, reached by drilling into a category. **Flagged for the captain at the gate** — see Open Decision below.

**3. Subscriptions stays on native inputs.**
Rows 6 and 7 are entity 053's, merged four days ago. Its shipped suite drives both through `setValue()` on `HTMLInputElement.prototype` at twelve call sites (`app/test/subscription-dates.render.test.js:157-316, 364-475`). Swapping them to a modal breaks all seven of 053's tests, dragging a just-verified feature into this entity's blast radius for a screen the ideation never named. Build the component so adopting them later is a two-line change per site, and leave them.

**4. All date math uses local calendar parts; `toISOString()` appears nowhere on the picker path.**
Reuse `todayLocalIso` (`app/app/lib/subscriptions.ts:31-36`), which already exists and is already correct. Grid cells are built with the local constructor `new Date(y, m - 1, d)` and formatted by parts; existing ISO strings are parsed with the repo's safe idiom `new Date(iso + "T00:00:00")` (`page.tsx:108`, `ExpenseEditSheet.tsx:33`, `history/page.tsx:137`), never bare `new Date(iso)`. Measured under `TZ=Asia/Taipei`: `new Date(2026,2,7).toISOString().split("T")[0]` returns **`2026-03-06`** — the off-by-one that AC-20 and AC-21 exist to catch.

**5. Month stepping is arithmetic on `(year, month)`, not `setMonth` on a date.**
Measured: `new Date(2026,0,31).setMonth(+1)` yields **3 March 2026**, silently skipping February. The visible month is `(year, monthIndex)` state; stepping adjusts the pair and carries across the year boundary.

**6. Home keeps its chevrons.**
Logging today or yesterday is Home's dominant interaction, and ±1 day is one tap today. The label becomes the tap target *in addition to* the arrows. Removing them to force a modal for the common case would be a regression.

**Stacking.** `ExpenseEditSheet` (`:118-119`) and the History filter sheet (`:184-185`) both `createPortal` to `document.body` inside a `fixed inset-0 z-[60]` wrapper whose **own `onClick` is `onClose`**. The picker must portal to `document.body` above `z-[60]` and stop its clicks propagating — otherwise tapping a day also dismisses the sheet that opened it.

### User Stories

- As the captain, I want to tap the date on Home, in the expense edit sheet, or in the History custom-range filter and see a calendar, so I can pick a date visually instead of typing one or stepping to it.
- As the captain, I want to step the calendar left and right by month, so I can reach a nearby date in a tap or two.
- As the captain, I want to tap the month/year title and jump straight to a year, so a date months or years back doesn't cost me twenty taps.
- As the captain, I want the calendar to open on the day I'm actually living in, so logging an expense at 1am doesn't quietly file it under yesterday.

### Acceptance Criteria

Every test below runs in the repo's existing jsdom harness (`node --test`, `app/test/helpers/dom.js`), under `process.env.TZ = "Asia/Taipei"` with `mock.timers` where a clock is named — the pattern `app/test/subscription-dates.render.test.js` established.

**The shared component**

- [ ] AC-1 — `app/app/components/DatePickerModal.tsx` is the only calendar-grid definition in the repo. Test: mount Home, the edit sheet (via History), and the History filter, open each picker, and assert all three render a `[data-testid="date-picker"]` root with identical grid geometry for the same visible month — same cell count, same first-cell `data-testid`, same weekday-header text in the same order. Fails if any screen grows its own grid.
- [ ] AC-2 — `onPick` receives a plain ISO string, never a `Date`. Test: tap a day cell → the argument satisfies `typeof arg === "string"` and `/^\d{4}-\d{2}-\d{2}$/`.
- [ ] AC-3 — The picker `createPortal`s to `document.body` and renders above the host sheet. Test: from inside the History filter sheet, open the picker and tap a day → the picker's `onPick` fires **and** the filter sheet is still in the DOM. Fails on the propagation bug the Stacking note above describes, which closes the host sheet too.
- [ ] AC-4 — The picker issues no network request. Test: open, navigate months, switch to year view, pick a day → the harness's `requests` array gains zero entries. (This is also the offline story: a pure-UI picker cannot fail offline.)

**Month grid**

- [ ] AC-5 — Opening with a value shows that value's month with that day marked selected, and it is the **only** selected cell. Test: `value="2026-03-07"` → the title reads the March 2026 label, `[data-testid="day-2026-03-07"]` carries `aria-selected="true"`, and exactly one cell in the grid does.
- [ ] AC-6 — The grid holds every day of the visible month in the correct weekday column. Test: March 2026 → cells `day-2026-03-01` through `day-2026-03-31` all exist, `day-2026-03-32` does not, and `day-2026-03-01` sits in the first column (1 March 2026 is a Sunday — verified). Leap handling: February 2028 renders `day-2028-02-29`; February 2027 does not.
- [ ] AC-7 — Left steps back exactly one month, right forward exactly one month, across year boundaries. Test: open at `2026-01-15`, tap left → title reads December 2025 and `day-2025-12-15` exists; tap right twice → February 2026. Fails on a `setMonth`-based implementation, which turns 31 January into 3 March (measured).
- [ ] AC-8 — Navigating months changes nothing but the view. Test: step three months forward and three back → the originally selected cell is still the only selected one, and `onPick` has not been called.

**Year view**

- [ ] AC-9 — Tapping the title switches to a year list and hides the day grid. Test: tap `[data-testid="picker-title"]` → `[data-testid="year-view"]` is present and no `[data-testid^="day-"]` remains.
- [ ] AC-10 — The year list spans local-current-year − 20 through + 5 inclusive (26 entries), with the visible year marked selected. Test under a fixed 2026 clock: `year-2006` and `year-2031` exist, `year-2005` and `year-2032` do not, and `year-2026` carries `aria-selected="true"`.
- [ ] AC-11 — Picking a year returns to the month grid for that year at the same month index, without picking a date or closing. Test: open at `2026-03-07`, tap the title, tap `year-2020` → `year-view` is gone, the title reads March 2020, `onPick` has not fired, and the picker is still in the DOM.

**Picking and dismissing**

- [ ] AC-12 — Tapping a day fires `onPick` exactly once with that cell's ISO string and closes the picker. Test: tap `day-2026-03-07` → one call, argument `"2026-03-07"`, and `[data-testid="date-picker"]` is gone.
- [ ] AC-13 — Dismissing without picking — backdrop tap, close button, or Escape — fires `onClose`, never `onPick`, and leaves the opening field's value byte-identical. Test all three dismissal routes.

**Timezone — the entity-053 lesson, not to be reintroduced**

- [ ] AC-14 — With no prior value, the picker opens on the **local** month and marks the local day as today. Test under `TZ=Asia/Taipei` with a fixed clock of `2026-08-31T16:30:00Z` — 00:30 on 1 September, local — → the title reads September 2026 and `[data-testid="day-2026-09-01"]` carries the today marker. Fails on any `toISOString()`-derived default, which yields August 2026 and `2026-08-31` (both measured).
- [ ] AC-15 — Day-cell ISO strings are built from local parts. Test under `TZ=Asia/Taipei`: tap the cell labelled "7" in the March 2026 grid → `onPick("2026-03-07")`. Fails on `toISOString()`-built cell ids, which yield `2026-03-06` (measured).

**Home** (`app/app/page.tsx`)

- [ ] AC-16 — The date label (`:177`) is a `<button>` that opens the picker at the currently selected date. Test: mount Home under a fixed clock, tap the label → the picker is open with today's cell selected.
- [ ] AC-17 — Picking sets Home's date, and it survives to the API. Test: pick `2026-03-07`, enter an amount, Save → the POST body carries `date: "2026-03-07"`. (`addExpense` forwards the form's `date` untouched, `app/app/lib/expenses.ts:48-53` — asserting on the request that *leaves* the page, per 053's discipline.)
- [ ] AC-18 — The chevrons still step ±1 day, before and after a pick. Test: pick `2026-03-07`, tap the right chevron → the label shows 8 March 2026.

**Expense edit sheet** (`app/app/components/ExpenseEditSheet.tsx`)

- [ ] AC-19 — The `<input type="date">` at `:223-228` becomes a button showing the current date; tapping opens the picker at `editForm.date`. Test: from History, open an expense dated `2026-08-01`, enter edit mode, tap the date button → `day-2026-08-01` is selected.
- [ ] AC-20 — Picking updates `editForm.date` and the save request carries it. Test: pick `2026-07-15`, Save → the PATCH body carries `date: "2026-07-15"`.
- [ ] AC-21 — Identical behaviour from the Reports drill-down mount (`app/app/reports/DrillDown.tsx:167`), with no second implementation. Test: repeat AC-19 and AC-20 through the drill-down. **Build note:** `test:compile` in `app/package.json` compiles four page files; `reports/page.tsx` is not among them, so `.test-build-ui/` currently has no `reports/` output. This AC requires adding it to that list.

**History custom range** (`app/app/history/page.tsx`)

- [ ] AC-22 — Both From and To become buttons opening the picker, and each writes only its own field. Test: set From to `2026-01-01`, then To to `2026-01-31` → `dateFrom` and `dateTo` hold exactly those, and neither pick clobbered the other.
- [ ] AC-23 — Opening a field whose value is `""` opens on the local current month with **no** cell selected (today is marked, but nothing is selected). Test: `datePreset` set to custom on a fresh filter → zero cells carry `aria-selected="true"`.

**i18n and regression**

- [ ] AC-24 — Month names and weekday headers render through `toLocaleDateString` with `zh-TW` when `i18n.language === "zh"` and `en-US` otherwise — the pattern at `history/page.tsx:128` and `ExpenseEditSheet.tsx:33`. Test: mount in each language → the March 2026 title differs between them, and the zh string is not the en string.
- [ ] AC-25 — Every new fixed string has a key in both `app/public/locales/en/common.json` and `.../zh/common.json`, the two files' key sets stay identical, zh is translated rather than copied, and no hardcoded English reaches the picker's DOM. (Entity 053's AC-25 rule.)
- [ ] AC-26 — After the change, `grep -rn 'type="date"'` across `app/app/` matches **only** `app/app/subscriptions/page.tsx` — two hits, rows 6 and 7. Binary and directly checkable.
- [ ] AC-27 — `npm test` passes from a clean install, with the new render test(s) added to the explicit file list in `app/package.json`'s `test` script and the newly-needed sources added to `test:compile`. Every pre-existing test still passes — in particular all seven of `subscription-dates.render.test.js`, which Decision 3 exists to protect.

### Edge Cases

- **No prior date selected.** The picker opens on the local current month with today marked but nothing selected (AC-14, AC-23). Real today: History's From/To both start as `""`.
- **Timezone.** The app is Asia/Taipei (UTC+8), so a UTC-derived "today" is *yesterday* for anything done between 00:00 and 07:59 local — entity 053's lesson. Pinned by AC-14 and AC-15 with clocks that measurably discriminate. Note `app/app/lib/expenses.ts:69` still carries the UTC form, but it filters the "logged today" list and never touches the picker path; see Out of Scope.
- **Rapid month/year navigation.** Stepping is synchronous local state with no fetch (AC-4), so N taps land exactly N months away with no coalescing or race. A fast title-tap into the year view must not also register as a day tap on whatever cell sits under the title's position.
- **Dismissing without picking.** Backdrop, close button, and Escape all leave the field exactly as it was (AC-13). Dismissing the picker must leave the *host* sheet open (AC-3).
- **A far-away date.** The year view is the escape hatch: any date within local-year − 20 to + 5 is reachable in three taps (title, year, day). Outside that window it is not reachable at all — acceptable for an expense tracker whose data starts in 2025, and the bound is stated in AC-10 rather than left implicit.
- **Month-length arithmetic.** Stepping from a 31-day month into a 30-day or February month must not overflow (Decision 5, AC-7); leap Februaries render 29 days (AC-6).
- **Picker inside an already-open modal.** Two of the four in-scope fields live inside portalled `z-[60]` sheets whose wrapper `onClick` closes them (AC-3).
- **Two people editing at once / offline.** Not applicable — the picker performs no I/O (AC-4). Whatever the surrounding screen already does on a failed write is untouched.

### Out of Scope

- **Reports' monthly and annual period navigation** (`reports/page.tsx:549-559`, `:719-727`) — month/year selectors, not date fields (Decision 2).
- **The Subscriptions start-date and end-date inputs** (`subscriptions/page.tsx:515-521`, `:626-635`) — entity 053's, and swapping them breaks its shipped suite (Decision 3).
- **Date-range selection.** The two History fields are picked one at a time, each with its own single-date picker. A range-select calendar is a separate ask.
- **What happens after a date is picked.** Every screen's existing save, filter, and refresh logic is untouched.
- **Time-of-day, recurring dates, and shortcut chips** ("Today", "Yesterday", "Last month").
- **The UTC `toISOString()` defaults in `app/app/lib/expenses.ts`** (`:16`, `:25`, `:34`, `:69`). Line 69 is a genuine latent Taipei bug — `getTodayExpenses` filters Home's "logged today" list against the UTC day — but it sits on the list path, not the picker path. Worth its own entity; fixing it here would put an untested data-path change inside a UI entity.

### Open Decision for the Captain

**Should tapping the month/year title on Reports open a picker too?**

The spec's answer is no (Decision 2) — Reports selects a period, not a date, and its in-scope field is the edit sheet reached by drilling into a category. But the ideation did name Reports as a screen with a "date field", and the year view this entity builds is exactly the control that would make jumping to March 2024's report fast.

Approving as written ships the picker on all four day-granularity fields and leaves Reports' navigation alone. The alternative is a follow-up entity adding a *month* picker — the same component in a month/year-only mode — to rows 4 and 5. Say which at the gate.

## Stage Report: spec

- DONE: Write the formal spec using the Spec Template (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope) from the ideation body already in workflow/046-calendar-date-picker.md
  `## Spec` at line 41 with all five template sections, plus `Current Date-Entry Points`, `Design Decisions`, and `Open Decision for the Captain` — the same shape entity 053's spec used.
- DONE: First identify every current date-entry point on Home, History, and Reports precisely (exact file/line, what input type or control each currently uses) before designing the swap-in — the ideation names three screens but the spec needs to confirm exactly what each one currently does today, including entity 053's newly-added Start Date/end-date inputs on Subscriptions if those should also be in scope or explicitly excluded
  Seven-row table with file:line and control type for each. Two corrections to the ideation's premise, both from the code: Home has no input at all (a non-interactive `<span>` at `page.tsx:177`), and Reports has no day-granularity field — its "date field" is `ExpenseEditSheet`, mounted from both `history/page.tsx:564` and `reports/DrillDown.tsx:167`. Subscriptions explicitly excluded, Decision 3.
- DONE: Acceptance criteria must be binary/independently testable, covering: tapping a date field opens a calendar modal instead of today's input; the modal shows the current month with the selected date highlighted; left/right arrows step one month; tapping the month/year label switches to a year-select view; picking a year returns to month view for that year; picking a day closes the modal and sets the date on the field that opened it; one shared component reused across all entry points, not three separate implementations
  27 ACs, each with its test and — where a specific defect is in play — the change that makes it fail. The seven named behaviours map to AC-16/19/22 (tap opens modal), AC-5 (current month, selected highlighted), AC-7 (arrows step one month), AC-9 (title opens year view), AC-11 (year returns to month view), AC-12 (day picks and closes), AC-1 (one component, proven by mounting all three entry points and comparing grid geometry rather than by grepping imports).
- DONE: Edge cases: opening the picker with no prior date selected (what does it default to); a date field for a different locale/timezone context (this app is Asia/Taipei per entity 053's established local-date-derivation lesson — do not reintroduce a UTC-vs-local bug); rapid month/year navigation; closing/dismissing the modal without picking a date; a very old or far-future date needing multiple navigation steps to reach
  All five in `### Edge Cases`, plus four found by reading the code: month-length overflow, the picker-inside-a-portalled-modal stacking trap, the title-tap/day-tap overlap, and offline as a non-issue since the picker does no I/O.
- DONE: Confirm scope boundary: this entity only swaps the picker UI, not what happens after a date is picked (existing per-screen logic stays untouched), and does not add date-range selection
  Both carried into `### Out of Scope` verbatim, with four more boundaries added: Reports period navigation, Subscriptions, shortcut chips, and `lib/expenses.ts`'s UTC defaults.

### Evidence

Four facts measured under `TZ=Asia/Taipei` rather than assumed, each pinning an AC to a real failure mode:

- `new Date(2026,2,7).toISOString().split("T")[0]` → `2026-03-06`. AC-15's discriminator: a `toISOString()`-built cell id is off by one day here.
- Clock `2026-08-31T16:30:00Z` → local `2026-09-01`, UTC `2026-08-31`. AC-14's discriminator, chosen to straddle a month boundary so the *title* disagrees too — a same-month clock would not have discriminated.
- `new Date(2026,0,31).setMonth(+1)` → `2026-3-3`. AC-7's falsifying change; forces Decision 5's `(year, month)` arithmetic.
- 1 March 2026 is a Sunday (`getDay() === 0`). AC-6's column assertion.

Two structural facts read from the repo: `ExpenseEditSheet` and the History filter both `createPortal` into a `fixed inset-0 z-[60]` wrapper whose own `onClick` is `onClose` (`ExpenseEditSheet.tsx:118-119`, `history/page.tsx:184-185`) — hence AC-3. And `test:compile` compiles four page files not including `reports/page.tsx`, so `.test-build-ui/` has no `reports/` output — flagged inside AC-21 as a build note rather than left for the builder to trip over.

### Summary

The spec is written against what the code actually does, and the survey changed the design twice. Home turned out to have no date input to replace — only a non-interactive label — so the build must add a tap affordance rather than swap a control. And "the date field on Reports" turned out to be the shared `ExpenseEditSheet`, already mounted from both History and the Reports drill-down, so entity 040's earlier deduplication means two of the three named screens are covered by one swap.

One decision is left open for the gate rather than settled unilaterally: Reports' monthly and annual navigation select a *period*, not a date, so the day-grid picker does not fit them and the spec puts them out of scope. That is defensible but it is narrower than the ideation's wording implies, so the captain should confirm it — the alternative is a follow-up entity adding a month-only mode of the same component.

Subscriptions is excluded on evidence, not preference: entity 053's shipped suite drives both of its date inputs through `setValue()` on the native input at twelve call sites, so converting them would break seven just-verified tests for a screen the ideation never named.
