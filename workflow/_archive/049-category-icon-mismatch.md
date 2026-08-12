---
id: 049
title: Category Icons/Emoji Don't Match Category Management Settings
status: done
source: captain (found manually testing entity 044 on staging)
started: 2026-08-10T10:26:52Z
completed: 2026-08-12T04:27:52Z
verdict: PASSED
score:
worktree:
issue:
pr: "#17"
mod-block:
---

Category icons shown around the app (Home, History, Reports) don't match what's actually configured in Category Management — many categories show the same, wrong emoji. Very likely the same root-cause pattern entity 044 just fixed for category *names* (hardcoded `DEFAULT_CATEGORIES`/`CATEGORY_ICONS` lookups in `app/app/lib/categories.ts` instead of the live category data from the API) — but 044's fix was scoped to name resolution only and never touched icon resolution, so this is a distinct entity, not a regression or a duplicate.

## User Stories

- As the captain, I want a category's icon shown everywhere in the app to match what's actually set in Category Management, so the visual is trustworthy and not just the name.

## Success

- Every category's displayed icon, everywhere in the app, matches its live `icon` field from the category data — not a hardcoded fallback map.
- Changing a category's icon in Category Management is reflected everywhere immediately, no code deploy needed.

### Out of Scope

- Category name resolution (already fixed by entity 044)
- Adding new icon choices or changing the icon picker UI itself

## Plan

Same pattern as entity 044: find every place a category icon renders from `CATEGORY_ICONS` or another hardcoded map instead of the live category object's own `icon` field, and switch it to live resolution, with the same hardcoded-fallback-on-genuinely-missing-id behavior 044 established for names.

## Spec

### Confirmed Root Cause

Traced live against real production and staging data before writing ACs. **The ideation's hypothesis is wrong about the main symptom.** The problem is not a hardcoded icon map being read; it is the opposite — the surfaces that show a per-expense icon look up the *live* list only, the lookup misses for almost all real data, and every affected row falls through to the same generic placeholder. Two distinct causes:

**Cause 1 — id-scheme mismatch + a live-only lookup with no fallback → `💰` on nearly every row.**

- Live `GET /api/categories` (production, read 2026-08-10): 25 categories, ids `cat_001`…`cat_023` plus `insurance`/`tax`. Every one carries a real `icon`.
- Live `GET /api` (production): 1945 expenses, of which **1931 (99.3%, across 19 distinct ids)** carry a legacy slug `category_id` (`eating-out` 651, `groceries` 228, `fuel` 156, …) present in **no** live category. Staging is the same shape (1400 of 1404).
- `app/app/history/page.tsx:509` — `categories.find(c => c.id === expense.category_id)` runs against the **live list only**. State is seeded from `DEFAULT_CATEGORIES` (line 310) but then wholly *replaced* by the live active list (lines 326-330); the lookup itself has no `DEFAULT_CATEGORIES` fallback. For those 1931 expenses `cat` is `undefined`, so line 519 renders `cat?.icon ?? "💰"` → **`💰` on every one of them**. This is exactly the captain's "many categories show the same, wrong emoji".
- `app/app/components/ExpenseEditSheet.tsx:146` — identical shape (`cat?.icon ?? "💰"`). Its `categories` prop comes from History (`history/page.tsx:559`) and from the Reports drill-down (`reports/DrillDown.tsx:39-53`, `:163`), both live-only. Same `💰` on the expense detail sheet.
- History filters its live list to `is_active` (line 328), so an expense on an **archived** category misses the lookup too.

**Cause 2 — Subscriptions never fetches the live list at all.**

- `app/app/subscriptions/page.tsx:14` — `getCategoryDisplay()` resolves against `DEFAULT_CATEGORIES` only; the file never imports or calls `getCategories()`. The icons on active cards (line 208) and cancelled cards (line 262), and the category `<select>` in both the add and edit modals (lines 320, 416), are all baked in at build time. All 31 production subscriptions use slug ids, so they happen to *resolve* today — but against the hardcoded map, so a Category Management icon edit can never reach them, and any `cat_NNN` category is simply absent from the picker.

