---
id: 058
title: Stop the App Writing Legacy Category Slugs
status: build
source: captain (surfaced by entity 054's spec)
started:
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-058-fix-legacy-category-writes
issue:
pr:
---

Surfaced while writing entity 054's spec (normalizing existing `category_id` data to live `cat_NNN` ids): the app's write path never stopped creating the old legacy-slug style ids in the first place, so entity 054's migration would not stay done — new slug rows start accumulating again the moment someone logs an expense after the migration runs.

Root cause, traced to three real bugs:

- `getDefaultCategory()` (`app/app/lib/categories.ts:162-167`) returns `DEFAULT_CATEGORIES[0].id` — the slug `eating-out` — whenever nothing is stored. Its own guard, `DEFAULT_CATEGORIES.find(c => c.id === stored)`, actively *rejects* a live `cat_NNN` value, so even after a captain picks a live category and `saveLastCategory("cat_001")` runs, the very next page load discards it and falls back to `eating-out` again.
- `handleConfirm()` (`app/app/page.tsx:99`) posts whatever category id is currently selected, unchanged — it has no opinion on whether that id is a live category or a legacy slug.
- `POST /api/expenses` (`functions/src/index.ts:729`) stores whatever string it's given for `category_id` with no validation against the live Categories tab. The new-subscription and edit-subscription forms (`app/app/subscriptions/page.tsx:53,114`) have the same default-to-a-legacy-slug behavior.

## User Stories

- As the captain, I want a category I actually pick to stay picked across page loads, instead of silently reverting to the same fallback category every time.
- As the captain, I want entity 054's category-id cleanup to actually stay clean, not get undone by the next expense I log.

## Success

- `getDefaultCategory()` (or whatever replaces the "last used category" logic) can hold and return a live `cat_NNN` id without rejecting it.
- Logging an expense (or a subscription) after selecting a live category persists that selection across a fresh page load — it doesn't revert to `eating-out` or any other fixed default.
- New expense/subscription rows are never written with a legacy-slug `category_id` under normal use.

### Out of Scope

- Entity 054's actual data migration — this entity is the write-path fix that keeps 054's result durable, not the migration itself.
- Whether `POST`/`PATCH` should server-side validate `category_id` against the live Categories tab — worth deciding at spec time, but the minimum fix is the client-side default/persistence bug; server-side validation can be a stretch goal or its own follow-up if spec finds it's a bigger change than it looks.
- Removing `DEFAULT_CATEGORIES`, `resolveCategory()`'s bridge, or the offline fallback path — still needed for the offline case per entity 054's own findings.

## Plan

Sequencing matters: this should land and deploy *before or alongside* entity 054's actual migration script being run against production — not necessarily before 054's script is built, but before the live data cleanup happens, so the cleanup isn't immediately undone. Spec should trace exactly where `localStorage`'s last-used-category value gets read/written and fix the guard that rejects live ids, then decide whether `handleConfirm`/the subscription forms/the API need their own guardrails too.

---

## Live Trace (2026-08-24)

Traced against the current `main` before writing acceptance criteria. Two of the ideation's three claims hold exactly as written; one is overstated and one is now understood more precisely.

### Blast radius: currently zero — but the window is open

Read production directly with the readonly dry-run (`npm run migrate:category-ids:dry-run`, which mints a `spreadsheets.readonly` token, so it cannot write). Target confirmed as production `19_D7yQaJvZr…` (staging is `1ZCmtQh2Yvex…`):

- **Expenses: 2136 data rows — 0 to change, 2136 already live, 0 blank.**
- **Subscriptions: 38 data rows — 0 to change, 38 already live, 0 blank.**

Entity 054's migration is holding as of this reading. **No new legacy-slug rows have appeared since it ran.** That is timing, not safety — the migration ran the same day and nobody has logged an expense through a freshly loaded home screen since. The very next such expense reverts to `eating-out`. The urgency in the ideation stands; the cleanup has simply not been tested by real use yet.

### Confirmed: `getDefaultCategory()` rejects live ids (`app/app/lib/categories.ts:162-167`)

Exercised the compiled function directly rather than reading it:

| stored value | `getDefaultCategory()` returns | |
|---|---|---|
| `cat_003` (live) | `eating-out` | rejected — **bug** |
| `groceries` (slug) | `groceries` | accepted |
| nothing | `eating-out` | slug default |

`saveLastCategory("cat_003")` writes `cat_003` to `localStorage` correctly. The guard on line 165 — `DEFAULT_CATEGORIES.find((c) => c.id === stored)` — then discards it on the next read. The captain's choice is stored and thrown away, every single time.

### Confirmed: the home screen submits whatever it is holding (`app/app/page.tsx:31, 93`)

`categoryId` is seeded once from `getDefaultCategory()` (line 31) and **is never reconciled when the live list arrives** — the `getCategories()` effect (lines 61-70) replaces `categories` but leaves `categoryId` untouched. So on every fresh load `categoryId` is the slug `eating-out`, and `handleConfirm()` (line 93) posts it verbatim.

The symptom is quiet rather than obvious: the header still reads "Eating Out", because `selectedCat` (line 44) falls back to the baked-in entry. Only the picker gives it away — no live tile is highlighted, since no live category has the id `eating-out`. **Typing an amount and confirming without touching the picker is the primary regression path**, and it is also the fastest path through the app.

### Correction: the subscription forms are largely already fixed

The ideation names `app/app/subscriptions/page.tsx:53,114` as having "the same default-to-a-legacy-slug behavior". Those two lines are real, but they are no longer the normal path — entity 049 already fixed the add form (`openAdd()`, line 136: `category_id: activeCategories[0]?.id ?? defaultAddForm.category_id`), and the edit form seeds from the stored `sub.category_id` (line 147) and already widens its options to include a stored id that is not in the active list (lines 270-279).

Lines 53 and 114 are reached only in two residual cases: the live fetch failed, or the modal is opened before `getCategories()` resolves. **The subscription forms need the same degraded-state guard as the home screen, not the same default-selection fix.**

### Amplification path: the scheduler

`functions/src/scheduler.ts:254` copies `sub.category_id` straight onto each auto-added expense. A single subscription saved with a slug therefore re-seeds a slug expense every month, indefinitely. This is why the guarantee belongs at the API, not only in two React components.

### The API validates nothing

`POST /api/expenses` (`functions/src/index.ts:729`) and `POST /api/subscriptions` (line 402) both store `String(body.category_id ?? "")` as-is. Both PATCH handlers (lines 632, 438) copy the field through untouched. Any string — a slug, a typo, empty — is accepted and written.

Cost of fixing this is low: `readTab(sheets, spreadsheetId, CATEGORIES_SPEC)` is an existing one-liner already called at lines 281, 291, and 343, and the Categories tab is 25 rows. This priced the decision recorded in AC-9 below.

---

## Spec

### Goal

Make a category the captain actually picks stick across page loads, and make the live Categories tab the only source of a valid `category_id` on every write path — so entity 054's cleanup stays clean instead of decaying with the next logged expense.

### User Stories

- As the captain, I want the category I pick to still be picked when I next open the app, instead of silently reverting to Eating Out every time.
- As the captain, I want entity 054's category-id cleanup to stay clean, not get undone by the next expense I log.
- As the captain, when the category list fails to load, I want to be told — rather than have the app quietly save my expense against the wrong category.

### Acceptance Criteria

**Last-used category persistence (client)**

- [ ] AC-1 — `getDefaultCategory()` returns the exact non-empty string stored under `expense_last_category_id`, including a live `cat_NNN` id. Test: store `cat_003`, call, expect `cat_003`. Fails today (returns `eating-out`).
- [ ] AC-2 — After selecting a live category on the home screen and reloading the page, the picker highlights that same category and the header names it. Binary: the highlighted tile's id equals the id selected before reload.
- [ ] AC-3 — With nothing stored and the live Categories list loaded, the initially selected id is the first active live category (matches `/^cat_\d+$/`), never a `DEFAULT_CATEGORIES` slug.
- [ ] AC-4 — When the stored id is absent from the live Categories tab entirely (deleted category), the selection falls back to the first active live category, and the resulting id is a live id — not a slug.
- [ ] AC-5 — When the stored id names a category present in the tab but `is_active: false`, the home screen falls back to the first active live category. Rationale: the picker only renders active categories, so an inactive selection would highlight nothing.

**No slug leaves the client (client)**

- [ ] AC-6 — Logging an expense from the home screen sends a `category_id` present in the live Categories tab. Test: assert on the intercepted POST body, including the path where the captain touches nothing but the keypad.
- [ ] AC-7 — Adding a subscription and editing a subscription each send a `category_id` present in the live Categories tab. This is a regression guard on entity 049's existing fix, not new behaviour.
- [ ] AC-8 — With the live Categories list loaded, no code path submits an expense or subscription while the selected id is a `DEFAULT_CATEGORIES` slug.

**Server-side validation (the decision the ideation deferred to spec)**

**Decision: yes — validate on the API side. Include it in this entity, not a follow-up.**

Three reasons the live trace settled it. The API is the single chokepoint all four write paths and the scheduler pass through, so one guard there is worth four client-side guards that each have to be maintained. The scheduler amplifies a single bad subscription into a new bad expense every month, and the scheduler is server-side — a client-only fix cannot reach it. And the cost is genuinely small: the Categories read is an existing helper already used three times in the same file, against a 25-row tab.

Validation is **accept-or-reject against the live tab, with no slug bridge on the server.** The server deliberately does not reimplement `resolveCategory()`'s `name_en` bridge, because that would mean duplicating the 24-row `DEFAULT_CATEGORIES` slug table into `functions/` and creating exactly the second-source-of-truth problem entity 054 removed.

- [ ] AC-9 — `POST /api/expenses` with a `category_id` not present in the live Categories tab responds `400` with an error naming the rejected value, and writes no row. Test: POST `category_id: "eating-out"` against staging; assert 400 and that the Expenses row count is unchanged.
- [ ] AC-10 — `PATCH /api/expenses`, `POST /api/subscriptions`, and `PATCH /api/subscriptions` reject the same way, each writing nothing on rejection.
- [ ] AC-11 — A `category_id` naming a category present in the tab but `is_active: false` is **accepted** on all four endpoints, so historical rows and archived categories remain editable. Rejection is for ids absent from the tab, not inactive ones.
- [ ] AC-12 — A blank or missing `category_id` on either POST is rejected with `400`. (Production has 0 blank rows today, so nothing existing depends on blanks being accepted.)
- [ ] AC-13 — The validation derives its valid set by reading the Categories tab at request time. No hardcoded id list, slug list, or `DEFAULT_CATEGORIES` copy is added anywhere under `functions/`. Test: grep `functions/src` for slug literals returns nothing new.

**Degraded state**

- [ ] AC-14 — When `getCategories()` fails or has not yet resolved on the home screen, the confirm action is disabled and a visible message states the category list is unavailable. No POST is issued in that state.
- [ ] AC-15 — The same guard applies to the subscription add and edit modals: submission is blocked with a visible message rather than falling back to `DEFAULT_CATEGORIES[0].id` (`app/app/subscriptions/page.tsx:53,114`).
- [ ] AC-16 — After a failed load recovers (the captain retries and `getCategories()` succeeds), the confirm action re-enables with a live id selected, without a page reload.

**Data invariant**

- [ ] AC-17 — After the fix is deployed, a fresh readonly dry-run (`npm run migrate:category-ids:dry-run`) still reports `0 row(s) would change` on production, following at least one expense logged through a freshly loaded home screen. This is the end-to-end proof that the cleanup holds; today's baseline is 2136 expenses / 38 subscriptions, all live.

### Edge Cases

- **First use ever, live list already loaded** — nothing in `localStorage`. Select the first active live category (AC-3). There is no legitimate reason to reach for a slug here: the live list is present, so a live id is available.
- **First use ever, live list not yet loaded** — the sub-second window before `getCategories()` resolves. The app must not commit to a slug in order to have something to show. `categoryId` starts empty and confirm stays disabled (AC-14); the picker renders `DEFAULT_CATEGORIES` as a visual placeholder only, never as a submittable value. This is the specific case the ideation asked about, and the answer is no — display fallback yes, write fallback no.
- **Offline / live fetch fails** — entity 054 flagged this as a real if minor pre-existing regression. This entity **narrows** it rather than worsening it: today a failed fetch silently writes a slug; after this fix it visibly blocks the write. Worth noting that `getCategories()` and `addExpense()` share an origin, so a true offline state fails the POST anyway — the only case this changes in practice is a partial or transient failure of the categories endpoint alone, which is precisely the case where silently writing a slug is most damaging because everything else appears to work.
- **Category deactivated after being saved as last-used** — the id stays valid server-side (AC-11), so historical rows keep resolving and stay editable; the home screen moves the selection to the first active category (AC-5).
- **Category deleted after being saved as last-used** — the id is absent from the tab. The client falls back to a live id (AC-4); the server rejects any attempt to write it (AC-9).
- **Two users logging at once** — `localStorage` is per-device, so the last-used category is inherently per-device and no coordination is needed. Server validation is a pure read of the Categories tab and holds no cross-request state, so concurrent writes cannot interfere.
- **A category added mid-session** — the client's valid set is whatever `getCategories()` last returned; the server's is read per request. A brand-new category is therefore accepted by the server before the client has refreshed. That asymmetry is safe (the server is the stricter side) and needs no extra handling.

### Out of Scope

Confirmed against the ideation's boundary — none of the following is touched:

- **Entity 054's migration script** (`functions/scripts/normalize-category-ids.js`). This entity is the write-path fix that keeps 054's result durable. The script is used here read-only, via its `--dry-run` mode, as evidence only.
- **`resolveCategory()`'s legacy-slug bridge, `DEFAULT_CATEGORIES`, and `CATEGORY_ICONS`** (`app/app/lib/categories.ts`). All three stay exactly as they are — still needed to render the offline fallback and to display any historical row, per entity 054's own findings.
- **Server-side reimplementation of the slug bridge** — explicitly rejected in AC-13's rationale, not merely deferred.
- **Backfilling or re-migrating existing data** — production is already clean (0 rows to change). If a slug row appears between this spec and the deploy, re-running 054's migration is the remedy, and that is 054's script, not this entity's.
- **Authentication on the write endpoints** — entity 055 owns that.

## Stage Report: spec

- DONE: Write the formal spec using the Spec Template (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope) from the ideation body
  All five template sections present under `## Spec`; 17 numbered ACs.
- DONE: Trace the exact current bug live before writing ACs, confirming the three sites named in the ideation
  Two confirmed, one corrected — see `## Live Trace (2026-08-24)`. `getDefaultCategory()` proven by executing the compiled `app/.test-build/categories.js`: stored `cat_003` returns `eating-out`, stored `groceries` returns `groceries`. `page.tsx:31` seeds from it and is never reconciled when the live list loads, so `handleConfirm()` (line 93, not 99) posts the slug. `functions/src/index.ts:729` and `:402` store `String(body.category_id ?? "")` unvalidated.
- DONE: Urgent context — check live production data now for any NEW legacy-slug rows since 054's migration
  Readonly dry-run against production `19_D7yQaJvZr…`: Expenses 2136 rows / 0 to change / 0 blank; Subscriptions 38 rows / 0 to change / 0 blank. **Blast radius is currently zero.** The window is open, not closed — the migration ran the same day and no expense has been logged through a fresh page load since.
- DONE: Acceptance criteria binary/independently testable, covering persistence, no-slug-writes, and the server-validation call
  AC-1..AC-8 client, AC-9..AC-13 server, AC-14..AC-16 degraded state, AC-17 end-to-end data invariant. Server-validation decision made explicitly: **yes, include it**, as accept-or-reject against the live tab with no server-side slug bridge (AC-13 rationale).
- DONE: Edge cases — first use ever, offline fetch failure, category deactivated/deleted after being saved
  Seven cases under `### Edge Cases`. First-ever-use answered directly: display fallback yes, write fallback no. Offline case is narrowed by this fix, not worsened — a silent bad write becomes a visible block.
- DONE: Confirm scope boundary per the ideation's Out of Scope
  Five exclusions listed; 054's migration script, `resolveCategory()`'s bridge, `DEFAULT_CATEGORIES`, and `CATEGORY_ICONS` all explicitly untouched.

### Summary

Traced all four write paths live rather than from the ideation's description. The `getDefaultCategory()` bug is real and reproduced by execution; production is currently 100% clean (2136 + 38 rows, zero slugs), so the captain has a clear window rather than an active leak. Two corrections to the ideation: the subscription forms were already fixed by entity 049 and need a degraded-state guard rather than a default-selection fix, and `functions/src/scheduler.ts:254` copies a subscription's `category_id` onto a new expense every month — an amplification path a client-only fix cannot reach, which is the deciding argument for the server-side validation this spec commits to.

Two calls worth the captain's attention at the gate: including server-side validation in this entity (the ideation left it open), and AC-14/AC-15 blocking submission when the category list fails to load — that is a deliberate UX trade, choosing a visible error over a silent wrong-category write.

## Build Plan

Written before coding. Baseline on this branch: `functions` 160 tests green, `app` 118 tests green.

1. **`app/app/lib/categories.ts`** — `getDefaultCategory()` returns the raw stored string (`""` when unset), dropping the `DEFAULT_CATEGORIES.find` guard that rejects live ids. Add `pickCategoryId(stored, activeCategories)` as the single pure fallback rule: keep `stored` when it is in the active live list, otherwise the first active live category. (AC-1, AC-3, AC-4, AC-5)
2. **`app/app/page.tsx`** — track whether the live list resolved (`categoriesReady`) and whether it failed; reconcile `categoryId` through `pickCategoryId` when `getCategories()` resolves; keep `DEFAULT_CATEGORIES` as a *display* placeholder only; disable confirm with a visible message until a live id is selected, with a retry that re-enables in place. (AC-2, AC-6, AC-8, AC-14, AC-16)
3. **`app/app/subscriptions/page.tsx`** — drop the two `DEFAULT_CATEGORIES[0].id` seeds (lines 53, 114) and block add/edit submission with a visible message until the live list loads, rather than falling back to a slug. (AC-7, AC-15)
4. **`functions/src/index.ts`** — one `categoryIdError()` helper reading `CATEGORIES_SPEC` via the existing `readTab` per request, called at the top of POST/PATCH `/api/expenses` and POST/PATCH `/api/subscriptions` before any write (notably before `ensureSubscriptionColumns`, which itself writes a header). Absent from the tab → 400 naming the value; `is_active:false` → accepted; blank/missing on POST → 400. No slug or id list under `functions/`. (AC-9 – AC-13)
5. **Tests** — extend `app/test/helpers/dom.js` to record expense POST bodies; new `app/test/legacy-category-writes.render.test.js` and `functions/test/categoryValidation.api.test.js`; extend `app/test/categories.test.js`. Mutation-check the three highest-risk ACs named in the dispatch.
6. **AC-17** — readonly `migrate:category-ids:dry-run` only. No production write is issued from the build stage.
