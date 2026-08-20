---
id: 053
title: Add Start/End Dates to Subscriptions
status: build
source: captain
started:
completed:
verdict: REJECTED
score:
worktree: .worktrees/spacedock-ensign-053-subscription-price-history
issue:
pr:
---

Subscriptions currently store one amount, one category, one due day — but real subscriptions change price over time (YouTube's record says NT$497 today, but 17 months of actual logged payments were NT$399; Netflix's record says NT$380, actual logged history is NT$560). Editing a subscription's amount to reflect today's real price silently overwrites the only record of what it used to cost, and — found live while working entity 051 — breaks history-matching tools that key off the current amount: changing [REDACTED-PHONE]'s amount from 850 to 499 today made its own 16 months of NT$850 history invisible to matching by amount, because there's only ever one amount on file.

Captain's direct instruction: add a start date and end date to each subscription.

- End date defaults to null — an active subscription has no end date.
- When a subscription is archived (deactivated), the app asks for its end date, defaulting to the date it's archived.

## User Stories

- As the captain, I want to change a subscription's price without erasing what it used to cost, so entity 051-style historical analysis stays accurate after a price change.
- As the captain, I want an archived subscription to record when it actually ended, not just that it's inactive, so history isn't ambiguous about which months it was really running.
- As the user, I'll end the subscription if the price change and create a new subscription with the new price. 

## Success

- Each subscription carries a start date and an end date (nullable).
- Archiving a subscription prompts for an end date, pre-filled with today's date, editable before confirming.
- An active subscription's end date is null.

### Out of Scope

- Multiple price periods / full price-change history per subscription (e.g. "NT$399 from Jan 2025, NT$497 from Jul 2026") — this entity is just start/end date, not a price-history log. A follow-up can revisit whether price changes need their own dated record, informed by how much 051's backfill actually needed it.
- Retroactively backfilling start/end dates for existing subscriptions — a separate data-entry pass, not this entity's build.
- Changing entity 050's scheduler or 051's backfill logic to use these new dates — future work can use them once they exist.

## Spec

### Goal

Give every subscription a start date and an end date so that ending a subscription records *when* it ended, and so the captain can retire a subscription at its old price and start a new one at the new price without any record of the old price being overwritten.

### Design Decisions

Four decisions the build must not re-litigate, each forced by something in the current code:

**1. The two columns are `optional`, never `required`, in `SUBSCRIPTIONS_SPEC`.**
`buildColumnMap` throws a 500 `SheetSchemaError` when a required column is absent from row 1 (`functions/src/sheetSchema.ts:109-116`). `CATEGORIES_SPEC` already carries `optional: ["gov_category", "note"]` for precisely this reason — its own comment records that requiring them "would 500 every categories request on both sheets" (`sheetSchema.ts:27-32`). Adding `start_date`/`end_date` to `required` would 500 every subscriptions request, every insights request, and the daily scheduler, on staging and production both, the instant the code deploys and before any header is touched.

**2. The code writes the headers; the captain does not.**
Since entity 047, reads and writes resolve by header *name*, so the header text is now load-bearing in a way it was not for entity 043's positional writes: `buildWriteRow` throws a 400 for any field with no column (`sheetSchema.ts:162-169`), meaning the feature genuinely cannot store a date until row 1 says `end_date`. Entity 042 is blocked right now on exactly this shape of production-sheet precondition. `ensureSchedulerLog` (`functions/src/scheduler.ts:129-157`) is the existing precedent — it creates sheet structure on demand "so the captain never has to touch the sheet by hand." Follow it.

**3. Dates are stored as ISO `YYYY-MM-DD` text**, matching the Expenses `date` column and the scheduler's `taipeiDate().iso` (`scheduler.ts:51-68`). Writes already use `valueInputOption: "RAW"`, so the string is stored as text and not coerced to a Sheets date serial.

**4. "Today" is the local calendar date, derived without `toISOString()`.**
The existing frontend convention `new Date().toISOString().split("T")[0]` (`app/app/lib/expenses.ts:16`) is UTC. In Taipei (UTC+8) it returns *yesterday* for anything done between 00:00 and 07:59 local. "Pre-filled with today's date" is a literal acceptance criterion here, so the build must not inherit that defect.

### User Stories

- As the captain, I want to change a subscription's price by ending the old record and starting a new one, so the old price and the months it applied to survive the change intact — the failure that made YouTube's 17 months at NT$399 invisible once its record said NT$497.
- As the captain, I want the app to ask me when a subscription actually ended as I archive it, defaulting to today but editable, so I can record a cancellation I'm entering a few days late.
- As the captain, I want an active subscription to carry no end date at all, so "has this ended?" is answerable without interpretation.

**Gate decision:** the replacement pre-fill (previously AC-17 to AC-19) is cut. Starting a subscription's replacement after archiving the old one stays a manual, ordinary Add — same as today, just now with a start date field (AC-13 below).