**Surfaces the ideation named that are NOT affected — verified, no change needed:**

- **Home.** The header chip (`app/app/page.tsx:128`) resolves live-first with a `DEFAULT_CATEGORIES` fallback (line 42); the picker grid (`components/CategoryPicker.tsx:34`) iterates the live list directly. Home renders no per-expense list. `components/TodayExpenseList.tsx` — the sole consumer of `CATEGORY_ICONS`, and the only Lucide-component (non-emoji) category surface — is **dead code**: a repo-wide grep finds no import or render of it anywhere. (Entity 042's build notes cite `TodayExpenseList.tsx:24` as a live surface; that citation is stale.)
- **Reports.** The category list rows render a color swatch, not an icon (`reports/page.tsx:108-133`, `CategoryRow`). The only Reports icon is the drill-down header (`reports/DrillDown.tsx:88,124`), fed from `reportService.ts:49` `getCatMeta`, which entity 044 already made live-first with a `DEFAULT_CATEGORIES` fallback — so it resolves and never shows a placeholder for these ids.

**Why adding a `DEFAULT_CATEGORIES` fallback is not sufficient.** It would make icons *look* right today, because all 22 slug icons currently equal their `cat_NNN` counterparts — verified by matching `name_en` against the live production list, 22/22 identical, `eating-out`→`cat_001` … `other`→`cat_022`. But the resolved icon would come from the baked-in map, so the moment the captain edits an icon in Category Management those 1931 expenses keep the old emoji — failing this entity's own second success criterion. Making the live icon win requires bridging legacy slug → live category (see the open decision below).

### Open Decision — captain

Both options satisfy every AC below; they differ in blast radius. Build should not pick unilaterally.

- **Option A — resolution-layer bridge (recommended).** Keep the stored data as-is. When an id misses the live list, use `DEFAULT_CATEGORIES` to translate the legacy slug to its `name_en`, then take the icon from the live category with that `name_en`. No writes to any sheet; reversible; the live icon wins. Cost: one more indirection, and it leans on the `name_en` correspondence holding (exact and complete today, 22/22).
- **Option B — data migration.** Rewrite the 1931 production `category_id` values (and 31 subscriptions) from slug to `cat_NNN`. Cleaner end state, no bridge code. Cost: a large one-way write to real production data, and entity 042 is mid-flight writing to the same sheet.

This is the same category-scheme question the captain deferred in entity 042 (`workflow/042-insurance-tax-categories.md:16`: "revisit whether 042 should add slug categories alongside the existing cat_NNN ones, or whether the category scheme itself needs to be addressed first"). Whichever is chosen here should settle it for 042 too.

### Scope note — name resolution is unavoidably coupled

`history/page.tsx:509-511` and `ExpenseEditSheet.tsx:146,150` derive **both** the name and the icon from a single `cat` lookup. Fixing the missed lookup necessarily makes the name resolve as well — those same 1931 expenses currently display the raw slug (`eating-out`) instead of `Eating Out`, a case entity 044 did not cover (044 fixed the opposite direction: live id absent from `DEFAULT_CATEGORIES`). Every AC below asserts on icons only. The name improving is a consequence of the same one-line lookup change, not added scope; splitting them would mean writing a second, icon-only lookup, which is worse code for no benefit.

### Goal

Every per-expense and per-subscription category icon resolves from the live category list — the same data Category Management writes — so the icon beside an expense matches what Category Management shows for that category, and editing it there changes it everywhere with no code deploy.

### User Stories

- As the captain scanning History, I want each expense to carry its own category's icon, so I can read the list at a glance instead of seeing the same `💰` on nearly every row.
- As the captain who just changed a category's icon in Category Management, I want that icon to appear everywhere the category is shown, so Category Management is actually the source of truth.
- As the captain reviewing Subscriptions, I want each subscription's icon to match its category, and the category picker to offer every category I can see in Category Management.

### Acceptance Criteria

**Per-expense surfaces**

- [ ] AC-1: In History, an expense whose `category_id` is a legacy slug absent from the live category list (e.g. `eating-out` — 651 production expenses today) shows a category-specific icon, not the generic `💰`.
- [ ] AC-2: That same expense, opened in the detail sheet (`ExpenseEditSheet`, reached both from History and from the Reports drill-down), shows the same category-specific icon, not `💰`.
- [ ] AC-3: The icon rendered for that expense is byte-identical to the `icon` string `GET /api/categories` returns for the category Category Management displays it under.
- [ ] AC-4: After changing that category's icon in Category Management and returning to History by in-app navigation (no hard refresh, no rebuild, no deploy), the expense row shows the NEW icon.
- [ ] AC-5: An expense whose `category_id` matches no live category and no legacy slug (a genuinely orphaned id) renders a defined fallback glyph and does not throw or blank the page.
- [ ] AC-6: An expense whose category has been archived (`is_active: false`) in Category Management shows that category's real icon in History and in the detail sheet, not `💰`.

**Subscriptions**

- [ ] AC-7: Subscription cards (active and cancelled) resolve their icon from `GET /api/categories`, not from `DEFAULT_CATEGORIES` — verifiable by the page issuing the request and by AC-8.
- [ ] AC-8: After changing a category's icon in Category Management, Subscriptions cards using that category show the new icon with no deploy.
- [ ] AC-9: The category `<select>` in the Subscriptions add and edit modals lists the live active categories — every category visible in Category Management is selectable, including `cat_NNN`-id ones absent from `DEFAULT_CATEGORIES`.

**No regressions**

- [ ] AC-10: For a category whose id IS in the live list, Home's header chip, Home's picker grid, the Edit Expense picker, the Reports drill-down header, and Category Management all show the same icon they show today.
- [ ] AC-11: With `GET /api/categories` failing (offline / API down), every icon surface above renders a defined glyph and no page crashes or renders blank.
- [ ] AC-12: No icon surface renders an empty string when a category's `icon` cell is blank in the sheet — `functions/src/index.ts:78` returns `icon: row[3] ?? ""`, and `""` survives `??`, so a blank cell today reaches the DOM as nothing at all.

### Edge Cases

- An expense on a legacy slug id, which is 99.3% of real production data — resolves to the live category's icon (AC-1, AC-3), not a placeholder and not a baked-in emoji.
- An expense on an id in neither the live list nor `DEFAULT_CATEGORIES` — defined fallback glyph, no crash (AC-5).
- An expense on an archived category — History filters its live list to `is_active`, so the lookup misses; the icon must still resolve (AC-6).
- A category whose `icon` cell in the Categories tab is empty — the API returns `""`, which passes through `?? "💰"` unchanged and renders as nothing (AC-12).
- A category created through the settings UI gets a `cat_NNN` id (`functions/src/index.ts:227-233`) and so is absent from `DEFAULT_CATEGORIES` — it must appear with its icon in Subscriptions' picker and cards (AC-9).
- `GET /api/categories` down while viewing History, the detail sheet, or Subscriptions — defined glyph, no crash (AC-11).
- The captain edits an icon in one tab while History is already open in another — the already-open page is not required to update without its own navigation or reload (out of scope, same carve-out as 044).

### Out of Scope

- **Category name resolution** as its own goal (entity 044) — names improving in History/`ExpenseEditSheet` is an unavoidable consequence of the shared lookup, per the scope note above; no AC asserts on names and no name-only code path is touched.
- The icon picker UI in Category Management (`settings/categories/page.tsx:269-277`), and adding, validating, or curating the set of available icons.
- `CATEGORY_ICONS` and `components/TodayExpenseList.tsx` — dead code; deleting them is cleanup for another entity, not this fix.
- Reports' category list rows and charts — they render color swatches, not icons.
- Entity 042's `gov_category` / column-G work, and its in-flight production write.
- Category *colors* (`DONUT_COLORS`), which are positional and unrelated to category data.
- Real-time push so an already-open page updates without the viewer navigating or reloading.
- Fixing the fact that an expense on a legacy slug id has no category selected in the Edit Expense picker (`CategoryPicker` renders only live categories) — a selection bug, not an icon bug; noted for a follow-up entity.

## Stage Report: spec

- DONE: Trace the actual root cause live in code before writing ACs — confirm which specific hardcoded map(s) icons resolve against, and every call site affected (Home, History, Reports, Category Management itself)
  Traced against live production and staging APIs, not just code reading. Found the ideation's hypothesis inverted: the symptom is a **live-only** lookup with no fallback (`history/page.tsx:509`, `ExpenseEditSheet.tsx:146`) missing for 1931/1945 production expenses (99.3%, 19 distinct legacy slug ids) and falling through to `?? "💰"` — not a hardcoded map being read. Separately confirmed Subscriptions (`subscriptions/page.tsx:14,208,262,320,416`) never calls `getCategories()` at all. Ruled out Home (live-first at `page.tsx:42,128`; `TodayExpenseList.tsx` is dead code — sole `CATEGORY_ICONS` consumer, zero imports repo-wide) and Reports (rows render color swatches; drill-down header already live via 044's `getCatMeta`). Category Management itself is correct and is the reference surface.
