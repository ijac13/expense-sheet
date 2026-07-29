---
id: 040
title: Tap to Edit Expense in Reports Drill-Down
status: build
source: captain feedback screenshot (feedback-screenshots/click to edit expense in history.png)
started: 2026-07-29T12:50:19Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-report-expense-edit
issue:
pr:
---

Tapping an expense row inside a Reports category drill-down does nothing today — Home and History already open the edit screen (entity 010) when you tap a row, but the same tap in a Reports drill-down (entity 005) is dead, so a user who spots a mistake while reviewing a report has to go hunt down the same expense in History to fix it.

## User Stories

- As a user, I want to tap an expense row in a Reports category drill-down so I can edit it right there, instead of having to find the same expense in History.
- As a user, I want the exact same edit behavior I already get from Home and History (pre-filled fields, subscription warning, delete confirmation) so editing feels consistent everywhere an expense row appears.

## Success

- Tapping any expense row in the Reports category drill-down screen (entity 005) opens the same edit screen used by Home and History (entity 010), pre-filled with that expense's values.
- Save, delete, and the subscription-generated warning banner all behave identically to entity 010 — no new edit logic, just a new entry point into it.
- After a save or delete from this entry point, the drill-down list and the report totals refresh to reflect the change.
- Leaving the edit screen (back / cancel / save) returns to the drill-down list, not the top-level report.

### Out of Scope

- Any change to report aggregation, charts, or period/payer filters (entity 005)
- Any change to edit/delete behavior itself beyond wiring this new entry point (entity 010 already defines it)

## Plan

Reuse the existing edit screen and Firebase Function write path built for entity 010. Wire the drill-down list's row tap handler (entity 005) to open it, pre-filled with the tapped row's expense — same pattern as the Home and History entry points.

## Spec

### Goal

Make an expense row in the Reports category drill-down tappable so it opens the existing edit surface pre-filled with that expense, letting a user fix a mistake where they spot it instead of hunting for it in History.

### Reuse Target

The ideation assumes Home and History share one edit screen. They do not — entity 010 shipped two divergent implementations, and this spec must name one:

| | Home entry point | History entry point |
|---|---|---|
| Surface | `/expense/[id]` route → `app/app/expense/[id]/EditExpenseClient.tsx` | In-page bottom sheet → `app/app/history/page.tsx` (`selected` + `detailMode` state) |
| Amount input | Calculator keypad | Plain text input |
| Subscription warning | Present (banner + delete dialog) | Absent |
| Works on real data | No — `next.config.ts` sets `output: "export"` and `app/app/expense/[id]/page.tsx` pre-renders only `MOCK_EXPENSES` ids, so real expense ids resolve to "This expense no longer exists." | Yes — reads live data, writes via `updateExpense` / `deleteExpense` |

**This spec targets the History bottom sheet.** Two facts force it:

1. The drill-down is component state, not a route — `app/app/reports/page.tsx:335` swaps `<DrillDown>` in when `drillDownCategory` is set. Navigating to a separate route and returning would remount `ReportsPage` with `drillDownCategory` reset to `null`, dumping the user on the top-level report and violating the ideation's fourth success criterion.
2. The route-based screen cannot load a real expense under static export.

Reuse is achieved by extracting the History sheet into a shared component that both History and the drill-down import — one implementation, two entry points. The drill-down therefore inherits History's plain amount input, not the calculator keypad.

### User Stories

- As a user reviewing a report, I want to tap an expense row in a category drill-down so I can edit it right there instead of finding the same expense in History.
- As a user, I want save and delete from the drill-down to behave exactly as they do in History, so editing feels the same everywhere an expense row appears.
- As a user, I want the drill-down list and report totals to reflect my change immediately, so I am never looking at figures I just invalidated.
- As a user, I want closing the editor to put me back on the category list I was reading, not at the top of the report.

### Acceptance Criteria

- [ ] Each expense row in the drill-down (`app/app/reports/DrillDown.tsx`) is an interactive control (`<button>` or equivalent), keyboard-focusable and activatable by Enter/Space — not a static `<div>`.
- [ ] Tapping a drill-down row opens the edit surface for that row's expense.
- [ ] The edit surface rendered by the drill-down and the edit surface rendered by History are the same shared component, imported by both. Removing that component breaks both call sites.
- [ ] The edit surface opens pre-filled with the tapped expense's current amount, category, date, paid-by, and notes, and the pre-filled amount, date, and notes match what the drill-down row displayed.
- [ ] Saving from the drill-down calls the existing `updateExpense` in `app/app/lib/expenseService.ts`. No new update function is added.
- [ ] Deleting from the drill-down shows the confirmation dialog and calls the existing `deleteExpense` in `app/app/lib/expenseService.ts`. No new delete function is added.
- [ ] The browser URL is unchanged while the edit surface is open — tapping a row performs no route navigation.
- [ ] Closing the edit surface via back, cancel, or a successful save leaves the user on the drill-down list for the same category, period, and payer filter they opened it from.
- [ ] After a successful save, the edited row in the drill-down list shows its new values with no manual reload.
- [ ] After a successful save or delete, the drill-down header total and transaction count recompute from the updated data.
- [ ] After a successful save or delete, returning to the top-level report shows recomputed category totals, chart, and payer breakdown — no figure reflects the pre-edit value.
- [ ] After a successful delete, the deleted row is gone from the drill-down list.
- [ ] When a save changes an expense so it no longer matches the drill-down's category, period, or payer filter, the row is gone from the drill-down list after the save.
- [ ] `ReportExpense` (`app/app/lib/reportTypes.ts`) carries `subscription_id` and the raw `paid_by` user id, and `getExpensesByCategory` populates both, so the edit surface receives the same field values it receives from History.
- [ ] When the tapped expense has a `subscription_id`, the subscription warning behaves per the Open Decision below.
- [ ] Row tap, save, delete, and refresh all behave identically in the monthly drill-down and the annual drill-down.
- [ ] The edit surface renders correctly in both English and Traditional Chinese, using existing i18n keys — no hardcoded user-facing strings are added.

