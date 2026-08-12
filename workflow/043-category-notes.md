---
id: 043
title: Category Notes — Tooltip on Home
status: verify
source: captain
started: 2026-08-12T04:41:49Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-043-category-notes
issue:
pr:
---

Categories get ambiguous over time — what's the real difference between "Daily Necessities" and "Other," or why "Digital" covers phone bills. A short note attached to each category, set once, would let the captain remember the intended meaning instead of guessing from old entries months later.

## User Stories

- As the captain, I want to attach a short note to a category (e.g. "phone/internet bills, subscriptions") explaining what it's for, so I don't second-guess myself when logging or reviewing later.
- As the captain, when I tap a category on the Home screen, I want to see that note as a tooltip, so the reminder shows up right where I'm choosing a category, not buried in Settings.

## Success

- Each category (entity 003's Category Management) has an optional free-text note field, editable the same way name/icon/gov_category are edited today.
- Tapping a category on Home shows its note in a tooltip/popover, when one is set.
- A category with no note shows no tooltip — the field is optional, not required for every category.

### Out of Scope

- Per-expense notes — that's the existing `notes` field on an expense (entity 002/010). This is category-level, not expense-level.
- Showing the tooltip anywhere besides Home (Reports, History, Settings) — scope this to Home first.
- Rich text or images in the note — plain text only.

## Plan

Add a `note` field to the Categories tab and the `Category` type, editable via the existing Category Management edit form (entity 003's pattern). On Home, tapping a category today is already the quick-entry selection action — spec needs to decide how the tooltip triggers without conflicting with that (long-press, a small info icon, etc.), rather than assuming tap alone can do both jobs.

## Spec

### Goal

Give each category an optional short note recording what it's for, editable in Category Management and shown on Home for the currently selected category, so the captain stops re-deriving a category's intent from old entries.

### Trigger Decision — how the note surfaces on Home

The ideation flagged this as open, and it is the one design question that had to be settled before ACs could be written: tapping a category on Home already means "select this category for the expense I'm entering," so the note cannot hijack tap.

**Decided: tap keeps its single job (select), and the selected category's note renders as its own line inside the Home header, directly under the category name already displayed there (`app/app/page.tsx:127-130`).** The note appears the moment a category is selected — including the category restored from `localStorage` on page load — and is absent when the selected category has no note.

Why this over the alternatives the ideation listed:

- **Long-press on the tile** — no functional conflict with tap, but iOS Safari fires its native text-selection/callout on a long-press over a `<button>`, which needs explicit suppression, and the gesture is invisible: the captain has to already know the feature exists to ever see a note.
- **A small ⓘ badge on each tile** — the tile is currently a single `<button>` (`app/app/components/CategoryPicker.tsx:28-40`). A nested tap target means restructuring it into a wrapper with two sibling buttons, which puts the app's most-used interaction at regression risk for a read-only affordance. It also puts a badge on some tiles and not others across a 4-column grid of ~80px tiles.
- **A popover anchored to the tapped tile** — the grid lives inside `<div className="flex-1 min-h-0 overflow-y-auto">` (`app/app/page.tsx:154`). Anything anchored to a tile and extending past its own row is clipped by that scroll container and scrolls away with the grid. Escaping it requires a portal — disproportionate machinery for one line of text.

Two consequences worth naming before approval: the note is persistent rather than transient, so it is calmer but less attention-grabbing than a popover that pops; and `CategoryPicker.tsx` needs no change at all, so tap-to-select carries zero regression risk.

### User Stories

- As the captain, I want to attach a short note to a category in Category Management, so the category's intended meaning is recorded once instead of re-derived from old entries.
- As the captain, I want the selected category's note visible on Home while I am entering an expense, so the reminder reaches me at the moment I am choosing.
- As the captain, I want categories whose meaning is already obvious to stay visually clean, so the note is optional and a category without one shows nothing at all.

### Acceptance Criteria

Data layer

- [ ] AC-1 — `Category` in `app/app/lib/categories.ts` declares `note?: string` (optional, mirroring `gov_category?`), so `addCategory`'s existing `Omit<Category, "id" | "sort_order" | "is_active">` parameter type still compiles without passing a note.
- [ ] AC-2 — `GET /api/categories` returns a `note` string for every category, read from the Categories tab's column H. A category whose H cell is blank or absent returns `note: ""`, never `null` or `undefined`.
- [ ] AC-3 — `PATCH /api/categories/:id` with body `{"note": "phone bills"}` writes that value to column H of that category's row and leaves columns A–G byte-identical.
- [ ] AC-4 — `PATCH /api/categories/:id` with a body that omits `note` (e.g. a rename or a reorder) leaves the existing column H value unchanged. A pre-existing note must survive an unrelated edit.
- [ ] AC-5 — `POST /api/categories` writes the submitted `note` to column H, and writes `""` when no note is submitted.
- [ ] AC-6 — All of AC-2 through AC-5 hold whether or not cell H1 of the Categories tab contains the literal header text `note`. Reads and writes are positional, so the header label is cosmetic and must never be a precondition for the feature working.

Category Management (`app/app/settings/categories/page.tsx`)

- [ ] AC-7 — The edit form renders a Note field pre-filled with that category's current note; a category with no note shows an empty field.
- [ ] AC-8 — Saving the edit form with the Note field empty succeeds and produces no validation error, in contrast to `name_en` / `name_zh` / `gov_category`, which each still block save when empty.
- [ ] AC-9 — The Note input accepts at most 120 characters; input beyond 120 characters (typed or pasted) is not accepted.
- [ ] AC-10 — The note is trimmed before save: a note of only spaces or newlines is stored as `""` and is indistinguishable from never having set one.
- [ ] AC-11 — The add-category form renders the same Note field, also optional, and the submitted note is present on the created category returned by the API.
- [ ] AC-12 — The Note field's label renders from a translation key present in both `public/locales/en/common.json` and `public/locales/zh/common.json` — no hardcoded English string in the component.
- [ ] AC-13 — A failed note save rolls the list back to the pre-edit note and surfaces the existing error toast, matching the rollback already in place for name/icon/gov_category edits.

Home (`app/app/page.tsx`)

- [ ] AC-14 — When the selected category has a non-empty note, that note's exact text is present in the Home header, on its own line beneath the selected category's name.
- [ ] AC-15 — When the selected category's note is empty or absent, no note element is rendered in the header at all — the element is absent from the DOM, not merely empty or hidden, so it consumes no vertical space.
- [ ] AC-16 — Selecting category B while category A is selected replaces A's note with B's note without a page reload; selecting a category with no note removes the note line.
- [ ] AC-17 — The note renders inside the existing header block, not as an absolutely-positioned or portaled overlay; the category grid, keypad, date stepper, and Save button remain unobstructed with a note displayed.
- [ ] AC-18 — Tapping a category still sets it as the selected category and still persists it via `saveLastCategory`. `CategoryPicker`'s `onSelect` contract is unchanged. (Regression guard for the app's most-used interaction.)
- [ ] AC-19 — When `GET /api/categories` fails and Home falls back to `DEFAULT_CATEGORIES`, no note is rendered for any category — a stale or invented note must never appear.

### Edge Cases

- **Category has no note (the common case at launch)** — every category starts with an empty column H. Home renders no note line, and Category Management shows an empty, non-blocking field. This is the default state, not an error state.
- **Whitespace-only note** — trimmed to `""` on save (AC-10), so it behaves exactly as unset. Prevents an invisible note line that occupies header space with nothing in it.
- **Note longer than the cap** — the input hard-caps at 120 characters (AC-9), so no truncation-with-ellipsis path exists on Home and every saved note is always fully readable. No hidden content.
- **Offline / API fetch fails on Home** — `getCategories()` rejects, Home keeps `DEFAULT_CATEGORIES`, which carry no notes, so nothing renders (AC-19). Correct: no note beats a wrong note.
- **Offline / API fails on save** — the note reverts to its pre-edit value and the error toast fires (AC-13), reusing the snapshot-rollback already added for the other fields.
- **Unrelated edit to a category that has a note** — a rename, icon change, reorder, or archive/restore must not wipe column H (AC-4). The backend PATCH rewrites the whole row, so every write path has to carry the note through.
- **Sheet header cell H1 is unlabeled** — the existing header-write guard only fires when A1 is not `id` (`functions/src/index.ts:255`), so a sheet whose header row already exists will never gain an `H1` label on its own. The feature must work regardless (AC-6); typing `note` into H1 is a cosmetic one-time captain action, explicitly **not** a blocker for deploy. Entity 042 was blocked once on a production-sheet precondition; this spec deliberately avoids repeating that.
- **Two devices editing the same category at once** — the backend PATCH rewrites the full row, so last write wins and one note can clobber the other. This is pre-existing behavior for every category field, not introduced here; out of scope to fix.

### Implementation Notes

Non-binding, but these were confirmed by reading the code and will save the build agent a discovery pass:

- Column H is the next free column. `CATEGORIES_HEADER` (`functions/src/index.ts:17`) gains `"note"`; `rowToCategory` (`:73-83`) gains `note: row[7] ?? ""`; the `A:G` ranges at `:209`, `:265`, `:285`, `:308` and the `A1:G1` / `colLetter` values at `:250-258` become `A:H` / `H`.
- `functions/src/index.ts:223` reads `A:F` in the POST path — already one column short of `gov_category`. It only feeds id and sort_order computation, so it is harmless today, but leaving it at `A:F` while the row grows to H widens exactly the gap entity 047 exists to close. Widen it in passing.
- `updateCategory`'s `Partial<Pick<Category, ...>>` (`app/app/lib/categoryService.ts:25`) must list `"note"`, or TypeScript rejects the call before it reaches the network.
- `FormState` and `emptyForm` (`app/app/settings/categories/page.tsx:19-27`) gain a `note` field; `openEdit` (`:66-69`) pre-fills it; both `data` objects in `handleSave` (`:100-105`, `:139-144`) include `note: form.note.trim()`.
- Home reads the note off `selectedCat` (`app/app/page.tsx:42`), which already resolves against the live API list. No new fetch, no new state.
- The jsdom harness at `app/test/helpers/dom.js` already stubs `GET /api/categories` and supports an `offline` mode — a natural fit for AC-14, AC-15, and AC-19. Note that `test:compile` in `app/package.json` currently compiles only `app/history/page.tsx` and `app/subscriptions/page.tsx`; covering Home means adding `app/page.tsx` to that list.
- When entity 047 (read/write by column header) is built, its header-name map must include `note`, or this column silently drops out.

### Out of Scope

- Per-expense notes — the existing `notes` field on an expense (entities 002/010) is unrelated. This is category-level.
- Showing the note anywhere besides Home — Reports, History, Settings, the Edit Expense category picker, and the subscriptions picker all keep their current rendering.
- Rich text, links, images, or markdown in the note — plain text only.
- Bilingual notes (`note_en` / `note_zh`). One language-agnostic `note` field, matching the ideation's singular "a short note." See open question 2.
- Showing a note before selecting a category (hover, preview, a browse mode) — the note surfaces on selection only.
- Fixing the last-write-wins full-row PATCH, or converting reads to header-name lookups — that is entity 047.
- Backfilling notes for existing categories — every category starts empty and the captain fills them in as needed.

### Open Questions for Captain

1. **Persistent header line vs. a popover that pops.** The decision above trades salience for zero gesture conflict and zero clipping risk. If the note being always-on feels like wallpaper you stop reading, say so at this gate — switching to a transient, timed reveal is a small change now and a rewrite later.
2. **One note field, or `note_en` / `note_zh`?** Specced as one field, because the note is a private reminder for you rather than user-facing copy, and doubling it doubles the sheet columns and the form. Say so if you want it bilingual like the names.

**Captain decision, 2026-08-12:** (1) Persistent header line, as specced. (2) One field, as specced — the captain will always write it in Traditional Chinese in practice; no bilingual split, no language field, still plain free text with no language validation.

## Stage Report: spec

- DONE: Decide how the tooltip triggers on Home without conflicting with tap-to-select — the ideation flags this as an open question, don't just assume tap alone can do both jobs
  Decided in "Trigger Decision": tap keeps selection only; the note renders as a header line under the already-displayed category name. The three ideation alternatives (long-press, ⓘ badge, tile-anchored popover) are each rejected with a concrete code reason — the decisive one being that the grid sits in an `overflow-y-auto` container (`app/app/page.tsx:154`) that clips and scrolls any tile-anchored popover.
- DONE: Acceptance criteria are binary/testable, covering both saving/editing the note in Category Management and showing it (or not, when empty) on Home
  19 ACs: AC-1–AC-6 data layer, AC-7–AC-13 Category Management (including AC-8 empty-note-saves-clean and AC-10 whitespace-trims-to-empty), AC-14–AC-19 Home (AC-15 asserts DOM absence, not a hidden element; AC-18 is an explicit tap-to-select regression guard).
- DONE: Trace the actual Category Management edit form and Home tap handler in code before writing ACs, don't assume the shape from the ideation alone
  Read `settings/categories/page.tsx`, `page.tsx`, `CategoryPicker.tsx`, `lib/categories.ts`, `lib/categoryService.ts`, `functions/src/index.ts`, both locale files, and `test/helpers/dom.js`. Every Implementation Note cites a verified file:line; the trace is what produced AC-4 (unrelated edits must not wipe the note, because PATCH rewrites the whole row) and AC-6.

### Summary

The spec settles the ideation's open question by declining the popover framing: tap stays single-purpose and the note renders in the Home header, which removes the gesture conflict, the scroll-container clipping problem, and any need to touch `CategoryPicker.tsx` — so the app's most-used interaction carries no regression risk. Tracing the backend turned up two things the ideation could not have known: unrelated category edits would wipe the note unless every PATCH path carries column H through (AC-4), and the sheet's `H1` header label can never self-populate on an existing sheet, so AC-6 requires the feature to work without it — deliberately avoiding the production-sheet precondition that blocked entity 042. AC-1's "optional, not required" premise was checked with `tsc`, including a negative control confirming a required `note` breaks `addCategory`'s existing call site. Two open questions are flagged for the gate: persistent header line vs. a transient popover, and single vs. bilingual note.

## Implementation Plan (build)

Written before coding. Three layers, bottom-up, each with its own proof.

1. **Sheet column H (AC-1 to AC-6).** `CATEGORIES_HEADER` gains `"note"`; `rowToCategory` gains `note: row[7] ?? ""` (`??` not `||`, and `""` not `null` — unlike the adjacent `gov_category`, AC-2 forbids null). Every Categories range widens `G` → `H`: GET, PATCH read, PATCH write, POST append, POST header-check. POST's `A:F` read widens straight to `A:H` per the spec's passing-fix note. POST row gains `String(body.note ?? "")`; PATCH row gains `body.note !== undefined ? String(body.note) : (existing[7] ?? "")` — the `!== undefined` test is what makes AC-4 hold, since a rename sends no `note` key and must not blank column H.
2. **Type + client (AC-1).** `Category.note?: string` mirrors `gov_category?`, keeping `addCategory`'s `Omit<...>` parameter satisfiable without a note. `updateCategory`'s `Partial<Pick<...>>` gains `"note"`, or the PATCH call will not typecheck.
3. **Category Management form (AC-7 to AC-13).** `FormState`/`emptyForm` gain `note`; `openEdit` pre-fills `cat.note ?? ""`; both `handleSave` `data` objects carry `note: form.note.trim()`. The field is rendered with no `*` marker and is absent from the three validation guards, which is all AC-8 requires. The existing `preEditCat` snapshot rollback already covers the note once it is part of `data` (AC-13) — no new rollback code.
4. **Home header (AC-14 to AC-19).** A conditional sibling `<div>` between the name row and the amount, inside the existing header block. No new state, no new fetch, no portal, and `CategoryPicker` is untouched (AC-17, AC-18).

**Proof strategy.** AC-2 to AC-6 are round-trip claims about a Google Sheet, so they are proved by invoking the real exported `api` handler against an in-memory Sheets stub that parses A1 ranges — the assertions are on the bytes written to the fake sheet and the JSON returned, not on the source. AC-7 to AC-19 are rendering claims, proved by mounting the real page components in the existing jsdom harness; that requires adding `app/page.tsx` and `app/settings/categories/page.tsx` to `test:compile`, which currently covers only History and Subscriptions.

**One deviation from the spec's Implementation Notes, decided here.** The notes state that Home's `selectedCat` (`page.tsx:42`) "already resolves against the live API list." It does not, for the case that matters on load: `getDefaultCategory()` returns a `DEFAULT_CATEGORIES` slug (`eating-out`), which no live `cat_NNN` category has as its id, so the `??` falls through to the baked-in entry — which carries no note. Taken literally, the approved decision's "the note appears ... including the category restored from `localStorage` on page load" would be false on every fresh load. The fix is to read the note through the repo's existing slug→live bridge, `resolveCategory()`, rather than off `selectedCat`. `selectedCat` itself is deliberately left alone so the header's icon and name keep their exact current behavior and AC-18's most-used interaction carries no change at all.

## Stage Report: build

- DONE: Data layer: note field on Category type, GET/PATCH/POST round-trip through Categories tab column H, positional not header-dependent (AC-1 through AC-6)
  `567ebd9`. All 19 ACs met. `functions/test/categories.api.test.js` drives the real exported `api` handler against an in-memory Categories tab: GET returns `note: ""` for a blank AND an absent H cell (AC-2); a note PATCH writes H with A–G byte-identical (AC-3); a rename/archive/reorder leaves H intact (AC-4); POST writes the note or `""` (AC-5). Every case runs twice — once with H1 labelled, once unlabelled (AC-6) — and asserts H1 is still blank afterwards.
- DONE: Category Management edit and add forms: Note field, optional save, 120-char cap, trim-to-empty, translated label, rollback on failed save (AC-7 through AC-13)
  `567ebd9`. `app/test/category-notes.render.test.js` mounts the real page: pre-fill and empty-for-no-note (AC-7); empty note saves while `name_en` still blocks (AC-8); a 200-char paste lands as 120 (AC-9); whitespace leaves the page as `""` (AC-10); the add form's note reaches the API-returned category (AC-11); the label renders as the raw i18n key, so a hardcoded "Note" fails, plus both locale files carry it (AC-12); a 503 restores the pre-edit note and fires the error toast (AC-13).
- DONE: Home: note renders as its own line under the selected category name, absent (not hidden) when empty, updates on category switch with no reload, doesn't obstruct the grid/keypad/save button, and falls back to nothing (never a stale note) when the API fails (AC-14 through AC-19)
  `567ebd9`. Same file: the note is a distinct header child ordered between the name row and the amount (AC-14); an empty or whitespace-only note drops the element, asserted as a child-count decrease rather than a style check (AC-15); switching categories swaps it (AC-16); it is in-flow inside the header with nothing portaled to `body`, grid/keypad/date/Save all present (AC-17); tapping still selects and writes `expense_last_category_id` (AC-18); offline renders no note for any category (AC-19).

### Falsifiability

Every claim above was checked by mutating the source and confirming the right tests fail — not by pass counts. Backend: dropping `note` from `rowToCategory` fails 9/9; making PATCH always overwrite H fails AC-4; narrowing the PATCH write range to `G` fails 5; narrowing the GET range fails 3. Frontend: deleting the Home note line fails AC-14/15/16/17; rendering it unconditionally fails AC-15; dropping `.trim()` fails AC-15; using `selectedCat` instead of the bridge fails AC-14/15/16/17; dropping the note from the edit payload fails AC-8/AC-10; from the add payload fails AC-11; dropping the 120 slice fails AC-9; hardcoding the label fails AC-12; disabling the rollback fails AC-13. AC-1 is type-level: making `note` required makes `tsc` reject all 24 `DEFAULT_CATEGORIES` entries.

The first negative-control run found a hole in my own stub — it ignored a write range's end column, so a narrowed PATCH range passed. The stub now throws the way Sheets 400s, and that mutant is caught.

### Deviations and side effects

- **Home reads the note through `resolveCategory()`, not off `selectedCat`.** The spec's Implementation Notes assert `page.tsx:42` "already resolves against the live API list"; it does not for the case that matters. `getDefaultCategory()` returns a `DEFAULT_CATEGORIES` slug, which matches no live `cat_NNN` id, so `selectedCat` falls back to a baked-in entry — and baked-in entries carry no note. Left as specced, the approved "the note appears ... including the category restored from `localStorage` on page load" would be false on every fresh load. `selectedCat` is deliberately untouched, so the header icon/name and tap-to-select behave exactly as before.
- **Known limit of that bridge:** it resolves against Home's active-only list, so a note on an archived category would not surface. An archived category cannot be picked, and the fallback carries no note, so this fails closed — never a stale note.
- **Latent harness bug fixed, outside this feature's scope.** `test/helpers/dom.js` required `react-dom/client` before any DOM global existed, so react-dom decided at module-init that the native `input` event was unsupported and downgraded `onChange` to a keydown/selectionchange polyfill. Dispatched `input` events updated the DOM node but never reached React. Any future controlled-input assertion would have passed vacuously; AC-13 did, until this was found. The fix is ordering only — install a DOM before the require.
- **`test:compile` now also builds `app/page.tsx` and `app/settings/categories/page.tsx`**, and the shared fixtures gained `gov_category` (without it no save in Category Management can pass validation) and `note`. Pre-existing tests are unaffected: 13/13 before, 13/13 after.
- **Merge note for the captain:** entity 048 is editing the same Category Management page and the same harness on its own branch; expect a conflict there.

### Verification

`npm test` in `app/`: 26 pass, 0 fail (13 pre-existing + 13 new). `node --test test/` in `functions/`: 21 pass, 0 fail (12 pre-existing + 9 new). `npm run build` in `app/`: Next.js production build succeeds, all 14 routes generated. No deploy was run.

### Summary

The note round-trips through a new column H that is read and written positionally, so it works on the production sheet with no captain action and no precondition — deliberately avoiding the blocker that stopped entity 042. The one judgement call worth the reviewer's attention is Home reading the note through `resolveCategory()`: the spec assumed a resolution that does not happen on page load, and without the bridge the feature would render nothing until the captain first tapped a tile. Tap-to-select and the header's icon/name are untouched, so AC-18's regression surface carries no change at all.
