---
id: 068
title: Add a Month Picker to Reports
status: spec
source: captain
started: 2026-09-11T07:54:16Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:068:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:068-ideation-1
              briefing:
                id: briefing:068:ideation:attempt-1:revision-1
                digest: sha256:90ca23ac973e7d0b11350a5eb7f1f1eef5c3a6ef9bc0a1385423846e7d9830b4
                room-ref: ./review/ideation/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:068:ideation:1
                briefing: briefing:068:ideation:attempt-1:revision-1
                by: person:captain
                at: "2026-09-11T07:53:10.661918Z"
                decision: approve
              application:
                target-stage: spec
                state: consumed
---

Reports currently requires stepping month by month (Annual/Monthly navigation) to reach a specific month. The captain wants to jump straight to any month, using a picker UI similar to the day picker already used elsewhere in the app (`app/app/components/DatePickerModal.tsx`, used on Home, History, Subscriptions, and the expense-edit sheet).

## User Stories

- As the captain, I want a month picker on Reports so I can jump directly to any month, instead of stepping through months one at a time.
- As the captain, I want that picker to look and feel like the day picker I already use elsewhere in the app (Home/History), so it's familiar rather than a new pattern to learn.

## Success

- Reports has a visible month-picker control that opens a UI matching `DatePickerModal`'s look and interaction, adapted for picking a month (and year) rather than a specific day.
- Selecting a month in the picker navigates Reports straight to that month, replacing (or supplementing — spec to decide) today's one-step-at-a-time navigation.

### Out of Scope

- Any change to `DatePickerModal`'s existing day-picking behavior on Home/History/Subscriptions/expense-edit.
- Any change to what Reports displays for a given month once selected.
- A picker for the Annual view (this is about Monthly navigation specifically) — confirm at spec time whether Annual needs anything analogous.

## Plan

`DatePickerModal.tsx` was read directly (not assumed from its name) — see Design Decisions below for what it actually is. Resolved open questions:

- **DatePickerModal's actual shape**: a `createPortal`-based modal (`app/app/components/DatePickerModal.tsx:107-238`) with a title bar (prev/next chevrons stepping by month + a title button that toggles between a `days` grid and a `years` list) and a day-grid body. Not a scrollable wheel, not a native input.
- **Reports' existing Monthly state**: `year` and `month` are already plain numbers in component state (`app/app/reports/page.tsx:400-401`), not an ISO string — a picker can set them directly with no new state, routing, or date-string parsing.
- **Year jumping**: yes — the picker exposes the same tap-title year-list DatePickerModal already has (local current year −20/+5), since Reports' data spans multiple years.
- **Component shape**: a new sibling `MonthPickerModal.tsx`, not a mode prop on `DatePickerModal` — see Design Decisions below for why.

## Spec

### Goal

Reports' Monthly view gets a tappable month/year control — visually and behaviorally matching `DatePickerModal` — so the captain can jump straight to any month instead of stepping through one at a time.

### Design Decisions

**DatePickerModal, characterized directly (`app/app/components/DatePickerModal.tsx`).** It is a `fixed inset-0` portal to `document.body` (`:107-121`) holding one `w-full max-w-xs` card (`:122`) with:
- A title bar (`:124-166`): a prev chevron that steps the visible month back one (`stepMonth(-1)`, arithmetic on the `{year, month}` pair, never `setMonth` on a `Date` — `:82-89`, the comment there explains why), a title button showing the month+year label that toggles `view` between `"days"` and `"years"` (`:139-143`), a next chevron, and a close `X`.
- The `days` view (`:168-211`): a 7-column weekday header plus a day grid, leading blank cells for the month's first weekday, `aria-selected` on the picked day, a ring marker on today.
- The `years` view (`:213-234`): a 4-column grid spanning local-current-year −20 to +5 (`YEARS_BACK`/`YEARS_FORWARD`, `:12-13`), tapping a year sets the cursor year and returns to `days` without picking or closing (`:221-224`).
- Escape (`:72-78`), a backdrop click, and the close button all call `onClose` only. A day tap calls `onPick(iso)` then `onClose` (`:91-94`). The backdrop handler's `e.stopPropagation()` (`:118`) is what keeps a click inside the picker from also closing a host sheet it was opened from — confirmed by `app/test/date-picker.render.test.js`'s "AC-3: the picker stops its own clicks reaching an UNGUARDED host wrapper" test.
- Its interface is narrow: `{ value: string /* YYYY-MM-DD or "" */; onPick: (iso: string) => void; onClose: () => void }` (`:18-23`).

