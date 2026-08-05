---
id: "008"
title: Data Migration
status: done
source: commission seed
started: 2026-05-06T05:13:40Z
completed: 2026-08-05T03:17:53Z
verdict: PASSED
score: 0.7
worktree:
issue:
pr:
mod-block:
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

Final output schema (captain correction 2026-06-06, post-verify — the captain reversed the earlier no-id/no-created_at direction). The migration output contains these columns, in this order:

    id | date | amount | paid_by | created_by | category_id | gov_category | notes | created_at

`id` is RETAINED: sequential `exp_2025_0001`…`exp_2025_NNNN` (captain confirmed IDs are wanted for migrated historical records). `created_at` is RETAINED but its derivation changed: do NOT set it equal to `date` — derive it from the row `date` with a randomized time-of-day component (bulk historical imports have no real creation timestamp; a random time avoids 1404 identical-second timestamps).

`paid_by` and `created_by` both map from `誰` using the same user mapping, so they hold the same value per row (`wei` → `user2`, `ijac` → `user1`). `created_by` is NOT a fixed `migration` literal.

| CSV column | Target column | Transformation |
|---|---|---|
| (generated) | id | Sequential `exp_2025_NNNN` over valid rows |
| 日期 | date | Already YYYY-MM-DD, pass through |
| 金額 | amount | Strip trailing `.0` decimals, write as number |
| 誰 | paid_by | `wei` → `user2`, `ijac` → `user1` |
| 誰 | created_by | Same mapping as paid_by; same value per row (`wei` → `user2`, `ijac` → `user1`) |
| 主分類 + 子分類 | category_id | See category mapping table below |
| (derived) | gov_category | From live Categories tab, keyed by category_id |
| 備註 | notes | Pass through (fallback subcategory appended per buildNotes) |
| 日期 | created_at | Derived from `date` with randomized time-of-day (ISO 8601 UTC) |

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
| 健康 | AWO | entertainment| explicit |
| 健康 | massage | entertainment | explicit |
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
| 其他 | 聖堂 | entertainment | explicit |
| 其他 | 其他 | other | fallback |
| 其他 | ijac保險 | other
 | fallback |
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
   f. Set `created_by` = same mapped `誰` value as `paid_by` (NOT the literal `migration`)
   g. Resolve `gov_category` from the live Categories tab, keyed by `category_id`
   h. Generate sequential `id` `exp_2025_NNNN`; derive `created_at` from `date` with a randomized time-of-day
4. Print summary: total rows, skipped rows (with reasons), rows to write
5. In dry-run: print rows as JSON, exit
6. Otherwise: preflight-fetch the gov_category map, then append all valid rows to the `Expenses` tab via `spreadsheets.values.append` (valueInputOption: `RAW`), in the column order `id | date | amount | paid_by | created_by | category_id | gov_category | notes | created_at`

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
| AC-5 | Output schema matches final spec | Each output row has exactly `id, date, amount, paid_by, created_by, category_id, gov_category, notes, created_at` in that order. `id` sequential `exp_2025_NNNN`; `created_at` derived from `date` with a randomized time-of-day (not equal to `date`); `created_by` maps from `誰` (same value as `paid_by`), NOT the literal `migration`; `gov_category` included in the Expenses write (captain correction 2026-06-06, post-verify) |
| AC-6 | Staging run succeeds before production | Script run against staging spreadsheet first; row count and amount sum verified before production run |
| AC-7 | Production write row count matches | After production run, tab row count delta equals expected valid-row count |

### Feedback Cycles

#### Cycle 1 (verify → build, 2026-06-06)

Verify (cycles 3–4) found genuine build defects against the revised output schema and recommended REJECTED with `feedback-to: build`. Routing back to build with a corrected fix plan — note the schema direction below **supersedes** what verify cycles 3–4 checked against (captain reversed the id/created_at call after verify ran):

**Final corrected output schema** (captain confirmed 2026-06-06, post-verify):
`id | date | amount | paid_by | created_by | category_id | gov_category | notes | created_at`

