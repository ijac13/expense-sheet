---
id: "060"
title: Historical Expense Analysis — Understand How to Spend Less Again
status: ideation
source: captain
started: 2026-09-02T10:20:26Z
completed:
verdict:
score:
worktree:
issue:
pr:
gates:
    version: 1
    records:
        - id: gate:060:ideation
          stage: ideation
          attempts:
            - id: gate-attempt:060-ideation-1
              briefing:
                id: briefing:060:ideation:attempt-1:revision-1
                digest: sha256:798d4729d706304bbfe534a89c782af478099fb12e883a88c65a36b8c5f481fe
                request-digest: sha256:2ee7c185dab62179144108262616ae5a7c1af4c9c301ea58520688b2e0cc8840
                room-ref: ./review/ideation/briefing-1
              withdrawal:
                by: agent:first-officer
                at: "2026-08-28T13:37:21.134116Z"
                reason: Captain changed scope before rendering a decision. The bound Briefing asserts "No historical row is ever written into the app" and lists migration under exclusions, matching the entity's twice-stated no-migration constraint. The captain now asks that 2023 and 2024 data be migrated into the app, that feasibility be evaluated, and that the report analysis cover 2006-2025 rather than 2024 plus one baseline year. The Briefing no longer states the captain's scope.
            - id: gate-attempt:060-ideation-2
              briefing:
                id: briefing:060:ideation:attempt-2:revision-1
                digest: sha256:0684e0d8fdc454cf1a5869cae04183eeab83b1d3b0ef862727baa5bf6cce50c5
                room-ref: ./review/ideation/briefing-2
---

The captain's question, in her own words: **why are 2023 and 2024 roughly half of 2025?**

That is the whole of it. The earlier framing — "understand nineteen years of records well enough to explain why I used to live on less than NT$1.2M/year" — is still the destination, but it is not the question in front of her, and treating it as one is what made this entity expensive before it produced anything.

The question is now answerable **inside the app**, because `061` finished: 2023 and 2024 are imported into production alongside 2025. Nobody has to process an archive to answer it. What the archive is still needed for is a different, later question.

## What changed since ideation cycle 1

`061 — Migrate 2023-2024 Historical Expense Data Into The App` is `done`, verdict PASSED, imported to production on 2026-09-02. Three of this entity's founding premises are now false, and one is void.

**1. "No migration into the app at all" is no longer the constraint.** It was stated twice in cycle 1 and listed under Out of Scope. It has been overtaken by the captain's own decision: `061` imported 1,670 rows to the production Expenses tab (2023: 895, 2024: 775), reversible with a working undo. 2022 is entity `062`'s. This entity migrates nothing — not because migration is forbidden, but because the years it needs are already in.

**2. The source's own monthly totals are not a trustworthy baseline.** Cycle 1's AC-2 required reconciling the computed total against "the total the workbook itself carries, within 1%". `061` Finding 6 falsifies that check: the workbook's monthly totals row is built from explicit column-addition chains, and **five of twelve chains per year name the wrong set of columns**, in the same repeating pattern across both years — October adds the whole of November and drops the 31st, December drops the 31st, September reaches into October 1st, and February 2024 omits the leap day. Any figure reconciled against that row inherits the error. Reconciling *to* it would fail on the source's own defect and look like a parser bug.

**3. The app's figures are the reliable ones.** `061` derived every imported row from an individual day cell, reconciled every numeric cell in each band with zero unaccounted, and proved that no formula in the captain's totals row references a day cell the extraction misses, while the extraction reads six day columns her chains omit outright. **The app's numbers are strictly more complete than the workbook's own totals.** So the comparison baseline for this entity is the app, and the workbook is the thing that gets checked against it, not the reverse.

**4. The read route cycle 1 relied on is void.** Cycle 1's spec recorded access as "resolved — read through the Google Drive connector on the captain's own account". Re-tested in this stage: the connector returns `Requested entity was not found` for the workbook and an empty listing for the archive folder, while the same connector happily searches her `@infuseai.io` work Drive. It is bound to the work account; the archive lives on the personal one. `061`'s finding holds — the only working read route to the workbook is the **staging** service account, to which the captain granted access on that one file. The production service account gets 403. **Nothing currently reads the other eighteen archive-folder year files.**

