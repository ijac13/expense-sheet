---
id: 042
title: Split Insurance and Tax Out of "Other" Category
status: spec
source: captain (category analysis of expense-sheet-prod data, 2026-05 to 2026-07)
started: 2026-07-29T12:50:24Z
completed:
verdict:
score:
worktree:
issue:
pr:
---

"Other" has become a catch-all mixing two unrelated, recurring patterns — insurance premiums and government tax payments — instead of holding genuinely miscellaneous spend. Analysis of the last 3 months of production data shows all 4 "Other" entries (NT$154,249 total) are actually one of these two: NT$123,176 income tax + NT$1,001 house tax, and NT$15,010 + NT$15,062 insurance premiums. A third insurance premium (NT$5,268, "ijac 國壽保費") is separately buried under Medical. Neither pattern is visible in the gov_category breakdown today — no category currently maps to `insurance_financial`, and tax has no home at all.

## User Stories

- As a user, I want a dedicated Insurance category so premium payments are visible on their own instead of buried in Other or Medical.
- As a user, I want a dedicated Tax category so tax payments (income tax, house tax) are visible on their own instead of buried in Other.
- As a user, I want both new categories mapped to the correct gov_category so the government-category report reflects them accurately.

## Success

- Two new categories exist: Insurance (保險) and Tax (稅金).
- Insurance maps to `gov_category: insurance_financial`.
- Tax maps to `gov_category: miscellaneous` — Taiwan's household consumption survey (entity 036's fixed 10-value enum) has no tax classification, so there is no better fit; extending the enum is explicitly out of scope.
- The 3 known historical insurance entries (2 currently in Other, 1 in Medical) are retagged to Insurance.
- The 2 known historical tax entries (both currently in Other) are retagged to Tax.
- The recurring "房屋稅" subscription (currently `category_id: other`) is updated to Tax so future auto-generated entries land correctly.
- After retagging, "Other" holds zero entries for the last 3 months of data — confirming these two categories account for everything "Other" previously caught.

### Out of Scope

- Adding a new gov_category enum value for tax — the 10-value enum (entity 036) is fixed and exhaustive; extending it is a separate decision
- Re-auditing any other category for further splits beyond Insurance and Tax

## Plan

- Add two rows to the Categories tab: Insurance (`gov_category: insurance_financial`) and Tax (`gov_category: miscellaneous`), following the category-system (003) add-category flow
- Edit the 5 known historical expense entries via edit-delete-expense (010) to point to the new category_ids
- Update the `房屋稅` subscription row's `category_id` to Tax
