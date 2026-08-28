---
id: "059"
title: Subscriptions — Add Notes and Search
status: build
source: captain
started: 2026-08-28T10:06:09Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-059-subscriptions-notes-search
issue:
pr:
---

Add a notes field to subscriptions and a search function on the Subscriptions page, so it's easier to record context on a subscription and find one quickly as the list grows.

## User Stories

- As the captain, I want to add a free-text note to a subscription, so I can record context (why it exists, when to cancel, plan details) that doesn't fit in the existing fields.
- As the captain, I want to search the Subscriptions page by name (and possibly note content), so I can find a specific subscription quickly instead of scrolling the full list.

## Success

- Each subscription can have an optional notes field, editable from the Add/Edit form.
- Notes are visible somewhere on the subscription (list item and/or detail view) without cluttering the default list.
- A search input on the Subscriptions page filters the list live as you type.
- Existing subscriptions (no note set) are unaffected — notes field starts empty, search matches everything until typed into.

### Out of Scope (decide at spec time)

- Whether notes are searchable, or search is name-only
- Any notes/search feature on other pages (Expenses, Categories, Reports)
- Rich text or formatting in notes — plain text only unless spec decides otherwise

## Plan

To be filled in at spec time: where notes lives in the Google Sheet schema (new column vs. reuse), whether it needs migration handling like entity 053/054's column additions, and where search fits in the existing Subscriptions page layout.

## Spec

### Goal

Give each subscription an optional free-text note, and put a live filter box on the Subscriptions page, so the captain can record why a subscription exists and find one by typing instead of scrolling.

### Scope Recommendation — keep the two halves bundled

**Recommendation: build both in this one entity, with the ACs split into separately-checkable groups (A/B = notes, C = search).**

The two halves land in the same file (`app/app/subscriptions/page.tsx`) and the same render path. Splitting them costs more than it saves here:

- Search's central design question — *what fields does it match?* — is only answerable once notes exist. Shipping search alone means shipping name-only matching, then reopening the same function weeks later to add notes matching. That is rework, not sequencing.
- Two entities means two build branches editing the same page file, and this repo has no CI/CD: every entity requires its own manual production deploy (`firebase deploy --only functions,hosting`). Bundling is one deploy instead of two.
- Search adds no backend, no schema, and no API surface (see the AC-C group — it is client-side filtering of data the page already holds). It is roughly a `useMemo` and an `<input>`. It does not carry enough risk to justify its own gate.

**The asymmetry the captain should know about before approving:** the notes half touches the live production Subscriptions sheet (a new column), the search half touches nothing but the browser. If the sheet write turns out to be riskier than expected during build, search can still be split out and shipped alone — it has zero dependency on notes beyond the matching field. Build should therefore land notes first and search second, so a problem in the risky half never strands the safe half half-written.

### Design Decisions Settled Here

The ideation left three questions open. Resolved:

1. **Are notes searchable?** Yes — search matches `name` and `notes`. That is the reason for bundling (above). Category name is deliberately *not* matched (see Out of Scope).
2. **Where do notes live in the sheet?** A new `notes` column on the Subscriptions tab, created on demand by the existing `ensureSubscriptionColumns` helper — never by a hand-run migration script, and never as a `required` field in `SUBSCRIPTIONS_SPEC`. See AC-A1 and AC-A7 for why each of those is load-bearing.
3. **Where does search sit?** A single text input between the page header and the Active section, filtering both the Active and Cancelled sections.

One further call worth the captain's attention: **notes render in full on the card, capped at 200 characters, with no truncation and no expand-to-read.** This follows entity 043's precedent (a hard input cap rather than an ellipsis) so no note is ever partly hidden. 200 chars is about four lines on a phone. If that reads as too much clutter on the card, lowering the cap to 120 (matching 043 exactly) is a one-line change — say so at the gate rather than after build.

### User Stories

