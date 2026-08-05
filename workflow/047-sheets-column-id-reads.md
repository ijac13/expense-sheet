---
id: 047
title: Read/Write Sheets Data by Column Header, Not Column Position
status: ideation
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

The backend reads and writes Google Sheets rows by fixed column position (e.g. "column D", ranges like `A:F`/`A:G`/`A:H`) instead of matching each field by its header name (e.g. `category_id`). This is fragile: inserting, reordering, or renaming a column in the Sheet silently breaks the mapping — no error, just wrong data landing in the wrong field. Already bit us twice: entity 042 found `gov_category` unreadable because the read range stopped one column short of where it actually lives, and entity 044 found category/payer names resolved against a hardcoded list rather than live data. Both are symptoms of the same root cause — code assumes a fixed column shape instead of reading it from the Sheet itself.

## User Stories

- As the captain, I want the app to read/write Sheet columns by their header name instead of a fixed column letter or number, so adding, reordering, or renaming a column in the Sheet doesn't silently corrupt data.
- As a future maintainer (including AI agents building features), I want column mapping to be self-documenting from the Sheet's own header row, so a new feature doesn't have to hardcode "column D means category_id" by reading source code.

## Success

- Every Sheets read/write in the backend resolves columns by matching the header row to expected field names, not by hardcoded column letters or fixed ranges.
- Reordering two columns in a Sheet tab does not break reads or writes — demonstrated live.
- A missing or renamed expected header produces a clear error instead of silently misreading or miswriting.

### Out of Scope

- Changing the actual schema or field names themselves
- Migrating or reshaping existing sheet data
- Re-litigating entity 042 or entity 044's specific fixes — this is about the underlying pattern going forward

## Plan

Read each tab's header row once (cache it), build a name-to-column-index map, and use that map everywhere instead of hardcoded ranges/letters. Likely touches every Sheets read/write in the Firebase Functions backend — spec should scope how much of this lands in one pass versus being tackled incrementally.