## What the app can answer today, with no archive work at all

Production holds three consecutive years of daily expense records, all normalized into the app's own category taxonomy:

| Year | Rows | Span | Source | Payers present |
|---|---|---|---|---|
| 2023 | 895 | 2023-01-04 → 2023-12-31, all twelve months | archive workbook `Daily` tab, via `061` | ijac only |
| 2024 | 775 | 2024-01-01 → **2024-11-08** | archive workbook `Daily` tab, via `061` | ijac only |
| 2025 | 1,404 | 2025-01-01 → 2025-12-31, all twelve months | `2025_combined_expenses.csv`, via `008` | ijac **and** wei |
| 2026 | app-native | from 2026-04 onward | entered in the app + subscription scheduler | ijac and wei |

Reports → **Annual** already gives, for any year the arrows reach: the annual total, a per-category breakdown with amount, count and share, a per-payer breakdown, a twelve-bar monthly trend, and an AI insight for that year. The year arrows are unbounded, so 2023, 2024 and 2025 are all reachable now. The **payer filter works correctly in Reports** — it resolves through `resolvePayerName` (`app/app/lib/reportService.ts:62`) and filters on the stored display name.

So the *what* of the captain's question — where the difference sits, by category — is a matter of her opening three screens. This entity's remaining job is the *why* and the path back, which no screen produces.

**What the app still cannot do:** show two years side by side in one view (Annual is one year at a time; only the Monthly view carries a same-month-last-year figure), and reach anything before 2023.

## Three traps that will make "roughly half" mean the wrong thing

Before any explanation is offered, the comparison has to be made honest. Every one of these makes 2025 look larger than 2023/2024 for reasons that are not spending.

**Trap 1 — 2025 counts two people; 2023 and 2024 count one.** 2025's 1,404 rows split wei 952 / ijac 452. All 1,670 of 2023–2024's rows carry `ijac`, and that is not an import artefact: the captain ruled it herself in `061` D2a, on the reasoning that the `Daily` tab has no payer column *because it only ever had one payer*. There is no wei record for 2023 or 2024 in that tab. So a naive year-total comparison pits a two-person household against one person's ledger. **This is controllable in the app**: filter Reports → Annual → 2025 to `ijac` and compare that against unfiltered 2023. If that single control closes most of the gap, the honest answer to her question is *"you started recording a second person"*, not *"you doubled your spending"* — and that is the first thing to establish, because every other explanation is conditional on it.

**Trap 2 — 2024 stops on 2024-11-08.** `061` Finding 4. The record ends there and nothing recovers it: the workbook's own December 2024 month total and day sum are both zero, so the fortnight was never entered. 2024 is short by **roughly seven weeks** — 53 days, 2024-11-09 through 12-31. Any 2024 annual total is therefore an understatement of a real year, and comparing it naively against a complete 2023 or 2025 manufactures a decline that did not happen. 2024 is usable as a **shape** check (its monthly trend, and per-month comparisons against the same months of other years) and not as an annual total, unless the total is explicitly annualized and labelled as such.

**Trap 3 — nobody has established that the two eras count the same *kinds* of cost, or that NT$1.2M ever meant what the app measures.** The 2023–2024 rows are the workbook's `非固定支出` — variable expense — and hold no income rows and no fixed-expense rows; those live in other tabs. The 2025 CSV's nine buckets (`飲食 交通 日用品 健康 數位 娛樂 其他 購物 學習`) are a different scheme from the workbook's nine (`食 衣 行 住 醫療 育 樂 公益 雜項`), and each migration mapped its own scheme into the app's categories independently. Two visible consequences: 2025 carries a `數位` bucket of recurring digital subscriptions with no counterpart bucket in 2023–2024, and 2025's gym-and-fitness spending sits in `健康` while the whole of 2023–2024 mapped only a handful of rows to `Sports`. Each of those is *either* a real behaviour change *or* a recording-coverage change, and the app cannot tell which. **And the NT$1.2M/year figure is a claim about total annual living cost**, which the app does not hold for any year — no rent, no mortgage, no insurance, no utilities, in either era. Comparing app totals against NT$1.2M is comparing two different things.