### Acceptance Criteria

Data model and sheet

- [ ] AC-1 — `SUBSCRIPTIONS_SPEC` lists `start_date` and `end_date` under `optional`, not `required`. Test: `buildColumnMap` against a header row holding only today's nine columns returns a map with no error and `hasColumn(map, "end_date") === false`. Fails if either name is moved to `required` — the call then throws.
- [ ] AC-2 — Both `Subscription` declarations — `functions/src/sheetSchema.ts:42-52` and `app/app/lib/subscriptions.ts:5-15` — carry `start_date: string` and `end_date: string`, and `rowToSubscription` yields `""` (never `null`, never `undefined`) in all three unset shapes: column absent from the header, column present with a blank cell, and a row truncated before the column by Sheets' trailing-blank trimming.
- [ ] AC-3 — `GET /api/subscriptions` returns `start_date` and `end_date` on every subscription, `""` where unset, and returns **200** against a Subscriptions tab whose row 1 has neither header. Fails if a legacy header 500s.
- [ ] AC-4 — A write needing `start_date` or `end_date` against a tab lacking the header appends the missing header(s) to the first free column(s) of row 1, then performs the write. Test: stub tab with the nine legacy headers (A–I); `PATCH {id, is_active: false, end_date: "2026-08-19"}` → 200, cell `J1` reads `end_date`, and that subscription's `J` cell reads `2026-08-19`. Fails if the response is the 400 `buildWriteRow` raises today.
- [ ] AC-5 — Adding the headers preserves every pre-existing column and cell. Test: a tab carrying an unknown column the resolver ignores → after the ensure, that column's header and all its data cells are byte-identical and the new headers land to its right, never on top of it.
- [ ] AC-6 — `start_date` and `end_date` join the PATCH allowlist at `functions/src/index.ts:385`, and a PATCH omitting them leaves the stored cells unchanged. Test: set `end_date`, then `PATCH {id, amount: 500}` → the `end_date` cell is unchanged. (An unrelated edit must not blank a date, the same rule entity 043 needed for its note column.)

Archiving an active subscription

- [ ] AC-7 — Clicking Cancel on an active subscription no longer PATCHes immediately (`app/app/subscriptions/page.tsx:208-217` does today); it opens a confirmation modal. Test: click Cancel → zero fetch calls issued and the modal is in the DOM.
- [ ] AC-8 — That modal contains an editable `<input type="date">` pre-filled with the **local** calendar date. Test with a fixed clock of `2026-08-18T16:30:00Z` under `TZ=Asia/Taipei` (00:30 on the 19th, local) → the field's value is `2026-08-19`. Fails on any `toISOString()`-derived default, which yields `2026-08-18`.
- [ ] AC-9 — Confirming issues exactly one PATCH carrying both `is_active: false` and the date currently shown in the field, and the card moves from Active to Cancelled. Test: change the field to `2026-07-01`, confirm → the request body contains `end_date: "2026-07-01"`, not today's date.
- [ ] AC-10 — Dismissing the modal (backdrop or its own Cancel button) issues no request and leaves the subscription in Active with no end date.
- [ ] AC-11 — Confirm is blocked while the entered end date is strictly earlier than that subscription's non-empty `start_date`, with a visible message, and no request is issued. Test: `start_date: "2026-03-01"`, enter `2026-02-28` → confirm is a no-op and the message is in the DOM.
- [ ] AC-12 — The API rejects the same case independently of the client: `PATCH` with an `end_date` strictly earlier than a stored ISO `start_date` returns 400 with an error naming both dates, and the sheet row is byte-identical afterwards. The comparison applies **only** when both values are non-empty and both parse as ISO `YYYY-MM-DD`; otherwise the write proceeds.

Starting a subscription

- [ ] AC-13 — The Add modal has a Start Date `<input type="date">`, pre-filled with the local calendar date by the same derivation AC-8 tests, and editable before submitting.
- [ ] AC-14 — `POST /api/subscriptions` writes the submitted `start_date` and writes `end_date` as `""`. Test: the created row's `end_date` cell is empty and the 201 body carries `end_date: ""`.
- [ ] AC-15 — The server writes whatever `start_date` the form submitted and does not substitute its own date when the field is empty (it stores `""`). "Today" is decided in one place — the browser, which is the only side that knows the captain's local date.
- [ ] AC-16 — An active subscription's `end_date` stays `""` through every non-archive path: creation, an edit to name/amount/category/due day/due month, and a daily scheduler run. Test: assert the cell is `""` after each.

Display

- [ ] AC-20 — A cancelled subscription's card shows its end date when `end_date` is non-empty.
- [ ] AC-21 — A cancelled subscription whose `end_date` is `""` renders **no** end-date element at all — absent from the DOM, not an empty span and not a placeholder date. This is the state of all 10 subscriptions already cancelled today.

