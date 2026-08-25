---
id: 057
title: Use Shared Calendar Date Picker on Subscriptions
status: build
source: captain
started:
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-057-subscriptions-date-picker
issue:
pr:
---

Entity 046 built one shared calendar-style date picker (`app/app/components/DatePickerModal.tsx`) and swapped it into Home, the expense edit sheet, and History's custom date range. It deliberately left Subscriptions' two date fields (Add's Start Date, Cancel's end-date prompt) on the native `<input type="date">`, because entity 053's shipped test suite drives both fields directly through `setValue()` on the native input at twelve call sites — swapping the control would break that suite, and 046 was scoped to the four fields it could change without touching a different, already-verified entity's tests.

Captain wants the same calendar picker on Subscriptions too, for a consistent experience across the whole app.

## User Stories

- As the captain, I want tapping a date on Subscriptions to open the same calendar I now get everywhere else, so the app feels consistent.

## Success

- Subscriptions' Add-form Start Date and the Cancel-confirmation end-date both open `DatePickerModal` on tap, matching the other four entry points' behavior exactly (month grid, left/right stepping, year-jump view).
- Entity 053's test suite is updated to match the new control, not bypassed or deleted — same coverage, driven through the picker instead of the native input.

### Out of Scope

- Any change to entity 053's actual date logic (start/end validation, the archive-prompt flow, what gets written to the sheet) — this is purely swapping the input control, same as entity 046 was for its four fields.
- Any change to `DatePickerModal` itself — reuse as-is unless the build finds a genuine gap.

## Plan

Same shape as entity 046: identify the exact two call sites (`app/app/subscriptions/page.tsx`, Add form's Start Date and Cancel modal's end-date field), swap each to the shared component, and update entity 053's `app/test/subscription-dates.render.test.js` to drive the picker (open modal, pick a day) instead of `setValue()` on a native input — the same test intent, different interaction path.

## Spec

### Goal

Replace the two remaining `<input type="date">` controls on Subscriptions with the shared `DatePickerModal` entity 046 built, so every day-granularity date in the app is picked from the same calendar — without weakening entity 053's shipped test suite or touching its date logic.

### Current State

Traced against the live files, not against the numbers the ideation inherited from entity 046's spec table. **Both of those numbers are stale**, and one of them was wrong when it was written.

| # | Field | Current location | Control | Value | Pre-fill |
|---|---|---|---|---|---|
| 1 | Add form — Start Date | `app/app/subscriptions/page.tsx:547-556`; input at `:549-555` | `<input type="date" data-testid="add-start-date" class="input input-bordered w-full">` | `addForm.start_date`, `onChange` at `:554` | `openAdd` sets `start_date: todayLocalIso()` (`:151`). The `defaultAddForm` literal (`:61`) is `""` but is never the value the captain sees. |
| 2 | Cancel confirmation — end date | `:660-677`; input at `:662-671` | `<input type="date" data-testid="cancel-end-date" class="input input-bordered w-full">` | `cancelDate`, `onChange` at `:667-670` sets the date **and** clears `cancelInvalid` | `openCancel` sets `setCancelDate(todayLocalIso())` (`:241`) |

The ideation cites `:515-521` and `:626-635`. Those were correct when entity 046 wrote them; the file has since grown and they now point at the frequency toggle and the edit modal's due-day field. Current truth, binary and re-checkable: `grep -rn 'type="date"' app/app/` returns **exactly two hits, `:550` and `:663`** — both rows above.

**The test suite drives them at 11 call sites, not twelve.** `subscription-dates.render.test.js` holds 26 tests (all green; full-suite baseline is **142/142**). Its `setValue` helper (`:31-36`) grabs `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set`, calls it, and dispatches a bubbling `input` event — the mechanism the ideation describes, confirmed. There are **13** `setValue` calls in the file; **11** target the two date fields (9 end-date at `:157, :173, :212, :229, :244, :257, :261, :364, :475`; 2 start-date at `:303, :316`), and the remaining 2 (`:314` name, `:315` amount) are ordinary text/number inputs the swap does not touch. The "twelve" figure comes from entity 046's Decision 3 and is wrong on either reading — the same class of error as 046's "all seven of `subscription-dates.render.test.js`", which its own verify stage corrected to 26.