### Edge Cases

- **Save fails (offline or Firebase Function error):** the edit surface stays open, shows an error message, and the drill-down list and totals are unchanged. No optimistic figure is left on screen.
- **Delete fails:** the confirmation dialog closes or shows an error, the row remains in the list, and totals are unchanged.
- **Expense already deleted by the other user:** the save or delete returns no matching row; the user sees an error rather than a silent success, and the drill-down refreshes to drop the row.
- **Two users edit the same expense at once:** last write wins (unchanged from entity 010); the drill-down shows whatever the refresh returns.
- **Deleting the last expense in the category:** the drill-down shows its existing empty state (`reports.no_data_period`) with a zero total, rather than an error or a blank screen.
- **Invalid amount (empty, zero, negative, non-numeric):** save is blocked with the same validation message History already shows; nothing is written.
- **Subscription-generated expense:** editing it does not alter the subscription; future generated entries are unaffected.
- **Tapping a row while the drill-down is still loading or in its error state:** no edit surface opens.
- **Rapid double-tap on a row:** one edit surface opens, not two stacked.

### Out of Scope

- Any change to report aggregation, chart rendering, or the period and payer filters (entity 005) — extending `ReportExpense` with fields already present on `Expense` is additive plumbing, not an aggregation change.
- Any change to edit and delete behavior itself (entity 010) beyond extracting the existing History sheet into a shared component and wiring this second entry point into it.
- Repairing the `/expense/[id]` route or Home's entry point. It is documented here as broken under static export; fixing it is separate work.
- Adding edit entry points anywhere else (spending insights, subscriptions, payer breakdown rows).
- Bulk edit, undo after delete, and edit history — all out of scope for entity 010 and still out of scope here.
- Switching the shared edit surface to the calculator keypad, or otherwise reconciling the two divergent entity 010 implementations.

### Open Decision

**Does the shared edit surface get the entity 010 subscription warning?**

Entity 010's approved spec requires a warning banner on the edit screen and inside the delete confirmation whenever the expense has a `subscription_id`. The route-based screen has it; the History bottom sheet does not. Since this spec reuses the History sheet, "behaves identically to entity 010" is only achievable one way:

- **Option A (recommended):** add the warning to the shared component, honoring entity 010's approved spec. History gains the warning as a side effect — a behavior change to entity 010's surface, which the Out of Scope section otherwise forbids.
- **Option B:** ship the drill-down matching History's current behavior, with no warning. Nothing outside this feature changes, and entity 010 stays out of spec on its own approved criteria.

Recommendation is Option A: the warning is the one place where a user can lose money by misunderstanding what an edit does, and entity 010 already ruled it required. Captain decides at this gate.

## Stage Report: spec

- DONE: Spec has Goal, User Stories, Acceptance Criteria (binary/testable), Edge Cases, Out of Scope per README Spec Template
  All five template sections present at report-expense-edit.md:40/62/69/89/101; each criterion names a file, an observable UI state, or a call site so it is checkable without judgment.
- DONE: Acceptance criteria cover reusing entity 010's existing edit screen/write path as the entry point, not new edit logic, plus drill-down + report totals refreshing after save/delete
  Reuse pinned by three criteria — shared component imported by both call sites, existing `updateExpense`, existing `deleteExpense`, each phrased "no new function is added". Refresh covered by four criteria spanning the edited row, drill-down header total/count, top-level category/chart/payer figures, and rows that filter out after edit.
- DONE: Out of Scope explicitly excludes changes to entity 005 (report aggregation/charts) and entity 010 (edit/delete behavior itself)
  First two bullets at report-expense-edit.md:101 name both entities; four further bullets fence off the broken `/expense/[id]` route, other entry points, bulk/undo/history, and keypad reconciliation.

### Summary

The ideation's premise that Home and History share one edit screen is false, and the spec had to resolve it rather than inherit it. Entity 010 shipped two divergent surfaces: a `/expense/[id]` route with the calculator keypad and subscription warning, and a History bottom sheet with a plain input and no warning. The route is dead for real data — `next.config.ts` sets `output: "export"` and `generateStaticParams` covers only `MOCK_EXPENSES`, so the exported build contains just `app/out/expense/mock-001|002|003`; a real expense id has no page.

The spec therefore targets the History sheet, extracted into a component both entry points import. This is also forced independently by navigation: the drill-down is component state at `app/app/reports/page.tsx:335`, so any route round-trip would reset `drillDownCategory` to `null` and strand the user on the top-level report — exactly the failure the ideation's fourth success criterion forbids. One consequence is that `ReportExpense` currently drops `subscription_id` and rewrites `paid_by` into a display name, so it needs both real values plumbed through to drive the form faithfully.

One decision is left open for the gate: whether the shared surface gains entity 010's subscription warning, which History lacks today. Adding it satisfies entity 010's approved spec but changes History — a surface this feature otherwise declares out of scope. Recommended Option A with the reasoning stated; captain's call.
