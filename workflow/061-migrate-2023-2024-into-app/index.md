---
id: 061
title: Migrate 2023–2024 Historical Expense Data Into The App
status: spec
source: captain
started: 2026-08-31T02:26:05Z
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
gates:
    version: 1
    records:
        - id: gate:061:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:061-ideation-1
              briefing:
                id: briefing:061:ideation:attempt-1:revision-1
                digest: sha256:90c429a00191a5d21bfb921d288df43483503ef28ccf426975c16e81967923fe
                request-digest: sha256:616238f67c2e32a98590eb748fd3d55a0029d1b13b4af4c11e49a0129596d81b
                room-ref: ./review/ideation/briefing-1
              withdrawal:
                by: agent:first-officer
                at: "2026-08-28T14:39:26.491363Z"
                reason: Bound Briefing omits the first officer's recommendation and the concrete decision effect, which the gate-presentation contract requires the captain to see in the presentation channel. This workflow declares Subspace as its review surface, so the room itself must carry them rather than relying on surrounding chat. Inputs are unchanged; only the Briefing's completeness is at fault.
            - id: gate-attempt:061-ideation-2
              briefing:
                id: briefing:061:ideation:attempt-2:revision-1
                digest: sha256:f9c2cf21c57f70dc9f65739e3e54596ca31649c6eb70e313114c5cff13897358
                request-digest: sha256:0df636f568ce44ae9440694e05a7d87a64c52388cdf1302933d28f9d1f2abd05
                room-ref: ./review/ideation/briefing-2
              withdrawal:
                by: agent:first-officer
                at: "2026-08-28T14:48:46.071606Z"
                reason: Room briefing-2 was written by the spacedock 0.27.0 binary, which emits no index.json and is therefore unreadable by Subspace gate mode — the presentation failed its preflight. The binary is now 0.27.1, which does emit index.json. Rebinding so the room is readable in Subspace, this workflow's declared review surface. Briefing content is unchanged; only the room format is at fault.
            - id: gate-attempt:061-ideation-3
              briefing:
                id: briefing:061:ideation:attempt-3:revision-1
                digest: sha256:7d80892f81a50f494679959179b1c5c06fd3f727c2cd0b9cf06695db42f8038a
                room-ref: ./review/ideation/briefing-3
              resolution:
                type: Resolution
                id: resolution:spacedock:061:ideation:3
                briefing: briefing:061:ideation:attempt-3:revision-1
                by: person:captain
                at: "2026-08-31T02:24:07.567092Z"
                decision: approve
                reason: 'Captain approved the ideation direction: migrate 2023-2024 historical expense records into the app, feasibility judged and reported before any write. Scope bounded to those two years; all other archive years remain with 060. Spec must settle whether 2023 data exists by inspecting tab gid=0, surface the 25-bucket to flat gov_category mismatch as a captain decision rather than resolving it, and state the undo and blast-radius plan before any import.'
              application:
                target-stage: spec
                state: consumed
            - id: gate-attempt:061-ideation-4
              briefing:
                id: briefing:061:ideation:attempt-4:revision-1
                digest: sha256:417071a5ffe7bd8f836764c0673a227aef2490bd5e1128af601677c7640d22dd
                room-ref: ./review/ideation/briefing-4
              resolution:
                type: Resolution
                id: resolution:spacedock:061:ideation:4
                briefing: briefing:061:ideation:attempt-4:revision-1
                by: person:captain
                at: "2026-08-31T03:47:10.208462Z"
                decision: approve
                reason: 'Captain approved the corrected ideation scope in gate room briefing:061:ideation:attempt-4:revision-1, with no annotations. Access cleared and proven via the staging service account with two negative controls; 2023 confirmed by inspection at rows 33-58 of tab gid=1209807047; captain annotations A1-A6 folded; the normalization sheet accepted with its cost stated. Three decisions were put to the captain and left unanswered: 2022 in or out of scope, D4 date granularity for the undated days, and D3 undo/blast-radius/staging-first. Spec is instructed to carry each with a concrete recommendation and a stated default so the spec gate is a confirmation rather than another open round.'
              application:
                target-stage: spec
                state: consumed
        - id: gate:061:spec
          stage: spec
          attempts:
            - id: gate-attempt:061-spec-1
              briefing:
                id: briefing:061:spec:attempt-1:revision-1
                digest: sha256:abca4c9b38f58691ae7f05e182a108d8d000a17306a278fcf26c41fe8bc7397c
                room-ref: ./review/spec/briefing-1
              resolution:
                type: Resolution
                id: resolution:spacedock:061:spec:1
                briefing: briefing:061:spec:attempt-1:revision-1
                by: person:captain
                at: "2026-08-31T02:56:31.369792Z"
                decision: revise
                reason: |-
                    Captain rendered revise in the spec gate room with six annotations. The direction is accepted; the spec must be reworked against six concrete captain inputs, four of which change the deliverable.

                    1. 2023 EXISTS, and the tab pointer changes. Captain: "check row 31-58, these are 2023" in tab gid=1209807047 — not gid=0, which the spec and AC-13 both named. AC-13 and decision D0 must be rewritten against the correct tab and against a settled answer rather than an open question.

                    2. ACCESS ROUTE CHANGED. Captain: "I just shared this sheet to staging service account." The spec rejected the service-account route on the grounds the workbook was never shared with it; that is now false. The remedy is no longer a Drive connector reconnection. Re-verify read access through the staging service account and rewrite the blocking-precondition section accordingly.

                    3. D1 CATEGORY MAPPING, answered: "we figure out the category first, we can leave gov_category later." Categories are settled first; the flat gov_category mapping is deferred rather than resolved in this feature. Collapse D1's four options to this.

                    4. D2 RENTAL AND INCOME ROWS, answered: "follow what we did for 2026." Adopt the existing current-year treatment rather than inventing one. Spec must state what that treatment concretely is, read from the code, not assumed.

                    5. FORMAT AND APPROACH CHANGE. Captain: "I know [gid=1209807047] is not the same format. I think we can create another sheet to make this data easy to migrate." An intermediate normalization sheet is proposed instead of parsing the source matrix directly. This displaces a substantial part of the parser design and must be specced as the approach, with its own acceptance criteria, or argued against explicitly.

                    6. Context: the data is personal, unrelated to any work account. Confirms the account-mismatch diagnosis and rules out an org-permissions route.
---

Evaluate whether the captain's 2023 and 2024 historical expense records can be migrated into the live app, and if so, migrate them — so the app itself holds those two years instead of them living only in Google Sheets. Feasibility is judged before any write is attempted.

This feature blocks `060-historical-expense-analysis`: the captain chose migration-first, so the 2006–2025 growth report is specced only after this lands and may read the migrated data as a source.

## User Stories

- As the captain, I want my 2023 and 2024 spending to live inside the app, so I can see those years alongside the data I log day to day instead of opening old spreadsheets.
- As the captain, I want to be told honestly whether this is even possible before anyone writes to my live data, so I am not left with a half-migrated app.
- As the captain, I want the migration to be reversible, so a bad import does not cost me the records two of us use every day.

## Success

- **Feasibility: answered, and the answer is possible-with-caveats.** The source is
  readable, both years exist, and the structure is parseable. The caveats are the
  two source-integrity defects recorded below — damaged December 2024 headers, and
  a workbook that disagrees with its own month totals about 12% of the time. Neither
  blocks the migration; both mean the import cannot be proved by reconciling to the
  workbook alone.
- An intermediate normalization sheet the captain can read and correct, holding one
  row per dated line item for 2023 and 2024, before anything is written to the app.
- 2023 and 2024 expense records present in the app, attributed to the correct
  categories, dates, and amounts.
- The live data two people use daily is intact — no existing row altered or lost, verified against a before/after check, not asserted.
- A stated, exercised way to undo the migration.

### Out of Scope

- Years other than 2023 and 2024. **2022 is present in the same tab** (rows 63–88)
  and is deliberately left there — that is decision **D5**, recommended and
  defaulted to *out*, and reversible with a `--years` flag if the captain wants it
  in. The remaining archive years are inventoried and analysed by `060`, not
  imported here.
- The other eight tabs of the source workbook, including its separate `Income` tab.
- The growth analysis itself — that is `060`'s deliverable.
- Any new app UI for browsing historical years. This feature lands data, not screens.
- Changing what the app does with categories going forward, beyond what landing these two years requires.
- Any `gov_category` work. It is a property of a category, not of an expense row, so
  it needs no mapping here — and per the captain it is deferred regardless.
- Repairing the source workbook itself. Corrections are made in the normalization
  sheet; the original is read-only throughout.

## Source: what is actually there

This section records what was read, not what was assumed. Everything below was
obtained by reading the live workbook through the **staging service account**
during ideation cycle 2; the probe scripts live under the gitignored
`functions/backfill-reports/061-probe/`. It supersedes the earlier description
of the source, which was inherited from `060`'s folder inventory and describes a
different artefact.

**Access is no longer blocked.** The captain shared the workbook with the staging
service account (`expense-tracker-staging@expense-sheet-staging.iam.gserviceaccount.com`,
credentials already in `functions/.env.staging`). A `spreadsheets.get` through
that account returns the workbook and all nine of its tabs. Two other routes were
re-tested and both still fail: the Google Drive connector in this session returns
`Requested entity was not found`, and the **production** service account
(`expense-sheet-functions@expense-sheet-b2db8...`) returns `403 The caller does not
have permission`. So the read route is exactly one account, and it is the staging
one. The old "reconnect the Drive connector" remedy is void.

**The source is one tab, not one file per year.** Workbook
`1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I`, titled `ijacwei_income收支 (archived)`,
holds nine tabs. The expense data the captain pointed at is tab
**`gid=1209807047`, titled `Daily`** — 1,061 rows by 749 columns. Every earlier
reference in this entity to tab `gid=0` was wrong: `gid=0` is a tab titled `P&L`
and is not the source. There is no "pick the right file per year" problem, because
both years in scope sit in this one tab.

**Three years are stacked vertically as bands, and 2023 is one of them.** The
captain is right and `060`'s "no 2023 record" finding does not apply here — it was
about the archive *folder*. The tab holds three bands of 26 data rows each:

| Band | Date-header row | Column-label row | Data rows |
|---|---|---|---|
| **2024** | 1 | 2 | 3–28 |
| **2023** | 31 | 32 | **33–58** |
| 2022 | 61 | 62 | 63–88 |

Rows 31–58 are exactly the 2023 band the captain named. 2022 also exists here but
stays out of scope per the Out of Scope list below; it is `060`'s.

**Each band is a day-level matrix, not a monthly one.** Reading left to right in a
band: column A a row-kind tag, B the top-level bucket (`項目大類`), C the
sub-category (`項目分類`), D a free-text detail label (`細項說明`), E a note column
(`備註`, always the literal `Daily`), then from column F onward a repeating
structure of **one month-total column followed by that month's day columns**, where
each day occupies a *pair* of columns — `品名` (item name) and `金額` (amount) —
with the date itself carried as a real date value in the header row above the
`品名` column. Twelve month-total columns per band.

**The taxonomy is far smaller than this entity previously claimed.** Measured over
the whole tab:

- Column A holds **two** distinct values, not four row-kinds: the band-header
  literal `收入支出`, and `非固定支出` ("variable expense") on all 78 data rows.
  **There are no income rows and no rental-property row-kind in this tab.** Income
  lives in a separate `Income` tab that is not in scope.
- Column B holds **9** top-level buckets — `食 衣 行 住 醫療 育 樂 公益 雜項` — not 25.
- Column C holds **17** sub-categories, not 61.
- Column D holds 8 distinct detail labels: per-person labels and per-property-unit
  labels. This is where the rental-property distinction actually lives — on the
  `住/家具設備` and `住/住家維修` rows, 8 rows per band — and it is a free-text
  detail column, not a tag.

**The aggregates are columns, not rows.** The earlier premise that "section totals
and per-kind subtotals sit in the same columns as real line items" is false for
this tab. Every one of the 78 data rows is a real line item; the aggregation is the
twelve month-total columns. So the planned column-A row-kind filter has nothing to
filter, and the real risk is the opposite one: a parser that walks columns
indiscriminately sums each month twice. The discriminator is the column-label row —
a day column's label cell is `品名` or `金額`; a month-total column's is not.

**Measured size of the import.** Populated amount cells, both years in scope:

| Band | Day columns | Populated amount cells | Of which text-typed | Day cells with an item name |
|---|---|---|---|---|
| 2024 | 365 | 764 numeric + 10 text | 10 | 59 |
| 2023 | 363 | 846 numeric + 47 text | 47 | 43 |

So the import is **roughly 1,670 rows for both years combined**, not the ~1,400 per
year previously estimated — small enough that the app's lack of pagination is not
the concern it looked like. The text-typed cells are plain digit strings with no
separators or currency prefix, so parsing is `Number(String(v).trim())` — but a
parser that accepts only `typeof v === "number"` silently drops 47 real 2023
amounts. Item names are present on only ~7% of populated cells, so `notes` will
mostly be assembled from the bucket / sub-category / detail columns.

**Two data-integrity defects in the source, found by exercising it.**

1. **December 2024 headers are damaged.** The 2024 band's day-column headers run
   only to 2024-12-16 and contain 15 duplicated dates across early December; 16
   calendar days of 2024 have no column at all. 2023 is clean by comparison — 362
   distinct dates, no duplicates, spanning 2023-01-01 to 2023-12-31, 3 missing days.
2. **The workbook does not reconcile against itself.** Checking every populated
   row-month cell against the sum of that month's day cells: **88.1% agree within
   1% for 2024 and 88.9% for 2023.** The mismatches cluster hard in October (7 in
   2024, 11 in 2023). This matters because it falsifies the planned AC-2: a check
   that reconciles the import to "the workbook's own total within 1%" would fail on
   the source's own inconsistency rather than on any parser defect.

## Plan

### Settled by the captain in the spec gate (cycle 1)

- **Does 2023 exist? Yes.** Settled by the captain and then confirmed by inspection —
  rows 33–58 of tab `gid=1209807047`. This feature covers both years. The 2024-only
  fallback is dead.
- **Categories are decided first; `gov_category` is deferred.** Captain: "we figure
  out the category first, we can leave gov_category later." This turns out to be
  free rather than a deferral, and spec should say so: `gov_category` is **not a
  column on the Expenses tab at all**. `EXPENSES_SPEC` requires exactly
  `id | date | amount | category_id | paid_by | created_by | notes | created_at`
  (`functions/src/sheetSchema.ts:19-22`), and `rowToExpense` returns those eight
  fields (`functions/src/index.ts:156-165`). `gov_category` is a property of a
  *category* on the Categories tab (`rowToCategory`, `functions/src/index.ts:192`),
  so it follows automatically once `category_id` is chosen. Nothing to map, nothing
  to defer. The real work is mapping 9 buckets × 17 sub-categories onto the 24
  category ids in `app/app/lib/categories.ts` — a much smaller job than the 25×61
  this entity previously described.
- **Rental-property and income rows: follow the 2026 precedent.** Captain: "follow
  what we did for 2026." Read from the code rather than assumed, that precedent is
  entity `008` / `scripts/migrate-2025.js`, recorded at
  `workflow/_archive/data-migration.md`, and concretely it is:
  - Every source bucket was mapped onto one of the **existing** 24 category ids. No
    new categories were created; unmappable combinations went to `other`.
  - The one rental-adjacent source bucket, `其他/房客` (tenant), was mapped to
    `other` as an **ordinary expense row** — no flag, no exclusion, no annotation
    (`data-migration.md:136`).
  - **Income never arose** — the 2025 source had no income rows, so `008` set no
    income policy. That gap is closed for this feature by the structure above: the
    `Daily` tab has no income rows either. Income stays out of scope by fact, not
    by decision.
  - Dates were passed through verbatim at day level; `created_at` was derived from
    the date with a randomised time so 1,404 rows would not share a timestamp.
  - Row ids were sequential and deterministic (`exp_2025_0001`…) but **not**
    idempotent — `008` states plainly that running twice creates duplicates. This
    feature should not copy that part; the newer `exp-auto-{sub}-{date}` shape in
    `functions/src/scheduler.ts:87` is the better precedent for re-runnability.

  Applied here: the ~8 rental-property rows per band are identified by the column-D
  detail label, and following `008` they land as ordinary expense rows with the
  detail label preserved in `notes`. Whether the captain wants them excluded instead
  is a smaller question than it looked, because they are 8 rows and identifiable.

### The intermediate normalization sheet — accepted, with what it does and does not buy

The captain proposed one: "I know [the `Daily` tab] is not the same format. I think
we can create another sheet to make this data easy to migrate." **Take it.** Two
concrete reasons, both from the readings above rather than from taste:

- The source does not reconcile against itself (~12% of row-month cells) and
  December 2024's headers are duplicated and truncated. Those need a human's
  judgement, and there is nowhere in a script-only pipeline to apply it. A
  normalization sheet is that place: the captain can see the extracted rows,
  correct the December 2024 dates, and settle the October discrepancies **before**
  anything is written to the app.
- It converts a 749-column three-band matrix into a long table — one row per
  `(year, date, bucket, sub-category, detail, item name, amount)` — which is the
  shape the app's Expenses tab already is. The importer then becomes the same
  row-append shape `008` and `051` have both already proven, instead of new code.

**What it does not buy, stated plainly so spec does not over-credit it:** it does
not remove the parser. Something still has to read three bands across 749 columns
and pair day headers to `品名`/`金額` columns; the normalization sheet is where that
parser's *output* goes instead of straight into the app. Net effect on scope is a
second, reviewable artefact and one extra stage, not less code.

It also raised a question nobody had answered: where the sheet lives, and whether
the captain's edits survive a re-generate. **Both are now answered by exercise, not
by assumption** — see **Spec → The normalization sheet** below. Short form: it is a
tab in the staging expense spreadsheet the captain already owns; a re-generate never
writes over an existing tab; and her corrections are keyed to source cell
coordinates, so they carry forward into the new tab rather than being matched by
position.

### Three decisions carried to the spec gate — each with a default

The ideation gate put three questions to the captain and she left all three
unanswered. They are **not** re-opened here as blank questions. Each now carries a
concrete recommendation **and a stated default that applies if she says nothing**,
so the spec gate is a confirm-or-correct rather than another open round:

| # | Question | Recommendation | Default if unanswered |
|---|---|---|---|
| **D3** | Undo, blast radius, staging first? | Staging first, both undo mechanisms | **A + U3** |
| **D4** | Dates for the ~19 undated days | Real per-day dates; hand-correct in the normalization sheet | **A, falling back to C** — never B |
| **D5** | Is 2022 in or out? | Out | **Out** |

Full statements, options and evidence are under **Spec → Decisions needed from the
captain**. The defaults are chosen so that **no decision blocks `build`**: if the
captain confirms nothing, build proceeds on the defaults and the result is
conservative in every case — it rehearses before it writes, it drops a date rather
than inventing one, and it imports less rather than more.

### No longer open

- **Which source file per year** — moot. Both years are in one tab of one workbook.
- **Aggregate rows interleaved with data rows** — false for this tab. The aggregates
  are columns.
- **Source access** — resolved; see above.


## Spec

> **Rewritten in spec cycle 2.** The captain's six cycle-1 annotations and the
> source readings under **Source: what is actually there** are folded in.
> AC-2, AC-3 and AC-4 are recut against the real source; the normalization sheet
> is specced as the approach with its own criteria; D3, D4 and the new D5 each
> carry a recommendation and a default. Nothing in this section is now known to
> rest on a falsified premise.

### Blocking precondition — source access — CLEARED

**Resolved on 2026-08-31.** The captain shared the workbook with the staging
service account, and read access was then verified rather than assumed:
`spreadsheets.get` on `1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I` through
`expense-tracker-staging@expense-sheet-staging.iam.gserviceaccount.com` returns the
workbook and its nine tabs. `build` is no longer gated on access.

Two routes remain closed and should not be re-attempted: the Google Drive connector
in this session still returns `Requested entity was not found` — the captain has
confirmed the data is personal and unrelated to any work account, so there is no
org-permissions route to chase — and the **production** service account
`expense-sheet-functions@expense-sheet-b2db8...` returns `403 The caller does not
have permission`. The read route is the staging service account and only that.