**Gate amendment (captain, live-testing staging post-verify-cycle-2):** `start_date` is captured but was never displayed anywhere. Add:

- [ ] AC-26 — Every subscription card (active and cancelled) shows its start date when `start_date` is non-empty, and renders no start-date element at all when it is `""` — same absent-not-placeholder rule as AC-21, since every subscription active before this entity has no start_date on record.
- [ ] AC-27 — A cancelled card shows both its start date and its end date together (not end date alone as AC-20 originally specced). Each still follows its own independent presence rule — a cancelled subscription with an end_date but no start_date (e.g. cancelled via this feature but never had a start_date backfilled) shows only the end date, and vice versa.

Non-regression

- [ ] AC-22 — The daily scheduler is untouched: it still selects on `is_active` alone and neither reads nor writes the new columns. Test: a scheduler run against a fixture holding an **active** subscription whose `end_date` is in the past still generates its expense row, and that row is byte-identical to the one today's code produces. Fails if any end-date filtering is slipped in — which would be entity 050's scope, explicitly excluded.
- [ ] AC-23 — The insights prompt payload is byte-identical to today's for the same fixture. `rowToSubscription`'s output is passed straight into `buildInsightsPrompt` (`functions/src/index.ts:442-448`), so two new fields would otherwise silently enter the Claude prompt.
- [ ] AC-24 — `npm test` passes in both `app/` and `functions/`, and any new frontend test file is added to the explicit file list in `app/package.json`'s `test` script. Test: the script names the new file — that list is enumerated by hand, so a file left out never runs at all.
- [ ] AC-25 — Every new user-facing string has a key in both `app/public/locales/en/common.json` and `.../zh/common.json`; the `subscriptions` blocks in the two files have identical key sets and the new UI contains no hardcoded English.

### Edge Cases

- **A subscription archived before this feature existed, with no end date.** All 10 of today's cancelled subscriptions. They render with no end-date line (AC-21) rather than a fabricated or blank one, and nothing backfills them. The captain can type a date straight into the sheet cell — it reads back and displays with no deploy, which is the whole premise of keeping the data in Sheets.
- **A hand-typed date coming back locale-formatted.** `readTab` sets no `valueRenderOption` (`functions/src/index.ts:59-63`), so it gets `FORMATTED_VALUE`: a cell the captain enters as a real Sheets date returns as e.g. `2026/8/19`, not ISO. Display such a value as-is — never parse-and-reformat — and let it skip AC-12's comparison rather than 400 on it.
- **End date earlier than start date.** Blocked in the modal (AC-11) and rejected by the API (AC-12). Both, because the modal is not the only caller.
- **End date equal to the start date.** Allowed — a subscription started and cancelled the same day is real. The guard is strictly-earlier.
- **A legacy row with an empty start date, being archived now.** No comparison is possible, so AC-12's guard does not fire and the end date is accepted. A missing start date must never block recording an end date.
- **Reactivating an archived subscription.** No reactivate affordance exists — a cancelled card renders a badge and no buttons (`app/app/subscriptions/page.tsx:330-352`), and `is_active` is not settable to true from any UI path. Out of scope. Because PATCH leaves `end_date` untouched unless it is sent (AC-6), no reactivation route can silently clear a date; whether it *should* clear one is a decision for whoever adds that flow.
- **A subscription that is never archived.** It never meets an end-date field. `end_date` stays `""` for its whole life (AC-16) and the Subscriptions screen looks exactly as it does today apart from the added start-date field on the Add form.
- **Archiving just after midnight, Taipei.** The pre-filled date is the local day, not the UTC one (AC-8) — otherwise every archive between 00:00 and 08:00 records yesterday.
- **The archive PATCH fails (offline, 500, schema error).** The modal stays open showing the error, the card stays in Active, and no local state is mutated — preserving today's behaviour, where `handleCancel` alerts and leaves the list untouched on failure.
- **Both household members editing the same subscription at once.** PATCH still rewrites the whole row, so it stays last-write-wins. Unchanged from today and not this entity's problem — named here so it is not mistaken for a regression this feature introduced.

### Out of Scope

- Entity 050's scheduler logic. It keeps selecting on `is_active` alone; AC-22 pins that with a test that fails if end-date filtering is added.
- Entity 051's backfill script logic. It is not read, called, or modified.
- Retroactively backfilling start or end dates for the 21 active and 10 cancelled subscriptions already in the sheet — a separate data-entry pass, as the ideation states.
- Multiple price periods / a full price-change history per subscription. The end-and-replace workflow this spec supports is the deliberate alternative to that.
- A flow for reactivating an archived subscription.
- Editing an archived subscription's dates inside the app.
- Any link between a replacement subscription and the one it replaced — no parent, successor, or group column.
- Using start/end dates to filter or scope reports, insights, or history.
- Multi-currency handling (entity 009).
- The post-archive "start a replacement" pre-fill (formerly AC-17 to AC-19) — cut at the gate. Starting a replacement subscription stays an ordinary, manual Add.