- As the captain, I want to attach a free-text note to a subscription, so the context that fits no existing field — why it exists, when to cancel, which plan tier — is recorded on the subscription itself instead of remembered.
- As the captain, I want a subscription's note visible on its card, so the reminder reaches me while I am looking at the list, not only when I open the edit form.
- As the captain, I want to type into a search box and see the list narrow as I type, so I can reach one subscription without scrolling past the others.
- As the captain, I want search to look inside notes as well as names, so I can find a subscription by what it is for when I cannot remember what it is called.

### Acceptance Criteria

#### Group A — Notes: data layer

- [ ] **AC-A1** — `SUBSCRIPTIONS_SPEC` (`functions/src/sheetSchema.ts:34`) lists `"notes"` under `optional`, not `required`. Verify by pointing the handlers at a Subscriptions tab whose row 1 has no `notes` header: `GET /api/subscriptions` returns 200, not 500. (A `required` entry throws in `buildColumnMap` for any tab lacking the header, which would 500 every subscriptions request, every insights request, and the daily scheduler the moment it deploys — the exact failure `start_date`/`end_date` are optional to avoid.)
- [ ] **AC-A2** — `rowToSubscription` returns `notes` as a string for all three unset shapes — column absent from the map, cell blank, row truncated by Sheets' trailing-blank trimming — returning `""` in each case, never `null` or `undefined`.
- [ ] **AC-A3** — `GET /api/subscriptions` returns a `notes` string field on every object in the response array, including rows written before this feature existed.
- [ ] **AC-A4** — `POST /api/subscriptions` with `notes: "cancel before renewal"` in the body writes that exact text to the row's `notes` cell and returns it in the 201 response body. A POST with no `notes` key writes `""`.
- [ ] **AC-A5** — `PATCH /api/subscriptions` with `{id, notes: "..."}` writes the `notes` cell of that row and leaves every other cell in the row byte-identical, including any column not named in `SUBSCRIPTIONS_SPEC`.
- [ ] **AC-A6** — `PATCH /api/subscriptions` with a body that omits `notes` — a rename, an amount change, a cancel — leaves the stored note unchanged. A note must survive an unrelated edit.
- [ ] **AC-A7** — The `notes` header, when absent, is created only through `ensureSubscriptionColumns` (`functions/src/index.ts:101`), whose placement index is `rows.reduce((widest, r) => Math.max(widest, r.length), map.width)`. Verify with a fixture whose row 1 holds 9 headers but whose row 5 holds 11 cells (two columns of data sitting under blank header cells): the `notes` header must land at index 11 (column L), and rows 2..n must be unchanged afterward. **Placement derived from row 1's trimmed length is a FAIL** — that is the entity 053 bug, which claimed an occupied column and destroyed the data under it. Do not add a new placement path; call the existing helper.
- [ ] **AC-A8** — The POST handler's `ensureSubscriptionColumns(..., ["start_date", "end_date"])` call (`functions/src/index.ts:439`) includes `"notes"`, so the first subscription added after deploy creates the column.
- [ ] **AC-A9** — The PATCH handler's patchable-field list (`functions/src/index.ts:494`) includes `"notes"`, so a notes-only edit reaches `buildWriteRow`.
- [ ] **AC-A10** — A note whose first character is `=`, `+`, `-`, or `@` round-trips as literal text: POST it, then GET it back and receive the same characters that were sent — not a computed value and not `#NAME?`. (All write paths already use `valueInputOption: "RAW"`; this AC exists so a future change away from RAW fails visibly rather than silently turning notes into formulas.)
- [ ] **AC-A11** — `Subscription` in `app/app/lib/subscriptions.ts` declares `notes: string` (required and always a string, matching `start_date`/`end_date`, since the API returns `""` for unset), and `updateSubscription`'s `Partial<Pick<Subscription, ...>>` in `app/app/lib/subscriptionService.ts:54` lists `"notes"`.

#### Group B — Notes: UI