Fix items for build:
1. **Keep `id`** — generate `exp_2025_0001`…`exp_2025_NNNN` sequential IDs (captain reversed the earlier "no id" instruction — IDs ARE wanted for migrated historical records)
2. **Keep `created_at` but change its derivation** — do NOT set it equal to `date`. Instead derive it from the row's `date` with a randomized time-of-day component (these are bulk-imported historical rows with no real creation timestamp; a randomized time avoids 1404 identical-second timestamps)
3. **Fix `created_by`** — map from the `誰` CSV column using the same mapping as `paid_by` (`wei`→`user2`, `ijac`→`user1`); replace the hardcoded `'migration'` literal at `migrate-2025.js:354`
4. **Add `gov_category`** to the live Expenses tab write — currently omitted from the write path (`migrate-2025.js:588-597`)
5. **Column order** — write in the order: `id, date, amount, paid_by, created_by, category_id, gov_category, notes, created_at`

AC-5 in the spec table above will need updating to match this corrected schema (verify had rewritten it to a no-id/no-created_at version that the captain has since reversed).

Independent of this fix: AC-6/AC-7 remain blocked by staging sheet `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o` returning HTTP 403 for the service account — captain action (share as Editor), not a build concern.

## Stage Report: spec

- DONE: Category mapping table documented with all CSV subcategory variants covered
  All 75 unique 主分類+子分類 combos enumerated from CSV; each assigned a category_id with explicit rule or fallback noted
- DONE: Spec written with binary AC covering dry-run, validation, staging-first approach, and production write
  7 binary ACs defined in Acceptance Criteria table; algorithm, env vars, CLI interface, and validation steps fully specified

### Summary

Enumerated all 75 unique category combinations from the 1,404-row CSV and mapped each to one of the 22 app category IDs, extending the provided mapping rules to cover data-driven variants (娛樂 travel subcategories, alisa-prefixed 日用品 rows, etc.). User ID mapping confirmed from `functions/src/index.ts` LEGACY_USER_MAP: `wei` → `user2`, `ijac` → `user1`. Script spec covers Node.js implementation with `csv-parse`, dry-run flag, row-level validation with skip logging, deterministic sequential IDs, post-write row count verification, and a mandatory staging-before-production run order.

## Stage Report: build

- DONE: Script handles all 75 CSV category combos and resolves each to a category_id with no SKIP on the full 2025 file
  Dry-run: 1404 rows in, 0 skipped, 1404 valid — confirmed via `node scripts/migrate-2025.js --dry-run`. The CSV has 84 unique combos (not 75); the 9 extra are 學習/數位 wildcards already covered by the spec's wildcard rules.
- DONE: --dry-run flag works: prints rows as JSON, no Sheets API calls made
  Output confirmed: `Dry-run complete. No data was written.` with JSON preview of first 10 rows, exit 0.
- SKIPPED: Staging run attempted first (AC-6): script successfully writes to staging spreadsheet and row count verified
  Production service account (`expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com`) does not have Editor access to the staging spreadsheet (`1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o`). The staging service account key in `functions/.env.staging` is missing PEM headers and cannot be used. `run-staging.sh` is provided to execute the staging run once the staging sheet is shared with the correct service account. The script logic and transformation are fully validated via dry-run.

### Summary

Implemented `scripts/migrate-2025.js` (Node.js, csv-parse + googleapis). All 84 unique CSV category combos map to a category_id with zero SKIP rows: explicit entries in CATEGORY_MAP for all named combos, wildcard rules for 學習 (→ tuition) and 數位 (→ digital). Dry-run confirmed: 1404 valid rows, IDs sequential (`exp_2025_0001`–`exp_2025_1404`), both user1 and user2 present, amount sum 2,005,690. AC-6 staging write blocked by missing service account access on the staging sheet; `scripts/run-staging.sh` is the operator-runnable wrapper once access is granted.

## Stage Report: verify

- FAILED: Staging run succeeds: run scripts/run-staging.sh, confirm row count delta equals expected valid-row count (AC-6)
  Live Sheets API call returns HTTP 403 PERMISSION_DENIED — `expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com` does not have access to spreadsheet `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o`. Error confirmed: `{"error":{"code":403,"message":"The caller does not have permission","status":"PERMISSION_DENIED"}}`. Dispatch said access was just granted but it has not taken effect.
- FAILED: Post-write row count matches: verify the Sheets row count delta equals the valid-row count from dry-run output (AC-7)
  Cannot verify — staging write blocked by same 403. No rows were written.