The exit condition this precondition set has been met, against the correct tab: the
file id, the tab structure, the column-label row and the distinct years found are
all recorded under **Source: what is actually there**. Note that the exit condition
named tab `gid=0`; that pointer was wrong. `gid=0` is a `P&L` tab. The source is
`gid=1209807047`, titled `Daily`.

### The normalization sheet — the accepted approach

The captain proposed it and it is taken. This section says where it lives, what
shape it has, and what happens to her corrections — the three things that were
open. Each was settled by exercising the mechanism, not by assuming it.

#### Where it lives — settled by probe, and the source stays read-only

It is a tab in the **staging expense spreadsheet**
(`1ZCmtQh2YvexnuxUpMroQnqT6DtQLvtyLQDTHiBTVe5o`), named
`Migration 2023-2024`. Three findings pick that host:

- **The staging service account provably can create, write, read back and delete a
  tab there.** Exercised, not assumed: `probe-staging-addsheet.js` added a temp tab,
  wrote a row, read it back, and deleted the tab. That is the exact mechanism the
  extractor needs.
- **The captain already owns that spreadsheet and can open it.** `STAGING_SETUP.md:78-84`
  has her creating it and sharing it with the service account as Editor, so the
  review surface needs no new sharing step.
- **The captain's archive workbook is ruled out as the host.** Write permission
  there is *unproven* — an empty `batchUpdate` returns `400 Must specify at least
  one request` before the permission check runs, so there is no non-mutating way to
  test it, and the only conclusive test would be a write to her personal data.
  Ruling it out costs nothing: this entity's Out of Scope already promises the
  original workbook is read-only throughout. **The migration never writes to
  `1PThKs3...`.**

**The Google Drive API is disabled on the staging GCP project** (`403 Google Drive
API has not been used in project 127990972623 before or it is disabled`). So the
alternative route — service account creates a standalone workbook and shares it
with the captain — is closed without a console change she would have to make. An
extra tab in a spreadsheet she owns needs nothing enabled. This is also why the
extractor uses Sheets API only; a build that reaches for `drive.files` will fail.

An extra tab is inert to the running app: the API reads tabs by name
(`EXPENSES_SPEC`, `CATEGORIES_SPEC` in `functions/src/sheetSchema.ts`), never by
enumeration, so `Migration 2023-2024` is invisible to every code path. AC-8 checks
this rather than trusting it.

#### Shape

Row 1 is a control row, row 2 the header, rows 3+ the data. One row per populated
day-amount cell.

| Column | Written by | Meaning |
|---|---|---|
| `key` | extractor | **`{year}-r{sourceRow}-c{sourceCol}`** — the source cell's own coordinates |
| `year` / `date` | extractor, captain may correct `date` | the day-column header date |
| `date_source` | extractor | `header`, `captain`, or `missing` |
| `bucket` / `sub_category` / `detail` | extractor | source columns B, C, D |
| `item_name` | extractor | source `品名` cell, blank on ~93% of rows |
| `amount` | extractor, captain may correct | parsed via `Number(String(v).trim())` |
| `category_name_en` | extractor, captain may correct | the mapping's output — a **name**, not an id (see D1 note below) |
| `status` | extractor, captain may correct | `include`, `exclude`, `undated`, `orphaned` |
| `captain_note` | captain only | free text, carried into nothing; for her own use |
| `gen_*` shadow columns | extractor only | what the extractor last emitted for each captain-editable column |

Control row: `A1="STATUS"`, `B1` is where the captain types `APPROVED`,
`C1` the extractor stamps the generation timestamp and a digest of the data block.

#### Do the captain's hand corrections survive a re-generate? Yes — and the mechanism is *never overwrite*, not *merge in place*

This is the question the ideation gate raised and nobody answered. The answer is a
mechanism, not a promise:

1. **The extractor never writes over an existing normalization tab.** `--generate`
   aborts non-zero if the named tab already exists. To re-generate, build passes
   `--generate --into "Migration 2023-2024 v2" --carry-from "Migration 2023-2024"`.
   The prior tab is left exactly as she left it.
2. **Corrections carry forward by source coordinate, not by row position.** `key`
   is derived from the source cell's row and column, so it is stable across a
   re-generate even if the extractor's ordering, filtering or row count changes.
   For each key present in both tabs, the carry-forward copies the captain-editable
   columns (`date`, `amount`, `category_name_en`, `status`, `captain_note`) from the
   old tab into the new one, and marks `date_source=captain` where she had changed
   the date.
3. **A correction the extractor cannot reconcile stops the run.** If a key's
   underlying source cell changed *and* the captain had edited the same column — the
   only case where carrying forward and re-extracting disagree — the run exits
   non-zero listing those keys, rather than silently picking a winner. She then
   decides per key.
4. **A key that vanishes from the source is not dropped.** It is carried into the
   new tab with `status=orphaned` and reported by count, so a correction can never
   disappear because a source cell went blank.

**What happens if they do not survive** — the case worth naming plainly, because
step 1 is what makes it recoverable. If the carry-forward is itself buggy, the
previous tab still exists, untouched, with every correction in it. Recovery is
re-running the carry-forward, not re-doing the manual pass. That is the whole reason
the design refuses in-place merge: an in-place merge that goes wrong has already
destroyed the thing it was preserving.

The importer never reads the extractor's output directly; it reads a named,
`APPROVED` tab and takes that name explicitly (`--from-sheet`, no default), the
same discipline AC-12 imposes on `--target`. AC-14 and AC-16 make both properties
falsifiable.

#### The mapping targets category *names*, not ids — a finding that changes the design

Read from the live sheets rather than from `DEFAULT_CATEGORIES`: the staging and
production Categories tabs both use `cat_NNN` ids, **and they do not agree**.
Production's `cat_023/024/025` are `Tenant / Insurance / Tax`; staging's are
`Test Cat / Antkee / ScrollTest`. Meanwhile `app/app/lib/categories.ts:120` records
that 99% of stored expenses carry a legacy slug (`eating-out`) that exists in no
live category at all.

Two consequences the spec has to carry:

- **A mapping table that hard-codes `cat_NNN` and is rehearsed on staging would
  write different categories on production.** So the mapping is
  `(bucket, sub_category) → name_en`, and the importer resolves `name_en` to the
  target sheet's own live `id` at run time, aborting if a name does not resolve
  there. This is what `resolveCategory` already does for reads
  (`app/app/lib/categories.ts:130-152`).
- **Do not write slugs.** They would render (via the legacy bridge) but would fail
  `categoryIdError` (`functions/src/index.ts:139-154`), so any row later edited
  through the API would be rejected. AC-9 asserts resolution against the target's
  live tab, which a slug fails.

The mapping itself is small and fixed. All three bands carry **identical** columns
A–C — 26 rows, 9 buckets, 17 distinct `(bucket, sub_category)` pairs, verbatim the
same in 2024, 2023 and 2022:

| Source `項目大類 / 項目分類` | → category `name_en` |
|---|---|
| 食 / 食材 | Groceries |
| 食 / 外食餐廳 | Eating Out |
| 衣 / 衣服鞋襪 | Clothing |
| 行 / 加油 | Fuel |
| 行 / 過路費 | Tolls |
| 行 / 修車保養 | Car Repair |
| 住 / 家用品 | Daily Necessities |
| 住 / 家具設備 | Equipment |
| 住 / 住家維修 | Equipment |
| 醫療 / 醫療 | Medical |
| 育 / 學費 | Tuition |
| 育 / 進修 | Tuition |
| 育 / 書、上課 | Tuition |
| 育 / 教練課 | Sports |
| 樂 / 旅遊 | Travel |
| 公益 / 捐款 | Donate |
| 雜項 / 雜項 | Other |

Every target is one of the 22 names common to both live tabs, so no category is
created and `D1`'s "existing categories only" holds. The captain can override any
row's `category_name_en` in the normalization sheet — which is the cheapest possible
way to settle a mapping disagreement, and the reason this table does not need to be
right first time.

**One consequence for row identity worth stating:** `(bucket, sub_category)` is
**not** a unique row key. Rows 8/9 and 19–26 of each band repeat `住/家具設備` and
`住/住家維修`; rows 11/12 repeat `育/學費`. They are distinguished only by the
free-text column D — which is exactly where the rental-property distinction lives.
So the extractor must key on the source row number, never on the taxonomy pair.

### Decisions needed from the captain

**D3, D4 and D5 are live, and each carries a default.** D0, D1 and D2 were answered by the captain in the
cycle-1 spec gate and are marked ANSWERED below rather than deleted, so the answer
and the question it settles stay together. D3, D4 and D5 were all put to her at the
ideation gate and all three came back unanswered, so each is restated below with a
recommendation **and a default that applies if she says nothing** — none of them
blocks `build`.

#### D0 — Does 2023 exist, and how do we look? — ANSWERED

**Outcome at stake:** whether this feature covers one year or two. **Answer: two.**

The captain named the location directly — tab `gid=1209807047`, rows 31–58 — and
that was then **confirmed by inspection, not taken on her word**: rows 33–58 are a
complete 2023 band with 363 day columns spanning 2023-01-01 to 2023-12-31. The
options below are all void: none of the four access remedies was needed, because the
route turned out to be the staging service account she shared the sheet with.

The pointer in the original question was wrong in a way worth recording. It named
tab `gid=0`; `gid=0` is a tab titled `P&L`. Every reference to `gid=0` in this
entity has been corrected to `gid=1209807047`.

`060`'s "the archive holds no 2023 record" finding is confirmed as inapplicable
rather than merely uncarried: it was about the archive *folder*, and the 2023 data
is inside a tab of a workbook in a different place.

#### D1 — How the historical buckets land in the app's categories — ANSWERED

**Outcome at stake:** whether a 2024 row is still recognisable as what it was, and whether the app's live Categories tab changes.

**Captain: "we figure out the category first, we can leave gov_category later."**
The four options collapse to that, and the readings shrink the problem twice over:

- The premise "25 top-level buckets over 61 sub-categories" was wrong for this
  source. The `Daily` tab carries **9 buckets over 17 sub-categories** plus a
  free-text detail column.