- [ ] **AC-B1** — The Add modal renders a Notes textarea, initially empty, positioned after the Start Date field.
- [ ] **AC-B2** — The Edit modal renders a Notes textarea pre-filled with that subscription's stored note; a subscription with no note shows an empty textarea.
- [ ] **AC-B3** — Submitting either modal with the Notes field empty succeeds, produces no validation error, and does not disable Save. (Contrast with amount, which still blocks save when empty or ≤ 0.)
- [ ] **AC-B4** — The Notes textarea accepts at most 200 characters; input beyond 200, whether typed or pasted, is not accepted.
- [ ] **AC-B5** — The note is trimmed before it is sent: a note of only spaces or newlines is sent as `""` and is indistinguishable from never having set one.
- [ ] **AC-B6** — A subscription with a non-empty note renders that note's exact text on its card, on its own line, on **both** Active and Cancelled cards.
- [ ] **AC-B7** — A subscription with an empty note renders no note element at all — absent from the DOM, not present-and-empty and not hidden by CSS, so it consumes no vertical space. (Same rule as the existing `start_date` / `end_date` lines.)
- [ ] **AC-B8** — Newlines inside a note render as separate visual lines rather than collapsing into one line.
- [ ] **AC-B9** — The Notes field label renders from a translation key present in **both** `app/public/locales/en/common.json` and `app/public/locales/zh/common.json` — no hardcoded English string in the component.
- [ ] **AC-B10** — After a successful edit that changes a note, the card's displayed note updates without a page reload.
- [ ] **AC-B11** — When a notes save fails (non-2xx or network error), the existing alert fires and the card's displayed note stays at its pre-edit value — nothing local is mutated on a write that did not land.

#### Group C — Search

- [ ] **AC-C1** — A search text input renders between the page header and the Active section whenever at least one subscription exists.
- [ ] **AC-C2** — When there are zero subscriptions, no search input renders and the existing `subscriptions.empty` message shows exactly as it does today.
- [ ] **AC-C3** — Typing in the search input filters the rendered list on each keystroke with no page reload and **no network request** — assert that no additional fetch to `/api/subscriptions` is issued while typing. (The page already loads the full list once on mount via `getSubscriptions()`; filtering is client-side over that array.)
- [ ] **AC-C4** — Matching is case-insensitive substring matching, not prefix-only and not fuzzy: `net`, `NET`, and `flix` each match a subscription named `Netflix`; `ntflx` matches nothing.
- [ ] **AC-C5** — Matching tests both `name` and `notes`. A subscription named `iCloud` carrying the note `family plan` is matched by the query `family`.
- [ ] **AC-C6** — An empty query, or a query of only whitespace, renders exactly the list rendered before this feature existed: both sections, every subscription, same order.
- [ ] **AC-C7** — Leading and trailing whitespace is trimmed before matching — the query `"  net  "` matches `Netflix`.
- [ ] **AC-C8** — A query that matches nothing renders a distinct no-results message that includes the query text, and does **not** render `subscriptions.empty` (which claims the captain owns no subscriptions and would be false).
- [ ] **AC-C9** — Filtering applies to the Active and Cancelled sections independently, and a section whose filtered result is empty renders no section header. A query matching only a cancelled subscription renders the Cancelled header and no Active header.
- [ ] **AC-C10** — A clear control renders whenever the query is non-empty; activating it empties the query and restores the full list per AC-C6.
- [ ] **AC-C11** — A query of Chinese characters matches a subscription whose name contains those characters. (`toLowerCase()` is a no-op on Chinese; this AC guards against a normalization step that breaks non-Latin input.)
- [ ] **AC-C12** — The query is not persisted: a page reload starts with an empty input and the full list. Nothing is written to `localStorage`.
- [ ] **AC-C13** — The search placeholder and the no-results message each render from a translation key present in both `en/common.json` and `zh/common.json`.

#### Group D — Non-regression