### Gate Decisions

1. **Replacement pre-fill: cut.** Starting a subscription's replacement stays a manual Add — same as today, just with the new Start Date field (AC-13).
2. **The 10 already-cancelled subscriptions: captain types the dates directly into the sheet.** No in-app edit form for archived subscriptions.
3. **Replacement's start date default: day after the end date, as specced.** No change.

## Stage Report: spec

- DONE: Write the formal spec using the Spec Template (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope) from the ideation body already in workflow/053-subscription-price-history.md
  All five template sections present, plus a Design Decisions section recording four choices forced by the current code and an Open Questions section for the gate.
- DONE: Acceptance criteria must be binary/independently testable, covering: start_date and end_date fields added to the Subscriptions schema; end_date nullable/blank for an active subscription; archiving (deactivating) a subscription prompts for an end date pre-filled with today's date, editable before confirming; an active subscription's end_date stays empty
  25 ACs, each naming its test and the change that would fail it. Schema AC-1/AC-2; blank-for-active AC-14/AC-16/AC-21; archive prompt AC-7 to AC-9 (pre-filled, editable, one PATCH carrying the shown date).
- DONE: Incorporate the captain's own clarified workflow (end the old subscription, create a new record at the new price) and consider convenience for creating the replacement
  Specced as AC-17 to AC-19: a post-archive "start a replacement" action pre-filling name/category/frequency/due day/due month/payer, leaving amount empty because it is the field that changed, and start date at the day after the end date. Deliberately writes no link column between the two rows, so it stays end-and-replace and does not become the price-history log the ideation excluded. Flagged as gate question 1 with a recommendation to keep, since it is the only part not literally in the ideation's Success list.
- DONE: Edge cases: archived subscription with no end date (existing already-archived rows); end_date earlier than start_date; reactivating an archived subscription; a subscription never archived
  All four covered, plus six found by reading the code: locale-formatted hand-typed dates (`readTab` uses FORMATTED_VALUE), end date equal to start date, a legacy row with an empty start date, archiving just after midnight Taipei, a failed archive PATCH, and concurrent edits. Reactivation resolved as out of scope on evidence — no reactivate affordance exists at `app/app/subscriptions/page.tsx:330-352`, and AC-6 guarantees no route can silently clear a date.
- DONE: Confirm scope boundary: no changes to entity 050's scheduler or entity 051's backfill script logic, and no retroactive backfill of start/end dates
  All three restated in Out of Scope. AC-22 makes the scheduler boundary falsifiable rather than declarative: an active subscription with a past end_date must still generate its expense row, so the test fails if end-date filtering is added.

### Summary

The spec settles four decisions the build would otherwise get wrong, and each was verified by running the real `sheetSchema` module rather than by reading it. Putting `start_date`/`end_date` in `required` throws a 500 against today's header (`missing required column headers`), so they must be `optional` — the same reasoning `CATEGORIES_SPEC` already records; and `buildWriteRow` today throws a 400 for `end_date` with no column, which is why entity 043's "the header label is cosmetic" precedent no longer holds after entity 047 made reads resolve by name. That makes the header genuinely load-bearing, so the spec has the code write it on demand following `ensureSchedulerLog`, deliberately avoiding the production-sheet precondition that has entity 042 blocked right now.

The fourth decision is a latent off-by-one: the app's existing `new Date().toISOString().split("T")[0]` convention returns `2026-08-18` for a clock at 00:30 Taipei on the 19th, confirmed by running it under `TZ=Asia/Taipei`. Since "pre-filled with today's date" is a literal acceptance criterion, AC-8 pins the local-date derivation with that exact clock as its test.

Three questions are flagged for the gate: whether to keep the replacement pre-fill, whether the 10 already-cancelled subscriptions get an in-app edit form or are typed straight into the sheet (recommended), and whether a replacement should start the day after the end date or on the next billing date.

## Stage Report: build

- DONE: Implement AC-1 through AC-6 (data model and sheet)
  `SUBSCRIPTIONS_SPEC.optional = ["start_date","end_date"]`; both `Subscription` declarations carry the fields; `ensureSubscriptionColumns` (functions/src/index.ts) appends only the header a write actually needs, to the right of row 1's last header. Commit 0a0989a.
- DONE: Implement AC-7 through AC-12 (archiving)
  Cancel calls `openCancel` instead of `cancelSubscription`; the modal's `<input type="date">` is filled by `todayLocalIso()` (local calendar parts, no `toISOString()`); `endsBeforeStart` guards client-side and a mirrored guard 400s server-side.