- DONE: Acceptance criteria are binary/testable against code or live data, not against visual judgment alone
  AC-1/AC-2/AC-6 assert "not the generic `💰`" against a named, currently-reproducible id; AC-3 asserts byte-identity against the `icon` string from `GET /api/categories`; AC-4/AC-8 assert an observable before/after change with no deploy; AC-9 asserts a `cat_NNN` category is present in a `<select>`; AC-12 asserts a specific `?? ""` defect at `functions/src/index.ts:78`. Each resolves to yes/no on a rendered value, an HTTP response, or a DOM presence check.
- DONE: Scope stays limited to icon resolution — do not touch name resolution (044, already shipped) or the icon picker/available-icons UI
  Out of Scope names the icon picker (`settings/categories/page.tsx:269-277`), available-icons curation, `CATEGORY_ICONS`/`TodayExpenseList` cleanup, and Reports' swatches. No AC asserts on names. A "Scope note" documents that `history/page.tsx:509-511` and `ExpenseEditSheet.tsx:146,150` derive name and icon from one shared `cat` lookup, so names resolving is an unavoidable consequence of the same change — surfaced rather than silently absorbed.

### Summary

The ideation's diagnosis was inverted and the spec says so: icons break because History and the expense detail sheet resolve against the live category list *only*, and 99.3% of real production expenses carry legacy slug ids that exist in no live category — so the lookup misses and every row renders the same `💰`. Verified live (1931/1945 production, 1400/1404 staging), and confirmed Home and Reports are unaffected, which narrows the fix to two surfaces plus Subscriptions. One open decision is escalated rather than chosen: a `DEFAULT_CATEGORIES` fallback would make icons look right today (all 22 slug icons currently equal their `cat_NNN` counterparts) but would silently fail this entity's own "changes reflect without a deploy" criterion, so the spec offers a resolution-layer bridge (recommended) versus a production data migration — the same category-scheme question the captain already deferred in entity 042.

