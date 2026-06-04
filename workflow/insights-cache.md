---
id: "039"
title: Insights Cache — Show Last Generated with Timestamp
status: build
source: captain
started: 2026-06-04T21:00:00Z
completed:
verdict:
score:
worktree: .worktrees/spacedock-ensign-insights-cache
issue:
pr:
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
