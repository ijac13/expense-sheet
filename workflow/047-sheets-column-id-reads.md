---
id: 047
title: Read/Write Sheets Data by Column Header, Not Column Position
status: verify
source: captain
started: 2026-08-13T08:35:02Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-047-sheets-column-id-reads
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

## Audit — every Sheets read/write on `main` (`ce44250`)

Traced live against the current code and against the two real spreadsheets (read-only calls, production id ending `4IeA-o`, staging ending `BTVe5o`).

### What the real sheets look like today

The code's assumed shape and the actual sheets have already drifted apart. This is not hypothetical risk — it is the present state.

| Tab | Production header row (live) | Staging header row (live) | Code assumes |
|-----|------------------------------|---------------------------|--------------|
| Expenses | A=id B=date C=amount D=category_id E=paid_by F=created_by G=notes H=created_at **I=month J=amount value** | A–H only | `A:H` |
| Categories | A=id B=name_en C=name_zh D=icon E=sort_order F=is_active G=gov_category **H=(blank) I=udpate** | **A–F only** (no `gov_category`, no `note`) | `A:H`, index 7 = `note` |
| Subscriptions | A=id B=name C=amount D=category_id E=frequency F=due_day G=due_month H=paid_by I=is_active | identical | `A:I` |
| Users | **A=email B=Users** (2 columns) | identical | `A:C`, index 0 = id |
| Monthly | A=SUM of amount value, B=month | absent | never touched |

Four findings that drive the scope decision below:

- **Production `Categories!H1` is empty.** The `note` column entity 043 shipped has data in it (3 of 25 rows) but no header name. A strict header-name lookup finds no `note` column in production *today* and would error on every categories request.
- **Production has captain-authored columns the backend knows nothing about:** `Categories!I` (header `udpate`, a typo, 9 non-empty values), `Expenses!I`/`J` (`month`, `amount value`, feeding the `Monthly` pivot tab). Today's narrow `A:H`/`A:I` writes preserve them by accident. A header-mapped writer that rebuilds a whole row would erase them.
- **Staging `Categories` is two columns behind production** — no `gov_category`, no `note`. Any "missing header is a hard error" rule breaks staging on deploy, which is where `verify` runs.
- **The `Users` tab's headers do not name its fields at all.** Header row is `email | Users`; both data rows are 2 cells wide with the email in column A. `rowToUser` (index.ts:48) compensates with an "does this cell contain `@`" sniff. Consequence visible live: `GET /api/users` returns `email: ""` for every user, because the heuristic looks for the email in a third column that does not exist.

### Call-site inventory

30 Sheets call sites, all positional. `functions/src/index.ts` unless noted.

| Tab | Line | Op | Range | What it is really for |
|-----|------|----|-------|----------------------|
| any | 100 | get | `{tab}!A1:{col}1` | header-exists probe in `insertRowAtTop`; `{col}` from `String.fromCharCode(64+len)` |
| any | 105 | update | `{tab}!A1:{col}1` | writes header only when `A1 !== "id"` |
| any | 120 | batchUpdate | rows 1→2 | insert blank row; assumes header is row 1 |
| any | 129 | update | `{tab}!A2:{col}2` | new row written by array position |
| Users | 154, 195, 484 | get | `A:C` | `resolveUserDisplayNames`, `GET /api/users`, `migrate-users` — id=0, `@`-sniff on 1/2 |
| Categories | 210 | get | `A:H` | `GET /api/categories` → `rowToCategory` idx 0–7 |
| Categories | 224 | get | `A:H` | POST: derive next `cat_NNN` id and `sort_order` |
| Categories | 255 | get | `A1:H1` | header probe (only checks A1) |
| Categories | 260 | update | `A1:H1` | writes `CATEGORIES_HEADER` |
| Categories | 267 | append | `A:H` | POST new category, 8-element positional row |
| Categories | 287 | get | `A:H` | PATCH: locate row by `r[0]` |
| Categories | 311 | update | `A{n}:H{n}` | PATCH write, 8-element positional row |
| Subscriptions | 332, 373, 435, 520 | get | `A:I` | GET, PATCH-locate, insights, `migrate-users` |
| Subscriptions | 397 | update | `A{n}:I{n}` | PATCH write, 9-element positional row |
| Subscriptions | 530/535 | update | `A{n}:I{n}` | `migrate-users` write; reads `r[7]` as `paid_by` |
| Expenses | 434, 498, 554, 643 | get | `A:H` | insights, `migrate-users`, PATCH-locate, `GET /api` |
| Expenses | 511/516 | update | `A{n}:H{n}` | `migrate-users`; reads `r[4]`/`r[5]` as paid_by/created_by |
| Expenses | 583 | update | `A{n}:H{n}` | PATCH write; carries `existing[4]`, `existing[5]`, `existing[7]` forward positionally |
| Expenses | 600 | get | `A:A` | DELETE: locate row, assumes column A is `id` |
| Expenses | 619 | batchUpdate | rowIndex | delete row |