## Stage Report: build

- DONE: Implement Option A (resolution-layer bridge) — captain's explicit choice over Option B: no writes to any sheet, translate a legacy slug id to its live category's icon via the name_en correspondence, live icon wins
  `resolveCategory`/`categoryIcon` in `app/app/lib/categories.ts` (commit `c3f26c5`): direct live-id match wins, else the slug goes through `DEFAULT_CATEGORIES`' `name_en` to the live category of that name. No write path added anywhere. Re-checked the correspondence against both live APIs today: 22/22 slugs bridge to a live category on production (25 categories, `cat_001`–`cat_023` plus 042's now-shipped `insurance`/`tax`) and on staging, with zero duplicate `name_en` — the bridge is unambiguous on real data.
- DONE: Fix History and ExpenseEditSheet (AC-1 through AC-6) and Subscriptions (AC-7 through AC-9), matching the spec's exact call sites
  All five spec-named call sites changed: `history/page.tsx:509,519`, `ExpenseEditSheet.tsx:54,146`, `subscriptions/page.tsx:14,208,262,320,416`. History and `reports/DrillDown.tsx` now hold the **unfiltered** live list for resolution and derive the active list for their pickers, so an archived category resolves (AC-6) without widening the Edit Expense picker. Subscriptions calls `getCategories()` for the first time (AC-7) and both `<select>`s list live actives (AC-9).