- DONE: Do NOT implement a "start a replacement" pre-fill flow
  Nothing was built: no pre-fill, no link column, no modal chaining. The Add modal's Start Date field (AC-13) is the only new affordance, and it defaults to today like any other Add.
- DONE: Implement AC-13 through AC-16 (starting a subscription)
  Add modal has a Start Date input using the same derivation; POST writes `String(body.start_date ?? "")` and a literal `""` end_date, substituting nothing of its own.
- DONE: Implement AC-20/AC-21 (display)
  `{sub.end_date && (...)}` on the cancelled card, rendered verbatim rather than reformatted so a hand-typed locale-formatted cell is not misread.
- DONE: Implement AC-22/AC-23 (non-regression, both proven false-if-broken)
  scheduler.ts and insights.ts are byte-unchanged. AC-22 diffs an expense row generated from a fixture carrying a past `end_date` against one from a fixture with no date columns; AC-23 diffs the prompt against one built from the same subscriptions with both fields stripped.
- DONE: AC-24/AC-25
  `functions/package.json` had **no** `test` script at all — added `npm run build && node --test test/`. New frontend file added to `app/package.json`'s explicit list. Six new keys in both locales; the test asserts the two `subscriptions` blocks have identical key sets and that zh differs from en.
- DONE: Self-check every AC against a fixture/stub before marking build complete
  Seven mutation runs, each reverted after: UTC date derivation (3 fail), unconditional end-date render (1), immediate-PATCH Cancel (14), columns moved to `required` (78), dropped server guard (2), scheduler filtering on `end_date` (1), start_date leaked into the insights prompt (1).
- DONE: Do not attempt any write against production or staging
  Every test runs against the in-memory `sheetsStub` or jsdom. No credential was read and no Sheets API was contacted.

### Summary

`npm test` is green in both packages: functions 131 passing (114 before), app 63 (44 before). Design Decision 1 is now measured rather than argued — moving `start_date`/`end_date` into `required` fails 78 of the 131 functions tests, taking down the scheduler, the backfill script, insights and every subscriptions route, which is exactly the deploy-time breakage the spec predicted.

Two spec details resolved in the code's favour. AC-4 asks a `{is_active, end_date}` PATCH to put `end_date` at J1, so `ensureSubscriptionColumns` creates only the columns a given write needs rather than both — a POST creates both because it writes both. And the existing `sheetColumns.api.test.js` BEFORE literal for `GET /api/subscriptions` had to change, since AC-3 requires the two new fields in the payload; it is annotated with why, and the fixture still carries only the nine legacy headers so it doubles as the AC-3 legacy-header case.

One thing the next stage needs: this worktree has no `node_modules`. I symlinked both from the main checkout to run the suites; the symlinks are untracked and were never staged. Note that root `.gitignore` says `node_modules/` (directory-only), so a *symlinked* `functions/node_modules` shows up as untracked and a `git add -A` here would commit it — `app/.gitignore` catches its own via `/node_modules`. Run `npm install` in `app/` and `functions/`, or re-symlink, before running the tests.

## Stage Report: verify

**verdict: REJECTED** — one acceptance criterion fails: AC-5.

- DONE: Re-run the full test suite fresh in this worktree and confirm the reported counts independently
  Deleted both symlinks, ran real `npm install` (functions 266 pkgs, app 216). Counts confirmed: **functions 131 pass / 0 fail, app 63 pass / 0 fail**. `git status` clean afterwards — neither `node_modules` is tracked or untracked-visible.
- DONE: Spot-check 3-4 of the build's mutation-tested claims directly against the actual code and test files
  Re-ran four mutations myself; every count reproduced exactly. UTC date derivation → 3 fail (AC-8, AC-9, AC-13). `start_date`/`end_date` moved to `required` → 78 fail, spanning backfill/scheduler/insights, confirming Design Decision 1's deploy-time breakage is measured, not argued. Scheduler `&& !s.end_date` → 1 fail (AC-22). `start_date` appended to the insights `subSummary` → 1 fail (AC-23). All reverted; `git status` clean.
- DONE: Confirm the cut scope was actually honored
  `handleCancelConfirm` (app/app/subscriptions/page.tsx:236-259) closes the modal and stops — no add-form pre-fill, no modal chaining. Diff grep for replace/successor/parent/chain/prefill matches only the *date* pre-fill of AC-8/AC-13. No link column: `SUBSCRIPTIONS_SPEC` gains only the two date fields.
