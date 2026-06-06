---
id: "036"
title: Category → Government Category Mapping
status: done
source: captain
started: 2026-05-21T03:07:30Z
completed: 2026-06-06T02:14:29Z
verdict: PASSED
score:
worktree: 
issue:
pr: "#11"
mod-block: 
---

Every expense category maps to a `gov_category` — a government-defined classification. The mapping is set when a category is created, existing categories get mapped on launch, and the mapping is visible in the UI as reference information.

## Why This Matters

Taiwan household expense tracking often needs to align with government tax categories (e.g. for deductible expenses, annual tax filing, or health insurance reporting). Without a canonical mapping, every export or report has to re-derive the classification manually.

## What the Captain Said

> "Every category should map to gov_category. When created, I add mapping for existing categories. Show the mapping on the UI as information."

Key signals:
- The mapping is **captain-defined**, not auto-generated
- Existing categories need to be mapped retroactively on launch
- The UI shows the mapping as **read-only information** (not editable by end users inline)

## Open Questions

1. What are the valid `gov_category` values? Is this a fixed enum (e.g. Taiwan tax deduction categories) or a free-form string? captain: fixed 
2. Is the mapping editable after creation, or set once? captain: editable 
3. Where in the UI should the mapping appear — category list, expense detail, reports, or all three? captian: category list 
4. Should unmapped categories be flagged or blocked from use? captain: flagged to ask me. Each category must map to a gov_category 

---

## Spec

### Goal

Every expense category carries a `gov_category` field mapped to Taiwan's official household expenditure classification (行政院主計總處家庭收支調查 — Table 14). The captain assigns and maintains the mapping. The UI shows it on the category list as read-only information. Categories without a mapping are flagged in the UI.

### gov_category Enum

Source: Year14.xls, 第14表 家庭消費支出結構按消費型態分, 113年 (2024) from the `tw-gov-reports/2025/` reference files. The 10 valid values:

| Key | Chinese | English (from source) |
|---|---|---|
| `food_beverage_tobacco` | 食品飲料及菸草 | Food, beverage and tobacco |
| `clothing_footwear` | 衣著鞋襪類 | Clothing and footwear |
| `housing_utilities` | 住宅服務水電瓦斯及其他燃料 | Housing, water, electricity, gas and other fuels |
| `furnishings_household` | 家具設備及家務服務 | Furnishings, household equipment and routine household maintenance |
| `health` | 醫療保健 | Health |
| `transport_communication` | 交通及資通訊 | Transport and communication |
| `recreation_culture_education` | 休閒、運動、文化及教育 | Recreation, sport, culture and education services |
| `restaurants_accommodation` | 餐廳及住宿 | Restaurants and accommodation services |
| `insurance_financial` | 保險及金融服務 | Insurance and financial services |
| `miscellaneous` | 其他 | Miscellaneous goods and services |

These 10 values are exhaustive. No other values are valid.

### Migration: Initial gov_category Assignment

At launch the captain assigns `gov_category` to all 22 existing `DEFAULT_CATEGORIES` via the category management UI (edit category). Below is the pre-filled mapping — these are the defaults committed alongside the feature, not hard-coded; the captain can change any of them through the UI:

| category_id | gov_category |
|---|---|
| eating-out | `restaurants_accommodation` |
| daily-necessities | `furnishings_household` |
| groceries | `food_beverage_tobacco` |
| medical | `health` |
| travel | `recreation_culture_education` |
| transportation | `transport_communication` |
| digital | `transport_communication` |
| babies | `miscellaneous` |
| clothing | `clothing_footwear` |
| sports | `recreation_culture_education` |
| gifts | `miscellaneous` |
| tuition | `recreation_culture_education` |
| tolls | `transport_communication` |
| equipment | `furnishings_household` |
| fuel | `transport_communication` |
| entertainment | `recreation_culture_education` |
| rent | `housing_utilities` |
| shopping | `miscellaneous` |
| car-repair | `transport_communication` |
| donate | `miscellaneous` |
| mortgage | `housing_utilities` |
| other | `miscellaneous` |

These defaults are applied via a one-time Firestore migration script run before the feature ships to production.

### User Stories

- As the captain, when I open category settings, I see the `gov_category` label next to each category name so I can verify alignment at a glance.
- As the captain, when I edit a category, I can change its `gov_category` using a dropdown of the 10 valid enum values.
- As the captain, when a category has no `gov_category` set, I see a flag indicator in the category list row so I know I need to assign it.
- As the captain, when I create a new category, I am required to select a `gov_category` before I can save.

### Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | The `Category` type has a `gov_category` field typed as the 10-value enum; TypeScript compilation fails if an invalid string is assigned. |
| AC-2 | The category list page displays the `gov_category` value (Chinese label) next to each category name. |
| AC-3 | A category row with `gov_category` null or undefined shows a visible flag indicator (e.g. "未設定" badge); rows with a valid value show no flag. |
| AC-4 | The category edit form includes a `gov_category` dropdown with all 10 enum values; selecting one and saving persists the change in Firestore. |
| AC-5 | The new category creation form requires `gov_category` to be selected; the save button is disabled until a value is chosen. |
| AC-6 | A Firestore migration script assigns the 22 default mappings from the table above to all existing categories; running it a second time is a no-op (idempotent). |
| AC-7 | All 22 `DEFAULT_CATEGORIES` have a non-null `gov_category` after the migration script runs; zero categories remain flagged. |

### Out of Scope

- Filtering or grouping expenses by `gov_category` in reports (separate feature).
- Displaying `gov_category` on the expense entry or detail view (only category list).
- Automatic or AI-suggested mapping (captain assigns manually).
- Supporting custom or user-defined gov_category values (enum is fixed).

---

## Stage Report: spec

- DONE: Gov category enum values drawn from the tw-gov-reports reference material (not invented) — document the exact values chosen
  10 values from Year14.xls 第14表 row 4 (Chinese) / row 6 (English); listed verbatim in the enum table with keys, Chinese, and English labels
- DONE: Every AC is binary-testable: pass or fail with no interpretation required
  7 ACs defined; each passes/fails on an observable outcome (TypeScript error, visible UI element, save button state, Firestore write, migration idempotency)
- DONE: Migration path specified: how existing categories get their gov_category assigned at launch
  Migration script pre-populates all 22 DEFAULT_CATEGORIES with the default mapping table; captain uses the edit UI for any subsequent changes; script is idempotent

### Summary

Wrote a complete spec grounded in the 10 consumption categories from the Taiwan government's 113年 (2024) Family Income and Expenditure Survey (Table 14). The enum keys are defined from the source XLS file in `tw-gov-reports/2025/Year14.xls`. Default mappings for all 22 existing categories are pre-filled in a migration table so the feature ships with zero unmapped categories on day one. All 7 ACs are binary — each resolves to pass or fail with no judgment required.
