---
id: 045
title: Category Rename Doesn't Persist to Production Sheet
status: ideation
source: captain (found manually testing in production)
started:
completed: 2026-08-01
verdict: MERGED into 044
score:
worktree:
issue:
pr:
---

**Merged into entity 044** (Reports/History Show Stale or Wrong Category & Payer Names) — same class of bug, same suspect file (`reportService.ts`). Archived here unbuilt; see 044 for the live scope.

Renaming a category in Settings → Category Management is supposed to update the Categories tab and have every screen that shows that category reflect the new name immediately (entity 003's approved spec, AC: "the change is immediately reflected everywhere the category name is displayed"). It doesn't: the captain renamed a category in the webapp, and the change shows up in none of — the production Categories sheet, History, or Reports.

## User Stories

- As the captain, when I rename a category, I want the new name saved to the Categories sheet, so the rename is real and permanent, not just a local UI change.
- As the captain, when I rename a category, I want History and Reports to show the new name immediately, so I'm not looking at stale labels everywhere the category appears.

## Success

- Renaming a category in Category Management writes `name_en`/`name_zh` to the correct row in the production Categories tab.
- After a rename, reloading History and Reports shows the new name — no stale cached label anywhere.
- The rename UI itself gives some confirmation the save actually happened (or an error if it didn't), rather than silently appearing to work while nothing was written.

### Out of Scope

- Any other category field (icon, sort_order, gov_category, is_active) — scope this to name_en/name_zh unless investigation shows they share the same broken path
- Adding new categories or archiving existing ones (entity 003's other flows) — not reported as broken

## Plan

Investigate where the break actually is before assuming a fix — candidates worth checking first: whether the category edit form's Save action calls the update API at all; whether the Firebase Function's category PATCH endpoint writes to the same Sheet range the app reads from (entity 042's spec investigation already found the category PATCH endpoint has at least one column-range bug affecting `gov_category` — this may be the same endpoint, possibly the same root cause, possibly a second bug in it); and whether History/Reports cache category metadata in a way that wouldn't pick up a successful write anyway.