- `gov_category` needs no mapping at all. It is not a column on the Expenses tab —
  `EXPENSES_SPEC` (`functions/src/sheetSchema.ts:19-22`) requires exactly eight
  fields and `gov_category` is not among them. It is a property of a *category*
  (`rowToCategory`, `functions/src/index.ts:192`), so choosing `category_id`
  determines it. Deferring it costs nothing.

The app still stores one `category_id` per expense and validates it against the
Categories tab on every write (`functions/src/index.ts`, `categoryIdError`), so the
remaining job is a 9×17 mapping onto the 24 ids in `app/app/lib/categories.ts`.
Following the `008` precedent the captain invoked in D2, that mapping uses the
**existing** categories only, with `other` as the fallback and the source bucket,
sub-category and detail label carried into `notes` — which the History page already
searches and displays (`app/app/history/page.tsx:86`, `:543`). Spec writes the
mapping table out in full; it is small enough to state exhaustively rather than
describe.

#### D2 — Rental-property flows and income rows — ANSWERED

**Outcome at stake:** whether every total the app shows still means "what the household spent".

**Captain: "follow what we did for 2026."** Read from the code rather than assumed,
that precedent is entity `008` / `scripts/migrate-2025.js`, recorded at
`workflow/_archive/data-migration.md`. Concretely it mapped every source bucket onto
the existing 24 category ids, sent the one rental-adjacent bucket `其他/房客`
(tenant) to `other` as an **ordinary expense row** with no flag and no exclusion
(`data-migration.md:136`), and never faced an income row at all. The full precedent
is set out under **Plan → Settled by the captain**, including the one part of it not
to copy: `008`'s row ids were not idempotent and it says so.

The premise of the original question was also wrong. The source does **not**
interleave income rows and rental pass-throughs distinguished by a column-A
row-kind tag:

- Column A has two values across the whole tab — the band-header literal and
  `非固定支出`. **There are no income rows in this tab.** Income sits in a separate
  `Income` tab that is out of scope. So option D's danger — the app sums `amount`
  with no sign handling anywhere (`app/app/lib/reportService.ts`) — is real but
  moot: there is nothing to import with a sign.
- Rental-property rows are identified by the **column-D detail label** on
  `住/家具設備` and `住/住家維修` rows, about 8 rows per band. Following `008`, they
  land as ordinary expense rows with that label preserved in `notes`.

#### D3 — Undo, blast radius, and whether staging goes first — RECOMMENDED A + U3, DEFAULT A + U3

**Outcome at stake:** the live data two people use daily.

Three verified facts shape the options — the third is new this cycle and changes
what a staging rehearsal is worth:

- `functions/scripts/load-local-env.js` reads the repo-root `.env.local` and `functions/.env` **only** — never `functions/.env.staging`, which is where `STAGING_SETUP.md:97-105` puts the staging `SPREADSHEET_ID`. **There is no supported way to point an admin script at staging today**, and the id it does resolve is whichever the deploy env files hold. That is why AC-12 exists: the script must be told its target rather than inheriting one.
- `functions/scripts/backfill-subscription-history.js` already proves the safe write shape on this sheet: deterministic ids, `--dry-run`, batched all-or-nothing `insertDimension`+`updateCells`, and a `PartialWriteError` that carries the ids already written.
- **Staging and production Categories tabs have diverged.** Read live this cycle: both use `cat_NNN`, but production's `cat_023/024/025` are `Tenant / Insurance / Tax` while staging's are `Test Cat / Antkee / ScrollTest`. So a staging rehearsal **does not** validate the production category mapping if ids are hard-coded. This is handled by resolving `name_en` at run time against the target's own tab (see **The normalization sheet** above), and it adds one required production pre-flight that no staging run can substitute for: assert every mapped `name_en` resolves on production **before** the first production write.

Target sequencing:

- **A. Staging first, then production.** Requires adding an explicit `--target staging|production` flag that reads `functions/.env.staging` (~15–25 LOC). Costs one small change; buys a full rehearsal of apply *and* undo against data nobody depends on.
- **B. Production only, with `--dry-run` first and a full pre-import snapshot of the Expenses tab.** Faster; the first real write is also the first real test.

Undo mechanism:

- **U1. Deterministic ids + `--undo`.** Every imported row carries `exp-hist-{year}-{NNNN}`; undo deletes exactly the rows with that prefix. Precise, repeatable, and it leaves anything the two users entered in between untouched. Follows the existing `exp-auto-{sub}-{date}` convention (`functions/src/scheduler.ts:87`).
- **U2. Copy the whole spreadsheet before the import; restore by hand if it goes wrong.** Coarse — restoring also throws away every expense either user logged after the snapshot.
- **U3. Both.** U1 as the routine reversal, U2 as the floor under it.

*Recommendation: **A + U3**. The undo is exercised on staging before production is touched (AC-6), so "reversible" is a demonstrated fact rather than a claim in a report.*

***Default if unanswered: A + U3.*** It is the conservative branch — it rehearses
apply *and* undo against data nobody depends on before the first production write —
and it costs ~15–25 LOC in `load-local-env.js`. Choosing B instead is the change
that needs her word, because B makes the first real write the first real test.

Two blast-radius notes she should see either way, whichever branch she picks:

- **Generating the normalization sheet touches staging regardless.** It adds a tab
  to the staging expense spreadsheet even if the import target is production. That
  is additive and reversible (`deleteSheet`, exercised), and inert to the app — but
  it means "production only" is not "staging untouched".
- **The captain's archive workbook is never written**, on any branch. Read-only
  throughout, and the spec deliberately puts the normalization tab elsewhere so that
  stays true.

#### D4 — Date granularity, and how many rows this adds — RECOMMENDED A, DEFAULT A FALLING BACK TO C

**Outcome at stake:** whether a synthetic date can masquerade as a real transaction date.

Its premise changed and its options are re-cut accordingly. The decision is still
hers, but it no longer blocks: the default below needs nothing from her. The source is **not** an annual matrix of twelve monthly
columns — it is a day-level matrix carrying a real date per column. The app stores a
day-level `date` and filters reports by `date.startsWith(year)` and `YYYY-MM`. There
is no pagination anywhere — `GET /api` returns every expense and the client sorts and
filters the whole list (`app/app/lib/historyService.ts`, `app/app/history/page.tsx`).

The "will this slow the app" half is now answered by measurement rather than
estimate: **~1,670 rows for both years combined**, not ~1,400 per year. That is small.
What is left is genuinely a judgement call, on the days the source cannot date — the
16 damaged December 2024 columns and the ~3 missing days in 2023:

- **A. Use the source's real per-day date, and hand-correct the undated days in the
  normalization sheet.** Highest fidelity; every row is a real date the captain
  stands behind. Costs her a short pass over ~19 cells.
- **B. Use the real date where there is one; park the undated ones on the last dated
  day of their month.** No manual work. Those rows then carry a date that looks real
  and is not — the exact failure mode this decision exists to prevent, confined to
  ~19 rows.
- **C. Use the real date where there is one; drop the undated rows and report the
  count.** Honest and cheap; loses a fraction of December 2024.

*Recommendation: **A**. The manual pass is small, it happens in the normalization
sheet she has already asked for, and it is the only option where every date in the
app is a date that was actually recorded.*

***Default if unanswered: A, falling back automatically to C — never B.*** The
extractor marks every row it cannot date `status=undated` and leaves `date` blank.
She may fill those in; she does not have to. At import time, any row still
`status=undated` is **excluded and reported by count**. So A happens if she spends
the ten minutes, C happens if she does not, and neither needs an answer from her in
advance. B — parking an undated row on the month's last dated day — is not
implemented at all, so the failure this decision exists to prevent cannot occur by
default, by drift, or by a later flag.

The blank-date rows are the *only* thing the ~19 undated days cost. Every other row
in both years carries a real date from its own column header.

#### D5 — Is 2022 in or out of scope? — RECOMMENDED OUT, DEFAULT OUT

**Outcome at stake:** whether this feature lands two years or three, and whether it
takes work away from `060`.

This one only became a question when the source turned out to be one tab holding
three stacked bands. 2022 sits at rows 63–88, complete, in the same shape, with
identical columns A–C. It was never *excluded* on evidence; it was excluded because
the ideation gate bounded scope to 2023–2024 before anyone knew 2022 was sitting
right there.

- **Out (recommended).** The captain approved a two-year scope at the ideation gate,
  and the remaining archive years belong to `060`. Importing 2022 here would take a
  year out of `060`'s inventory without `060` having specced it.
- **In.** Costs roughly one more band's worth of rows and a second pass over the
  normalization sheet. It buys a third year in Reports now instead of after `060`.

*Recommendation: **out**. **Default if unanswered: out.***

**The honest part of this recommendation:** deferring 2022 costs almost nothing to
reverse. The extractor discovers all three bands anyway — it has to, in order to
know where the 2023 band ends — so adding 2022 later is a `--years 2022` flag and
one more normalization-sheet review, not a rewrite. That asymmetry is why "out" is
the low-regret answer rather than merely the cautious one.

**This is also where the band-boundary risk lives, and it is not a cosmetic one.**
Columns A, B and C are **byte-identical across all three bands** — verified, the
same 26 rows in the same order in 2024, 2023 and 2022. So if a row-range slip pulled
2022 rows in, *nothing in the taxonomy would look wrong*. The rows would be
well-formed, correctly categorised, and silently attributed to the wrong year. The
only discriminator is the date in each band's own header row. AC-4 is written
against exactly that, and the guard was exercised: rows 1 / 31 / 61 yield years
2024 / 2023 / 2022 with no cross-year contamination in any of them.

### Goal

Land the captain's 2023 and 2024 historical expense records — both confirmed present in tab `gid=1209807047` — as ordinary rows in the app's Expenses tab, reversibly and without touching a single existing row, so those years appear in Reports alongside everyday data. The rows reach the app by way of a normalization sheet the captain reviews first.

### User Stories

- As the captain, I want to open Reports, step back to 2024, and see a real total, so those years are part of the app rather than a spreadsheet I have to go find.
- As the captain, I want to be told what the import would write before it writes anything, so the first real change is one I already approved in detail.
- As the captain, I want one command that puts the app back exactly as it was, so a bad import costs me an afternoon and not my records.
- As the captain, I want to know which historical bucket a row came from when I look at it, so a 2024 figure is still interpretable two years from now.