Plus five positional row-mappers: `rowToExpense` (:35), `rowToUser` (:48), `rowToSubscription` (:59), `rowToCategory` (:73), and the header constants at :17–20.

Also positional, outside index.ts: `functions/scripts/apply-insurance-tax-categories.js` reads `Categories!A:G` (already stale — misses `note`) and writes `Expenses!D{n}` / `Subscriptions!D{n}`. `apps-script/*.gs` run inside Google, not in the backend.

Two things the checklist asked me to re-check, verified on current `main` rather than from memory: 042's `gov_category` fix is in place (`A:H` everywhere in the categories block, `rowToCategory` reads index 6), and the `A:F` PATCH that 049 found is **already fixed** — line 287 reads `A:H` and line 311 writes `A{n}:H{n}`.

## Spec

### Goal

Make every backend Sheets read and write resolve its columns by matching the tab's own header row to expected field names, so adding, reordering, or renaming a column in the spreadsheet cannot silently put data in the wrong field.

### Scope decision

**One pass, three tabs: Expenses, Categories, Subscriptions. `Users` is excluded.**

The ideation left this open and flagged the risk of touching everything at once. Splitting per-tab across separate entities is the wrong cut here, because the expensive, risky part is the shared resolver — building it once and adopting it on one tab means writing the hard part anyway, then repeating the deploy-and-verify cycle three more times for progressively smaller gains. The three included tabs share one code path and one test harness; doing them together is barely more work than doing one.

`Users` is excluded for a concrete reason, not to save effort: its header row is `email | Users`, which does not name the fields the code needs (`id`, `name`, `email`). Header-name matching cannot work on that tab until the header row itself is renamed — and "changing the actual schema or field names themselves" is already out of scope per the ideation. Forcing it in would mean either a schema change or a special-cased fake mapping, both of which undercut the point of the feature. The `@`-sniff heuristic at index.ts:48 stays as-is, with a comment recording why. The blank-`email` bug it causes is noted above as a separate finding, not fixed here.

The tradeoff being accepted: this is a larger single diff than a per-tab split, and the risk sits in the write paths, where a mistake corrupts real spending data. That risk is bounded by (a) writes preserving unknown columns by construction, (b) the existing `categories.api.test.js` harness, which already emulates the two Sheets behaviours that make this subtle, and (c) staging verification before production.

### User Stories

- As the captain, I want to reorder or rename a column in my spreadsheet without the app silently writing data into the wrong field, so I can organise my own sheet freely.
- As the captain, I want a column I added myself (`month`, `amount value`, `udpate`) to survive every app write untouched, so the app never eats my own work.
- As a future maintainer, I want column mapping to come from the sheet's header row rather than a hardcoded letter, so a new feature does not have to read source code to learn that "column D means category_id".
- As the captain, I want a clear, specific error when an expected column is missing, instead of blank fields that look like real data.

### Acceptance Criteria

Resolver behaviour

- [ ] AC-1 — A single header-resolution helper exists that, given a tab's rows, returns a map from field name to column index built from row 1.
- [ ] AC-2 — Header matching is case-insensitive and ignores leading/trailing whitespace (`Note`, `note`, `note ` all match `note`).
- [ ] AC-3 — If a tab's header row contains the same field name twice, the request fails with a 500 naming the tab and the duplicated name. It does not pick one.
- [ ] AC-4 — If a **required** header is missing, the request fails with a 500 whose body names the tab and the missing field. Required fields per tab: Expenses `id, date, amount, category_id, paid_by, created_by, notes, created_at`; Categories `id, name_en, name_zh, icon, sort_order, is_active`; Subscriptions `id, name, amount, category_id, frequency, due_day, due_month, paid_by, is_active`.
- [ ] AC-5 — `gov_category` and `note` on Categories are **optional**: when absent, reads return the existing empty defaults (`null` / `""`) and the endpoint still returns 200. This is what keeps staging (6-column Categories) and today's production (blank `H1`) working.
- [ ] AC-6 — A PATCH that sets an optional field whose column is absent returns 400 naming the field, rather than silently discarding the value.