- FAILED: No duplicate IDs and no gaps in exp_2025_0001–exp_2025_NNNN sequence in the staging sheet
  Cannot verify against staging sheet — 403 prevents any read. Dry-run output confirms IDs `exp_2025_0001`–`exp_2025_1404` sequential with no gaps (confirmed in build stage), but staging sheet content cannot be checked.

### Summary

Staging run blocked by HTTP 403 PERMISSION_DENIED on all Sheets API calls. The service account `expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com` does not have Editor (or any) access to the staging spreadsheet `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o`. Dry-run via `bash scripts/run-staging.sh --dry-run` confirms script logic is correct (1404 valid rows, 0 skipped, amount sum 2,005,690), but no live write evidence can be produced until the staging sheet is shared with the service account. Captain action required: share the staging spreadsheet with `expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com` as Editor, then re-dispatch verify.

verdict: REJECTED

## Stage Report: build (cycle 2)

- DONE: --preview mode writes a new tab to the source spreadsheet (1DtYJgoqUIWxbM_L7NHFz3OpyOy-MphYNaxrdxDrXYBc) showing: original columns + category_id + gov_category + transformed notes
  Implemented `writePreviewTab()` async function: deletes existing "Migration Preview" tab if present, creates fresh tab via batchUpdate, writes header row (日期,主分類,子分類,金額,備註,誰,category_id,gov_category,notes) + 1404 data rows via values.update. Spreadsheet ID hardcoded as PREVIEW_SPREADSHEET_ID constant.
- DONE: Original subcategory (子分類) is preserved in the notes field when it differs from the mapped category name (all fallback mappings)
  `buildNotes()` appends sub to notes when `isFallbackMapping()` returns true (sub != govName from GOV_CATEGORY_MAP). Deduplication: if original 備註 already equals or contains the sub text, no append. 9/9 test cases pass. Dry-run: 1404 valid rows, 0 skipped, amount sum 2,005,690 — identical to cycle 1.
- DONE: gov_category column populated from DEFAULT_CATEGORIES mapping for each row in the preview tab
  GOV_CATEGORY_MAP (22 entries) sourced from DEFAULT_CATEGORIES name_zh values in app/app/lib/categories.ts. Each previewRow.gov_category = GOV_CATEGORY_MAP.get(categoryId). Verified: sports → 運動, transportation → 交通, daily-necessities → 日用品, entertainment → 娛樂.

### Summary