### Edge Cases

- ~~**2023 may have no record at all.**~~ **Closed.** 2023 is present, rows 33–58 of tab `gid=1209807047`, with 363 day columns spanning the full year. There is no 2024-only fallback to carry.
- ~~**Aggregate rows sit in the same columns as data rows.**~~ **Wrong shape, replaced.** All 78 data rows in the tab are real line items; there are no aggregate *rows*. The aggregates are **columns** — twelve month-total columns per band, each sitting immediately before its month's day columns. A parser that walks columns indiscriminately therefore double-counts every month. The discriminator is the column-label row (`品名`/`金額` marks a day column; a month-total column's label cell is neither), not the column-A tag.
- **The workbook disagrees with itself.** Only ~88% of populated row-month cells match the sum of their own day cells within 1%, and the mismatches cluster in October in both years. Any acceptance criterion that reconciles the import against the workbook's own totals will fail on the source rather than on the parser. The reconciliation target has to be the normalization sheet the captain has signed off, with the source-vs-source discrepancies surfaced to her there.
- **December 2024's day headers are damaged.** They stop at 2024-12-16 and repeat 15 dates in early December; 16 calendar days of 2024 have no column at all. 2023 is nearly clean by comparison — 3 missing days, no duplicates. This is the concrete case D4 now turns on.
- ~~**Rows with a blank column-A tag.**~~ **Does not occur.** Column A is `非固定支出` on every one of the 78 data rows.
- **Blank day cells.** The overwhelming majority. A blank means no spending was logged that day for that line item; no row is written. No zero-valued amount cell exists in either band in scope, so there is nothing to disambiguate.
- **Amounts stored as text.** 10 cells in 2024 and 47 in 2023 are strings rather than numbers. Measured, they are plain digit strings — no thousands separators, no currency prefix — so `Number(String(v).trim())` parses them. The trap is the opposite of the one previously feared: a parser that accepts only `typeof v === "number"` silently drops 47 real 2023 amounts rather than failing loudly. Any value that genuinely fails to parse aborts the run with the source cell reference; it never silently becomes 0.
- **Item names are mostly absent.** Only ~7% of populated day cells carry a `品名`. `notes` is therefore assembled mainly from the bucket, sub-category and detail columns, with the item name appended when present.
- **Uncategorised line items.** An amount with a blank bucket goes to an explicit bucket, is visible in the totals, and is counted in the dry-run — never dropped.
- **Two users logging expenses while the import runs.** Rows are inserted at the top and shift every row index below them. Every check keys on the row `id`, never on a row index, so a concurrent manual add cannot be mistaken for an imported row or vice versa.
- **A batch fails halfway.** `PartialWriteError` carries the ids already written; `--undo` removes exactly those. The run is then re-runnable from clean.
- **The import is run twice.** Deterministic ids mean the second run finds every id already present and writes nothing (AC-5).
- **Sheets API write quota.** Batches of 50, matching the existing backfill script's `WRITE_BATCH_SIZE`.
- ~~**Duplicate, template, and legacy `.xls` variants of a year.**~~ **Moot.** Both years in scope are bands inside one tab of one workbook. There is no file to pick.
- **2022 sits in the same tab, and looks exactly like the years in scope.** Rows 63–88 are a complete 2022 band whose columns A–C are **byte-identical** to 2023's and 2024's. A band-boundary slip therefore produces rows that are well-formed and correctly categorised but attributed to the wrong year — nothing in the taxonomy would look wrong. So the extractor does not take row ranges at all: it discovers bands from column A's `收入支出` / `非固定支出` structure and labels each from the dates in its own header row, then selects by year. AC-4 asserts both halves.
- **The mapping is built on staging and applied to production.** The two Categories tabs agree on `cat_001`–`cat_022` and diverge after: production `Tenant / Insurance / Tax`, staging `Test Cat / Antkee / ScrollTest`. Any `cat_NNN` learned on staging is wrong on production, and wrong in the worst way — the id exists on both, so the write succeeds and the row is simply filed under the wrong category. The importer therefore resolves `name_en` against the target's own tab at run time and aborts on an unresolved name (AC-9).
- **The normalization sheet is a new tab in a live spreadsheet.** The app reads tabs by name, never by enumeration (`functions/src/sheetSchema.ts`), so an extra tab is inert — but that is checked (AC-8) rather than assumed, and the tab is added to **staging**, never to the captain's archive workbook.
- **The app has no income concept, and does not need one here.** There is no sign or type column on the Expenses tab, so an income row could not be represented without corrupting a sum — but the `Daily` tab contains no income rows. Income is a separate tab, out of scope. The hazard is real and unexercised.

### Out of Scope

- Years other than 2023 and 2024 — decision **D5**, defaulted to *out*. The rest of the archive stays with `060`.
- Writing to the captain's archive workbook. It is read-only throughout; the normalization sheet lives in the staging expense spreadsheet instead.
- Creating any category. The mapping targets the 22 `name_en` values common to both live Categories tabs (AC-9).
- `gov_category`. It is a property of a category, not of an expense row, so choosing `category_id` settles it.
- The growth analysis itself — `060`'s deliverable.
- Any new app UI. Reports already has an annual year stepper that reaches back arbitrarily (`app/app/reports/page.tsx:721`), which is how the imported years become visible. No screen is built here.
- Changing what the app does with categories going forward. D1 is answered: existing categories only, no new ones, `other` as the fallback.
- Pagination or performance work on `GET /api`. If the dry-run row count shows this is needed, that is a finding for the captain and its own feature.
- Multi-currency handling.
- Writing any real figure, vendor name, or account identifier into this public repository.

## Acceptance criteria

Verification split: **offline** — AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16. **Interactive** — AC-7, AC-8. No harness is built to automate AC-7 or AC-8; both are judged on a live drive of the deployed app.

**Status after the cycle-2 rewrite:** AC-2, AC-3 and AC-4 are **recut** — each now
asserts a property of *our* work that the source's own inconsistency cannot falsify.
AC-13 is satisfied at ideation. AC-14 keeps its gating role unchanged. AC-15 and
AC-16 are new and cover the normalization sheet. AC-1, AC-5, AC-6, AC-7, AC-8, AC-9,
AC-10, AC-11 and AC-12 carry forward.

**The principle the recut follows.** The workbook disagrees with itself on ~12% of
its own month totals. Any criterion whose pass depends on the workbook being
self-consistent tells us nothing about whether *we* got it right — it fails on her
spreadsheet, not on our parser. So every recut criterion below is stated against a
reference we control and can be held fixed: the **approved normalization sheet**, a
**committed synthetic fixture**, or the **app's own post-import state**. The source's
disagreements do not vanish; they are reported to the captain under AC-15, where
they inform her rather than gate us.

Fixtures are synthetic. Under AC-11 no real figure, item name or detail label from
the workbook is committed, so the unit fixtures reproduce the source's *structure* —
three bands, identical A–C columns, interleaved month-total columns, text-typed
amounts, duplicated December headers — with invented numbers.

**AC-1 — No pre-existing expense row was altered or deleted by the import.**
Verified by: offline — the script's `--snapshot` writes the full Expenses tab before the run; `--verify` diffs it against the post-import tab and reports `0 modified, 0 deleted` among rows whose id does not begin `exp-hist-`. Falsified by: changing the writer from row-insertion to an in-place `values.update` over existing rows — the diff then reports modified rows and the check fails.

**AC-2 — Every expense row in the app traces to exactly one `include` row of the approved normalization sheet, and the per-year totals are equal — not within a tolerance.** — *recut; supersedes "reconciles to the workbook's own annual total within 1%".*
Verified by: offline — `--verify --target X --from-sheet Y` joins imported rows to the approved sheet on the `key` each row carries in `notes`, and asserts four things: zero imported rows with no matching `key`; zero `status=include` sheet rows with no row in the app; zero `key` values appearing twice in the app; and per-year sums equal **exactly**, compared as integer minor units, not within 1%.
Falsified by: rounding amounts to whole units on write instead of carrying the parsed value — the exact per-year sum comparison then fails on any row with a fractional amount, where a 1% tolerance would have absorbed it and passed.

*Why exact rather than 1%:* both sides of this comparison are now artefacts we
control, so any variance at all is a defect in our own arithmetic. A tolerance here
would only hide one. The workbook's ~12% self-disagreement is not in this
comparison at all — it is AC-15's subject.

**AC-3 — No month-total column contributed an expense row.** — *recut; supersedes "no aggregate or untagged source row became an expense", which asserted a property of rows that do not exist.*
Verified by: offline — a unit test over the committed synthetic three-band fixture asserts the extractor emits a row **only** for a column whose own column-label cell is `金額` and whose immediately preceding column's label is `品名`, and that the emitted count equals the fixture's known day-column count with the twelve month-total columns per band contributing zero.
Falsified by: accepting every column from F onward regardless of its label cell — the fixture's emitted count then rises by exactly the month-total column count (12 per in-scope band, 24 total) and the test fails on a wrong number, not on a vague "looks off".

*Why this and not the column-A filter:* column A is `非固定支出` on all 78 data rows,
so a row-kind filter has nothing to filter and a test of it would pass no matter what
the code did. The double-counting hazard in this tab is columnar.

**AC-4 — No row dated outside 2023 or 2024 reached the app, and the extractor derived its band ranges from the sheet rather than being handed row numbers.** — *recut; supersedes "income-side source rows are absent", which was vacuous — the tab has no income rows, so it passed whether or not any exclusion logic existed.*
Verified by: offline, in two parts. (a) `--verify` asserts every row whose id begins `exp-hist-` has a `date` starting `2023-` or `2024-`, and reports the count of any others as a number that must be `0`. (b) A unit test over the committed synthetic fixture asserts the extractor **discovers** the three bands from column A's `收入支出` / `非固定支出` structure, labels each from the dates in its own header row, and emits rows for the two in-scope years only.
Falsified by: replacing the year-based band selector with a positional one ("take the first three bands") — the fixture then emits its 2022 band, (b) fails on the band count and (a) fails with a non-zero out-of-range date count.