Reads resolve by name

- [ ] AC-7 — `GET /api/categories`, `GET /api` (expenses), and `GET /api/subscriptions` return identical JSON before and after the change when the sheet is unmodified — byte-for-byte on the same fixture.
- [ ] AC-8 — With two columns swapped in a tab, each of those three GETs returns the same values per field as before the swap.
- [ ] AC-9 — A data row shorter than the header row (Sheets trims trailing blanks — 14 of 25 production Categories rows are 7 cells wide) reads as the field's empty default, not as an error or a shifted value.

Writes resolve by name

- [ ] AC-10 — `POST`/`PATCH` on expenses, categories, and subscriptions place each value in the column its header names, verified by reading the written row back and checking values by header, not by letter.
- [ ] AC-11 — Any column not named in the expected field list is preserved unchanged by every write. Concretely: after a PATCH to a production-shaped Categories row, column `I` (`udpate`) holds its original value; after a PATCH to an Expenses row, `I`/`J` (`month`, `amount value`) are unchanged.
- [ ] AC-12 — A newly inserted row (`insertRowAtTop`) puts each field under its named header, and leaves unknown columns blank rather than shifting values into them.
- [ ] AC-13 — `DELETE` locates the target row by the `id` column resolved from the header, not by assuming column A.
- [ ] AC-14 — The `migrate-users` endpoint resolves `paid_by` / `created_by` by header name instead of `r[4]`/`r[5]`/`r[7]`.

Live demonstration (the actual claim)

- [ ] AC-15 — On deployed staging, two columns are physically swapped in the Sheets UI in the **Subscriptions** tab (`frequency` ⇄ `due_day`). With the swap in place: `GET /api/subscriptions` returns each subscription's `frequency` as a word (`monthly`) and `due_day` as a number — the same values as before the swap. Evidence: the curl response body, and a screenshot or description of the swapped sheet.
- [ ] AC-16 — With that same swap still in place, a `PATCH /api` on a subscription changing `amount` writes the new amount into the `amount` column and leaves the swapped `frequency`/`due_day` cells untouched. Evidence: the PATCH response plus a read-back of that row showing the two swapped columns unchanged.
- [ ] AC-17 — A column is renamed in staging (`notes` → `note_text` on Expenses). `GET /api` then fails with a 500 naming the tab and the missing `notes` field — not a 200 with blank notes. Evidence: the curl status line and body.
- [ ] AC-18 — Both staging changes are reverted and a final `GET` confirms normal behaviour restored.
- [ ] AC-19 — The same three GETs are run against **production** after deploy and return non-empty, correct-looking data, proving the resolver copes with production's real header row (blank `Categories!H1`, `udpate` at `I`, `month`/`amount value` on Expenses).

### Edge Cases

- **Tab has no header row at all / is completely empty** — fail with a clear 500 naming the tab, rather than treating row 1 data as headers.
- **Header row has a blank cell** (production `Categories!H1` today) — treated as an unnamed column: never matched, always preserved on write.
- **A header typo** (`udpate`) — matches nothing, so it is simply an unknown column and is preserved. The feature does not attempt fuzzy matching; a near-miss must not silently bind to a real field.
- **Column moved beyond the current read range** — read ranges must be widened past the known field count (e.g. `A:Z`) so a column dragged to the right is still seen. A range that stops at `H` reintroduces exactly the 042 bug.
- **Captain reorders a column between the read and the write inside one in-flight request** — accepted, documented race. The write uses the map from that request's own read.
- **Header changes while a Function instance is warm** — see Plan: the map is per-request, never cached across requests, specifically so this cannot happen.
- **Two people editing at once** — unchanged from today's behaviour; last write wins.
- **Row shorter than header** — reads as empty default (AC-9).
- **More than 26 columns** — `String.fromCharCode(64 + len)` at index.ts:95 breaks past `Z`; the replacement must handle two-letter columns or avoid letter arithmetic entirely.

### Out of Scope

- The `Users` tab and `rowToUser`'s `@`-sniff heuristic — see Scope decision. The blank-`email` bug it causes is recorded in the audit as a separate finding.
- Fixing production's blank `Categories!H1`, the `udpate` typo, or staging's missing `gov_category`/`note` columns. AC-5 makes the code tolerate all three; changing the sheets is a captain decision, and a separate one.
- `functions/scripts/apply-insurance-tax-categories.js` — entity 042 is mid-flight and blocked on a captain-run write. Editing its ranges now would disturb work in progress.
- `apps-script/*.gs` — runs inside Google Apps Script, not the backend.
- Changing any field name, schema, or sheet data.
- The `Monthly` tab, which the backend never touches.

