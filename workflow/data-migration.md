---
id: "008"
title: Data Migration
status: spec
source: commission seed
started: 2026-05-06T05:13:40Z
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

## Source Data

CSV file: `feedback-screenshots/2025_combined_expenses.csv`
- 1,404 rows, full year 2025 (Jan 1 – Dec 31)
- Columns: `日期` (date YYYY-MM-DD), `主分類` (main category), `子分類` (subcategory), `金額` (amount, decimal), `備註` (notes), `誰` (paid_by)

## Source Column Mapping

| CSV column | Target column | Transformation |
|---|---|---|
| 日期 | date | Already YYYY-MM-DD, pass through |
| 金額 | amount | Strip trailing `.0` decimals, write as number |
| 主分類 + 子分類 | category_id | See category mapping table below |
| 誰 | paid_by | `wei` → `user2`, `ijac` → `user1` |
| 備註 | notes | Pass through as-is |
| (generated) | id | `exp_2025_0001` … `exp_2025_1404`, zero-padded to 4 digits |
| (fixed) | created_by | `migration` |
| 日期 | created_at | Same value as date |

## User ID Mapping

From `functions/src/index.ts` LEGACY_USER_MAP:

- `user1` = `ijac`
- `user2` = `wei`

Therefore: CSV `wei` → `user2`, CSV `ijac` → `user1`.

The Expenses tab stores user IDs (`user1`/`user2`), not display names. The API layer resolves IDs to names for display; the migration writes IDs directly.

## Category Mapping Table

All 75 unique `主分類,子分類` combinations found in the CSV, mapped to `category_id`:

| 主分類 | 子分類 | category_id | Rule |
|---|---|---|---|
| 飲食 | 外食 | eating-out | explicit |
| 飲食 | 請客 | eating-out | explicit |
| 飲食 | 霜淇淋 | eating-out | explicit |
| 飲食 | 食材 | groceries | explicit |
| 交通 | 加油 | fuel | explicit |
| 交通 | 修車 | car-repair | explicit |
| 交通 | 過路 | tolls | explicit |
| 交通 | 交通 | transportation | fallback |
| 交通 | uber | transportation | fallback |
| 交通 | 3月火車票 | transportation | fallback |
| 交通 | 汽車稅 | transportation | fallback |
| 交通 | 汽車稅×2 | transportation | fallback |
| 交通 | 賣車 | transportation | fallback |
| 健康 | 運動 | sports | explicit |
| 健康 | 醫療 | medical | explicit |
| 健康 | 復健 | medical | explicit (alisa復健 matches) |
| 健康 | alisa復健 | medical | explicit |
| 健康 | 物理治療 | medical | explicit |
| 健康 | 雷射疣 | medical | explicit |
| 健康 | AWO | medical | explicit |
| 健康 | massage | medical | explicit |
| 健康 | 臍帶血 | medical | explicit |
| 娛樂 | 旅遊 | travel | explicit |
| 娛樂 | ESTA | travel | explicit |
| 娛樂 | 合歡山住宿 | travel | explicit |
| 娛樂 | 泰國機票 | travel | fallback travel-keyword match |
| 娛樂 | 清邁住宿 | travel | fallback travel-keyword match |
| 娛樂 | 清邁訂車訂金 | travel | fallback travel-keyword match |
| 娛樂 | 馬來西亞 | travel | fallback travel-keyword match |
| 娛樂 | 馬來西亞換200美金 | travel | fallback travel-keyword match |
| 娛樂 | 娛樂 | entertainment | fallback |
| 娛樂 | bike | entertainment | fallback |
| 娛樂 | cooking | entertainment | fallback |
| 娛樂 | tea experience | entertainment | fallback |
| 娛樂 | 潛旅 | entertainment | fallback |
| 娛樂 | 礁火捕魚 | entertainment | fallback |
| 娛樂 | 鐵人賽 | entertainment | fallback |
| 學習 | (all) | tuition | all 學習 → tuition |
| 數位 | (all) | digital | all 數位 → digital |
| 日用品 | 衣服 | clothing | explicit |
| 日用品 | 設備 | equipment | explicit |
| 日用品 | garmin | equipment | explicit |
| 日用品 | smart ring | equipment | explicit |
| 日用品 | 寶貝 | babies | explicit |
| 日用品 | alisa ipad | babies | explicit |
| 日用品 | alisa加碼 | babies | explicit (alisa prefix) |
| 日用品 | alisa加碼投資 | babies | explicit (alisa prefix) |
| 日用品 | 日用品 | daily-necessities | fallback |
| 日用品 | 施巴 | daily-necessities | fallback |
| 日用品 | 瓦斯 | daily-necessities | fallback |
| 日用品 | 淨水器 | daily-necessities | fallback |
| 日用品 | 3樓電視 | daily-necessities | fallback |
| 日用品 | 4號1樓熱水器 | daily-necessities | fallback |
| 日用品 | 自行車用 | daily-necessities | fallback |
| 購物 | 禮物 | gifts | explicit |
| 購物 | 紅包 | gifts | explicit |
| 購物 | 公公婆婆紅包 | gifts | explicit (紅包 suffix) |
| 購物 | 給公公婆婆 | gifts | explicit (給公公婆婆 match) |
| 購物 | 日用品 | shopping | fallback |
| 購物 | 購物 | shopping | fallback |
| 其他 | 聖堂 | donate | explicit |
| 其他 | 其他 | other | fallback |
| 其他 | ijac保險 | other | fallback |
| 其他 | 保費 | other | fallback |
| 其他 | 房客 | other | fallback |
| 其他 | 房屋險 | other | fallback |