**New sibling component, not a mode prop.** `DatePickerModal` backs four live entry points (Home, History ×2, expense-edit) and is pinned by a 26-AC, 848-line suite (`app/test/date-picker.render.test.js`) that asserts exact grid geometry, stepping arithmetic, and timezone behavior. Reports needs a different unit entirely — a 12-month grid with year-stepping, not a day grid with month-stepping — and growing `DatePickerModal`'s props/branches to cover both raises the blast radius on four already-shipped, already-tested screens for one new screen's sake. Building `app/app/components/MonthPickerModal.tsx` as a sibling keeps this entity's diff to a new file plus a small Reports change, and makes the Out-of-Scope guarantee below ("no change to DatePickerModal's existing day-picking behavior") mechanical rather than a promise about behavior of shared code.

**MonthPickerModal's shape**, reusing DatePickerModal's proven chrome and mechanisms directly:
- Props: `{ year: number; month: number; onPick: (year: number, month: number) => void; onClose: () => void }`. Plain numbers, matching Reports' own state shape (`page.tsx:400-401`) — inventing a `"YYYY-MM"` string boundary would add a parse/format step with no other consumer.
- Same overlay, same `createPortal` to `document.body`, same backdrop `stopPropagation` guard, same card shell.
- Title bar: prev/next chevrons step the visible **year** by exactly one (the one-level-up analogue of DatePickerModal's month-stepping — there is no smaller unit to step within a 12-month grid); the title shows just the year and, tapped, opens the same `years` list (same range, same selection flow) as DatePickerModal, reusing its `picker.select_year` label since the interaction is identical.
- Body (default view): a 12-cell month grid, one button per month, labelled via `toLocaleDateString(lang, { month: "short" })` (localized, same `zh-TW`/`en-US` split DatePickerModal uses at `:44-46`) — never the hardcoded English `MONTH_SHORT` array already in `reports/page.tsx:32-35`, which only exists as this-file-local display strings today and is not itself localized.
- The cell matching the passed-in `{year, month}` gets the selected (`bg-primary`) treatment; the cell matching the real current year/month (if in view) gets DatePickerModal's "today" ring treatment.
- Tapping a month cell calls `onPick(cursorYear, month)` then `onClose`. Escape, backdrop, and close button all call `onClose` only — identical dismiss semantics to DatePickerModal.
- `data-testid`s use a `month-picker` prefix, distinct from DatePickerModal's (`month-picker`, `month-picker-title`, `month-picker-prev`, `month-picker-next`, `month-picker-close`, `month-cell-{year}-{month}`, `month-picker-year-view`, `month-picker-year-{year}`) so the two components' DOM never collides.

**Reports integration.** The Monthly-view navigation row (`page.tsx:550-560`) currently renders the period label as a non-interactive `<span>`. It becomes a `<button data-testid="reports-month-button">` with the same visible text, no new aria-label (matching Home's identical `home-date-button` pattern at `page.tsx:222-229`, which also carries no aria-label beyond its visible text). Tapping it opens `MonthPickerModal` at the current `year`/`month`; picking calls `setYear`/`setMonth` directly. **Supplementing, not replacing**: the existing prev/next chevrons stay, exactly as Home kept its ±1-day chevrons alongside its own picker trigger — one-step browsing is still the common case, and removing it would be a regression.

**Annual view: no analogous control.** Out of Scope already excludes it; the reason is that Annual's pain point (stepping year by year) is already a single tap per step, unlike Monthly's twelve-taps-to-reach-December problem the ideation is solving. Nothing changes in the annual navigation row (`page.tsx:719-728`).

**New locale keys.** `picker.previous_year` and `picker.next_year` (chevron aria-labels — the existing `picker.previous_month`/`next_month` describe the wrong unit here). Everything else reuses existing keys (`picker.select_year`, `picker.close`).

### User Stories

- As the captain, I want a month picker on Reports so I can jump directly to any month, instead of stepping through months one at a time.
- As the captain, I want that picker to look and feel like the day picker I already use elsewhere in the app, so it's familiar rather than a new pattern to learn.
- As the captain, I want to still be able to step one month at a time with the existing arrows, so quick adjacent-month browsing isn't lost.

### Edge Cases

- **The picked month has no data.** `MonthPickerModal` does no fetching; Reports' existing `no_data_period`/`try_different_month` empty state (`page.tsx:562-566`) handles this exactly as it does today for a chevron-reached month.
- **Picking the month already on screen.** `setYear`/`setMonth` to identical values is a no-op re-render; the data-loading `useEffect` is keyed on `[period, year, month, payer, dataVersion]` (`page.tsx:437-446`), so no new fetch fires and no loading flash appears.
- **Rapid navigation before picking.** Stepping the year or opening the year-list is pure client state with no fetch, mirroring DatePickerModal's AC-4/AC-8 — N taps before a pick issues zero requests.
- **Switching to Annual while the picker is open.** `MonthPickerModal` only renders while Reports renders it in the Monthly branch; if `period` flips to `"annual"` the component (and its portal) unmounts with its host, the same lifecycle all four existing DatePickerModal sites already rely on.
- **Locale switch mid-session.** Month labels re-render in the new language via `toLocaleDateString`, the same mechanism DatePickerModal's AC-24 already pins.
- **Two users viewing Reports at once / offline.** Not applicable — this is read-only client-side navigation state with no write and no server round trip of its own.

### Out of Scope

- Any change to `DatePickerModal`'s existing day-picking behavior on Home/History/Subscriptions/expense-edit — enforced by building a sibling component rather than modifying it (AC-10).
- Any change to what Reports displays for a given month once selected.
- A picker for the Annual view — Annual's existing single-tap year stepping already solves the multi-step problem this entity targets for Monthly; confirmed no analogous control is added (AC-8).
- Range selection, "jump to today" shortcuts, or any interaction beyond picking one month+year.
- Any change to `reportService.ts`, the report API, or backend data — this is a client-side navigation UI change only.

## Acceptance criteria

Each AC names a property of the finished feature and how it is verified. Offline ACs run in the repo's existing jsdom harness (`node --test`, `app/test/helpers/dom.js`), the pattern `app/test/date-picker.render.test.js` established, in a new `app/test/month-picker.render.test.js` added to the explicit file list in `app/package.json`'s `test` script (no `test:compile` change needed — `tsc` already follows imports transitively into `.test-build-ui/`, the same reason `DatePickerModal.js` is emitted today without being named directly on that command line).

**AC-1 — `MonthPickerModal` renders a 12-cell month grid scoped to the given year, inside DatePickerModal's chrome.**
Verified by: offline — mount standalone with `year=2026`; assert `[data-testid="month-picker"]` root exists, cells `month-cell-2026-01` through `month-cell-2026-12` all exist and no 13th. Falsified by: a grid with any count other than 12, or a cell for a year other than the one passed in.

**AC-2 — Selecting a month fires `onPick` exactly once with that year and month as numbers, then closes.**
Verified by: offline — tap `month-cell-2026-07` → `onPick` called once with `(2026, 7)`; `[data-testid="month-picker"]` is gone afterward. Falsified by: `onPick` receiving a string/Date instead of two numbers, firing more than once, or the picker staying open.

**AC-3 — Opening with a given year/month highlights exactly that cell as selected.**
Verified by: offline — mount with `year=2026, month=3` → `month-cell-2026-03` carries `aria-selected="true"` and it is the only cell that does. Falsified by: zero, or more than one, selected cell.

**AC-4 — The prev/next controls step the visible year by exactly one, with the grid always showing all 12 months of the new year.**
Verified by: offline — open at year 2026, tap next → title reads "2027" and cells are `month-cell-2027-01`..`2027-12`; tap prev twice → title "2025". Falsified by: a step of anything other than exactly one year, or stale cells left from the prior year.

**AC-5 — Tapping the title opens a year list (local current year −20 to +5, 26 entries, visible year marked selected); picking a year returns to the month grid for that year without picking a month or closing.**
Verified by: offline — same range/selection-flow assertions as DatePickerModal's pinned AC-10/AC-11, run against `month-picker-year-*` testids. Falsified by: wrong range, wrong/no selected marker, or a year pick firing `onPick`/`onClose`.

**AC-6 — Dismissing without picking (backdrop tap, close button, Escape) never calls `onPick`, and the caller's `year`/`month` props are unchanged afterward.**
Verified by: offline — all three dismissal routes, each asserting zero `onPick` calls. Falsified by: any dismissal route triggering `onPick`.

**AC-7 — Reports' Monthly view exposes a real `<button>` (not a `<span>`) showing the current month label; tapping it opens `MonthPickerModal` at the currently viewed year/month, and picking a month updates Reports' displayed period directly, while the existing prev/next chevrons remain present and still step ±1 month from the newly picked month.**
Verified by: offline — mount Reports via `.test-build-ui/reports/page.js`, assert the month label is a `<button>`; click it, pick a different month, assert the on-screen period label updates to the picked month/year; click the next-month chevron afterward and assert it now shows one month past the pick (not the original month). Falsified by: the label staying non-interactive, the pick not updating the displayed period, or the chevrons stepping from the wrong baseline after a pick.

**AC-8 — The Annual view is unchanged: no month-picker-triggering control appears in its navigation row, and its existing prev/next-year stepping still works.**
Verified by: offline — mount Reports in Annual view; assert no control opens `[data-testid="month-picker"]` from that view, and the existing year chevrons still step by exactly one year. Falsified by: a new control present on Annual, or a regression in annual year-stepping.

**AC-9 — Every new user-facing string (`picker.previous_year`, `picker.next_year`) has a key in both `app/public/locales/en/common.json` and `.../zh/common.json`, with zh genuinely translated rather than copied.**
Verified by: offline — same key-presence and non-identity assertions as DatePickerModal's pinned AC-25, run against the two new keys. Falsified by: a missing key in either locale, or an identical en/zh string.

**AC-10 — `DatePickerModal.tsx` is unmodified by this entity, and its existing pinned suite still passes unchanged.**
Verified by: offline — `git diff` against the pre-entity commit shows zero changed lines in `app/app/components/DatePickerModal.tsx`; `node --test test/date-picker.render.test.js` exits 0. Falsified by: any line changed in that file, or any of its 26 ACs failing.

**AC-11 — `npm test` passes from a clean run, with the new render test added to the explicit file list in `app/package.json`'s `test` script.**
Verified by: offline — `npm test` exit code 0; `package.json`'s `test` script string contains `month-picker.render.test.js`. Falsified by: a non-zero exit, or the new file missing from the explicit list (silently not run).

**AC-12 — On staging, the month picker visually reads as "the same picker" as the day picker the captain already uses — matching chrome, spacing, and interaction feel.**
Verified by: interactive — captain or live-drive judgment on the deployed staging build, opening both pickers side by side in the session. Falsified by: the captain reporting it looks or feels like a different, unfamiliar pattern.

**AC-13 — Picking a month/year reachable only via the year-list (e.g. 3+ years back) correctly loads and displays that period's real data on staging, including the correct empty state if that period has none.**
Verified by: interactive — live drive: open the picker, tap the title, pick a year several years back, pick a month, observe Reports render that month's real totals or the empty state. Falsified by: stale data, a loading hang, or the wrong period's numbers on screen.

## Risk evidence

No spike needed: the design reuses DatePickerModal's already-proven mechanisms end to end — local-calendar-part construction (never `setMonth`/`toISOString` on a `Date`), the portal + `stopPropagation` stacking guard, the year-list range/selection flow, and the Escape/backdrop/close dismiss handling — all read directly from `app/app/components/DatePickerModal.tsx` (characterized above, not assumed from its name) and confirmed exercised end-to-end by its existing 26-AC suite (`app/test/date-picker.render.test.js`). The one genuinely new mechanism — stepping a bare year with no month component — is a strict subset of arithmetic DatePickerModal's own year-view already performs (`years` array construction and `setCursor(c => ({...c, year}))`, `DatePickerModal.tsx:96-100, 221-224`), so it inherits proof rather than introducing a new unverified path.

### Feedback Cycles

## Stage Report: spec

- DONE: Spec follows the Spec Template: goal, user stories, edge cases, and an explicit Out of Scope section.
  `## Spec` section added with `### Goal`, `### Design Decisions`, `### User Stories`, `### Edge Cases`, `### Out of Scope` (index.md:64-131).
- DONE: Top-level `## Acceptance criteria` section with independently-testable, binary criteria, each split offline vs interactive.
  13 ACs added (index.md:133-160): AC-1 through AC-11 offline (jsdom render-test harness), AC-12/AC-13 interactive (staging live drive), each with a `Verified by:` and `Falsified by:` clause.
- DONE: DatePickerModal's actual UI/interaction is read and characterized directly before the month-variant design is finalized.
  Read `app/app/components/DatePickerModal.tsx` in full (239 lines) plus its usage sites (Home, History ×2, ExpenseEditSheet) and its pinned 848-line test suite (`app/test/date-picker.render.test.js`); characterization written into `### Design Decisions` (index.md:70-76) with exact line citations, ahead of the `MonthPickerModal` design that follows it.

### Summary

Spec resolves all four open questions from ideation: `MonthPickerModal` is a new sibling component (not a `DatePickerModal` mode prop, to protect its four-site pinned suite), reuses year/month as plain numbers matching Reports' existing state, exposes the same tap-title year-list DatePickerModal already has, and the Monthly trigger button supplements (does not replace) the existing chevrons — Annual gets no analogous control, closing that ideation question explicitly. Design decisions are grounded in direct reads of `DatePickerModal.tsx`, `reports/page.tsx`, and both locale files rather than assumption.