## Where the archive is still required, and it is currently unreadable

- **What NT$1.2M actually counted.** Cycle 1's own inspection of the workbook found, among its nine tabs, a 19-column annual matrix over 25 top-level buckets of which five are income-side, a category-by-month rollup, and a multi-decade projection table carrying a per-year required-spending column running 2024→2041. That is where total living cost, income, and her own existing target curve live. Settling what the sub-NT$1.2M years counted, and checking any glide path against the projection she already keeps, needs those tabs. They are reachable — the staging service account reads that workbook.
- **Anything before 2023.** 2022 is entity `062`. 2006–2021 sit in eighteen separate archive-folder files that **no working credential currently reads**: the Drive connector is bound to the wrong Google account, the staging service account was granted one file, and the production one is 403. Extending back is not merely expensive, it is blocked pending the captain either sharing those files with the staging service account or rebinding the connector to her personal account.
- **The four October 2023 rows recorded only as a month figure.** `061` Finding 6 names them — `樂/旅遊` dominating the month's variance, plus `住/住家維修`, `衣/衣服鞋襪`, `住/家具設備` with no day cells at all. They are in her workbook and not in the app. If a category comparison lands on any of them, that is where the difference partly is.

## Recommendation on scope

**Drop 2006–2025 as this entity's span. Answer the question she asked, from the app, and let the long history be a separate round.**

- **Round A — this entity.** 2023 versus 2025, from production data only, with 2024 as a partial-year shape corroboration. Payer-controlled before anything is explained. Deliverable: the honest comparison, the labelled reasons, and a first glide path expressed against what the app measures.
- **Round B — a later entity, if Round A justifies it.** The sub-NT$1.2M question: which years those were, what the figure counted, and the glide path checked against her own projection table. Needs the workbook's non-`Daily` tabs, and — if it goes back past 2022 — an access grant that does not exist today.

The case for splitting is that Round A is nearly free and Round B is not, and Round A may well answer her. If Trap 1 turns out to explain most of the gap, the alarming premise behind this entity dissolves and Round B becomes a calm exercise rather than an urgent one. Running them together spends the expensive half before knowing whether it is needed.

## User Stories

- As the captain, I want to know whether 2025 being roughly double is my spending changing or my *recording* changing, before I read a single explanation — because the answer changes what I should do about it.
- As the captain, I want 2023 and 2025 compared category by category on a like-for-like basis, so I can see which buckets actually grew rather than guessing from two annual totals.
- As the captain, I want each reason written out and labelled recurring or one-time, so I can tell what is structural from what was one bad year.
- As the captain, I want to be told plainly which parts of my question the app cannot answer and what it would cost to answer them, so extending the analysis is my decision rather than a surprise.
- As the captain, I want a first gradual path toward spending less, expressed against the same measure the app reports, so the target is something I can watch in Reports rather than a number in a document.

## Success

- The payer-controlled comparison is done **first** and its result stated plainly, before any explanation is offered.
- 2023 and 2025 are compared category by category on the app's own taxonomy, with the amount and the difference for each.
- 2024 appears as a shape corroboration with its 2024-11-08 cutoff stated wherever a 2024 figure is shown, never as a bare annual total.
- The comparison's figures are traceable to the app, and any cross-check against the workbook states that the workbook's monthly totals row carries the `061` Finding 6 range errors and is therefore not the authority.
- At least three candidate reasons for the increase, each naming a specific app category, labelled recurring or one-time, and citing the difference that supports it.
- Every reason distinguishes a **behaviour** change from a **recording-coverage** change, or says explicitly that the data cannot tell them apart.
- A first glide path, stated in the measure the app actually reports, with an explicit note that this measure is not the same thing as the NT$1.2M total-living-cost figure and what would be needed to bridge them.
- A short, honest statement of what Round B would require, including the access that does not exist today.