- DONE: Confirm no regressions on Home, Reports, or any surface already resolving correctly (AC-10), and the offline/blank-icon edge cases (AC-11, AC-12)
  Home, `CategoryPicker`, and Category Management changed only `X.icon` → `categoryIcon(X)`, which is the identity for any non-blank icon — asserted over all 25 live plus 22 baked-in categories. `npx tsc --noEmit` and `npm run build` both clean.

### Evidence

`npm test` in `app/` — 13 tests, all passing, covering three claims:

- **The bridge makes the live icon win.** Fixtures give each live category an icon that differs from its baked-in twin, so the rendered glyph identifies which source was read. Replacing the bridge line with the old `DEFAULT_CATEGORIES` fallback fails 3 unit tests and 5 of 6 render tests — confirmed by mutating the compiled output and re-running.
- **The blank-icon guard is `||`, not `??`.** Reverting `categoryIcon` to `?? FALLBACK_ICON` fails the AC-12 unit test and the History render test.
- **The rendered DOM, not just the helper.** `test/icons.render.test.js` mounts the real `history/page.tsx` and `subscriptions/page.tsx` in jsdom against production-shaped fixtures (legacy-slug, live-id, archived, orphan and blank-icon rows) and asserts on the icon that reaches the DOM: AC-1/AC-3 (`🍕` not `💰`, not the baked-in `🍜`), AC-2 (detail sheet through the portal), AC-4 (edit an icon mid-run, dispatch `popstate`, the slug row shows the new glyph with no rebuild), AC-5, AC-6, AC-11 (API 503 → every row keeps a defined glyph), AC-12.

### Notes for verify

- **No full-app browser run.** Every page sits behind `AuthGuard`'s Google sign-in popup, which cannot run headlessly, and the app is a static export with no local `/api`. The page components were mounted directly instead. Confirming on deployed staging with real data is verify's to do.
- **Deliberate behaviour change outside the ACs:** `reportService.getCatMeta`'s fallback glyph for a genuinely orphaned id moves from `📦` to the shared `💰`. Categories in the live list are unaffected (AC-10).
- **Two known limits, both left alone.** If the captain ever creates a second live category with an existing `name_en`, the bridge takes the first match. And History's category *filter* still compares raw ids, so filtering by a live category matches no slug expense — the same class as the picker-selection bug the spec deferred, and equally not an icon bug.
- **New in the repo:** an `npm test` script, a `jsdom` devDependency, and `app/test/`. The repo had no app-level test runner before; `functions/test/` set the `node --test` precedent.

### Summary

The captain's Option A is in: a legacy slug id is translated to its live category through the `name_en` correspondence, so the icon always comes from the sheet Category Management writes and nothing is written back. The visible fix today is that the 1931 production expenses that all rendered the same `💰` now render their own category's icon; the durable fix is that an icon edit in Category Management reaches them at all, which no baked-in fallback could deliver. Two regressions the change could have introduced were headed off rather than discovered later: resolution runs against the unfiltered live list so archived categories still resolve, and Subscriptions' edit modal keeps the stored slug as its option value so an amount-only save cannot silently rewrite `category_id`.