**Only 8 assertions in 3 tests actually break.** Everything else in the file asserts on request bodies that leave the page, card lines, section membership, the validation message, or translation keys — all control-agnostic and all expected to survive byte-identical.

| Test | Line | Assertion | Why it breaks |
|---|---|---|---|
| AC-8 pre-fill | `:144` | `.value === "2026-08-19"` | a `<button>`'s `.value` is `""` |
| AC-8 pre-fill | `:145` | `.type === "date"` | becomes `"button"` |
| AC-8 pre-fill | `:146` | `.disabled === false` | still passes, but stops meaning anything |
| AC-8 pre-fill | `:147` | `.readOnly === false` | `HTMLButtonElement` has no `readOnly` → `undefined`, hard fail |
| AC-8 editable | `:159` | `.value === "2026-07-01"` | as above |
| AC-13 | `:299` | `input.type === "date"` | as above |
| AC-13 | `:301` | `input.value === "2026-08-19"` | as above |
| AC-13 | `:304` | `input.value === "2025-11-30"` | as above |

**Portal scoping is the one mechanical trap.** `mount()` (`test/helpers/dom.js:231-241`) appends the container to `document.body`; the picker portals to `document.body` too, as a **sibling** of that container. `container.querySelector` therefore cannot see the picker — picker queries must run against `global.document`, exactly the `$`/`$$` helpers `date-picker.render.test.js:70-71` already documents. This is safe for isolation because `installGlobals` calls `installDom()` on every invocation (`:102`), so each test gets a fresh JSDOM.

**No i18next stub is needed** — measured, not assumed. `date-picker.render.test.js` stubs `react-i18next` because it flips languages for its own AC-24. Mounting the compiled picker under `subscription-dates`' harness with no stub: `useTranslation()` returns `{t: k => k, i18n: {}}`, `i18n.language` is `undefined`, the picker falls through to `en-US` and renders correctly — title `"March 2026"`, `weekday-0` `"Sun"`, `day-2026-03-07` present, aria-labels echoing their keys. The build should add no stub.

### The one genuine gap: the picker will render *underneath* the Subscriptions modal

The ideation asks whether the Cancel modal needs the stacking and propagation handling entity 046 built. The two halves have opposite answers.

**Propagation: already handled, nothing to do.** Subscriptions' modals put `onClick` only on the sibling `.modal-backdrop` div (`:568, :650, :687`); neither the `.modal` wrapper nor `.modal-box` carries one. A portal click bubbling up the React tree reaches no closing handler, and the picker's own `e.stopPropagation()` (`DatePickerModal.tsx:118`) guards it regardless. Entity 046's build report (`:263-267`) already found its hosts were self-defending and the spec's propagation premise half wrong; Subscriptions is the same story for a different reason.

**Stacking: genuinely broken, and it is not a judgment call.**

- Entity 046's two modal hosts are hand-rolled portals at `fixed inset-0 z-[60]` (`ExpenseEditSheet.tsx:121`, `history/page.tsx:187`). The picker is `z-[70]` (`DatePickerModal.tsx:110`). 70 > 60, so it paints above. That is why 046 worked.
- Subscriptions' three modals are daisyUI's, `className="modal modal-open"` (`:465, :574, :656`). daisyUI 5.5.18 defines `.modal { position: fixed; z-index: 999 }` (`app/node_modules/daisyui/daisyui.css`). The `.modal-open` variant alters visibility, opacity and pointer-events — **not** z-index. `globals.css` loads daisyUI as a plugin and overrides nothing.
- The picker portals to `document.body`, a sibling of the `.modal` element. Neither `<body>`, nor the `pb-16` wrapper (`layout.tsx`), nor `<main>` (`:316`) establishes a stacking context, so both elements compete in the root one: **70 against 999. The calendar loses and paints behind the modal, with the modal's own backdrop over it.**