*Why the year and not the row range:* columns A–C are byte-identical across all
three bands, so a row-range slip produces well-formed, correctly categorised rows
attributed to the wrong year — invisible to every check except a date one. The guard
was exercised against the live tab: header rows 1 / 31 / 61 yield exactly one year
each (2024 / 2023 / 2022), so a year assertion is a real discriminator here and not
a hopeful one.

**AC-5 — Running the import a second time writes nothing.**
Verified by: offline — a second `--apply` against the same target reports `created: 0` with every candidate skipped as already present. Falsified by: generating row ids from `Date.now()` instead of the deterministic `exp-hist-{year}-{NNNN}` — the second run then writes a full duplicate set.

**AC-6 — Undo restores the Expenses tab to its pre-import state, and touches nothing else.**
Verified by: offline, on staging — `--snapshot`, `--apply`, `--undo`, then a diff of the tab against the snapshot showing no difference; a row added by hand between apply and undo survives. Falsified by: having undo match on the row's date-year instead of the id prefix — the hand-added row is then deleted too and the diff fails.

**AC-7 — Reports → Annual, stepped back to an imported year, shows a non-zero total matching AC-2's reconciled figure within 1%.**
Verified by: interactive — a live drive of the deployed app (staging before merge, production after deploy): open Reports, switch to Annual, step the year back, read the total. Falsified by: writing rows with a date outside the year they belong to — the annual filter `date.startsWith(year)` then returns zero and the view is empty.

**AC-8 — Everyday use is unaffected after the import: adding an expense in the app still writes it and shows it in today's list, and History still loads.**
Verified by: interactive — a live drive on staging: add an expense, see it appear, delete it; then open History and confirm it renders. Falsified by: writing rows wider than the Expenses header row, which makes `buildColumnMap` throw and `GET /api` return 500 for every request.

**AC-9 — Every imported row's `category_id` is an id present in the target's own live Categories tab, and no category was created.**
Verified by: offline — the importer resolves each row's `category_name_en` against the target sheet's Categories tab at run time and aborts before writing anything if any name does not resolve there; `--verify` then asserts each imported `category_id` is present in that tab and reports the Categories row count before and after the run, unchanged. Falsified by: hard-coding the `cat_NNN` ids observed on staging — production's `cat_023/024/025` are `Tenant / Insurance / Tax` where staging's are `Test Cat / Antkee / ScrollTest`, so a staging-derived id table files production rows under the wrong categories while still passing a naive "id exists" check.

*This falsifier is not hypothetical:* the two tabs were read live this cycle and do
diverge at `cat_023` onward. Writing the legacy slugs (`eating-out`) instead is the
other tempting shortcut and also fails — a slug passes no `categoryIdError` check
(`functions/src/index.ts:139-154`), so any imported row later edited through the API
would be rejected.

**AC-10 — Every imported row records where it came from, precisely enough to find the source cell again.**
Verified by: offline — `--verify` parses each imported row's `notes` and asserts it yields four fields: source top-level bucket, sub-category, detail label, and the **`key`** (`{year}-r{sourceRow}-c{sourceCol}`) that AC-2's join and AC-16's carry-forward both depend on. Falsified by: dropping the `key` from the notes template — the parse yields three fields instead of four, and AC-2's join loses its only handle, so both criteria fail together rather than AC-2 silently degrading to a row-count comparison.

*The `key` is the load-bearing part.* Bucket and sub-category are not unique — rows
8/9 and 19–26 of every band repeat `住/家具設備` and `住/住家維修`, distinguished only
by the free-text detail column — so provenance recorded as taxonomy alone cannot
identify which source row a given expense came from.

**AC-11 — No figure, vendor name, or account identifier from any source workbook is committed to this repository.**
Verified by: offline — the generated import plan is written under the already-gitignored `functions/backfill-reports/` (`.gitignore:39`), confirmed with `git check-ignore`, and the branch's full diff is read before the PR. Falsified by: writing the plan under `functions/scripts/`, where `git check-ignore` returns non-zero and the file appears in the diff.

**AC-12 — The import refuses to run without an explicit target.**
Verified by: offline — invoking the script with no `--target` exits non-zero, writes nothing, and the Expenses row count is unchanged. Falsified by: falling back to `load-local-env.js`'s resolved `SPREADSHEET_ID`, which today silently resolves to production.

**AC-13 — Whether 2023 has a record is settled by inspecting tab `gid=1209807047`, and recorded before any write.** — **SATISFIED at ideation.**
The inspection happened and is recorded under **Source: what is actually there**: file id `1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I`, tab `gid=1209807047` titled `Daily`, read through the staging service account; the column-label row is `收入支出 | 項目大類 | 項目分類 | 細項說明 | 備註` followed by month-total and `品名`/`金額` day-column pairs; the distinct years found are **2024, 2023 and 2022**, as three stacked bands. 2023 exists, so the 2024-only fallback is void. The original criterion named tab `gid=0`, which is a `P&L` tab and not the source. Falsified by: an import plan whose rows do not come from row ranges 3–28 and 33–58 of that tab.

**AC-14 — The captain approved the normalization sheet before any row was written to the app.** — *carries AC-13's gating role, unchanged from cycle 1.*
Verified by: offline — the import refuses to run unless the normalization sheet it reads carries the captain's sign-off marker (`B1 == "APPROVED"`) and unless the sheet was named explicitly via `--from-sheet`; with the marker absent the run exits non-zero, writes nothing, and the Expenses row count is unchanged. The stage report names the sheet and the approved revision digest from `C1`. Falsified by: letting the import read the extractor's output directly instead of the approved sheet, which lets a re-generate silently discard her corrections to the December 2024 dates.

**AC-15 — The workbook's disagreements with itself are reported to the captain, and gate nothing.** — *new; this is where AC-2's old subject went.*
Verified by: offline — the extractor writes a variance report alongside the normalization sheet listing, per year and month, the workbook's own month-total cell against the sum of that month's day cells and the difference; the report is present, covers all 24 in-scope year-months, and the run exit code is **independent of** its contents. A test drives the extractor with a fixture whose month totals are deliberately inconsistent and asserts exit 0 with the variances listed.
Falsified by: making the extractor exit non-zero when a variance exceeds a threshold — the inconsistent fixture then fails the run, which is precisely the behaviour that made the old AC-2 unfalsifiable: the pipeline would break on her spreadsheet rather than on our defect.

**AC-16 — A re-generate cannot lose a correction the captain made by hand.**
Verified by: offline — three assertions against a scripted sequence on the staging spreadsheet: (a) `--generate` into an existing tab name exits non-zero and mutates nothing; (b) after editing a `date`, an `amount`, a `category_name_en` and a `status` in tab v1, `--generate --into v2 --carry-from v1` produces a v2 carrying all four edits **and leaves v1 byte-identical**; (c) a key whose source cell was blanked appears in v2 with `status=orphaned` rather than being absent.
Falsified by: matching carried-forward edits on the normalization sheet's row index instead of on `key` — insert or drop one row in v2 and every edit after it lands on the wrong expense, which (b) catches because the four edited values arrive on the wrong keys.

## Risk evidence

**Reading the source workbook — was the riskiest mechanism, now exercised and proven.** The captain shared the workbook with the staging service account, and reading it through `expense-tracker-staging@expense-sheet-staging...` succeeded: nine tabs enumerated, the `Daily` tab's structure mapped, all three year bands located, and every count in **Source: what is actually there** taken from live reads. The prior diagnosis was half right — the Drive connector is authenticated to the wrong account and still returns `Requested entity was not found` — but its proposed remedy was wrong: reconnection was never needed. Note the account that works is the **staging** service account, not the production one, which returns `403 The caller does not have permission`. An admin script that resolves its credentials through `load-local-env.js` picks up the **production** key from `.env.local` and will therefore fail to read the source at all. That is a second, independent reason AC-12's explicit `--target` matters.

**Riskiest unverified mechanism this cycle: writing the normalization sheet. Exercised, and it works — but not everywhere.** The whole approach rests on a service account being able to create a tab and write to it, and that had never been tried. `probe-staging-addsheet.js` ran the full mechanism against the **staging expense spreadsheet**: `addSheet` → `values.update` → read back → `deleteSheet`, all four succeeded, and the probe tab was removed. So the normalization sheet has a proven host.

Two negative results from the same probe round change the design rather than just reassuring it:

- **The Google Drive API is disabled on the staging GCP project** — `403 Google Drive API has not been used in project 127990972623 before or it is disabled`. That kills the "service account creates its own workbook and shares it with the captain" route, which would otherwise have been the tidier home for a migration workspace. Build must stay on the Sheets API alone; a `drive.files` call will 403.
- **Write permission on the captain's archive workbook remains unproven and untestable without mutating her data.** An empty `batchUpdate` returns `400 Must specify at least one request` — validation fires before the permission check, so the cheap probe is inconclusive. Rather than write to a personal workbook to find out, the design routes around it: the normalization tab lives in the staging spreadsheet and the archive stays read-only, which the Out of Scope section already promised.

**Second riskiest, and the one that would have shipped silently: category ids are not portable between environments.** Read live rather than taken from `DEFAULT_CATEGORIES` — staging and production Categories tabs both use `cat_NNN` and **disagree from `cat_023` onward** (`Test Cat / Antkee / ScrollTest` vs `Tenant / Insurance / Tax`). A mapping table built and rehearsed on staging would therefore file production rows under wrong categories while every id-exists check still passed. This is why the mapping resolves `name_en` at run time against the target's own tab (AC-9), and why D3's staging rehearsal cannot substitute for a production pre-flight.

**Third: the band-boundary guard.** Exercised. Columns A–C are byte-identical across all three bands, so taxonomy cannot discriminate them; the date-header rows can. Rows 1 / 31 / 61 yield exactly one year each — 2024 / 2023 / 2022 — with no cross-year contamination, so AC-4's year assertion is a real discriminator on the live data and not just on a fixture.

**Fourth: trusting the source's own totals.** Exercised, and it does not hold. Reconciling every populated row-month cell against the sum of its own day cells gives 88.1% agreement within 1% for 2024 and 88.9% for 2023, clustered in October. Combined with December 2024's duplicated and truncated day headers, this means **the source cannot serve as its own correctness oracle** — which is the strongest argument for the captain's normalization sheet, and the reason AC-2 as written is unfalsifiable and must be recut.