Note on 娛樂 travel subcategories: the spec rule covers 旅遊/ESTA/合歡山住宿 explicitly. The remaining travel-themed subcategories (泰國機票, 清邁住宿, 清邁訂車訂金, 馬來西亞, 馬來西亞換200美金) should also map to `travel` based on clear semantic intent. The script will include these as explicit mappings.

## Script Spec: `scripts/migrate-2025.js`

### Environment variables

| Var | Purpose |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON key for the service account (base64 or raw JSON string) |
| `SPREADSHEET_ID` | Target spreadsheet ID |

### CLI interface

```
node scripts/migrate-2025.js [--dry-run]
```

- `--dry-run`: print transformed rows to stdout, skip all writes
- No flag: write rows to the Expenses tab via Sheets API

### Algorithm

1. Read `feedback-screenshots/2025_combined_expenses.csv` (relative to repo root, or accept `--file` override)
2. Parse CSV with a streaming parser (e.g. `csv-parse`)
3. For each row:
   a. Skip if `日期` is empty → log `SKIP [row N]: missing date`
   b. Skip if `金額` is 0 or non-numeric → log `SKIP [row N]: zero/invalid amount`
   c. Resolve `category_id` from `主分類` + `子分類` using the mapping table
   d. Skip if no mapping found → log `SKIP [row N]: unmappable category {主分類}/{子分類}`
   e. Map `誰` → `paid_by`: `wei` → `user2`, `ijac` → `user1`; skip if unknown → log `SKIP [row N]: unknown paid_by {誰}`
   f. Generate `id`: `exp_2025_XXXX` where XXXX is the sequential row index (1-based), zero-padded to 4 digits
   g. Set `created_by` = `migration`
   h. Set `created_at` = `日期` value
4. Print summary: total rows, skipped rows (with reasons), rows to write
5. In dry-run: print rows as JSON, exit
6. Otherwise: append all valid rows to the `Expenses` tab via `spreadsheets.values.append` (valueInputOption: `RAW`)

### Output row order

Rows are written in CSV order (chronological Jan–Dec 2025). The Expenses tab normally shows newest-first via the UI, but the sheet itself stores in append order; the app reads/sorts client-side.

### Validation (post-write)

After writing, the script fetches the Expenses tab row count and logs:
- Expected rows written
- Actual new rows (tab row count before minus after)
- Sum of amounts written (for manual spot-check)

### Staging-first approach

Run with `SPREADSHEET_ID` set to the staging sheet ID first. Verify row count and spot-check amounts. Then re-run with `SPREADSHEET_ID` set to the production sheet ID.

The script is idempotent in that it generates deterministic IDs (`exp_2025_XXXX`), but it does not deduplicate — running twice will create duplicates. Clear the staging sheet between test runs.

### Acceptance criteria

| # | Criterion | Pass condition |
|---|---|---|
| AC-1 | Dry-run prints rows without writing | `--dry-run` outputs JSON rows, Sheets API never called |
| AC-2 | Invalid rows skipped with log | Rows with missing date, zero amount, or unknown category logged and excluded from write |
| AC-3 | Category mapping complete | All 75 CSV combos resolve to a `category_id`; no SKIP for unmappable category on the full 2025 file |
| AC-4 | User mapping correct | All `wei` rows have `paid_by: user2`; all `ijac` rows have `paid_by: user1` |
| AC-5 | IDs sequential and unique | IDs are `exp_2025_0001`–`exp_2025_NNNN` with no gaps or duplicates across valid rows |
| AC-6 | Staging run succeeds before production | Script run against staging spreadsheet first; row count and amount sum verified before production run |
| AC-7 | Production write row count matches | After production run, tab row count delta equals expected valid-row count |

## Stage Report: spec

- DONE: Category mapping table documented with all CSV subcategory variants covered
  All 75 unique 主分類+子分類 combos enumerated from CSV; each assigned a category_id with explicit rule or fallback noted
- DONE: Spec written with binary AC covering dry-run, validation, staging-first approach, and production write
  7 binary ACs defined in Acceptance Criteria table; algorithm, env vars, CLI interface, and validation steps fully specified

### Summary

Enumerated all 75 unique category combinations from the 1,404-row CSV and mapped each to one of the 22 app category IDs, extending the provided mapping rules to cover data-driven variants (娛樂 travel subcategories, alisa-prefixed 日用品 rows, etc.). User ID mapping confirmed from `functions/src/index.ts` LEGACY_USER_MAP: `wei` → `user2`, `ijac` → `user1`. Script spec covers Node.js implementation with `csv-parse`, dry-run flag, row-level validation with skip logging, deterministic sequential IDs, post-write row count verification, and a mandatory staging-before-production run order.
