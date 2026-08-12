---
id: 048
title: Category Edit Form Doesn't Open in Category Management
status: spec
source: captain (found manually testing entity 044 on staging)
started: 2026-08-12T04:41:49Z
completed:
verdict:
score:
worktree:
issue:
pr:
---

Tapping a category's Edit button in Settings → Category Management does nothing — no form, no modal, no visible response at all, every time. Confirmed pre-existing and unrelated to entity 044: the button/open-form code (`openEdit`, `isFormOpen`, the button's `onClick`) is byte-identical between `main` and entity 044's branch, and a static read of that logic shows nothing obviously wrong — this needs live/runtime investigation (browser console error, event handler not attaching, an overlay blocking the click target, a hydration issue, etc.), not a guessed fix.

## User Stories

- As the captain, I want tapping a category's Edit button to actually open the edit form, so I can change its name, icon, or gov_category.

## Success

- Tapping Edit on any active category opens the edit form, pre-filled with that category's current values, every time.
- Root cause is identified and documented (from live reproduction, not a guess) before a fix is written.

### Out of Scope

- The save-confirmation/error-toast behavior itself — already fixed by entity 044. This is specifically about the form never opening in the first place.

## Plan

Reproduce live against staging with browser devtools open (console errors, whether the click handler fires at all). Compare against the "Add category" button, which uses the same `setFormMode` mechanism and doesn't appear to be broken — the difference between the two paths is the likely lead.

## Root Cause

**The form is not failing to open. It opens correctly, off-screen, and nothing scrolls it into view.**

The edit form is not a modal — it is rendered inline in normal document flow at
`app/app/settings/categories/page.tsx:260`, between the page header and the active-category
list. It therefore always appears at the *top of the page*, no matter which row's Edit was
tapped. `openEdit` (`page.tsx:66-69`) only calls `setForm` + `setFormMode`; there is no
`scrollIntoView`, no `scrollTo`, and no focus move anywhere in this page.

On the captain's device the active list is ~18 rows, so nearly every Edit button sits well
below the fold. Tapping one inserts roughly 380 CSS px of form *above* the current scroll
position. Chrome then applies scroll anchoring — which this app never disables
(`overflow-anchor` appears 0 times in the shipped CSS) — and compensates `scrollTop` so the
visible rows do not move. The user sees literally nothing change. Every time.

Why "Add category" looks healthy: that button lives in the page header, so it is only
tappable while scrolled to the top — exactly where the form appears.

The decisive discriminator against the guessed causes: the ↑/↓ reorder buttons sit 4 px from
Edit inside the same row and work. So the handler attaches, the click lands, and nothing
overlays the row. Reorder's effect is visible in place; Edit's effect is 380+ px above the
viewport.

### Evidence

- **Live browser reproduction was not possible in this sandbox** — stated plainly, as asked.
  Chrome cannot launch at all here (`dlopen ... Google Chrome Framework: blocked by sandbox`,
  reproduced with the bash sandbox disabled too), and the app sits behind a Google sign-in
  that cannot run headlessly (the repo's own harness records this at
  `app/test/helpers/dom.js:3-4`). Investigation was adapted to: mounting the real compiled
  page component and driving real clicks, plus reading the actually-shipped CSS.
- Mounted the real `settings/categories/page.tsx` and dispatched a real click on the Edit
  button of row 10 of 18: the form **opens**, titled 編輯分類, pre-filled `🍕 / Fuel / 加油`;
  the Add button disappears; **zero** console errors. So: not a dead handler, not a console
  error, not a hydration failure.
- In the resulting DOM the form is element index **6** while the row that was clicked is
  element index **146** — the form renders far above the row, confirmed by
  `compareDocumentPosition`.
- Instrumenting `scrollIntoView`, `window.scrollTo` and `focus` during that click records
  **(NONE)**.
- Shipped CSS `out/_next/static/chunks/0r9u1ja0en03n.css`: `.card{…position:relative}` — the
  form is in normal flow and occupies layout space. Contrast `.toast{…position:fixed}`, the
  viewport-anchored primitive the same page already uses for the save toast.
- `grep` over `app/`: no `scrollIntoView` / `scrollTo` / `autoFocus` in the categories page
  (count 0). Elsewhere the app source uses `window.scrollTo` (`reports/DrillDown.tsx:47`) and
  `autoFocus` (`history/page.tsx:440`); `scrollIntoView` appears **nowhere** in app source —
  only in `node_modules` type definitions.