- [ ] **AC-D1** — Add, Edit, and Cancel each still complete end-to-end and still persist correct values for name, amount, category_id, frequency, due_day, due_month, start_date, and end_date.
- [ ] **AC-D2** — The auto-add scheduler status line still renders in the header and is unaffected by the search query — filtering the list never hides it.
- [ ] **AC-D3** — The daily scheduler still writes `notes: sub.name` into the expenses it creates (`functions/src/scheduler.ts:257`). A subscription's own note does **not** change what the scheduler writes into the created expense's notes field.
- [ ] **AC-D4** — `/api/insights` and every other path calling `rowToSubscription` still returns 200 after `notes` joins the spec.
- [ ] **AC-D5** — `npm test` in `app/` passes, including `test:compile`, which already compiles `app/subscriptions/page.tsx`.
- [ ] **AC-D6** — Every frontend request added by this feature goes through `apiFetch` from `app/app/lib/apiClient.ts`. No bare `fetch(` is introduced. (Auth is then automatic — entity 055's token gate applies to every endpoint, so no new auth work is needed or permitted.)

### Edge Cases

- **Every existing subscription has a blank note.** This is the state on day one for all ~30 production rows: no `notes` column exists at all until the first write creates it. `rowToSubscription` returns `""` (AC-A2), cards render no note line (AC-B7), and search matches against `""`, which never matches a non-empty query. This is the default state, not an error state.
- **A note under a blank header cell.** The production Categories tab already has this shape (`note` data under a blank H1, per `sheetSchema.ts:27-29`), which is why AC-A7 exists. If the Subscriptions tab has any occupied column past its last labelled header, the new `notes` header must land past it, never on it.
- **A `notes` header already exists on the live Subscriptions tab.** Then `buildColumnMap` maps it once `notes` is in the spec, `ensureSubscriptionColumns` sees it present and creates nothing, and existing cell contents surface as notes. Correct behavior, no special-casing needed — but build should check the live tab before assuming the column is absent.
- **Two `notes` headers on the tab.** `buildColumnMap` throws `SheetSchemaError` on duplicate headers, returning 500 with a message naming both columns. Pre-existing behavior for every field; not changed here.
- **Whitespace-only note.** Trimmed to `""` on save (AC-B5), so it behaves as unset. Prevents a note line that occupies card space showing nothing.
- **Note longer than the cap.** The textarea hard-caps at 200 characters (AC-B4), so no truncation-with-ellipsis path exists and every saved note is fully readable on the card. No hidden content, no expand affordance.
- **Special characters in a note.** Leading `=`/`+`/`-`/`@` stay literal because every write uses `valueInputOption: "RAW"` (AC-A10). Emoji, Chinese characters, commas, and quotes are stored and displayed as typed — there is no CSV or formula path between the textarea and the cell.
- **Search matches nothing.** A dedicated no-results message naming the query (AC-C8), never the "no subscriptions yet" empty state — the difference between "nothing matched" and "you own nothing" matters to a captain who owns 30 subscriptions.
- **Search typed while the page is still loading.** The page returns a loading spinner before rendering any of the list UI (`page.tsx:320`), so the input does not exist during load. No partial-list filtering is possible.
- **Offline / API unreachable on load.** `getSubscriptions()` rejects, the page sets an empty list, and per AC-C2 no search input renders — search over nothing is not offered.
- **Offline / write fails on save.** The existing alert fires and local state is not mutated (AC-B11), matching how `handleCancelConfirm` already treats a failed write.
- **Both users editing the same subscription at once.** PATCH rewrites the whole row, so last write wins and one note can overwrite the other. Pre-existing behavior for every subscription field; explicitly not fixed here.
- **A note on a subscription whose category was since deleted.** Editing notes sends no `category_id`, so the PATCH category guard does not fire (`index.ts:477`) and the stored category carries forward. A note is editable on a subscription filed under a dead category.

### Out of Scope

- **Notes or search on any other page** — Expenses, Categories, Reports, History. Subscriptions only.
- **Rich text, markdown, links, or images in notes** — plain text only. Newlines are the only formatting preserved.
- **Matching search against category name, amount, payer, frequency, or dates.** Name and notes only. Typing a category name returning every subscription in that category is a different feature (a filter, not a search) and would surprise someone typing a subscription name.
- **Server-side search or a search API endpoint.** The page already loads the full list client-side on mount; a household's subscription list is well under 100 rows. No new API surface.
- **Fuzzy matching, typo tolerance, ranking, or highlighting matched substrings.** Plain case-insensitive substring, unranked, in existing sort order.
- **Persisting the search query** across reloads or navigation, and any URL query-parameter form of it.
- **Feeding a subscription's note into the expenses the scheduler auto-creates.** Those keep `notes: sub.name` (AC-D3). Changing them would rewrite the notes field of every future auto-added expense — a separate decision.
- **A migration or backfill script** to populate notes on existing rows, and any hand-run script to add the column. The column is created on demand by the existing write path (AC-A7/A8); there is no entity 051/054-style backfill here.
- **A detail view for a subscription.** The app has cards only; notes render on the card.
- **Changing existing subscription fields, validation, or the cancel flow.**

### Implementation Notes

Non-binding, confirmed by reading the code — this should save the build agent a discovery pass.

- Backend touch points: `SUBSCRIPTIONS_SPEC.optional` (`sheetSchema.ts:42`); `rowToSubscription` (`sheetSchema.ts:145`) gains `notes: String(cell(row, map, "notes") ?? "")`; POST's `ensureSubscriptionColumns` field list (`index.ts:440`) and its `buildWriteRow` object (`index.ts:446`); PATCH's patchable-field array (`index.ts:494`).
- `"notes"` **must** be added to `SUBSCRIPTIONS_SPEC` before any write is attempted. `buildColumnMap` skips headers naming no expected field (`sheetSchema.ts:106`), so a `notes` header that is not in the spec never enters the map, and `buildWriteRow` then throws `cannot write "notes" — no column with that header exists`.
- The PATCH path already routes `Object.keys(updates)` through `ensureSubscriptionColumns` (`index.ts:512`), so once AC-A9 lands, a notes-only PATCH creates the column on its own. POST needs the explicit addition (AC-A8).
- Frontend touch points: `Subscription` (`app/app/lib/subscriptions.ts:5`) and the three `MOCK_SUBSCRIPTIONS` entries below it; `updateSubscription`'s `Partial<Pick<...>>` (`subscriptionService.ts:54`) — TypeScript rejects the call before it reaches the network otherwise; `AddFormState` / `EditFormState` / `defaultAddForm` (`page.tsx:33-63`), `openEdit` (`:160`), `handleAdd` (`:187`), and `handleEdit`'s `updates` object plus its optimistic `setSubscriptions` merge (`:215-231`).
- `addSubscription` takes `Omit<Subscription, "id" | "is_active">`, so once `notes` is a required field on `Subscription`, `handleAdd` must pass it — the compiler will point at the call site.
- Search fits naturally as a `useMemo` over `subscriptions` feeding the existing `active` / `cancelled` splits at `page.tsx:143-144`, which currently filter and sort the raw array. Filter first, then split, so AC-C9 falls out of the existing `active.length > 0 &&` guards without new conditionals.
- New i18n keys go in the `subscriptions` block of both `app/public/locales/{en,zh}/common.json`. Existing subscription keys are listed there; follow the naming already in use.
- The jsdom harness at `app/test/helpers/dom.js` already stubs `GET`/`POST`/`PATCH` on `/api/subscriptions` with a `SUBSCRIPTIONS` fixture, records writes via `subWrites`, and supports `failSubscriptionWrites` — a direct fit for AC-B6, B7, B10, B11 and the whole C group. `app/subscriptions/page.tsx` is already in `test:compile`. New test files must be added to the `test` script's explicit file list in `app/package.json`; `subscription-dates.render.test.js` is the closest existing model.

## Stage Report: spec

- DONE: Read the full ideation content in workflow/059-subscriptions-notes-search.md
  All 37 lines read — why, 2 user stories, 4 success criteria, 3 open questions, and the Plan's three spec-time decisions.
- DONE: Read app/app/subscriptions/page.tsx, the subscriptions handlers in functions/src/index.ts, the subscription service/type file, and any column-management scripts in functions/scripts/ relevant to the Subscriptions sheet
  Read page.tsx (718 lines), index.ts subscriptions block (:414-530) plus `ensureSubscriptionColumns` (:101-122) and `insertRowAtTop` (:200-229), sheetSchema.ts (192 lines), subscriptions.ts, subscriptionService.ts, apiClient.ts, scheduler.ts:240-275. functions/scripts/ holds no Subscriptions column script — column creation lives in `ensureSubscriptionColumns` in index.ts.
- DONE: Confirm whether the Subscriptions page already loads the full list client-side
  Yes. `getSubscriptions()` runs once on mount (page.tsx:82-87) and `GET /api/subscriptions` returns every row (index.ts:419-422). Client-side filtering confirmed correct; recorded as AC-C3 and in Out of Scope (no search endpoint).
- DONE: Write a complete Goal section
  One sentence covering both halves and the reason each exists.
- DONE: Write 2-4 User Stories
  Four, refined from the ideation's two — split so notes-capture and notes-display are separately checkable, and search-by-name and search-by-note are distinct.
- DONE: Write Acceptance Criteria covering notes add/edit/display, notes persistence without breaking existing rows/columns, search filtering behavior, non-regression, and safe column placement
  41 ACs in four groups: A (11, data layer), B (11, notes UI), C (13, search), D (6, non-regression). AC-A7 is the entity 053 guard — it names the surviving `rows.reduce(...Math.max(widest, r.length)...)` placement, requires a fixture with data under blank headers, and declares row-1-length placement a FAIL. AC-A1 is the second sheet-safety guard: `notes` must be `optional`, since a `required` entry 500s every subscriptions, insights, and scheduler call on any tab lacking the header.
- DONE: Write Edge Cases
  13 cases: blank notes on all existing rows, data under a blank header, a pre-existing `notes` header, duplicate headers, whitespace-only, over-cap, formula-injection characters, no search results vs. empty list, typing during load, offline read, offline write, concurrent edits, notes on a dead-category subscription.
- DONE: Write Out of Scope
  10 exclusions, including the two that were live risks: feeding subscription notes into scheduler-created expenses, and any hand-run migration/backfill script for the new column.
- DONE: State recommendation on bundled-vs-split scope explicitly
  Recommended bundled, in its own "Scope Recommendation" section: search's matching-fields design depends on notes existing (splitting causes rework), both halves edit the same file, and this repo needs a manual production deploy per entity. Named the asymmetry — notes touches the live sheet, search touches nothing — and required build to land notes first so search stays separable if the sheet write goes badly.
- DONE: Self-check every AC is binary/testable before finishing
  Re-read all 41. Each names a concrete observable: an HTTP status, a returned field value, a DOM element's presence or absence, a stored cell value, a compile result, or a command exit. No AC asks whether something "looks right" or is "clear". Verified every code reference cited (18 file:line pointers) against the files as they stand today.

### Summary

Wrote a full spec for entity 059 covering both halves — an optional per-subscription notes field and a live client-side search box — and recommended keeping them in one entity, with reasoning and an escape hatch if the sheet-column work turns risky during build. The two sheet-safety requirements are called out as explicit ACs rather than prose: the new column must be placed by the widest occupied row (the entity 053 data-destruction bug), and `notes` must be an `optional` spec field or every subscriptions, insights, and scheduler request 500s on deploy. Three decisions the ideation left open are settled in the spec: notes are searchable, the column is created on demand by the existing helper rather than by a migration script, and search sits between the header and the Active section filtering both sections. One design call is flagged for the captain at the gate — the 200-character note cap renders in full on the card with no truncation, and dropping it to 120 (matching entity 043) is a one-line change if cards read as too busy.