## Stage Report: verify

**Verdict: PASS** — every AC verified against deployed staging; no AC failed.

- DONE: Deploy to staging and confirm live, on real data — build's evidence was jsdom-mounted components, not a running deployed app (AuthGuard blocks headless sign-in, noted explicitly in the build report as verify's job)
  `firebase deploy --only hosting --project staging` (functions untouched by this branch, so hosting-only keeps the blast radius minimal). All 14 JS chunks referenced by `/`, `/history` and `/subscriptions` are sha256-identical between `app/out` and what staging serves; `GET /api` returns 1404 real expenses and `GET /api/categories` 25 categories, both HTTP 200.
- DONE: Live-check the bridge actually wins over any baked-in fallback for real legacy-slug expenses on staging, and that editing an icon in Category Management reflects with no rebuild (AC-4, AC-8)
  Ran the **deployed** `resolveCategory`/`categoryIcon` — extracted from the chunk fetched over HTTP from staging (`0_9ofk67fg_dc.js`, sha256 `38ad08ca…`, identical to the local build) — against the **live** API payload. 1400/1404 staging expenses carry a legacy slug absent from the live list; 0 fall back to `💰`. Feeding the live payload back with `cat_001.icon` altered to a sentinel `🦄` makes the deployed resolver return `🦄` for slug `eating-out` (509 expenses) while the baked-in map still says `🍜` — the live record wins, and the chunk is untouched. **Then closed the round-trip for real** (captain-approved staging write): `PATCH /api/categories/cat_001 {"icon":"🦄"}` → 200, a fresh `GET` returns `icon: 🦄`, and the deployed resolver resolves `eating-out` → `🦄` — with the bridge chunk's sha256 unchanged at `38ad08ca…` across the whole exchange, so no rebuild or redeploy was involved. Restored to `🍜` and re-fetched: byte-identical to the pre-mutation snapshot.
- DONE: Confirm the two build-flagged items don't regress anything real: the orphan fallback glyph change (📦→💰), and Subscriptions now calling getCategories() for the first time
  Orphan glyph: 0 of 1404 staging expenses have a `category_id` in neither the live list nor the legacy map, and the deployed resolver returns `undefined` for none of them — the `📦`→`💰` change is unreachable on real data. Subscriptions: the subscriptions-only chunk `17qp~mp3y.sh~.js` now imports categoryService (module `80386`), which it never did before; `GET /api/categories` is the same endpoint History already used, so it adds no new backend surface.
- DONE: Mandatory PII / secrets check
  No `.env` file with real values is tracked (only three `.example` files); `app/.env.local` is ignored via `app/.gitignore:34`. Across every line this branch adds (excluding `package-lock.json`): no key/token/password/private-key match, the only email is the synthetic `test@example.com`, the only URL is `http://localhost/`. The real addresses in `app/app/lib/users.ts` are pre-existing on `main` and untouched here. Reverted one build artifact (`app/public/manifest.json`, rewritten by the staging `prebuild`) so it stayed out of the commit.

### Evidence

Live staging, deployed code + deployed data (HTTP 200 on every call):