This is the "genuine gap" the ideation's Out of Scope clause anticipated, so the spec flags it rather than letting the build silently expand scope. **The minimal fix is in scope: raise `DatePickerModal`'s overlay z-index above 999.** It is a one-token change, it is the only place it can be fixed (the class is baked into the portalled overlay, so no host can override it from outside), and it stays correct for the existing four fields, which only need it above 60. No other change to `DatePickerModal` is authorised.

jsdom computes no layout, so no render test can prove this. AC-11 pins it as a static assertion on the emitted class and the daisyUI constant; AC-12 sends it to a human on staging. Entity 046's verify stage flagged this exact limit (`:306`) — this entity is the case where the untested assumption turns out to bite.

### User Stories

- As the captain, I want tapping the Start Date when adding a subscription to open the same calendar I get on Home and History, so the app behaves one way everywhere.
- As the captain, I want tapping the end date when cancelling a subscription to open that calendar too, so recording when something actually ended is a couple of taps rather than typing into a native field.
- As the captain, I want the calendar to open *on top of* the dialog that summoned it, so it is usable at all.
- As the captain, I want everything entity 053 gave me — the local-Taipei pre-fill, the end-before-start guard, the archive flow — to keep working exactly as it does today.

### Acceptance Criteria

Tests run in the existing harness (`node --test`, `app/test/helpers/dom.js`) under `process.env.TZ = "Asia/Taipei"` with `mock.timers` wherever a clock is named. Picker elements are queried against `global.document`, never `container` (see Current State).

**The swap**

- [ ] AC-1 — `grep -rn 'type="date"' app/app/` returns **zero** hits. Binary, directly checkable, and the mirror of entity 046's AC-26.
- [ ] AC-2 — The Add form's Start Date is a `<button type="button" data-testid="add-start-date">` that opens the picker at `addForm.start_date`. Test: open the Add modal under a clock of `2026-08-18T16:30:00Z`, click it → `[data-testid="date-picker"]` is in `document`, and `[data-testid="day-2026-08-19"]` carries `aria-selected="true"`.
- [ ] AC-3 — The Cancel confirmation's end date is a `<button type="button" data-testid="cancel-end-date">` that opens the picker at `cancelDate`. Test: open Cancel for Netflix under the same clock, click it → the picker is open with `day-2026-08-19` selected.
- [ ] AC-4 — Both buttons display the raw ISO date, and `t("picker.choose_date")` when the value is `""` — the History filter's convention (`history/page.tsx:249, :260`), not the edit sheet's `formatFullDate` prose. Test: with the pre-fill in place, each button's `textContent.trim()` is exactly `"2026-08-19"`; rendered with `value=""`, it is `"picker.choose_date"`. (Rationale: the Subscriptions cards already show raw ISO — `subscription-dates.render.test.js:396, :430` — so prose on the trigger would disagree with the card directly beneath it.)
- [ ] AC-5 — Picking a day writes only that field's state. Test: in the Add modal, pick `2025-11-30` → the button reads `2025-11-30`, the picker is gone from `document`, and the modal is still open with name/amount/frequency/due-day untouched.

**Entity 053's guarantees, end to end and unweakened**

