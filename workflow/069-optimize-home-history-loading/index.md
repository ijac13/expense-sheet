---
id: 069
title: Optimize Home and History Loading Time
status: ideation
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
mod-block:
---

The captain wants Home and History to load faster. A concrete symptom surfaced while reviewing entity `067`'s work: History briefly showed a raw category id (`cat_003`) instead of its name on the production app, right after two large backfills (`066`: 203 rows, `067`: 18 rows) landed on production in quick succession. The categories API was independently confirmed live and responsive minutes later (401 in ~0.5s, normal), so this looks like a one-off failed category fetch, not an ongoing outage — but it's worth investigating as a real symptom of whatever is making these pages slow, not dismissed.

## User Stories

- As the captain, I want Home and History to load quickly and reliably, without visible stalls or fallback states.
- As the captain, I don't want a category to ever show as a raw id (`cat_003`) instead of its name — if the live category list can't be fetched in time, I'd rather see a stale-but-correct name than a raw id.

## Success

- Understand what's actually slow about Home and History today — what each page waits on, and why (building on entity `063`'s own investigation of Home's load sequence, which this entity should read rather than re-derive from scratch).
- Understand why History showed a raw category id instead of a name, and fix the underlying cause (or its fallback behavior) so it can't recur.
- Either the load feels faster, or — if something must load first — it's fast and legible, matching the bar `063` already set for Home.

### Out of Scope

- Any change to what Home or History display once loaded, beyond load-time behavior and the category-fallback fix.
- Reports' own loading behavior (not requested here — a separate page).
- Re-litigating anything `063` already shipped (the category-list cache, the backend auth-client memoization) — this entity builds on that work, not against it.

## Plan

To be filled in at spec time. Open questions for spec:

- What does History actually wait on before it can render (its own categories fetch, its own expenses fetch, something else)? Read the code directly — do not assume it mirrors Home's sequence, since `063`'s fix only touched `app/app/page.tsx` (Home), not `app/app/history/page.tsx`.
- Does History's category-fetch failure path fall back to `DEFAULT_CATEGORIES` (a hardcoded list using old-style slug ids, e.g. `eating-out`) the same way Home's used to before `063`? If so, that's why a live `cat_NNN` id can't resolve when the fetch fails — the fallback list simply has no matching entry, not a bug in the matching logic itself.
- Would extending `063`'s client-side category-list cache to History close this gap, the same way it already did for Home? Or does History need its own cache given a different mount/lifecycle?
- Is there a real slowness in Home and/or History beyond what `063` already measured and fixed, or is the captain's experience now dominated by something else (e.g. History's own expense-list fetch, pagination, or rendering cost)? Investigate live before assuming `063`'s fix covers everything relevant to History.
- Was the `cat_003` incident actually caused by load from `066`/`067`'s large writes landing around the same time, or unrelated? Worth checking live evidence (timing, error logs if any) before concluding either way.

## Acceptance criteria

Written at the `spec` stage. Each entry is `**AC-N — {property}**` plus a `Verified by:` clause — see the Spec Template in the workflow README.

### Feedback Cycles