- Captain screenshots `feedback-screenshots/category-003.png`, `category-004.png` confirm the
  real conditions: Android Chrome, 1080×2400, a long list, scrolled far past the header.

## Spec

### Goal

Make the category edit form land where the captain is looking, so tapping Edit on any row —
including rows far below the fold — visibly opens a pre-filled form instead of appearing to do
nothing.

### User Stories

- As the captain, I want tapping Edit on any category to visibly open its edit form, so I can
  change its name, icon, or gov_category without wondering whether the tap registered.
- As the captain, I want the form to show which category I'm editing and its current values, so
  I don't overwrite the wrong row.
- As the captain, I want to keep my place in a long category list after I cancel or save, so I
  can edit several categories in a row without re-scrolling each time.

### Acceptance Criteria

- [ ] **AC-1** — On a 390×780 CSS-px viewport with ≥15 active categories, tapping Edit on the
      *first*, a *middle*, and the *last* row each results in the edit form being visible in the
      viewport with no further scrolling by the user. Binary check: after the tap, the form
      element's bounding rect intersects the viewport and its top edge is ≥ 0.
- [ ] **AC-2** — The opened form is pre-filled from the tapped row: icon, English name, and
      Chinese name fields equal that category's stored values.
- [ ] **AC-3** — The gov_category select shows the tapped category's stored `gov_category`
      selected. When the category has no `gov_category`, the select shows the placeholder option
      and the form still opens normally.
- [ ] **AC-4** — The open form identifies the edit target: its title is `cat_mgmt.form_edit`
      ("Edit Category" / 編輯分類), not the add title.
- [ ] **AC-5** — Tapping Edit on row B while row A's form is already open switches the form to
      row B's values and brings it into view; no second form is rendered.
- [ ] **AC-6** — Tapping "+ Add Category" from the top of the page still opens an empty add form
      in view (no regression to the working path).
- [ ] **AC-7** — After Cancel, the row that was being edited is visible in the viewport (the
      captain keeps their place; closing the form must not throw them 380 px off).
- [ ] **AC-8** — After a successful Save from a below-the-fold row, the captain can see the
      result: the edited row is visible in the viewport and the success toast is on screen.
- [ ] **AC-9** — A regression test lands in `app/test/` and runs under `npm test`. It mounts the
      real categories page against a ≥15-row fixture, clicks Edit on a below-the-fold row, and
      asserts the form is brought into view. It must **fail on current `main`** and pass after
      the fix — the stage report must show both results.
- [ ] **AC-10** — `npm test` passes with all pre-existing tests still green.

### Edge Cases

- **List shorter than the viewport (1–3 categories).** The form is already fully visible; the
  fix must not produce a visible scroll jump in this case.
- **Form taller than the viewport** (small phone in landscape, or `data-font-size: large` via
  `FontSizeProvider`). The form's *top* must be visible and the first field reachable; the form
  may extend below the fold.
- **Edit tapped on the very last row**, where there is no content below to scroll past.
- **Archive from inside the open form** (`handleArchive` calls `closeForm`): the list must remain
  usable and the captain must not be thrown to an unrelated scroll position.
- **Category with a blank icon** — form opens with an empty icon field showing the 📦
  placeholder, not a crash.
- **Category API down** (`getCategories` rejects): the list is empty, there are no Edit buttons,
  and the page still renders. No regression.
- **Staging banner.** `StagingBanner` is a `fixed top-0 … h-6 z-50` bar and page content has no
  top padding, so the top 24 px of the viewport is covered on staging. Whatever brings the form
  into view must not park it under that bar.
- **Two categories edited back to back** without leaving the page.

### Implementation Notes (non-binding — build chooses)

Outcome first: the form must be where the captain is looking. Two viable routes —

1. **Keep it inline, scroll it into view.** Add a ref to the form card and
   `scrollIntoView({ block: "center" })` after `setFormMode`. Smallest diff. Note this
   introduces `scrollIntoView` as a *new* API for this codebase (only `window.scrollTo` and
   `autoFocus` are used today), so it is not the "matches existing conventions" option it
   first appears to be. Needs care for AC-7 (restore scroll on close), for the short-list edge
   case, and for the `StagingBanner` edge case — `block: "center"` clears the 24 px bar, but
   `block: "start"` would park the form under it.