**Second risk: the bulk write. No spike needed** — the mechanism is already proven on this exact sheet by `functions/scripts/backfill-subscription-history.js` (entity 051): deterministic ids (`autoExpenseId`, `functions/src/scheduler.ts:87`), `--analyze`/`--dry-run`/`--apply` phases, batched all-or-nothing `insertDimension`+`updateCells` (`insertRowsAtTop`), skip-if-id-present idempotency, and `PartialWriteError` carrying already-written ids. This feature reuses that shape rather than inventing one.

**Verified blast-radius fact:** `functions/scripts/load-local-env.js` resolves `SPREADSHEET_ID` from `functions/.env` or the repo-root `.env.local`, and never from `functions/.env.staging` — so an admin script inherits a target rather than being given one, and cannot be aimed at staging at all. AC-12 and D3-A exist because of this.

## Expected surface and tolerance

Redone for the two-phase normalization-sheet approach. The parser does not go away;
a sheet writer, a carry-forward and an approval check are added.

Estimate: **+1,050 net LOC across 6 files, tolerance ±30%** (so 735–1,365).

- `functions/scripts/extract-historical-expenses.js` — new, ~350–450 LOC. Band discovery, day-column pairing, amount parsing, mapping to `name_en`, `--generate` / `--into` / `--carry-from`, the variance report.
- `functions/scripts/import-historical-expenses.js` — new, ~300–400 LOC. Reads an `APPROVED` sheet by explicit name, resolves `name_en` against the target's live tab, `--dry-run` / `--apply` / `--verify` / `--undo` / `--snapshot`, batched writes reusing `backfill-subscription-history.js`'s shape.
- `functions/test/historical-expenses.test.js` — new, ~250 LOC over **synthetic** fixtures. Covers AC-3, AC-4(b), AC-5, AC-10, AC-15, AC-16.
- `functions/test/fixtures/historical-bands.json` — new, ~80 LOC. Three synthetic bands reproducing the source's structure with invented numbers (AC-11).
- `functions/scripts/load-local-env.js` — ~15–25 LOC for `--target staging|production`.
- `functions/package.json` — 6–8 script entries.

Two scripts rather than one is deliberate: the captain's approval sits between them,
and a single script with a phase flag makes it possible to run straight through that
gate. Splitting them makes AC-14 structural rather than a check.

Semantics this may change: **stored data only** — new rows in the target Expenses
tab, and one new tab in the staging spreadsheet holding the normalization sheet. No
category is created (AC-9), so the Categories tab is unchanged. No API shape change,
no auth change, no scheduled-behavior change, no client change.

## Test plan

- **Unit, offline:** `npm --prefix functions test` over the **synthetic** three-band fixture — band discovery and year labelling, month-total column rejection, day-column pairing, amount parsing including the text-typed and the genuinely-unparseable cases, blank skipping, deterministic id generation, notes assembly including the `key`, the variance report's non-gating exit code, and the undo id-prefix match. Covers AC-3, AC-4(b), AC-5, AC-10, AC-15 and the falsifying edit named against each.
- **Carry-forward rehearsal on the staging spreadsheet, offline:** generate v1 → hand-edit four cells → `--generate --into v2 --carry-from v1` → assert the four edits arrived on the right keys and v1 is unchanged → blank a source cell and assert `status=orphaned`. Covers AC-16. Uses the mechanism already proven by `probe-staging-addsheet.js`.
- **Dry-run, offline:** `--dry-run --target staging --from-sheet ...` prints per-year planned row counts, the `key`-join result, the `status=undated` exclusion count, and the resolved `name_en` → `cat_NNN` table for that target. Covers AC-2, AC-4(a), AC-13, AC-14.
- **Apply + undo rehearsal on staging, offline:** snapshot → apply → verify → add one row by hand → undo → diff against snapshot. Covers AC-1, AC-6, AC-9, AC-12.
- **Production pre-flight, offline, non-negotiable even if D3-B is chosen:** resolve every mapped `name_en` against **production's** Categories tab and abort on any miss, before the first production write. The staging rehearsal cannot cover this — the two tabs diverge from `cat_023`.
- **Live drive, interactive:** deployed staging — Reports → Annual stepped back to each imported year, then add/see/delete one expense and open History, confirming the extra `Migration 2023-2024` tab is inert. Covers AC-7 and AC-8; repeated against production after deploy.
- **Cost:** unit tests are seconds. The carry-forward and apply/undo rehearsals are the expensive steps; both depend on D3-A. Under D3-B there is no apply rehearsal and production is the first write — the carry-forward rehearsal still runs, because the normalization sheet lives on staging either way.

### Feedback Cycles