- **AC-1 / AC-3** — 1400 legacy-slug expenses resolve; 0 render `💰`, and 0 differ from the `icon` string `GET /api/categories` returns. Falsification control: replaying the pre-fix lookup (live list only, `?? "💰"`) over the *same live payload* gives 1400/1400 falling back to `💰` — the captain's original symptom, reproduced and then removed.
- **AC-4 / AC-8** — real write to staging, then restored. `PATCH cat_001 {"icon":"🦄"}` → 200; fresh `GET` → `🦄` (persisted); deployed resolver `eating-out` → `🦄` while the baked-in map still says `🍜`; bridge chunk sha256 identical before and after, so nothing was rebuilt. Restore → `GET` byte-identical to the pre-mutation snapshot. What would make it fail: `resolveCategory` returning the `DEFAULT_CATEGORIES` entry instead of the live twin — then the answer stays `🍜`.
- **AC-5** — `resolveCategory("no-such-category-anywhere", live)` → `undefined`, `categoryIcon` → `💰`, no throw.
- **AC-6** — with the unfiltered live list an archived `cat_001` resolves to its own icon; the same list filtered to `is_active` falls back to the baked-in `🍜`. That gap is exactly what holding the unfiltered list fixes.
- **AC-10** — `categoryIcon(c) === c.icon` for all 25 live categories, so a live-id surface renders what it rendered before.
- **AC-11** — empty live list (the state after `getCategories()` rejects) → `🍜`, a defined glyph, no throw.
- **AC-12** — deployed guard is `||`, not `??`: `icon:""` → `💰` and `icon:"   "` → `💰`.
- **AC-4 refetch path** — the deployed history chunk registers `getCategories()` on mount *and* on `popstate`; TabBar `<Link>` navigation remounts the page, so returning to History refetches without a reload.
- Build's 13 tests still pass on this branch (`npm test`), unchanged.

### Limits — please read before approving

- **No browser run was possible.** Chromium, WebKit and Firefox all fail to start on this machine; a freshly downloaded Chromium segfaults (`SIGSEGV`) even on `about:blank`, with and without the sandbox. So there is no screenshot and no observed-in-page behaviour. Everything above executes the *deployed bytes* against the *live API*, which is stronger than build's local-source-plus-fixtures evidence but is still not a rendered page. Entity 041's verify hit the same wall.
- **AC-2 and AC-9 are the weakest links.** Both are asserted from the hash-matched deployed bundle and from build's jsdom render tests, not from a live rendered sheet or `<select>`. They are the first things worth a click in the captain's manual test.
- ~~**One link in AC-4/AC-8 is unproven end-to-end.**~~ **Closed.** Ran with captain approval: the icon edit persists through `PATCH`, comes back on a fresh `GET`, and the deployed resolver follows it — no rebuild, chunk hash unchanged. `cat_001` was restored and re-verified byte-identical to its pre-mutation state; staging carries no residue from this test.
- **Unrelated bug found while reading the write path:** `PATCH /api/categories/:id` reads columns `A:F` but writes `A:G`, so `existing[6]` is always `undefined` and `gov_category` is silently blanked on every PATCH that omits it (`functions/src/index.ts:283-311`). Harmless on staging today (all 25 categories have `gov_category: null`) but it directly threatens entity 042's column-G work on production. Not this entity's to fix — filing it is worth a decision.

### Summary

The fix is live on staging and does what it claims on real data: 1400 of 1404 staging expenses carry a legacy slug that exists in no live category, and the deployed code resolves every one of them to its live category's icon instead of the single generic `💰` that the pre-fix lookup still produces for all 1400 when replayed over the same payload. The durable half also holds — because all 22 baked-in glyphs currently equal their live twins, a screenshot could never tell the bridge from the old fallback, so I set a sentinel icon on `cat_001` — first in the fetched payload, then for real on staging with the captain's approval — and confirmed the deployed resolver follows the live record rather than the baked-in map, with the bridge chunk's hash unchanged throughout. That is AC-4/AC-8 end to end: edit the icon in Category Management, and 509 legacy-slug expenses pick it up with no rebuild and no deploy. `cat_001` was restored and re-verified byte-identical, so staging carries no residue. The two build-flagged changes are inert on real data: no staging expense can reach the changed orphan glyph, and Subscriptions' new `getCategories()` call hits an endpoint the app already used. The one gap to be honest about is that no browser will run on this machine, so nothing here was seen rendered — the captain's manual pass on staging is what closes AC-2 and AC-9.