2. **Make it a real modal** (daisyUI `<dialog className="modal">`). Viewport-anchored by
   construction, so AC-1/AC-7/AC-8 fall out for free and scroll anchoring stops mattering; the
   page already uses daisyUI's fixed-position `toast`. Larger diff, and needs Esc/backdrop
   dismiss wired to `closeForm`.

Route 2 is the more robust fix for a phone-first app; route 1 is the cheaper one.

### Out of Scope

- Save-confirmation / error-toast behavior — entity 044.
- `gov_category` data backfill or option list — entity 042.
- Category icon resolution — entity 049.
- Redesigning the category row layout, the archived section, or reorder.
- Adding top padding to compensate for `StagingBanner` globally (worth its own entity).

## Stage Report: spec

- DONE: Review the already-written spec at this entity file for internal consistency and
  completeness — do not redo the investigation or second-guess the root cause unless you find
  it's actually wrong
  Re-ran every cited anchor against the tree; the root cause holds and one factual error in the
  Evidence section was found and corrected (details below).
- DONE: Write the closing Stage Report: spec section (DONE/SKIPPED/FAILED against the
  checklist, with evidence) and commit
  This section; committed with the two Evidence/Implementation-Notes corrections.

### Review findings

- **Root cause stands.** Verified independently: the form renders inline at `page.tsx:260`
  (`{isFormOpen && (<div className="card …">`), `openEdit` at `page.tsx:66-69` calls only
  `setForm` + `setFormMode`, the categories page contains 0 occurrences of
  `scrollIntoView`/`scrollTo`/`autoFocus`, shipped CSS has `.card{…position:relative}` vs
  `.toast{…position:fixed;…bottom:1rem}`, and `overflow-anchor` count is 0. Nothing contradicts
  the off-screen-render diagnosis.
- **CORRECTED — one wrong citation.** The Evidence bullet claimed the codebase "uses all three
  elsewhere (`reports/DrillDown.tsx:47`, `page.tsx:222`, `history/page.tsx:440`)".
  `scrollIntoView` appears **nowhere** in app source (only `node_modules` type defs), and
  `page.tsx:222` resolves to unrelated lines in every candidate page. Rewrote the bullet, and
  softened Implementation Notes route 1, which had sold `scrollIntoView` as "matches existing
  conventions" — it would be a new API here. This is load-bearing for the build stage's
  route choice, so it was worth fixing rather than noting.
- **AC-4 exact strings confirmed:** `cat_mgmt.form_edit` = "Edit Category" / 編輯分類 in
  `app/public/locales/{en,zh}/common.json:89`. AC-4 is checkable as written.
- **AC-3 is supported by the code:** `openEdit` does `gov_category: cat.gov_category ?? ""`, so
  the no-gov_category → placeholder path exists rather than being aspirational.
- **Out-of-scope deferrals are real:** 042, 044, 049 are all `status: done` / `verdict: PASSED`
  in `workflow/_archive/`. Nothing is deferred to work that does not exist.
- **`StagingBanner` edge case verified verbatim:** `fixed top-0 left-0 right-0 z-50 h-6` at
  `app/app/components/StagingBanner.tsx:4`.
- **Flagged, not rewritten:** the Success bullet asks that root cause come "from live
  reproduction, not a guess", but Evidence documents that live browser repro was impossible in
  this sandbox (Chrome blocked; Google sign-in not headless-able). The adapted method — mounting
  the real page and driving real clicks — meets the intent, but the captain authored that line,
  so the captain should confirm the substitution rather than have it edited away.
- **Minor, left as-is:** AC-8's "success toast is on screen" is trivially true given
  `.toast{position:fixed}`; the discriminating half of AC-8 is "the edited row is visible".

### Summary

Reviewed the spec written in cycle 1 rather than re-investigating. The root cause, all ten
acceptance criteria, and the edge-case list are internally consistent and independently
checkable; every file/line/string citation was re-verified against the tree and all but one
held. The exception — a claim that `scrollIntoView` is already used in this codebase — was
factually wrong and would have biased the build stage toward route 1 for a bad reason, so it
was corrected in both places it appeared. One captain-authored tension (live-reproduction
requirement vs. a sandbox where that was impossible) is surfaced for the gate rather than
silently resolved.
