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
pr: "#18"
mod-block: merge:pr-merge
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