- FAILED: Confirm AC-4's on-demand column creation preserves every pre-existing column and cell exactly (AC-5)
  Holds for a *labelled* unknown column (AC-5's own test). Destroys data under a **trailing blank header cell** — see below.
- DONE: Live evidence
  `curl` GET, read-only, nothing seeded: `https://expense-sheet-b2db8.web.app` → **200**, 10702B, `<title>Expense Tracker</title>`; `https://expense-sheet-staging.web.app` → **200**, 11140B, same title. Both still serve the pre-053 build (this branch is unmerged and undeployed by design).
- DONE: Mandatory PII/secrets check per workflow/README.md
  No `.env`, credential, `.pem` or service-account file in the diff. No key/token/secret/password match in any added line. Only address is `ijac@example.com`. The ideation's real data — the phone number `[REDACTED-PHONE]`, YouTube's 497/399, Netflix's logged 560, the 850→499 change — appears nowhere. Fixtures use `Netflix`/`Insurance` with synthetic amounts, matching long-standing convention already on `origin/main` (`functions/test/scheduler.test.js:23`). `functions/backfill-reports/` is empty and untracked, so 051's failure mode has not recurred.

### AC-5 failure — detail

`ensureSubscriptionColumns` places new headers at `const first = map.width` (functions/src/index.ts:105). `map.width` is `header.length` (functions/src/sheetSchema.ts:125) — row 1's length *after* Sheets trims trailing blanks. A column holding data under a blank row-1 cell therefore goes uncounted, and the new header is written on top of it.

Reproduction (in-memory `sheetsStub`, which models the trimming at test/sheetsStub.js:98): Subscriptions row 1 = the nine legacy headers, J1 blank; data rows carry a 10th cell (`KEEP-ME-1`, `KEEP-ME-2`). `PATCH {id: "sub-1", is_active: false, end_date: "2026-08-19"}` →

- observed: `J1` becomes `end_date`; the patched row's `KEEP-ME-1` is overwritten with `2026-08-19`; `GET /api/subscriptions` then reports the untouched row's `KEEP-ME-2` as sub-2's `end_date`, so it renders as an end date and dies on that row's next PATCH.
- expected (AC-5): the pre-existing column's header and every data cell byte-identical, new headers to its right.

Boundary: a blank header *followed by* a labelled column is safe (width counts it, new header lands beyond). Only a **trailing** blank header with data beneath is affected.

Not hypothetical on this repo's sheets: `CATEGORIES_SPEC`'s own comment (functions/src/sheetSchema.ts:27-31) records that production has `note` data under a blank `H1`. This is the header-mutation surface entity 042 is already blocked on.

Fix direction: derive `first` from the widest occupied row, not row 1's length. The PATCH path already holds the full `rows` where it calls the helper (index.ts:447); the POST path reads only `A1:Z1` via `readColumnMap` (index.ts:383) and needs a full-tab read to compute it. Worth an AC-5 test at the trailing-blank shape, since the current one only covers the labelled case.

### Summary

Everything else verified strongly. Both suites reproduce their counts on a genuinely fresh install, and all four of the build's mutation claims hold exactly as reported — the 78-failure `required` mutation in particular makes the spec's central design decision falsifiable rather than asserted. Cut scope was honored, and the PII sweep is clean, including the specific real figures named in the ideation.

Rejecting on AC-5 alone. `ensureSubscriptionColumns` positions new headers by row 1's trimmed length, so a column with data under a blank header cell gets claimed and its cells destroyed — silent, irreversible loss of captain-typed data in the live sheet, and the same surface entity 042 is blocked on. The fix is small and local to `ensureSubscriptionColumns`; the rest of the build looks sound and should not need rework.

## Stage Report: build (cycle 2)

- DONE: Fix the verify-stage REJECTED finding — `ensureSubscriptionColumns` places new headers by row 1's trimmed length, silently claiming and destroying a column with data under a blank header cell
  `functions/src/index.ts`: the helper now takes the full `rows` array and derives placement via `rows.reduce((widest, r) => Math.max(widest, r.length), map.width)` instead of `map.width` alone. The POST path now does a full-tab `readTab` instead of an `A1:Z1`-only `readColumnMap`, since it needs to see data rows, not just the header, to compute a safe placement.
- DONE: Add a test at the exact trailing-blank-header shape verify used to reproduce the bug
  New test in `functions/test/subscriptionDates.api.test.js`: nine-header row (blank J1), two data rows each carrying a real 10th-column value. PATCH needing a new column must not touch J and must land the new header at K1; both rows' pre-existing cells stay byte-identical; the archived row's own new date still writes correctly. The original labelled-unknown-column AC-5 test is untouched and still passes.
- DONE: Re-run the full suite fresh and confirm all previously-passing tests still pass plus the new test
  `functions`: 132/132 (131 + 1 new). `app`: 63/63, unaffected (this fix is backend-only). Build clean (`tsc`).
- DONE: Everything else from cycle 1 confirmed correct by verify — not re-touched
  Diff for this cycle is exactly the two files above; nothing else changed.
- DONE: Do not attempt any write against production or staging
  All verification against the in-memory `sheetsStub`. No credential read, no network call.

### Verification

Falsifiability checked by mutation, not assumed: reverted `functions/src/index.ts` alone (keeping the new test) and re-ran `subscriptionDates.api.test.js` — 17/18, the one failure being the new trailing-blank-header test itself. Restored, full suite green again at 132/132.

### Note on this cycle's provenance

The ensign that did this fix hit its session's usage limit right after finishing — the code and test were complete and correct in the worktree, uncommitted. The FO reviewed the diff against the checklist and verify's exact fix direction, ran the full suite fresh, ran the same falsification check independently, and committed on confirming both. No code was written by the FO; this stage report documents what was salvaged and independently re-verified.

### Summary

AC-5 is fixed at its root cause: header placement now looks at where data actually is, not at row 1's length after Sheets trims trailing blanks. The reproduction verify used is now a permanent regression test. Nothing else in the entity changed.

## Stage Report: verify (cycle 2)

**verdict: PASSED** — the AC-5 data-loss bug is fixed at its root, and nothing else moved.

- DONE: Re-run the full test suite fresh (npm install, not symlinks) and confirm 132/132 in functions (131 + the new AC-5 trailing-blank-header test) and 63/63 in app
  Deleted both `node_modules` and ran real `npm ci` (lockfiles present, registry reachable). Both are real directories, no symlinks. **functions 132 pass / 0 fail, app 63 pass / 0 fail.** `git status` clean throughout.
- DONE: Independently reproduce the AC-5 fix's falsifiability: revert only functions/src/index.ts and confirm the new trailing-blank-header test fails while everything else stays green, then restore and confirm 132/132 again
  Reverted `functions/src/index.ts` to `d06fb59^` keeping the new test, ran the **full** suite (not just the one file): 131 pass / 1 fail, the single failure being `AC-5: a column with data under a BLANK trailing header is not claimed or overwritten`. The firing assertion is the data-loss one itself — `J1 was blank but its column holds data — it must not be claimed` (old code writes `end_date` into J). Restored via `git checkout HEAD --`, tree clean, 132/132 again. The test catches the reported root cause, not something incidental.
- DONE: Confirm this cycle touched only the two files it claims and nothing from cycle 1's already-verified scope regressed
  `git diff --stat 7fc58c9 HEAD` (the branch state cycle 1 verified) = exactly `functions/src/index.ts`, `functions/test/subscriptionDates.api.test.js`, and the entity file. Excluding `workflow/`, only the two claimed files differ. The two `origin/main` merges in the range contributed **zero** code changes, so everything cycle 1 verified is byte-identical and its verification still stands.
- DONE: Re-confirm the mandatory PII/secrets check still holds on the new diff
  No key/token/secret/password/credential/`.env`/private-key/email match in any added line. The ideation's real figures — `[REDACTED-PHONE]`, 497, 399, 560, 850, 499 — appear nowhere in branch code (the sole regex hit is a coincidental base64 fragment inside a `package-lock.json` integrity hash). `Netflix`, `ijac`, `wei` are long-standing fixture conventions already on `origin/main` (`functions/test/backfill.test.js:51`, `app/test/users-env.test.js:27`). `380` is not new this cycle — it already appeared 7× in the cycle-1-verified copy of that same test file. New data is synthetic `KEEP-ME-1`/`KEEP-ME-2`. The three `.env*.example` files are pre-existing on main, untouched by this branch, and hold only `TODO_` placeholders.
- DONE: Live evidence
  Read-only `curl`, nothing seeded, no writes. Production `https://expense-sheet-b2db8.web.app` → **200**, 10702B, `<title>Expense Tracker</title>`; staging `https://expense-sheet-staging.web.app` → **200**, 11140B. Also hit the API same-origin: staging `/api/subscriptions` → **200**, JSON array of 3; production `/api/subscriptions` → **200**, JSON array of 33. Neither response carries an `end_date` key, confirming both still serve the pre-053 build — this branch is unmerged and undeployed by design. Bodies were deliberately not dumped (real captain data); only status, size and shape recorded.

### Went beyond the checklist: the POST path

The committed AC-5 regression test covers the PATCH path only, so I probed the other write path independently — cycle 2 changed POST too (`readColumnMap` → full-tab `readTab`), and an untested behavioural change is exactly where a second bug would hide. Two throwaway probes against the same trailing-blank shape, both pass:

- POST with a blank `J1` over live data: `J1` stays blank, `start_date`/`end_date` land at K/L, and `sub-1`/`sub-2` rows are byte-identical (`deepEqual` on the whole row). The created row leaves its own J cell `""` and writes `start_date` at K, `end_date` `""` at L — AC-14/AC-15 hold under this shape too.
- Placement bounded by a row *other* than the one being written: archiving the narrow `sub-1` while the wider `sub-2` carries the extra cell still spares `KEEP-ME-2`. The `reduce` looks at every row, not just the target.

One caution worth recording: my first probe run reported a false failure because POST **inserts** the new row at the top rather than appending, so a position-indexed assertion compared the wrong row. Dumping the grid before concluding is what caught it — the code was right, the probe was wrong.

### Summary

Cycle 1's rejection is resolved at the root cause, and I confirmed that by mutation rather than by reading the fix: reverting `functions/src/index.ts` alone drops exactly one test, and the assertion that fires is the "J1 must not be claimed" one — so the new test is load-bearing and specific. Placement now derives from the widest occupied row, which I verified holds on both write paths and when the widest row is not the row being written.

The rest of the entity needed no re-verification and got none beyond the full suite, because the diff since the cycle-1-verified state is provably just those two files — the merges brought in no code. PII sweep clean, with `380` and the fixture names confirmed pre-existing rather than newly introduced.

One thing the gate needs: the feature is **not on staging** — both live APIs still return payloads with no `end_date`, as expected for an unmerged branch. Every AC here is proven against the in-memory sheet stub and jsdom, so the captain's own manual test has to happen after a deploy, not before it. Nothing in this entity was ever exercised against a real Google Sheet.

## Stage Report: build (cycle 3)

- DONE: Implement AC-26/AC-27 — every card shows its start date when non-empty, renders no start-date element at all when `""`
  `app/app/subscriptions/page.tsx`: a `data-testid="start-date"` line gated on `{sub.start_date && (...)}` on both the active card (after `paid_by`) and the cancelled card (above the existing end-date line). Same guard shape AC-21 already uses for `end_date`, so absent stays absent for the 21 active and 10 cancelled records that have no `start_date` on file. Value rendered verbatim — a hand-typed cell comes back locale-formatted and reformatting would misread it. Commit `01756a0`.
- DONE: A cancelled card shows BOTH start and end date, each following its own independent presence rule
  Two sibling conditionals, not one combined branch, so end-without-start and start-without-end each render only what they have. AC-20's end-date line is unchanged; the start-date line was added above it.
- DONE: Add tests for both new ACs at the same rigor as the rest of this entity
  7 tests in `app/test/subscription-dates.render.test.js` covering all four date combinations across both card states: active+start, active+neither, cancelled+both, cancelled+end-only, cancelled+start-only, neither-renders-neither, and archive-preserves-start. The last one guards the local state update as much as the render — `handleCancel` rewrites the subscription, and dropping `start_date` there would blank the line with no reload to reveal it.
- DONE: Add any new user-facing strings to both `en/common.json` and `zh/common.json` with matching keys in the subscriptions block
  One new key, `subscriptions.started` — `"Started"` / `"開始於"`. Added to the AC-25 test's key loop, which asserts both locales carry it, that zh is translated rather than copied, and that the two blocks' key sets are identical.
- DONE: Re-run the full suite fresh and confirm no regressions plus the new tests
  `app` **70/70** (cycle 2's 63 + 7 new), `functions` **132/132** unchanged — this cycle is frontend-only. `tsc` clean via `test:compile`, which typechecks `page.tsx` directly.
- DONE: Do not touch anything else — display only, no write against production or staging
  Diff is exactly the four files above. All assertions run against jsdom and the in-memory fetch stub; no credential read, no network call.

### Verification

Falsifiability established by two mutations, which between them partition all 7 new tests — no new test passes vacuously:

1. **Feature reverted** (`git checkout HEAD -- page.tsx`, keeping the new tests): 4 fail — the three presence assertions (active+start, cancelled+both, cancelled+start-only) and archive-preserves-start. The other 3 are negative assertions, so they hold when nothing renders; that is the point of mutation 2.
2. **Presence guard dropped** (`{sub.start_date && (` → `{true && (`, i.e. the placeholder regression AC-26 exists to prevent): the other 3 fail — active+no-start, neither-renders-neither, cancelled+end-only. This is the real failure mode, since an unconditional line would print an empty "Started" on every pre-053 subscription.

Restored from a byte-copy backup after each, confirmed 2 guards present and 70/70 green again.

### Note on the working tree

`app/public/manifest.json` was already modified when this cycle started, carrying the staging variant (`Expense Tracker (Staging)`, orange theme, `icon-staging-*` icons). It is generated by `app/scripts/set-manifest.js` on `prebuild`, so it is a leftover artifact of a staging build run in this worktree, not this cycle's work. Deliberately left uncommitted and untouched — the commit above is path-scoped to the four files this cycle actually changed.

### Summary

`start_date` was captured since cycle 1 but never rendered, which is what the captain hit on staging. Both card types now show it under the same absent-not-placeholder rule `end_date` already followed, and the cancelled card shows the two independently rather than as a pair — the end-without-start case is real data this very feature produces, and start-without-end is what hand-archiving in the sheet produces.

The one judgement call worth flagging to verify: the start date renders as the last line of the active card and above the end date on the cancelled card. Nothing in the ACs pins position or wording, so if the captain wants it elsewhere or labelled differently, that is a locale-string and line-order change, not a logic one.