### Out of Scope

- **Migrating any historical row.** Not because it is forbidden — `061` did it and `062` will — but because the years this entity needs are already in the app. 2022 is `062`'s; 2006–2021 is Round B's.
- **Repairing the captain's workbook formulas.** `061` Finding 6 carries the per-month repair manual. Acting on it is hers.
- **Processing any pre-2023 archive file.** Blocked on access as well as out of scope.
- Any new app UI — no side-by-side year view, no target line, no new Reports screen. If Round A shows the comparison is worth having permanently, that is a separate entity.
- Any automated budget enforcement: no caps, alerts, or blocking.
- Multi-currency handling.
- Changing the app's Categories tab or `gov_category` assignments to suit the analysis.
- Tax, legal, or investment advice.

## Delivery constraint — unchanged, and here is why it still holds

`github.com/ijac13/expense-sheet` is a **public** repository, and its PII pre-commit hook detects only phone numbers and email addresses (`scripts/hooks/pii-scan.js:11-15`) — it would not stop a commit containing real income and spending figures. This report is nothing but real figures. So:

- The report is delivered **privately**, and **the entity records only its location**.
- **No money figure from the captain's records appears in this entity file, in any commit message, or in any file in this repository.** The NT$1.2M figure is retained because it is her own stated target rather than a figure read out of her records, and it already appears throughout the repo.
- Note that `2025_combined_expenses.csv` and `2025_expenses_ijac.csv` sit under `feedback-screenshots/`, which `.gitignore:35` excludes — verified with `git check-ignore`. They are not committed and must not become committed.
- `061` Finding 1 stands and is not this entity's to fix: the archive workbook's file id is already on `main` in several places. A Sheets file id grants no access on its own; it promotes to a real risk only if the workbook is ever made link-shareable.

## Plan

Open questions for spec, in the order they should be resolved:

1. **Does the payer control close the gap?** Reports → Annual → 2025 filtered to `ijac`, against unfiltered 2023. One measurement, and it decides how much of the rest matters. Everything below is conditional on it.
2. **Does 2025 cover the same kinds of cost as 2023–2024?** Specifically the `數位` subscription bucket and the `健康`/`Sports` gap. Answerable by reading the two source taxonomies' mappings into the app's categories, which both migrations recorded — no new source access needed.
3. **What did the sub-NT$1.2M figure count?** Needs the workbook's non-`Daily` tabs via the staging service account. Decide at spec whether this belongs in Round A at all, or whether Round A ships with the gap stated and Round B closes it.
4. **Where does the report live?** Proposed default: a private Google Doc in the captain's own archive folder, the same as cycle 1 proposed. **But** the Drive connector cannot reach her personal account from this session, so an agent may not be able to create it there. Fallback: a local markdown file under a gitignored `analysis/` directory. Confirm which, and confirm the write route works, before the build stage depends on it.
5. **Should any of this become a Reports feature?** Out of scope here, but if the comparison proves worth repeating annually, say so in the report so the captain can file it.

## Spec — cycle 1, superseded and removed

The cycle-1 spec section — a Goal, four user stories, twelve acceptance criteria, eleven edge cases and an "Access — resolved" block — has been **removed from this file** rather than left in place, because more than half of it is now known-false and a later spec stage could reuse it by mistake. It is preserved in git at commit `30e9c15` (`060: spec — historical expense analysis, report-only, no migration`), and its stage report is still appended below. The spec stage restarts from this ideation.

**What it got right and is worth carrying forward:** the public-repo/PII finding and the private-delivery decision (restated above); the inventory of the workbook's other eight tabs, especially the 19-column annual matrix and the 2024→2041 projection table, which is Round B's material; and the discipline of separating "processed" from "inventoried".

**What `061` falsified:**