### Plan

The change is cheaper than the call-site count suggests, because **the header row is already in memory almost everywhere**. Every read today fetches `A:H`/`A:I` — which includes row 1 — and then throws it away with `.slice(1)`. So for read paths the header map costs zero extra Sheets API calls: use `rows[0]` instead of discarding it.

1. Add a resolver module (`functions/src/sheetSchema.ts` or similar) with the field lists per tab, marking `gov_category`/`note` optional, and a `buildColumnMap(headerRow, tabSpec)` that returns the name→index map or throws a named error (AC-1 to AC-6).
2. Widen every read range from `A:H`/`A:I` to a generous bound (`A:Z`) so a column moved rightwards is still in view. Costs nothing extra per call.
3. Rewrite the five `rowTo*` mappers to take `(row, columnMap)` and index by name.
4. For writes, build the outgoing row from the **existing row**, overwriting only the mapped indices that changed, and write back the same width. Unknown columns survive by construction rather than by remembering to preserve them (AC-11).
5. Rework `insertRowAtTop` to place values by resolved header index and to drop the `String.fromCharCode` letter arithmetic.
6. Extend `functions/test/categories.api.test.js` — its stub already emulates A1 range addressing and trailing-blank trimming, the two behaviours that make this subtle. Add fixtures for: swapped columns, a missing optional header, a missing required header, a duplicate header, and a production-shaped Categories tab with blank `H1` and `udpate` at `I`.

**Caching decision — do not cache the header map across requests.** The ideation suggested reading the header once and caching it. A Firebase Function instance stays warm for minutes; if the captain reorders a column while an instance is warm, a cached map would write to the old positions — which is precisely the corruption this feature exists to prevent, made harder to spot because it would be intermittent. The map is built per request from the rows already fetched, so caching buys no API calls on read paths anyway.

### Prerequisites for verify

- AC-15/AC-17 need two columns swapped and one renamed in the **staging** spreadsheet. Prior sessions (entity 042) found that this sandbox can read Sheets but has its writes refused by the permission classifier, so the sheet edits should be made by the captain in the Sheets UI, or by the verify agent if writes are permitted in that session. Reads and the API calls themselves (curl against deployed staging) are unaffected — the Function does the writing server-side.
- Staging must be deployed from the build branch before AC-15 to AC-18 can run.

## Stage Report: spec

- DONE: Trace every current Sheets read/write in functions/src/index.ts live against the actual code on main (not memory of old entities) — list every hardcoded range/column reference, which tab it belongs to, and what field it's really for. Several were touched very recently (042's gov_category A:F/A:G fix, 043's note column H, 049 found a PATCH still reading A:F) so treat this as an audit, not a recap.
  30 call sites tabulated by tab/line/op/range in the Audit section, plus 5 positional row-mappers. Re-checked on `main` (`ce44250`): 042's `gov_category` fix is present; the `A:F` PATCH 049 reported is already fixed (index.ts:287 reads `A:H`, :311 writes `A{n}:H{n}`). Went beyond code: read both real spreadsheets' header rows live (read-only) and found the code and the sheets have already diverged.
- DONE: Decide and justify the scope: one pass across the whole backend, or incremental per-tab/per-endpoint — the ideation explicitly left this open and flagged real risk in touching everything at once
  One pass over Expenses/Categories/Subscriptions; `Users` excluded. Justified in the Scope decision section on evidence, not preference: the three included tabs share one code path, while `Users`' live header row (`email | Users`) does not name its fields at all, so header matching cannot work there without a schema change the ideation already ruled out.
- DONE: Acceptance criteria are binary/testable, and explicitly include a live demonstration of the actual claim (reordering or renaming a column in a real sheet without breaking reads/writes) — not just code inspection
  19 ACs. AC-15 to AC-19 are the live demonstration: physically swap `frequency` ⇄ `due_day` in staging Subscriptions and prove a GET and a PATCH both still land correctly (AC-15/16), rename `notes` and prove it 500s instead of silently blanking (AC-17), revert (AC-18), then confirm against production's real header row (AC-19). Confirmed feasible — staging has 2 subscription, 25 category and 1404 expense data rows.

### Summary

