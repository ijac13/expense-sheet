---
id: "008"
title: Data Migration
status: ideation
source: commission seed
started:
completed:
verdict:
score: 0.7
worktree:
issue:
pr:
---

I have old expense data in Excel or CSV format with a different column structure. This needs to be mapped to the new Expenses tab schema and imported into the production Google Spreadsheet so historical data is available from day one.

## What's needed

- Inspect the old file and document its column structure
- Map old columns to new schema (date, amount, category_id, paid_by, notes, etc.)
- Handle mismatches: categories that don't exist yet, missing fields, different date formats, amounts in different currencies or formats
- Write a migration script that reads the old file, transforms each row, and writes to the Expenses tab
- Validate the result: row count matches, amounts sum correctly, no data lost

## Open questions (to answer when starting this entity)

- Where is the old file? What format — Excel (.xlsx) or CSV?
- What columns does it have?
- Are there multiple files (e.g., one per year)?
- Are categories in the old data names or codes? How do they map to the 22 default categories?
- Does the old data have a "paid by" field, or was it single-user?

## Notes

- This runs after project setup is complete — needs the production Spreadsheet to exist
- Migration is a one-time operation, not a recurring feature
- The migration script should be committed to the repo under `scripts/migrate.js` (or similar) so it's reproducible if needed again
- Run against the staging Spreadsheet first to validate before touching production