- [ ] AC-6 — All 26 tests in `subscription-dates.render.test.js` still exist and pass. No test is deleted, `.skip`ped, merged into another, or reduced to a weaker claim. Test-count check: `grep -c '^test(' app/test/subscription-dates.render.test.js` is **≥ 26**. Only the 8 assertions tabulated in Current State may change, and each must be replaced by the equivalent claim against the new control — `.value`/`.type` becomes `textContent`, `.readOnly === false` becomes "clicking it opens the picker", i.e. the editability claim is *kept*, not dropped.
- [ ] AC-7 — The local-Taipei pre-fill still holds through the picker. Test: at `2026-08-18T16:30:00Z` (00:30 on the 19th, Taipei) both trigger buttons read `2026-08-19` and the picker opens on August 2026 with `day-2026-08-19` marked today. Fails on any `toISOString()` re-derivation, which yields the 18th (measured in 053 and 046).
- [ ] AC-8 — The end-before-start guard is unchanged and still fires from a picked date. Test: Cancel Netflix (fixture `start_date` `2026-03-01`), pick `2026-02-28` via the picker, confirm → `[data-testid="cancel-end-date-error"]` is present, `subWrites` is empty, the modal stayed open, the card is still Active. Then pick `2026-04-01` → the error clears **on pick** (the `onChange` at `:667-670` cleared `cancelInvalid`; the picker's `onPick` must do the same), and confirming sends one PATCH with `end_date: "2026-04-01"`.
- [ ] AC-9 — Equal-to-start is still accepted and a missing start date still blocks nothing. Test: pick `2026-03-01` for Netflix → one PATCH, no error. Pick `2020-01-01` for Spotify (`start_date: ""`) → one PATCH, no error.
- [ ] AC-10 — Creating and archiving still carry the picked date to the API. Test: Add with the start date picked as `2025-11-30` → one POST with `start_date: "2025-11-30"` and `end_date: ""`. Cancel Netflix with `2026-07-01` picked → one PATCH with `end_date: "2026-07-01"`, `is_active: false`, the card moves to Cancelled, and its start-date line still reads `2026-03-01`.

**Stacking**

- [ ] AC-11 — `DatePickerModal`'s overlay carries a z-index strictly greater than daisyUI's `.modal`. Test: assert the rendered `[data-testid="date-picker"]` root's `className` contains a `z-[N]` token with `N > 999`, and — so the check cannot rot silently — assert that `.modal{...}` in `app/node_modules/daisyui/daisyui.css` still declares `z-index:999`. Fails today at `z-[70]`.
- [ ] AC-12 — Manual, at verify: on staging, open Add and tap Start Date, then open Cancel and tap the end date. The calendar is visible and tappable above the dialog in both. This is the layout claim jsdom structurally cannot make; entity 046's verify stage flagged it as the picker's one untested assumption, and this entity is where it fails.

**Regression**

- [ ] AC-13 — `npm test` passes from a clean install, at **≥ 142** tests with **zero** failures. The pre-existing 142 all still pass; in particular `date-picker.render.test.js`'s coverage of the original four fields is untouched, since AC-11 raises the picker above `z-[60]` as well as above `999`.
- [ ] AC-14 — `git diff main...HEAD` shows changes confined to `app/app/subscriptions/page.tsx`, `app/app/components/DatePickerModal.tsx` (the single z-index token only — no other line), and `app/test/subscription-dates.render.test.js`. Any other file in the diff is scope bleed and must be justified at the gate.
- [ ] AC-15 — No new user-facing string is introduced. The picker's `picker.*` keys and Subscriptions' `start_date_label` / `end_date_label` already exist in both `en` and `zh` common.json (verified). Test: `subscription-dates.render.test.js`'s existing AC-25 test — identical `subscriptions` key sets across locales — still passes untouched.

### Edge Cases

- **The picker inside a daisyUI modal.** The whole point of AC-11/AC-12. `z-[70]` against `z-index: 999` means the calendar paints behind the dialog that opened it. Not a judgment call — a CSS fact, and the reason `DatePickerModal` gets its one authorised edit.
- **Closing the picker must not close the modal underneath it.** Backdrop tap, close button, and Escape must return the captain to the Add or Cancel dialog with its other fields intact. Safe by construction — Subscriptions' modals hang `onClick` on the sibling `.modal-backdrop` only, and the picker stops its own clicks (`:118`) — but assert it rather than assume it, because 046's build found the analogous end-to-end test was a tautology.
- **Escape with both open.** `DatePickerModal` binds a `document`-level Escape listener (`:72-78`). Subscriptions' modals bind none, so one Escape closes the picker and leaves the dialog open. Correct behaviour; worth a test so a later modal-level Escape handler cannot silently start closing both at once.
- **The pre-fill must survive exactly.** Both fields open pre-filled with `todayLocalIso()` (`:151`, `:241`), and entity 053 exists because that date was once derived in UTC and filed a 1am expense under yesterday. The picker takes `value` and gives back `onPick(iso)`; neither may re-derive today. Pinned by AC-7.
- **An empty value is unreachable through the UI but must still render.** Both fields are always pre-filled on open, so `""` never appears in practice. The button must still fall back to `t("picker.choose_date")` (AC-4) rather than rendering an empty tap target, since a future caller could open the modal without pre-filling.
- **Clearing the validation error.** Today the error clears in the input's `onChange` (`:669`). After the swap there is no `onChange` — `onPick` is the only path, and it must carry the `setCancelInvalid(false)` with it. Dropping it leaves a stale red error under a corrected date. Pinned by AC-8's second half.
- **Year-jump range.** `DatePickerModal` offers local current year −20 / +5 (`:12-13`), i.e. 2006–2031 today. Checked specifically for subscription dates: start dates run backwards (the oldest fixture is `2025-01-15`) and end dates cluster on today or slightly before, so both sit well inside the window. **No adjustment needed** — and adjusting it would be an unauthorised change to a shared component affecting the other four fields.
- **Two people at once / offline.** Not applicable to the picker, which performs no I/O. Whatever Subscriptions already does on a failed write is untouched — the existing "a failed archive keeps the modal open" test (`:273`) covers it and must keep passing.

### Out of Scope

- **Entity 053's date logic.** `endsBeforeStart`, the archive-prompt flow, what gets written to the sheet, the card start/end-date lines, and the local-date derivation in `app/app/lib/subscriptions.ts` all stay exactly as they are. This is a control swap.
- **`DatePickerModal`'s behaviour.** One authorised edit — the overlay's z-index token (AC-11) — and nothing else. The month grid, stepping, year view, date derivation, Escape handling, and portal target are entity 046's, verified, and stay untouched. Any further gap the build finds is flagged at the gate, not fixed in passing.
- **The Edit modal.** It has no date field at all (`:573-652`) — only name, amount, category, due month/day. Adding one is a separate ask.
- **Reports' month and year navigation.** Period selectors, not date fields — entity 046's Decision 2, still standing.
- **Weakening or deleting any of entity 053's 26 tests** to make the swap easier. AC-6 exists to make that a gate failure rather than a convenience.

## Stage Report: spec

- DONE: Write the formal spec using the Spec Template (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope) from the ideation body already in workflow/057-subscriptions-date-picker.md
  All five template sections present, plus a Current State trace table and a stacking-gap section — the shape entity 046's spec established.
- DONE: Trace the exact current state of both date fields before writing ACs … confirm exact current line numbers and control shape against the live file, not the numbers cited in the ideation
  **Both ideation line numbers are stale.** Start Date is `:547-556` (input `:549-555`), not `:515-521`; the Cancel end date is `:660-677` (input `:662-671`), not `:626-635`. Testids and control shape are as described. Re-checkable: `grep -rn 'type="date"' app/app/` → exactly 2 hits, `:550` and `:663`.
- DONE: Trace exactly how entity 053's test suite currently drives these two fields — the ideation says setValue() on HTMLInputElement.prototype at twelve call sites; confirm this exact count and mechanism
  Mechanism confirmed verbatim (`:31-36`). **Count is wrong: 11, not 12** — 9 end-date (`:157, :173, :212, :229, :244, :257, :261, :364, :475`) and 2 start-date (`:303, :316`). The file has 13 `setValue` calls total; the other 2 drive name and amount. The figure was inherited from 046's Decision 3, which also mis-stated the file's test count as 7 (it is 26).
- DONE: Acceptance criteria must be binary/independently testable, covering [the swap, the updated 053 suite, and 053's original ACs still holding end to end]
  15 ACs, each naming its own falsifying test. AC-1 is a grep returning zero. AC-6 pins the suite at ≥26 tests with an explicit no-delete/no-skip/no-weaken clause and a table of the only 8 assertions permitted to change. AC-7 through AC-10 re-assert 053's pre-fill, end-before-start guard, equal-date and missing-start cases, and both request bodies, end to end through the picker.
- DONE: Edge cases: [the Cancel modal is itself a modal — z-index/stacking and stopPropagation; the Start Date pre-fill; the year-jump range]
  The two halves split. **Propagation: nothing to do** — Subscriptions hangs `onClick` on the sibling `.modal-backdrop` only (`:568, :650, :687`), and the picker already stops its own clicks. **Stacking: genuinely broken** — see below. Pre-fill traced to `openAdd` (`:151`) and `openCancel` (`:241`), both `todayLocalIso()`, pinned by AC-7. Year range −20/+5 checked against real subscription dates (oldest fixture `2025-01-15`) — sensible, no adjustment, and adjusting it would hit the other four fields.
- DONE: Confirm scope boundary: no change to DatePickerModal itself … and no change to entity 053's actual date logic/validation/archive-prompt flow
  Held, with **one flagged exception** rather than a silent expansion. AC-14 confines the diff to three files; AC-11 authorises exactly one token in `DatePickerModal`.

### The gap worth the captain's attention

The picker would render **underneath** both Subscriptions modals. 046's hosts are hand-rolled portals at `z-[60]` and the picker is `z-[70]`, so it paints above. Subscriptions uses daisyUI's `.modal`, which `app/node_modules/daisyui/daisyui.css` sets to `z-index: 999` (`.modal-open` changes visibility/opacity, not z-index; `globals.css` overrides nothing). The picker portals to `document.body` as a sibling, and neither `<body>`, the `pb-16` wrapper, nor `<main>` establishes a stacking context — so it is 70 against 999 in the root context, and 70 loses.

This is the "genuine gap" the ideation's Out of Scope clause anticipated, so it is flagged here rather than discovered mid-build. The minimal fix — raising the picker's overlay z-index above 999 — is the only place it can be fixed, since the class is baked into the portalled overlay and no host can reach it. It stays correct for the existing four fields, which only need it above 60.

### Evidence

- Baseline before any change: `npm test` → **142/142 pass**, `subscription-dates.render.test.js` at 26 tests.
- Measured, not assumed: mounting the compiled picker under this suite's harness with **no** `react-i18next` stub renders correctly — `i18n.language` is `undefined`, the picker falls to `en-US`, title `"March 2026"`, `weekday-0` `"Sun"`, `day-2026-03-07` present. So the build should add no stub, unlike `date-picker.render.test.js`, which needs one only to flip languages for its own AC-24.
- The portal trap: `mount()` (`test/helpers/dom.js:231-241`) appends the container to `document.body`, and the picker portals to `document.body` as its **sibling** — so `container.querySelector` cannot see it. Picker queries must run against `global.document`. `installGlobals` calls `installDom()` per test (`:102`), so that stays isolation-safe.

### Summary

The spec swaps two controls and nothing else, with 15 binary ACs and a hard floor under entity 053's 26 tests — only 8 assertions across 3 tests may change, each replaced by the equivalent claim rather than dropped. Two of the ideation's inherited facts turned out to be wrong and are corrected in the body: the line numbers are ~33 lines stale, and the "twelve call sites" figure is 11.

The one thing needing a decision at the gate is the z-index. Reusing `DatePickerModal` untouched is impossible here — it would ship a calendar that renders behind the dialog that opened it, and no test in this repo can catch that, because jsdom computes no layout. The spec asks for one token's worth of change to the shared component, pinned statically by AC-11 and by a human tap-through on staging at AC-12. Entity 046's verify stage named this exact assumption as the picker's one untested claim; this is where it comes due.

## Stage Report: build

- DONE: Implement AC-1 through AC-5 (the swap)
  `grep -rn 'type="date"' app/app/` → zero hits. Both fields are now `<button type="button">` triggers showing raw ISO / `picker.choose_date`, opening the picker at their own value (commit `83d3098`).
- DONE: Implement AC-6 through AC-10 (entity 053's guarantees, unweakened)
  All 26 original test names still present verbatim (`comm` against `HEAD:` shows none missing), none skipped, 35 total now. 7 of the 8 tabulated assertions changed (`.disabled === false` needed no change); `readOnly === false` became a click that asserts the picker opens on the pre-filled day.
- DONE: Implement AC-11 (the one authorized DatePickerModal change)
  `z-[70]` → `z-[1000]`, a one-line diff — `git diff` on that file shows exactly 1 insertion, 1 deletion. The test reads `z-index:999` out of `app/node_modules/daisyui/daisyui.css` rather than hardcoding it, so a daisyUI bump that moves the constant fails loudly.
- DONE: Implement AC-13 through AC-15 (regression and scope)
  `npm test` after `npm ci` → **151 pass, 0 fail** (baseline was 142; 26 → 35 in the swapped suite). No new locale strings — AC-25's key-set-parity test passes untouched.
- FLAGGED: AC-14's three-file confinement — the diff touches a **fourth** file. See below.
- DONE: Implement the Edge Cases section as tests
  Picker backdrop dismiss, the picker's own close button, and Escape each close only the picker and leave the host dialog open with its date intact and nothing archived. Pre-fill survival and the error-clears-on-pick wire are covered by AC-7/AC-8 and mutation-proven below.
- DONE: Do NOT adjust DatePickerModal's year-jump range
  Untouched. `YEARS_BACK`/`YEARS_FORWARD` (`DatePickerModal.tsx:12-13`) are outside the one-line diff.
- DONE: Self-check every AC with falsifiability proven by mutation
  Four mutations run, each reverted after measuring:
  1. `z-[1000]` → `z-[70]`: AC-11's test fails alone (1 fail).
  2. Drop `setCancelInvalid(false)` from `onPick`: "correcting the date clears the message" fails (1 fail) — the exact wire the spec flagged as easy to drop.
  3. Remove the end-date trigger's `onClick`: 13 tests fail, including AC-8's "tapping it opens the picker — still editable", proving the editability claim was kept rather than dropped.
  4. Re-derive both pre-fills with `toISOString()`: 8 tests fail, so the local-Taipei pre-fill genuinely survives the swap.
- SKIPPED: AC-12 (manual staging tap-through)
  Reserved for verify by the dispatch. Build performed no write against staging or production.

### The fourth file in the diff

`app/test/date-picker.render.test.js` had to change. Entity 046's AC-26 test asserts the app-wide list of remaining native date inputs equals **`["subscriptions/page.tsx", "subscriptions/page.tsx"]`** — the two hits entity 057 exists to remove. AC-1 (zero hits) and AC-13 (zero failures) cannot both hold while that expectation stands, so this is forced rather than discretionary.

The change is minimal and confined to that one test: the expectation becomes `[]` and the title is updated to match. Its coverage of the original four fields is untouched. I also removed the duplicate walker I had first written into `subscription-dates.render.test.js`, so the invariant keeps a single home — 046's walker, where it belongs.

### Notable

- **The picker is driven, not typed into.** The replacement for `setValue()` is a `pickDate()` helper that opens the trigger, uses the year view for a different year, steps months, then clicks the day — reading the grid's current position off its first day cell rather than assuming it. A picker that opened on the wrong month fails there instead of being bypassed.
- **The empty-value fallback is reachable only by emptying the pre-fill.** Both fields are always pre-filled at open, so `""` never occurs through the UI. The test swaps `todayLocalIso` on the compiled lib module — the page calls it late-bound through the module object (`page.js:128, :218`) — which drives the real page down the real fallback branch rather than asserting against a replica of the markup. Mutation 4 independently confirms the test is not vacuous: bypassing `todayLocalIso` makes it fail.
- **No i18next stub added**, as the spec measured.

### Summary

Both Subscriptions date fields now open the shared calendar, and the picker was raised to `z-[1000]` so it paints above daisyUI's `.modal` rather than behind it. Entity 053's suite kept all 26 tests and gained 9; the full suite went 142 → 151 with zero failures, and four mutations confirm the highest-risk claims fail when the behaviour they name is removed.

The one thing for the gate is the fourth file: entity 046's AC-26 test hardcoded the two native inputs this entity removes, so it had to be updated. AC-12 remains the untestable half — whether the calendar actually paints above the dialog needs a human on staging, which is exactly what verify is for.
