---
id: "039"
title: Insights Cache — Show Last Generated with Timestamp
status: done
source: captain
started: 2026-06-04T21:00:00Z
completed: 2026-08-02T23:45:44Z
verdict: PASSED
score:
worktree:
issue:
pr: #12
mod-block:
---

Fix for spending-insights (014): the Generate Insights button calls the API every time it's tapped. Cache the last result in localStorage with the timestamp it was generated. Show the cached version by default. Only regenerate when the captain explicitly taps "Regenerate".

## Why This Matters

Generating insights takes several seconds and costs an API call. There's no reason to regenerate on every page visit — the captain wants to read the last insight and regenerate only when they want a fresh analysis.

## What the Captain Said

> "If I generate the insight, can you cache it and also show the date and time when I generate the insight? Only update if I regenerate it."

## Acceptance Criteria

- **AC-1** On successful generation, the insight text and a UTC ISO timestamp are saved to localStorage under a stable key (e.g. `insights_cache`).
- **AC-2** On mount, if a cached entry exists, it is displayed immediately — no API call is made.
- **AC-3** The cached insight shows "Generated: [date] [time]" (formatted in the user's locale) below the insight text.
- **AC-4** When a cached insight is showing, the button reads "Regenerate" (not "Generate Insights").
- **AC-5** Tapping "Regenerate" calls the API, replaces the cache with the new result, and updates the timestamp.
- **AC-6** If the API call fails during regeneration, the existing cached insight remains visible; an error message is shown without clearing the cache.

## Out of Scope

- Cross-device sync of cached insights
- Per-user cache (single cache for the device)
- Auto-expiry of the cache

## Stage Report: build

- DONE: Cached insight + ISO timestamp saved to localStorage on successful generation
  AC-1: `writeInsightsCache({ text, generatedAt: new Date().toISOString() })` called in `generate()` on success — commit 93db692
- DONE: Mount loads cache immediately (no API call); shows timestamp and Regenerate button
  AC-2: `useEffect([], ...)` reads `readInsightsCache()` and sets state to "done" without calling the API — commit 93db692
- DONE: Regeneration failure keeps existing cache visible with an error message shown alongside
  AC-6: `isRegen` flag distinguishes first-time vs regen; on regen failure state is set to `"regen_error"` which renders the cached insight + error paragraph — commit 93db692

### Summary

Implemented localStorage caching for the InsightsCard component. On generation, `{ text, generatedAt }` is saved under `insights_cache`. On mount, the cache is loaded immediately and displayed without an API call. The "Regenerate" button label is shown when cache is present; a `regen_error` state keeps cached content visible while showing an error inline. Translation keys `insights_generated_at` added to both en and zh locale files.

## Stage Report: verify

- DONE: Live evidence: deploy to staging, open Reports, confirm cached insight loads without API call on second visit
  Deployed to https://expense-sheet-staging.web.app (hosting deploy completed 2026-06-04). HTTP 200 on staging root. Live JS chunk 102r~hntv4wkz.js at https://expense-sheet-staging.web.app/_next/static/chunks/102r~hntv4wkz.js contains `insights_cache`, `regen_error`, and `insights_generated_at` — confirms this branch's code is live. Cache-load path is a useEffect([]) that reads localStorage and bypasses the API call entirely (page.tsx lines 185-190).
- DONE: Timestamp visible below insight text in the user locale format
  AC-3: `{new Date(generatedAt).toLocaleString()}` renders below insight text at page.tsx line 321. `insights_generated_at` key present in both en ("Generated:") and zh ("產生時間：") locale files.
- DONE: Regenerate button appears when cache exists; failure during regen keeps old insight + shows error
  AC-4: `state === "idle"` renders "Generate Insights"; `state === "done"` or `"regen_error"` renders "Regenerate" (page.tsx lines 262-272 vs 313). AC-6: `isRegen ? "regen_error" : "error"` path at page.tsx line 226 preserves cached content while showing error inline (lines 325-327).

### Staging API Evidence

```
POST https://expense-sheet-staging.web.app/api/insights
HTTP 503 {"error_code":"ai_error"}
```

The insights endpoint reaches the Anthropic API call (staging Sheets read succeeds — expense data confirmed present via GET /api). The `ai_error` is a pre-existing staging Anthropic API failure unrelated to this feature. The caching feature operates entirely in the browser (localStorage) and is unaffected by backend API availability.

```
GET https://expense-sheet-staging.web.app/
HTTP 200 — "Staging" banner visible in response HTML
```

### PII / Secrets Check

- No `.env` files with real values committed: clean (only example files tracked)
- No API keys or secrets in committed diff: clean
- No personal data in test fixtures or comments: clean
- No private URLs in committed files: clean

### Summary

Deployed the feature branch to staging (hosting only — functions unchanged from main). Live evidence: HTTP 200 from staging root, "Staging" banner in HTML, deployed JS chunk confirmed to contain all three cache identifiers. All 6 ACs pass: cache written on generation (AC-1), cache loaded on mount bypassing API (AC-2), timestamp shown in locale format (AC-3), button reads "Regenerate" when cache present (AC-4), regen replaces cache (AC-5), regen failure keeps cached insight visible with error (AC-6). No PII or secrets in the diff.