The audit turned up four live facts that reshaped the spec: production `Categories!H1` is blank (043's `note` column has data but no header name), production carries captain-authored columns the backend has never seen (`udpate`, `month`, `amount value`), staging's Categories tab is two columns behind production, and the `Users` tab's headers don't name its fields — which is why `GET /api/users` returns a blank `email` for everyone today. The first three forced a required-vs-optional header distinction (AC-4/AC-5), without which a strict implementation would 500 on production and staging the moment it deployed; the fourth is what puts `Users` out of scope. Two judgment calls need the captain's eye: excluding `Users`, and rejecting the ideation's suggested cross-request header cache — a warm Function instance holding a stale map would cause exactly the intermittent corruption this feature exists to prevent, and on read paths the cache saves no API calls because the header row is already in the response being fetched.

## Stage Report: build

- DONE: Resolver behavior: header-name resolution helper, case-insensitive/trimmed matching, duplicate-header and missing-required-header errors, optional-field defaults (AC-1 through AC-6)
  `functions/src/sheetSchema.ts` — `buildColumnMap(rows, spec)` builds field→index from row 1; per-request, never cached (the ideation's cache was rejected in spec for the warm-instance reason, and the code comment records it). Tests: a header row of `["ID", " Name_EN", "name_zh ", ..., " NOTE "]` still round-trips reads and writes (fails if `normalizeHeader` stops trimming or lowercasing); a duplicated `name_en` 500s naming both columns (fails if the resolver last-write-wins instead of throwing); a removed `is_active` and a renamed `name_en`→`label_en` each 500 naming tab and field (fails if required headers become optional); a 6-column staging-shaped tab returns 200 with `gov_category: null` (fails if optional headers become required — this is the assertion that stops a deploy from 500ing staging).
- DONE: Reads and writes on Expenses/Categories/Subscriptions resolve by header name, unknown columns survive writes unchanged, DELETE and migrate-users resolve by name too (AC-7 through AC-14)
  All 30 audited call sites converted; ranges widened to `A:Z`; writes go through `buildWriteRow`, which copies the existing row cell-by-cell and overwrites only mapped indices, so unknown columns survive by construction rather than by remembering. The only positional ranges left are the three `Users!A:C` calls the spec scoped out. AC-7 was proven by building the pre-change handler from git HEAD and diffing: all three GETs byte-identical on the same fixture, with a self-check confirming a one-field perturbation registers as different; those exact bytes are now committed as string literals, so any drift in a field name, order, type or default fails the compare. AC-13 asserts `GET Expenses!C:C` was issued after moving `id` to column C (fails if DELETE reverts to assuming column A). AC-14 swaps `paid_by` with `notes` rather than with `created_by` — swapping the two user fields does not discriminate, since both run through the same resolver and a positional reader gets the right answer by luck.
- DONE: Extend the test harness per the spec's Plan step 6 (swapped columns, missing optional/required header, duplicate header, production-shaped Categories fixture with blank H1 and the udpate column)
  53 tests pass, 0 fail (`categories.api.test.js` 19, `sheetColumns.api.test.js` 22, `insights.test.js` 12 unchanged). The stub moved to `test/sheetsStub.js` and grew multi-tab support plus `spreadsheets.get`/`batchUpdate`, so row insertion and deletion are now exercised rather than stubbed around. Falsifiability check: the 39 new/rewritten tests were run against the pre-change handler and **24 failed**; the 15 that pass on both are exactly the ones asserting unchanged behaviour (AC-7 byte-identity, the 043 regression guard, short-row defaults, 404-on-unknown-id). Verify's job is set up by `AC-8: swapping frequency and due_day…`, which is the unit-level twin of AC-15's live staging swap.

### Summary

Every backend Sheets read and write on Expenses, Categories and Subscriptions now resolves columns from the tab's own header row. Two decisions worth the captain's eye. First, **a behaviour change to entity 043's note column**: 043 wrote to column H positionally, which works on production today even though `Categories!H1` is blank. Since an unnamed column is now an unknown column, production's 3 rows of note data will read back as `""` and a PATCH setting a note returns 400 — this is exactly what AC-5/AC-6 specify and the spec defers the sheet fix as a separate captain decision, but the fix is one cell: type `note` into `Categories!H1` **before** this reaches production. Second, `insertRowAtTop` no longer self-writes a header row when `A1 !== "id"`; that guard would have stamped the code's own field order over a reordered header, destroying the very thing the resolver reads. The consequence is that a genuinely empty tab now 500s with a clear message instead of silently bootstrapping itself, which matches the spec's empty-tab edge case.

Not done here, by design: AC-15 through AC-19 are the live staging and production demonstration and belong to verify. Note for verify — the worktree had no `node_modules`; run `npm install` in `functions/` before `npm run build && node --test test/`.