- Cycle 2: rework — spec rewritten against the cycle-1 revise and the ideation-cycle-2 readings; surface estimate revised from +700 LOC across 4 files to +1,050 across 6 (+50%, driven by splitting extract and import into two scripts so the captain's approval sits structurally between them); AC-2, AC-3 and AC-4 recut so each is falsifiable only by a defect in our own work; AC-15 (source variance reported, gates nothing) and AC-16 (corrections survive a re-generate) added; AC-9 and AC-10 tightened after two live readings — staging and production Categories tabs diverge from `cat_023`, and `(bucket, sub_category)` is not a unique row key; D5 (2022 in or out) raised, and D3/D4/D5 each given a recommendation plus a default so none blocks build.
- Cycle 1: revise — captain at the spec gate (briefing:061:spec:attempt-1:revision-1, six annotations); surface 1 file/+0 net deliverable LOC vs estimate +700 across 4 files (0% — the round produced no code, only re-scoped inputs); AC narrowed: source inspection satisfied AC-13, exposed AC-2 as unfalsifiable (the workbook does not reconcile against itself — ~88% of populated row-month cells match their own day sums), and found AC-3 and AC-4 written against premises that are false for the real tab (no aggregate rows, no income rows); AC-3, AC-4 marked for recutting and AC-14 proposed to carry AC-13's gating role.

## Stage Report: spec

- FAILED: Settle whether 2023 data actually exists by inspecting tab gid=0 of the 2024 workbook (spreadsheet id 1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I) and report the finding either way
  The inspection was attempted directly against that file id, not skipped in favour of 060's record: `get_file_metadata` and `read_file_content` both returned `Requested entity was not found`, and a Drive title search returned only `infuseai.io`/`reccehq.com`-owned files — the connector is signed in to the captain's work account, not the personal account that owns the archive. A service-account route was probed and rejected too (the workbook was never shared with `expense-sheet-functions@…`). Two follow-up Drive searches were then blocked by the permission classifier. Escalated to the first officer with three concrete unblock options. Per the FO's follow-up direction, the spec now states the likely cause — 060 read these same ids successfully from the captain's own account, so the connector's signed-in account changed rather than the files moving or permissions being revoked, which makes reconnection the remedy — and carries the access dependency as a top-of-spec **Blocking precondition** with an explicit exit condition, not as a footnote. It also remains D0 and AC-13.
- DONE: do NOT carry 060's recorded "no 2023 record in the archive" forward as settled
  D0 states explicitly that 060's finding was about the archive *folder* while the captain pointed at a *tab inside the 2024 workbook*, and treats the question as open rather than closed either way.
- DONE: if 2023 has no record say so and scope this feature to 2024 only
  D0 option D and AC-13 both carry the 2024-only fallback; AC-13's evidence requires the shipped scope to match what the gid=0 inspection actually found.
- DONE: Write a top-level `## Acceptance criteria` section whose entries are `**AC-N - {property}**` followed by a `Verified by:` clause that names the concrete change which would falsify the evidence
  13 criteria at `index.md:211`, each `**AC-N — property**` + `Verified by:` + `Falsified by:`. Offline/interactive split declared at the head of the section: AC-7 and AC-8 are interactive and no harness is built for them.
- DONE: confirm `spacedock status --read 061 --stage spec --ac-scan` actually reads them rather than erroring
  Exercised, not asserted — the command previously exited 1 with `no ## Stage Report for stage "spec"`; it now exits 0 and lists all 13 AC ids with their line numbers. It reports `unevidenced=true` for 10 of them, which is correct at spec: an AC earns a citation when the stage that proves it reports evidence, and no AC has been proved yet. The proposed proof for each lives in its own `Verified by:`/`Falsified by:` clause.
- DONE: Surface as captain decisions with options rather than resolving them in-spec: the 25-bucket/61-sub-category to flat gov_category mapping
  D1, four options (map-to-existing / new inactive categories / notes-carried taxonomy / hybrid), recommendation stated as a recommendation.
- DONE: ... the treatment of rental-property pass-through and income rows
  D2, four options including the negative-amount option stated only to close it off, grounded in the fact that the Expenses tab has no sign or type column.
- DONE: ... and the undo plus blast-radius plan including whether the import runs against staging first
  D3, target sequencing (staging-first vs production-only) crossed with three undo mechanisms, resting on a verified finding: `load-local-env.js` never reads `functions/.env.staging`, so no admin script can be aimed at staging today.

### Summary

The mandated gid=0 inspection could not be done: the Drive connector in this session is authenticated to the captain's work Google account, not the personal account that owns the archive, and both direct reads of the workbook returned "not found". That is escalated rather than guessed around — the 2023 question stays open in the spec as decision D0 and as AC-13, which blocks the import until the tab is actually read. The access dependency is stated at the head of the Spec as a blocking precondition on `build`, because it gates every year in scope and not only 2023: 2024 is read from the same unreadable workbook.

Everything else is written in full. The four captain decisions (D0 taxonomy access, D1 category mapping, D2 rental/income, D3 undo and blast radius) are presented as options with recommendations, plus a fourth the checklist did not name but that materially changes the deliverable: D4, date granularity, where the choice is between roughly 1,400 rows per year with working monthly reports and roughly 118 with broken ones, in an app that has no pagination anywhere.

The spec's spine is an existing precedent rather than a new design: `functions/scripts/backfill-subscription-history.js` already performs a safe bulk write against this exact sheet, so the mechanism is proven and only the source parsing is new. The one genuinely new finding is a blast-radius one — `load-local-env.js` resolves an admin script's spreadsheet target from the deploy env files and never from `functions/.env.staging`, meaning a migration script inherits its target instead of being told it. AC-12 makes refusing to run without an explicit `--target` a shipped property.

## Stage Report: ideation (cycle 2)

- DONE: Verify the staging service account can actually read spreadsheet 1PThKs3kePy294j5-0cK3ii1ZPAlkAkcgRdoE-6-o04I now that the captain has shared it, and record what you observe; if the read still fails, say so plainly rather than assuming the share resolved it.
  It reads. `spreadsheets.get` through `expense-tracker-staging@expense-sheet-staging.iam.gserviceaccount.com` (creds already in `functions/.env.staging`) returns the workbook `ijacwei_income收支 (archived)` and all nine tabs. Two negative controls run in the same probe: the Drive connector still returns `Requested entity was not found`, and the **production** service account returns `403 The caller does not have permission` — so the working route is specifically the staging account, which matters because `load-local-env.js` resolves the production key.
- DONE: Read tab gid=1209807047 rows 31-58 and record structurally what is there (row-1 headers, the column-A row-kind tags present, and the distinct years found), settling the 2023 question by inspection rather than on the captain's word alone, and correct every reference that names tab gid=0.
  2023 exists — confirmed, not accepted on her word. Tab `gid=1209807047` is titled `Daily`, 1061x749. Row 31 is a date-header row whose first cells are `Jan 2023`, `Sun, 1/1/ 2023`…; row 32 is the column-label row `收入支出 | 項目大類 | 項目分類 | 細項說明 | 備註` then month-total and `品名`/`金額` day pairs; rows 33-58 are 26 data rows. Column A holds two values tab-wide (`收入支出` band header x3, `非固定支出` x78) — not the four row-kinds assumed. Distinct years: **2024, 2023, 2022** as three stacked bands (rows 3-28 / 33-58 / 63-88). `gid=0` is a `P&L` tab, not the source; corrected at the Goal, the blocking precondition, D0, the edge cases and AC-13. Recorded in full under `## Source: what is actually there`.
- DONE: Fold captain annotations A1-A6 into the ideation body so scope reflects them, and state plainly whether the proposed intermediate normalization sheet replaces the direct-parse design and what that does to scope, or argue against it with a concrete reason.
  A1 tab pointer corrected everywhere and 2023 confirmed; A2 answered under Plan and D1 — and `gov_category` turns out to need no mapping at all, since it is not an Expenses column (`sheetSchema.ts:19-22`, `rowToExpense` at `index.ts:156-165`) but a Categories property (`rowToCategory`, `index.ts:192`); A3 answered by reading the `008`/`migrate-2025.js` precedent at `workflow/_archive/data-migration.md` and stating it concretely rather than copying "follow 2026" forward; A4 **accepted** with the scope effect stated plainly — it does *not* replace the parser, it relocates the parser's output to a place the captain can correct, so net scope is up not down, and it raises a new question about whether her edits survive a re-generate; A5 blocking-precondition section rewritten against the observed read; A6 folded into Out of Scope and the risk section.
- DONE: Preserve uncontested prior work and carry D4 date granularity forward as still-open and still needing the captain, since she has not answered it.
  051 precedent, the `load-local-env.js` blast-radius finding, AC-12, D3 and AC-1/5/6/7/8/9/10/11/12 all carried unchanged. D4 kept open and marked STILL NEEDS THE CAPTAIN; its premise changed (the source is day-level with real dates, not a monthly matrix) so its options are re-cut against the real question — what to do with the ~19 days the source cannot date — but the decision is not made for her.

### Summary

Access is resolved and the source is nothing like what this entity previously described. It is one tab, `Daily` (`gid=1209807047`), holding 2024, 2023 and 2022 as three stacked 26-row bands, each a **day-level** matrix of `品名`/`金額` column pairs with twelve month-total columns interleaved. The taxonomy is 9 buckets over 17 sub-categories, not 25 over 61; there are no income rows and no aggregate rows; rental property lives in a free-text detail column. Measured import size is ~1,670 rows for both years together, which retires the pagination worry.

Two findings change what the spec can promise. December 2024's day headers are duplicated and truncated at 12-16, leaving 16 undated days; and the workbook does not reconcile against itself — only ~88% of populated row-month cells match the sum of their own day cells, clustered in October in both years. Together these make AC-2 unfalsifiable as written and are the concrete reason the captain's normalization sheet is the right approach: the source cannot be its own correctness oracle, so a human-reviewed intermediate is where those get settled. AC-3 and AC-4 were also written against premises that turned out false and are marked for recutting; AC-13 is satisfied here; AC-14 is proposed to carry its gating role.

Caveat on reproducibility: the five probe scripts live in the gitignored `functions/backfill-reports/061-probe/` and need `functions/.env.staging`, so they are not runnable from a fresh clone. They print structure and counts only — no amounts, item names or detail labels — which is deliberate under AC-11, this being personal financial data in a public repo. Build should promote the extraction logic into a committed script with fixtures rather than depend on these.

## Stage Report: spec (cycle 2)

- DONE: Recut AC-2, AC-3 and AC-4 against the real source so each can only be falsified by a defect in our own work
  AC-2 now joins the app to the approved normalization sheet on `key` and compares per-year sums **exactly** (integer minor units), not within 1% — both sides are artefacts we control, so a tolerance could only hide our own arithmetic error; falsifier is rounding amounts on write. AC-3 asserts no month-total column contributed a row, discriminated on the column-label cell (`金額` preceded by `品名`); falsifier raises the fixture count by exactly 24. AC-4 asserts no row dated outside 2023–2024 reached the app **and** that the extractor discovers bands rather than taking row numbers; falsifier is a positional band selector, which fails both halves. Each carries a short "why this and not the old one" note.
- DONE: AC-2 as written fails on the source's ~88% row-month-versus-day-sum mismatch rather than on a parser bug
  That subject is not deleted, it is moved to AC-15, which requires the variance report to exist and cover all 24 in-scope year-months while requiring the exit code to be **independent** of its contents. Its falsifier is making the run fail on a variance threshold — i.e. reintroducing exactly the old AC-2.
- DONE: AC-4 is vacuous because this tab has no income rows
  Replaced entirely. The old falsifier ("drop the income-bucket exclusion") changed nothing; the new one (positional band selector) changes a fixture band count and an out-of-range date count from 0 to non-zero.
- DONE: Preserve AC-14's gating role, keep the Verified by / Falsified by shape
  AC-14 kept verbatim in role and tightened only in mechanism (`B1 == "APPROVED"`, `--from-sheet` mandatory, digest from `C1` recorded). All 16 criteria retain `Verified by:` / `Falsified by:`.
- DONE: confirm `spacedock status --read 061 --stage spec --ac-scan` still reads every criterion
  Exercised, not asserted. First run read only 15 — AC-9 was invisible because nested `*italics*` inside the bold heading broke the parse. Removed the nesting; re-run lists AC-1 through AC-16 with line numbers and exits 0. `unevidenced=true` on the unproven ones is correct at spec.
- DONE: Specify the intermediate normalization sheet as the accepted approach with its own acceptance criteria
  New `### The normalization sheet` section: host, shape, control row, column table, and the `key` = `{year}-r{row}-c{col}` identity. Its own criteria are AC-14 (approval gates the import), AC-15 (variance reported, gates nothing) and AC-16 (a re-generate cannot lose a correction).
- DONE: answer the question it raised that nobody has yet — whether the captain's hand corrections survive a re-generate, and what happens to them if they do not
  Yes, and the mechanism is *never overwrite* rather than *merge in place*: `--generate` aborts on an existing tab, re-generation goes `--into v2 --carry-from v1`, corrections carry by source coordinate rather than row position, an irreconcilable conflict exits non-zero listing the keys, and a vanished source cell becomes `status=orphaned` rather than disappearing. If the carry-forward is itself buggy, v1 still exists untouched — recovery is re-running the carry, not re-doing the manual pass. That is stated explicitly as the reason in-place merge was rejected.
- DONE: Carry the three decisions the captain left unanswered, each with a concrete recommendation and a stated default
  D3 = A + U3 (recommended and defaulted); D4 = A defaulting to A-falling-back-to-C, with B not implemented at all so the synthetic-date failure cannot occur by drift; D5 (2022) = out, recommended and defaulted, with the honest note that reversing it is a `--years` flag because the extractor discovers all three bands anyway. A summary table sits in the Plan and full statements under Decisions. Every default is the conservative branch and **none blocks build**.
- DONE: Include a band-boundary guard so a row-range slip cannot import 2022 rows that belong to entity 060
  AC-4 is that guard, and it was exercised rather than proposed: columns A–C are byte-identical across all three bands (verified — same 26 rows, same order, 2024/2023/2022), so taxonomy cannot discriminate them, while header rows 1/31/61 yield exactly one year each with no cross-year contamination. The design removes hard-coded row ranges entirely.

### Summary

The three recut criteria now rest on references we control — the approved normalization sheet, a synthetic fixture, and the app's own post-import state — so the workbook's ~12% self-disagreement can no longer fail a check that was meant to catch our bugs. That disagreement becomes AC-15's report to the captain, explicitly non-gating.

Four mechanisms were exercised this cycle rather than assumed, and two of them changed the design. The normalization sheet's host was proven by running `addSheet` → write → read back → `deleteSheet` against the staging expense spreadsheet; the same probe round found the **Drive API disabled** on the staging project (killing the standalone-workbook route) and found no non-mutating way to test write permission on the captain's archive workbook, so the design routes around it and keeps that workbook read-only. Separately, reading both live Categories tabs showed staging and production **diverge from `cat_023`** (`Test Cat/Antkee/ScrollTest` vs `Tenant/Insurance/Tax`), which would have shipped silently: a staging-derived id table files production rows under wrong categories while every id-exists check still passes. AC-9 now resolves `name_en` against the target's own tab, and D3 gains a production pre-flight no staging rehearsal can substitute for.

Surface estimate rose from +700 LOC across 4 files to +1,050 across 6, tolerance ±30%. The increase is deliberate: extract and import are two scripts rather than one phase-flagged script, so the captain's approval sits structurally between them and AC-14 cannot be bypassed by a flag. Two probe scripts were added under the gitignored `functions/backfill-reports/061-probe/`; like the existing five they print structure only, never amounts or item names, per AC-11.