- Its authoritative-source description — a 19-column annual matrix, 25 top-level buckets, 61 sub-categories, four row-kinds, aggregate rows interleaved among data rows — describes a **different tab**. The captain's actual source is tab `gid=1209807047`, titled `Daily`: three years stacked as vertical bands, 9 buckets, 17 sub-category pairs, one row-kind value on every data row, and aggregates as **columns**, not rows.
- "The archive has no 2023 and no 2025 record." Both wrong for this purpose. 2023 is a band in the `Daily` tab. 2025 is a full year in the app.
- "2024 is the 'now' anchor because it is the most recent complete year." 2024 is not complete — it stops on 2024-11-08. **2025 is the anchor**, and it is a real complete calendar year.
- AC-2's reconciliation against the workbook's own total — falsified by Finding 6's five-of-twelve formula range errors per year.
- AC-5's baseline-year rule, AC-8's twenty-row year inventory, and the archive-first processing approach behind them — all predicated on reading archive files that no credential currently reads.
- "Access — resolved… through the Google Drive connector on the captain's own account." Re-tested this stage: not found for the workbook, empty for the folder.

## Stage Report: spec

- DONE: Read the full current entity file at workflow/060-historical-expense-analysis.md.
  Read all 50 lines including the captain's mid-session revision; the twice-stated no-migration constraint is restated verbatim in Out of Scope.
- DONE: Check for read access to the 2024 sheet and the Drive folder; report what you found.
  Read access confirmed on both via the Google Drive connector on the captain's own account; findings recorded under "Access — resolved" as structure only. No blocker, no captain action needed.
- DONE: Write a complete Goal section reflecting "analysis report only, no migration, starting with 2024."
  One sentence naming the private delivery, the no-write constraint, and the glide-path output.
- DONE: Write 2-4 User Stories.
  Four stories: the comparison, the labelled reasons, the glide path checked against the captain's existing projection, and knowing what stayed unprocessed.
- DONE: Write Acceptance Criteria.
  Twelve. AC-1/2/3 fix how the sheet is read and reconciled, AC-6/7/9 fix the report's required contents, AC-10 fixes delivery, AC-8 fixes scope honesty for other years. AC-11 and AC-12 hold the no-leak and no-write lines.
- DONE: Write Edge Cases.
  Eleven, drawn from the actual inspected structure rather than guessed: interleaved aggregate rows, rental-property pass-through flows, duplicate files per year, template files, the 2023/2025 gaps, blank months, uncategorised rows, second-account ownership, the oversized daily table, and formatted-value parsing.
- DONE: Write Out of Scope.
  Restates the three required exclusions verbatim in intent — no writes to the app's sheets, no new app UI, no automated enforcement — plus multi-currency, no Categories-tab changes, not all 18 years, and no financial advice.
- DONE: Self-check every AC is binary/testable before finishing.
  Each AC resolves to a count, an equality, a presence check, or a named-value classification. AC-2 has an explicit failure signature (a roughly doubled total means aggregate rows were summed). AC-10 depends on the captain opening the delivered report, which is the gate check itself.

### Summary

Access turned out to be the easy question and delivery the hard one. Both sources read fine on the captain's own account, so the ideation's access blocker is closed and the spec is grounded in the real structure: a 19-column annual matrix with aggregate rows interleaved among the data, a two-level 25-bucket taxonomy that does not match the app's flat categories, 18 archived years with duplicate and template files scattered among them, and no 2023 or 2025 record at all.

The finding that shapes the spec most is that this repository is public and its PII pre-commit hook only catches phone numbers and email addresses. A report of real income and spending committed here would be exposed and nothing would stop it, so the natural "markdown file in the repo" answer is wrong. The spec proposes a private Google Doc in the captain's own archive folder instead, and raises it as Decision 1 for the captain rather than settling it unilaterally.

Two more decisions are surfaced rather than assumed: scope is 2024 plus one baseline year plus an inventory, not all 18 years; and 2024 serves as the "now" anchor because it is the most recent complete year, since 2023 and 2025 are absent and the app's own sheet covers only part of the current year.

## Stage Report: ideation (cycle 2)