Added `--preview` flag to `scripts/migrate-2025.js` that writes a "Migration Preview" tab to spreadsheet `1DtYJgoqUIWxbM_L7NHFz3OpyOy-MphYNaxrdxDrXYBc`. The tab shows all 6 original CSV columns plus `category_id`, `gov_category` (Chinese name from DEFAULT_CATEGORIES), and `notes` (with fallback subcategory text appended when sub differs from the category's name_zh). Added `GOV_CATEGORY_MAP` (22 entries), `isFallbackMapping()`, and `buildNotes()` helpers. Dry-run stays unchanged: 1404 rows, 0 skipped, amount sum 2,005,690.

## Stage Report: build (cycle 3)

- DONE: GOV_CATEGORY_MAP removed: gov_category fetched at runtime from Categories tab (spreadsheet 19_D7yQaJvZrJyQ3q2oxaVWgWXoofXvCZ0kHUR4IeA-o, gid=776312032) keyed by category_id
  Hardcoded `GOV_CATEGORY_MAP` deleted (grep confirms 0 references). New `fetchGovCategoryMap()` reads the live Categories tab and builds `categoryIdToGovCategory`. The tab's `id` column is `cat_001…` (not the slug) and has no slug column, so the join bridges slug → `name_zh` (from `CATEGORY_ID_TO_NAME_ZH`) → live `gov_category`. Live run logged "Fetched gov_category for 22 categories".
- DONE: Dry-run and --preview modes produce correct gov_category values from the live spreadsheet read
  `--preview` against live sheets wrote 1404 rows; read-back confirms every category_id carries its live label (eating-out → 食品飲料及菸草, transportation → 交通及資通訊, medical → 醫療保健, clothing → 衣著鞋襪類) with zero old name_zh display values remaining (PASS). Dry-run skips the fetch (no creds needed), gov_category empty there — preview tab is the only gov_category consumer.
- DONE: All 7 spec ACs self-checked with evidence in the stage report
  AC-1 dry-run JSON, no API call (ran without creds); AC-2 0 skips needing date/amount/category logic intact; AC-3 1404/1404 mapped, 0 unmappable; AC-4 user1+user2 both present (wei→user2, ijac→user1); AC-5 IDs exp_2025_0001–exp_2025_1404 sequential; AC-6/AC-7 staging/production live write unchanged from prior build (blocked earlier by 403, out of scope for this gov_category fix — the live Expenses write path and its row-count validation are untouched).

### Summary

Replaced the hardcoded `GOV_CATEGORY_MAP` with a runtime preflight read of the main spreadsheet's Categories tab. Because that tab keys `gov_category` by `name_zh` (its `id` is `cat_NNN`, with no slug column), the script bridges slug → name_zh → live gov_category via `CATEGORY_ID_TO_NAME_ZH`. The fetch runs only in `--preview` (the sole gov_category consumer) and live mode; dry-run stays credential-free. Verified end-to-end against live sheets: 22 categories fetched, 1404 preview rows written, every gov_category now the live Categories-tab value (e.g. eating-out → 食品飲料及菸草) with no stale name_zh values. Row counts and amount sum unchanged (1404 / 0 skipped / 2,005,690). Refactored shared auth resolution into `resolveAuthConfig()` and extracted `processRows()`/`printSummary()` so the gov map can be fetched before row transform in async paths.

## Stage Report: verify (cycle 2)

- FAILED: Staging run succeeds; row count delta equals expected valid-row count (AC-6)
  Live write via `bash scripts/run-staging.sh` against staging sheet `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o` returns `ERROR during Sheets write: The caller does not have permission`. Direct HTTP GET on the same sheet returns **HTTP 403** `{"error":{"code":403,"status":"PERMISSION_DENIED"}}`. No rows written.
- FAILED: Post-write row count matches valid-row count from dry-run (AC-7)
  Cannot verify — staging write blocked by the same 403; row count before/after never read. Dry-run confirms the *intended* delta is 1404 valid rows.
- DONE: Live HTTP evidence captured (at least one curl/API response from staging)
  Direct googleapis HTTP call returned HTTP 403 on staging sheet; the SAME service account returned **HTTP 200** on the main Categories sheet (`19_D7yQaJvZrJyQ3q2oxaVWgWXoofXvCZ0kHUR4IeA-o`) — proving the credential is valid and the failure is a sharing/access gap on the staging sheet only, not a broken key.
- DONE: Dry-run logic re-confirmed (AC-1/AC-2/AC-3/AC-4/AC-5)
  `bash scripts/run-staging.sh --dry-run`: 1404 read, 0 skipped, 1404 valid, amount sum 2,005,690; IDs exp_2025_0001–exp_2025_1404 sequential; both user1 and user2 present; no Sheets write call in dry-run path.
- DONE: No secrets, .env values, or PII in any committed file (mandatory PII/secrets check)
  Branch diff vs main tracks only `.env*.example` files (no real values); `scripts/migrate-2025.js` + `scripts/run-staging.sh` read creds from env vars, zero hardcoded keys/private-key/passwords; only identifier present is the GCP service-account email (internal id, not personal PII).

### Summary

AC-6 and AC-7 FAIL on live HTTP evidence: the staging spreadsheet `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o` still returns HTTP 403 PERMISSION_DENIED for service account `expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com`. The dispatch stated access was just granted, but it has not taken effect — the same credential gets HTTP 200 on the main Categories sheet, so the key is healthy and the gap is purely sheet sharing. Script transformation logic is fully re-validated via dry-run (1404 valid rows, 0 skipped, amount sum 2,005,690), but no live write can succeed until the staging sheet is shared. This is not a build defect — routing back to build will not fix an access-grant gap. Captain action required: share `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o` with `expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com` as Editor, then re-dispatch verify.

verdict: REJECTED

## Stage Report: verify (cycle 3)

- FAILED: Output schema matches revised spec — no `id`, no `created_at`, columns `date|amount|paid_by|created_by|category_id|gov_category|notes` (AC-5, captain correction 2026-06-06)
  Current script STILL emits both. `migrate-2025.js:347-356` builds the row object with `id` (`exp_2025_XXXX` from `seqNum` at :333-334) and `created_at: date` (:355). Live-write column order at :588-597 is `id, date, amount, category_id, paid_by, notes, created_by, created_at` (range `A:H`) — wrong order, includes the two forbidden columns, and OMITS `gov_category` entirely from the Expenses write. Dry-run row 1 confirms keys: `id, date, amount, category_id, paid_by, notes, created_by, created_at`. Build must: drop `id` + `created_at`, add `gov_category` to the Expenses write, and reorder to the revised schema.
- FAILED: Staging run succeeds; row count delta equals expected valid-row count (AC-6)
  Live write returns `ERROR during Sheets write: The caller does not have permission`; direct HTTP GET on staging sheet `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o` returns HTTP 403 PERMISSION_DENIED. Same service account gets HTTP 200 on the main Categories sheet — credential healthy, staging sheet not shared. Unchanged from cycle 2.
- FAILED: Post-write row count matches valid-row count from dry-run (AC-7)
  Cannot verify — staging write blocked by the 403; no rows written.
- DONE: Live HTTP evidence captured (at least one curl/API response from staging)
  HTTP 403 on staging values GET; HTTP 200 on main Categories values GET (auth health check) — both via live googleapis fetch.
- DONE: All 7 ACs mapped to pass/fail with concrete evidence
  AC-1 dry-run JSON, no write call: PASS. AC-2 0 skips, skip logic intact: PASS. AC-3 1404/1404 mapped, 0 unmappable: PASS. AC-4 wei→user2, ijac→user1 both present: PASS. AC-5 schema: FAIL (id + created_at present, gov_category missing from write). AC-6/AC-7: FAIL (403).
- DONE: No secrets, .env values, or PII in any committed file (mandatory PII/secrets check)
  Branch diff vs main tracks only `.env*.example` files (no real values); scripts read creds from env vars, no hardcoded keys/private-key/passwords; only identifier is the GCP service-account email (internal id, not personal PII).

### Summary

Two independent blockers, both FAIL. (1) Schema regression: the captain revised the output to `date|amount|paid_by|created_by|category_id|gov_category|notes` with NO `id` and NO `created_at`, but the current script generates `exp_2025_XXXX` IDs (`migrate-2025.js:333-334,348`) and `created_at` (:355), writes them in the wrong column order (:588-597), and omits `gov_category` from the Expenses write — this is a build defect, route to build via feedback-to:build. (2) Staging access: the staging sheet still returns HTTP 403 for the service account (same key gets 200 on the main sheet), so AC-6/AC-7 cannot pass regardless of the schema fix — captain must share `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o` as Editor. Entity spec updated: Source Column Mapping, Script Spec algorithm, and AC-5 now reflect the revised no-id/no-created_at schema. Build should fix the schema; in parallel the captain must grant staging access before the next verify can produce a live write.

verdict: REJECTED

## Stage Report: verify (cycle 4)

- FAILED: Output schema matches revised spec — `created_by` maps from `誰` (same value as `paid_by`), NOT the literal `migration` (AC-5, captain addendum 2026-06-06)
  Current script hardcodes `created_by: 'migration'` at `migrate-2025.js:354`. Per the captain addendum, `created_by` must use the same `誰` user mapping as `paid_by` (wei→user2, ijac→user1), giving the same value as `paid_by` per row. Build must replace the literal with the mapped `誰` value.
- FAILED: Output schema — no `id`, no `created_at`, add `gov_category`, revised column order (AC-5, carried from cycle 3)
  Still present: `id` (`migrate-2025.js:333-334,348`), `created_at` (:355); live-write order at :588-597 (range `A:H`) is `id,date,amount,category_id,paid_by,notes,created_by,created_at` — wrong order, omits `gov_category`. Unchanged from cycle 3.
- FAILED: Staging run succeeds; row count delta matches (AC-6)
  Staging sheet `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o` still HTTP 403 PERMISSION_DENIED for the service account; same account HTTP 200 on the main Categories sheet. Unchanged.
- FAILED: Post-write row count matches (AC-7)
  Cannot verify — blocked by the 403; no rows written.
- DONE: Live HTTP evidence captured
  HTTP 403 on staging values GET; HTTP 200 on main Categories values GET (re-confirmed in cycle 3, no access change since).
- DONE: All 7 ACs mapped to pass/fail with concrete evidence
  AC-1/AC-2/AC-3/AC-4 PASS (dry-run); AC-5 FAIL (id, created_at, hardcoded created_by, missing gov_category, wrong order); AC-6/AC-7 FAIL (403).
- DONE: No secrets, .env values, or PII in any committed file (mandatory PII/secrets check)
  Only `.env*.example` tracked; scripts read creds from env vars; no hardcoded secrets; only identifier is the GCP service-account email.

### Summary

The captain's addendum corrects `created_by`: it maps from the `誰` column (same value as `paid_by`), not the hardcoded `migration` literal still in `migrate-2025.js:354`. Combined build defects for build to fix in one pass: (1) drop `id` and `created_at`, (2) add `gov_category` to the Expenses write, (3) reorder columns to `date|amount|paid_by|created_by|category_id|gov_category|notes`, (4) map `created_by` from `誰` like `paid_by`. Entity spec (Source Column Mapping, Script Spec algorithm, AC-5) updated to reflect all corrections. Staging 403 still blocks AC-6/AC-7 independently — captain must share the staging sheet as Editor before the next verify can produce a live write.

verdict: REJECTED

## Stage Report: build (cycle 4)

- DONE: id and created_at retained with corrected generation: id sequential exp_2025_NNNN, created_at derived from date with randomized time-of-day
  `id` kept (`exp_2025_0001`–`exp_2025_1404`, sequential, 0 gaps). New `deriveCreatedAt(date)` returns ISO 8601 UTC = day-start + random offset in [0,24h); full-dump check over 1404 rows: 1404 unique timestamps, every `created_at` prefixed by its row `date`.
- DONE: created_by maps from 誰 (same mapping as paid_by: wei->user2, ijac->user1) — hardcoded "migration" literal removed
  `created_by = paidBy` at the transform (`migrate-2025.js`); grep confirms 0 `'migration'` literals remain. Full-dump check: `created_by === paid_by` for all 1404 rows; all `paid_by` ∈ {user1,user2}.
- DONE: gov_category included in the Expenses write; column order matches id|date|amount|paid_by|created_by|category_id|gov_category|notes|created_at
  Live `writeToSheets()` now preflight-fetches the gov map (`fetchGovCategoryMap`) before transform; write array reordered to the 9-col target with `gov_category` included; range widened `A:H`→`A:I`. Dry-run JSON key order matches target exactly (verified programmatically: `order===expected` true).

### Summary

Applied the captain's post-verify corrections to `scripts/migrate-2025.js`: retained `id` (sequential) and `created_at` but changed `created_at` to a randomized time-of-day derived from the row date (was `= date`); mapped `created_by` from `誰` like `paid_by` (removed the hardcoded `'migration'`); added `gov_category` to the live Expenses write and reordered to `id|date|amount|paid_by|created_by|category_id|gov_category|notes|created_at` (range `A:I`), with a gov-map preflight fetch added to the live path. Verified against the full 1404-row CSV via dry-run + a programmatic full-dump harness: counts unchanged (1404 valid / 0 skipped / sum 2,005,690), schema/order exact, created_by==paid_by everywhere, 1404 unique in-day timestamps, IDs contiguous. Updated entity spec (Source Column Mapping, algorithm step, AC-5) to the final keep-id/keep-created_at schema, superseding verify's no-id rewrite. AC-6/AC-7 remain out of scope — staging sheet `1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o` still returns HTTP 403 for the service account (captain must share as Editor); live write path is correct and ready for re-verify once access is granted.

## Stage Report: verify (cycle 5)

- DONE: AC-1 Dry-run prints rows without writing — confirm --dry-run outputs JSON rows and Sheets API is never called
  `node scripts/migrate-2025.js --dry-run`: 1404 rows read, JSON printed, exits 0 with "No data was written"; dry-run path returns before any Sheets call (no creds needed).
- DONE: AC-2 Invalid rows skipped with log — rows missing date/amount/category are logged and excluded
  Skip logic intact (missing date / zero-invalid amount / unmappable category / unknown paid_by each log SKIP and `return`); full 2025 file: 0 skipped because all rows are valid.
- DONE: AC-3 Category mapping complete — all CSV category combos resolve to a category_id, zero SKIP on full 2025 file
  Dry-run: 1404 valid / 0 skipped — zero "unmappable category" SKIP lines on the full file.
- DONE: AC-4 User mapping correct — all wei rows -> paid_by user2, all ijac rows -> paid_by user1
  Full-CSV scan of 誰: only {wei:952, ijac:452}, 0 unmapped; USER_MAP wei→user2, ijac→user1; created_by==paid_by per row (dry-run rows confirm).
- DONE: AC-5 Output schema matches FINAL spec exactly — id, date, amount, paid_by, created_by, category_id, gov_category, notes, created_at IN THAT ORDER
  Dry-run JSON key order matches exactly. id sequential exp_2025_0001…; created_at DERIVED (e.g. 2025-01-01 → 2025-01-01T06:11:25Z, randomized time, ≠ date); created_by maps from 誰 (==paid_by, no 'migration' literal); gov_category fetched LIVE: HTTP 200 on Categories tab, all 22 slugs resolve non-empty (eating-out→食品飲料及菸草, medical→醫療保健) via slug→name_zh→gov_category bridge.
- FAILED: AC-6 Staging run succeeds before production — script run against staging spreadsheet first, row count and amount sum verified
  Live HTTP GET on staging sheet 1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o → HTTP 403 PERMISSION_DENIED `{"code":403,"message":"The caller does not have permission","status":"PERMISSION_DENIED"}`. SAME service account → HTTP 200 on main Categories sheet (24 rows). CAPTAIN-ACTION BLOCKER, not a build defect — staging sheet still not shared with expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com as Editor. Unchanged across cycles 2–5.
- FAILED: AC-7 Production write row count matches — after production run, tab row count delta equals expected valid-row count
  Cannot exercise: production write is gated on a successful staging run (AC-6), which is blocked by the 403. No rows written; row-count delta unverifiable until staging access is granted.
- DONE: Mandatory PII/secrets check per stage definition
  Branch diff vs main tracks only `.env*.example` (no real values); migrate-2025.js + run-staging.sh read creds from env vars, zero hardcoded keys/private-key/passwords (grep clean); node_modules gitignored (third-party author emails not committed); only identifier is the GCP service-account email (internal id, not personal PII).
- DONE: Live evidence requirement — actual HTTP responses included
  HTTP 200 on main Categories sheet (credential health + gov_category fetch), HTTP 403 on staging sheet — both captured via live googleapis fetch this cycle.

### Summary

Build cycle 4 (commit cb6ec8e) correctly applies the captain's FINAL corrected schema: AC-1–AC-5 all PASS with live evidence. Verified live this cycle — dry-run emits the exact 9-column order `id|date|amount|paid_by|created_by|category_id|gov_category|notes|created_at`; created_at is randomized time-of-day derived from date (not equal to date); created_by maps from 誰 like paid_by (no 'migration' literal); gov_category is fetched at runtime from the live Categories tab (HTTP 200, all 22 slugs non-empty). AC-4 confirmed over the full 1404-row CSV (wei→user2 ×952, ijac→user1 ×452, 0 unmapped). The ONLY failures are AC-6/AC-7, blocked by HTTP 403 PERMISSION_DENIED on the staging sheet 1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o — the same service account returns HTTP 200 on the main sheet, proving the credential is healthy and the gap is purely sheet-sharing. This is a CAPTAIN-ACTION blocker (share the staging sheet as Editor with expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com), NOT a build defect — routing back to build cannot fix it. The build work is complete and correct; only the staging access grant stands between this and a passing staging+production run.

verdict: REJECTED

## Stage Report: verify (cycle 6) — captain-run, direct execution (dispatch unavailable this session)

Agent dispatch was unavailable for the remainder of this session (repeated infrastructure failures on the dispatch/agent-spawn path); this cycle was run as a direct FO+captain collaboration in the terminal rather than through a dispatched ensign. Recorded here for the audit trail, same evidentiary bar as prior cycles.

- DONE: AC-6 Staging run succeeds before production — captain granted `expense-sheet-functions@expense-sheet-b2db8.iam.gserviceaccount.com` Editor access to the staging sheet (1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o), resolving the cycle 2–5 HTTP 403. `bash scripts/run-staging.sh --dry-run` then `bash scripts/run-staging.sh` both ran clean: 1404 rows read, 1404 written, before/after row count 15→1419, live `PASS: Row count delta matches expected valid rows.`
- CHANGED PLAN: AC-7 Production write — NOT executed via `migrate-2025.js` as originally planned. Before running the real script against production, the captain manually corrected the staging sheet's column order/schema to match production's actual live layout (captain intervention, done between cycles, not a build action). Comparing `scripts/migrate-2025.js`'s write order (`id,date,amount,paid_by,created_by,category_id,gov_category,notes,created_at` — 9 cols) against BOTH sheets' real headers (`id,date,amount,category_id,paid_by,created_by,notes,created_at` — 8 cols, no `gov_category`, different order) confirmed they no longer match — re-running the script as-is would have misaligned every field from column D onward. Caught via live header read before any production write, not assumed.
  Executed instead: a direct read-from-staging → append-to-production copy (`scripts/copy-to-prod.js`, captain-run from the worktree since Bash write access was also blocked this session), using the corrected 1,404 rows already sitting in staging as the source of truth instead of re-deriving from the CSV. Safety checks: row count must read exactly 1404 or abort; amount sum must match the precise cents-based total (2005689.8 — cross-checked independently against a naive parseFloat sum that had rounding drift, and against the one true non-integer amount in the dataset, row 1139 = 327.8) or abort. Verified after write: production Expenses tab 282→1686 rows (+1404 exact), 1404 `exp_2025_*` ids present, zero duplicate ids sheet-wide, amount sum of migrated rows = 2005689.8 exact match, spot-checked first/last 3 rows — all fields correctly positioned per the header. Columns I/J (`month`, `amount value` — per-row formulas `=MONTH(Bn)`/`=value(Cn)`, not auto-filling) intentionally left untouched on the 1,404 new rows; captain to drag-fill from an existing row.
- DONE: Mandatory PII/secrets check — no new script/data committed to any branch with real credentials; `copy-to-prod.js` reads `GOOGLE_SERVICE_ACCOUNT_KEY` from env only, same pattern as `run-staging.sh`.
- DONE: Live evidence — every claim above backed by a live Sheets API read/write this cycle (row counts, header comparisons, spot-checked row contents), not code inspection.

### Addendum — second data source, same session (2026 Jan 1–May 1)

Beyond entity 008's original CSV scope, the captain also had a second untracked history source: a separate personal tracking spreadsheet (`1Vt0wcrpZ2v9HkyRT1_e_KDm30stcppK0eBYKRT7JeGk`, tab `202604`) covering 2026-01-01 through 2026-05-01 (244 rows) — the gap between this app's data and when production went live (first real production row: 2026-05-02). Captain asked for this to be migrated too; treating it as an extension of 008's "historical data available from day one" goal rather than a separate entity, since it's the same kind of gap-fill.

- Column check before anything else: source has `記帳日期,分類,主分類,子分類,金額,更新日期,備註` — no payer/誰 column anywhere in the source (checked the sheet's other tabs for any usable signal — one candidate column, "只有 wei 的支出", was empty for all 244 rows in this date range). Flagged to captain; captain's decision: `paid_by`/`created_by` = `wei` for all 244 rows.
- Category coverage checked against the existing `CATEGORY_MAP`/`WILDCARD_CATEGORIES` tables (same ones `migrate-2025.js` uses) before writing: 244/244 rows resolved, 0 unmapped, 0 invalid dates, 0 invalid/zero amounts, all rows type `支出` (expense).
- Date range check: 237 rows Jan–Apr, 7 rows dated 2026-05-01 (all same-day cluster — 4× gym NT$788, YouTube, a donation, groceries). Flagged as outside "Jan-Apr" as captain described; captain's call: include them (no conflict with production's 05-02 start).
- New script `scripts/migrate-2026-jan-apr.js` (captain-run, same reason as above): reused `migrate-2025.js`'s category/notes/timestamp logic verbatim, generated fresh `exp_2026_NNNN` ids, `paid_by`/`created_by` fixed to `wei`. Dry-run reviewed with captain before the real write.
- Verified after write: production Expenses tab 1686→1930 rows (+244 exact), 244 `exp_2026_*` ids present, zero duplicate ids sheet-wide, amount sum = 420189 exact match, all migrated rows show `paid_by`/`created_by` = `wei` as instructed.

### Summary

Both the original 2025 CSV migration and the additional 2026 Jan–May1 gap-fill are now live in production, independently verified against the actual sheet (not the write script's own self-report) after each write: 1,648 new rows total (1404 + 244), zero duplicates, exact amount-sum matches, correct column alignment. AC-6/AC-7 (this entity's original scope) both PASS. The captain's manual staging schema correction — caught before the production write, not after — is the reason this closed cleanly instead of writing 1,404 misaligned rows to real financial data.

verdict: PASSED
