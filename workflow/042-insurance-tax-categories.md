---
id: 042
title: Split Insurance and Tax Out of "Other" Category
status: build
source: captain (category analysis of expense-sheet-prod data, 2026-05 to 2026-07)
started: 2026-07-29T12:50:24Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-042-insurance-tax-categories
issue:
pr:
mod-block: captain-action:category-scheme-mismatch-discovered-see-body
---

**Blocked, 2026-08-05:** running the build script's dry-run against real production surfaced a wrong core assumption — production's actual Categories tab uses `cat_001`…`cat_023` ids (e.g. `cat_004` = Medical), not the readable slugs (`medical`, `other`) this entity's spec/build assumed were already there. Confirmed live against the real production sheet, not staging. Captain confirmed production Reports/History already show raw `cat_00X`-looking text instead of names — the exact symptom entity 044 exists to fix. Captain's call: fix 044 first (it's the root cause — hardcoded `DEFAULT_CATEGORIES` resolution vs the live category list), then revisit whether 042 should add slug categories alongside the existing cat_NNN ones, or whether the category scheme itself needs to be addressed first. Do not run the live (non-dry-run) migration script until this is resolved — it correctly halted itself on this exact mismatch.

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

---

## Spec

### Goal

Give insurance premiums and tax payments their own expense categories, each mapped to the correct `gov_category`, and retag the known historical entries so the split is visible in existing data instead of hidden inside "Other".

### User Stories

- As the captain, I want a dedicated Insurance category so premium payments show as their own line in the category breakdown instead of being split between Other and Medical.
- As the captain, I want a dedicated Tax category so income tax and house tax show as their own line instead of inflating Other.
- As the captain, I want both new categories to carry a `gov_category` so the category settings list shows their government classification like every other category.
- As the captain, I want the recurring 房屋稅 subscription filed under Tax so next year's auto-generated entry lands correctly without me touching it.

### Category Definitions

| Field | Insurance | Tax |
|---|---|---|
| `id` | `insurance` | `tax` |
| `name_en` | Insurance | Tax |
| `name_zh` | 保險 | 稅金 |
| `icon` | 🛡️ | 🧾 |
| `sort_order` | 23 | 24 |
| `is_active` | true | true |
| `gov_category` | `insurance_financial` | `miscellaneous` |

Slug ids (not `cat_NNN`) because every existing `category_id` in production is a slug — `other`, `medical` — and three UI surfaces resolve category metadata by slug against the hard-coded `DEFAULT_CATEGORIES` list rather than the API.

### Acceptance Criteria

**Category definitions**

| # | Criterion |
|---|---|
| AC-1 | `DEFAULT_CATEGORIES` in `app/app/lib/categories.ts` contains two new entries matching the Category Definitions table field-for-field. The 22 existing entries are unchanged. |
| AC-2 | `CATEGORY_ICONS` in the same file has keys `insurance` and `tax`, so `TodayExpenseList` renders a real icon rather than its `Package` fallback (`TodayExpenseList.tsx:25`). |
| AC-3 | The production Categories tab has exactly one row per new category, `id` cells reading exactly `insurance` and `tax`, columns A–G matching the Category Definitions table. |
| AC-4 | The subscription category picker (`subscriptions/page.tsx:320,416`) lists Insurance and Tax as selectable options. |

**gov_category round-trip — prerequisite, see Assumptions**

| # | Criterion |
|---|---|
| AC-5 | `GET /api/categories` returns a non-null `gov_category` for every category whose column G is non-empty. Today the read range is `A:F` (`functions/src/index.ts:208`), so `rowToCategory` reads `row[6]` as undefined and every category returns `gov_category: null`. |
| AC-6 | A `PATCH /api/categories/:id` body that omits `gov_category` leaves column G unchanged. Today the handler reads `A:F` then writes `A:G` with `existing[6] ?? ""` (`index.ts:284,302,307`), so archive, restore, and reorder each blank the mapping. |
| AC-7 | On the category settings page after a full reload, Insurance shows 保險及金融服務 and Tax shows 其他, and neither row shows the 未設定 badge. |

**Retagging**

| # | Criterion |
|---|---|
| AC-8 | These 5 expenses have the stated `category_id` in the production Expenses tab. Build records each row's actual `id` so verify can re-check by id. |
| AC-9 | The Subscriptions row named 房屋稅 has `category_id: tax`; its `id`, `name`, `amount`, `frequency`, `due_day`, `due_month`, `paid_by`, `is_active` are byte-identical to before. |
| AC-10 | No expense dated 2026-05-01 through 2026-07-31 has `category_id: other`. |
| AC-11 | For 2026-05-01 through 2026-07-31: Insurance totals NT$35,340, Tax totals NT$124,177, Medical is NT$5,268 lower than before the change, and Other is absent from the breakdown. |
| AC-12 | The reports category breakdown for that window renders "Insurance" and "Tax" with their emoji, not raw ids — confirming `getCatMeta` (`reportService.ts:24`) resolves both. |

AC-8 target rows:

| Amount | Current category | Identifier | New `category_id` |
|---|---|---|---|
| NT$123,176 | `other` | income tax | `tax` |
| NT$1,001 | `other` | house tax (房屋稅) | `tax` |
| NT$15,010 | `other` | insurance premium | `insurance` |
| NT$15,062 | `other` | insurance premium | `insurance` |
| NT$5,268 | `medical` | notes `ijac 國壽保費` | `insurance` |

### Edge Cases

- **A category added through the settings UI cannot satisfy AC-3.** `POST /api/categories` generates the id itself as `cat_NNN` from the max existing numeric suffix (`index.ts:227-232`); it cannot be told to use `insurance`. A `cat_023` category would miss `DEFAULT_CATEGORIES`, so reports would print the raw id, the home list would show the `Package` fallback, and the subscription picker would omit it entirely. The rows must be written with the intended ids by another route.
- **`apps-script/seed-categories.gs` is stale.** It seeds ids `cat_001`–`cat_022`, which match nothing in `DEFAULT_CATEGORIES`. Do not extend or run it for these two rows.
- **Retagging the subscription does not retag the expense it already generated.** The NT$1,001 house-tax expense and the 房屋稅 subscription row are separate writes; AC-8 and AC-9 both have to happen.
- **房屋稅 is annual**, so the next auto-generated entry is roughly 2027-05 — far past verify. AC-9 asserts the stored `category_id` instead, which is what `subscription-scheduler.gs:48` copies into the new expense row.
- **A new "Other" expense logged between build and verify** breaks AC-10. Verify re-runs the check; if a genuinely miscellaneous entry has appeared, the captain confirms it and AC-10 is amended to name that row as the allowed exception.
- **Entity 008 (data migration) imports 2025 rows into `other`**, including `ijac保險`, `保費`, and `房屋險`. AC-10 and AC-11 are scoped to 2026-05-01 through 2026-07-31, so they hold regardless of whether 008 lands first.
- **Column G may already be blank for some of the 22 existing categories**, wiped by the AC-6 defect via archive, restore, or the reorder arrows. Fixing the leak does not restore what was already lost.
- **Two users editing categories at once** is unhandled, per entity 003's out-of-scope list.

### Assumptions

- **Production `category_id` values are slugs.** Evidence: the entity body records the 房屋稅 subscription as `category_id: other`; entity 008's mapping table targets slugs; and reports have been rendering category names correctly, which only happens when ids match `DEFAULT_CATEGORIES`. Build confirms this by reading the Categories tab before writing, and halts if the ids are `cat_NNN`.
- **AC-5 and AC-6 are pulled in as prerequisites.** They are a two-range change (`A:F` → `A:G`), and without them this feature cannot demonstrate its own success criterion: the mapping never reaches the UI, and the next reorder or archive erases it. Splitting them into a separate entity is a reasonable call for the captain to make instead — it would leave AC-7 unverifiable here.
- **`app/scripts/migrate-gov-category.ts` targets Firestore, not Sheets**, so it plays no part in this feature.

### Out of Scope

- Adding a gov_category enum value for tax — entity 036's 10 values are fixed and exhaustive
- Re-auditing any other category for further splits
- A report grouped by `gov_category` — no such view exists today; reports break down by category, and `gov_category` appears only on the category settings list
- Retagging the 2025 rows entity 008 imports into `other`, or changing 008's mapping table to route 保險/保費/房屋險/汽車稅 into the new categories
- Backfilling `gov_category` for any of the 22 existing categories whose column G was already blanked
- Archiving or deleting the Other category — it stays active for genuinely miscellaneous spend
- Migrating `seed-categories.gs` onto slug ids

## Stage Report: spec

- DONE: Spec has Goal, User Stories, Acceptance Criteria (binary/testable), Edge Cases, Out of Scope per README Spec Template
  All five template sections present (headings at lines 48/52/73/112/129), plus Category Definitions and Assumptions; every AC resolves on an observable value — a file's contents, a sheet cell, an API field, a rendered label, or a sum.
- DONE: Acceptance criteria cover both new categories' gov_category mapping and the retagging of the 5 known historical expense entries plus the recurring house-tax subscription
  AC-1/AC-3 pin `insurance`→`insurance_financial` and `tax`→`miscellaneous` in code and in the sheet; AC-7 asserts both labels render unflagged; AC-8 tables all 5 expenses by amount and source category; AC-9 covers the 房屋稅 subscription row.
- DONE: Out of Scope explicitly excludes extending the gov_category enum itself (entity 036's 10 values stay fixed)
  First Out of Scope bullet; the Tax→`miscellaneous` choice is justified in the ideation body as "no better fit" rather than as a reason to extend the enum.

### Summary

Two research findings reshaped the plan. First, the ideation's "follow the 003 add-category flow" cannot work: `POST /api/categories` generates ids as `cat_NNN` (`functions/src/index.ts:227-232`) and cannot be told to use `insurance`, while `reportService.ts:24`, `TodayExpenseList.tsx:24`, and `subscriptions/page.tsx:14,320,416` all resolve category metadata against the hard-coded `DEFAULT_CATEGORIES` slug list rather than the API — so a UI-created category would render as a raw id in reports and be absent from the subscription picker that AC-9 depends on. The spec therefore requires slug ids written to both code and sheet.

Second, `gov_category` does not round-trip today. GET and PATCH both read `Categories!A:F` while the field lives in column G, so `rowToCategory` sees `row[6]` as undefined. Verified by running both code paths against a 6-cell row: GET yields `gov_category: null`, and a PATCH omitting the field (what archive, restore, and the reorder arrows all send) rewrites column G to `""`. This feature's central claim — that Insurance maps to `insurance_financial` — is unobservable and self-erasing without a fix, so AC-5/AC-6 are pulled in as prerequisites and flagged in Assumptions as a split-out call the captain may prefer to make.

The zero-Other criterion is window-scoped to 2026-05-01 through 2026-07-31 because entity 008 imports 2025 rows into `other`, several of them insurance-flavored (`ijac保險`, `保費`, `房屋險`); scoping keeps AC-10 and AC-11 valid whichever entity lands first.
