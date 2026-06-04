---
id: "038"
title: Tab Navigation — Intermittently Shows Home Content on History Tab
status: ideation
source: captain observation
started: 2026-05-11T04:11:34Z
completed: 2026-06-04T01:46:52Z
verdict: REJECTED
score: 0.9
worktree:
issue:
pr:
archived: 2026-06-04T01:46:52Z
---

After the 029 fix (loading.tsx Suspense boundary), tapping the History tab still sometimes shows the Home screen content. Not every time — intermittent.

## Context

029 added `app/app/loading.tsx` as a Suspense boundary to swap stale content to a spinner on tab switch. This fixed the most reliable reproduction but the underlying issue appears to resurface under some conditions.

## Suspected causes

- The Suspense boundary fires on initial navigation but may not trigger on repeat navigations to the same route (Next.js App Router may keep the page component alive in its cache, skipping the boundary)
- Race condition between the tab indicator updating (via `usePathname`) and the page component unmounting/remounting
- Static export behaviour: with `output: 'export'`, client-side routing may bypass Suspense boundaries on cached routes

## Acceptance Criteria

- **AC-1** Tapping History always shows History content — no Home content visible, even on repeated back-and-forth navigation
- **AC-2** Tapping any tab (Reports, Subscriptions, Settings, Home) always shows that tab's content
- **AC-3** Fix is reproducible as "always works" across 10 consecutive tab switches in both iOS Safari and Android Chrome