- DONE: Re-scope this feature around the captain's actual question — why are 2023 and 2024 roughly half of 2025 — now that those years live in the app, state what the app can answer versus what still needs the archive, and recommend whether 2006-2025 is still the right scope.
  Body rewritten around that one question. "What the app can answer today" tables the three years' rows, spans and payers and names Reports → Annual (unbounded year arrows, working payer filter at `app/app/lib/reportService.ts:62`) as the surface that already produces the *what*. "Where the archive is still required" separates the three things it is still needed for. Recommendation: **drop 2006-2025**; Round A is 2023-vs-2025 from production data with 2024 as shape corroboration, Round B is the sub-NT$1.2M question as a later entity — because Round A is nearly free and may dissolve the premise.
- DONE: Fold in what 061 established, because three of this entity's original premises are now false; correct every reference to the old 2024-only starting point and to the archive-first approach.
  Four corrections recorded: migration is no longer the constraint (1,670 rows live in production, 2022 is `062`'s); the workbook's monthly totals row carries `061` Finding 6's five-of-twelve formula range errors per year and is not a baseline; the app's day-cell-derived figures are strictly more complete than her own totals row and are the baseline; and cycle 1's Drive-connector access answer is void — I re-tested it this stage rather than quoting 061 (the connector returns `Requested entity was not found` for the workbook and an empty listing for the archive folder, while searching her `@infuseai.io` Drive fine, so it is bound to the work account). Cycle 1's Spec section is **removed** rather than left stale, preserved at commit `30e9c15`, with a superseded-and-removed block naming what it got right and the six things `061` falsified — including "2024 is the now anchor", replaced by 2025.
- DONE: Keep the delivery constraint intact and restate why it holds; record that 2024's record stops on 2024-11-08.
  "Delivery constraint" restates the public repo and the PII hook's narrow coverage (`scripts/hooks/pii-scan.js:11-15`), the private delivery, and entity-records-location-only. The 2024-11-08 cutoff is Trap 2 — roughly seven weeks, 53 days, unrecoverable because the source's own December 2024 total and day sum are both zero — with the rule that no bare 2024 annual total may be compared against a full year.
- DONE: No money figure from her records in the entity, a commit message, or any repo file.
  Verified by inspecting the whole new body: it carries row counts, dates, payer row-splits, bucket names and per-year row counts only. The one currency figure is NT$1.2M, her own stated target rather than a figure read from her records, already present throughout the repo. I also removed the two Google URLs cycle 1 carried in the body, which narrows `061` Finding 1's exposure on this file. Separately confirmed with `git check-ignore` that `feedback-screenshots/2025_combined_expenses.csv` is excluded by `.gitignore:35` and uncommitted — I read its structure to answer the comparability question and wrote none of its values here.

### Summary

The decisive finding is not about scope, it is about the comparison itself: **2025's 1,404 rows are wei 952 / ijac 452, while all 1,670 of 2023-2024's rows are ijac's alone** — and per the captain's own `061` D2a ruling that is real, not an import artefact, because the `Daily` tab has no payer column since it only ever had one payer. So "roughly half" may be largely a recording-coverage change rather than a spending change, and Reports' payer filter is exactly the control that settles it. That measurement is one screen, costs nothing, and is now the first thing the spec must order, because every other explanation is conditional on its result.

Two further comparability traps sit behind it: 2024 stopping on 2024-11-08, and the fact that nobody has established the two eras count the same *kinds* of cost — 2025 carries a `數位` subscription bucket with no counterpart in 2023-2024, its gym spending sits in `健康` against a handful of `Sports` rows across both earlier years, and neither era holds rent, mortgage, insurance or utilities. That last point matters most for the goal: **NT$1.2M/year is a total-living-cost claim, and the app holds no total living cost for any year**, so app totals cannot be compared against it without the workbook's other tabs.

The scope recommendation follows from access as much as from cost. Extending past 2022 is not merely expensive, it is **blocked**: the eighteen archive-folder year files are read by no working credential today — connector bound to the wrong Google account, staging service account granted one file, production 403. That belongs in front of the captain as a decision, not discovered at build time.
