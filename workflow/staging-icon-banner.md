---
id: "033"
title: Staging Icon and Environment Banner
status: spec
source: captain
started: 2026-05-03T09:41:34Z
completed:
verdict:
score: 0.9
worktree:
issue:
pr:
---

Add a distinct PWA icon for staging and an in-app "STAGING" banner so it's obvious which environment you're using — especially when both are pinned to the mobile home screen.

## What the captain wants

- **Production icon:** keep the existing "D" money/expense tracker icon
- **Staging icon:** something visually distinct so the two home screen shortcuts look different at a glance
- **In-app staging banner:** a visible indicator inside the web app itself (e.g. a top bar or corner badge saying "STAGING") so there's no ambiguity while using it

## How this should work technically

The staging and production apps are the same codebase deployed to two Firebase projects with different env vars. The environment indicator should be driven by a `NEXT_PUBLIC_APP_ENV` (or similar) env var set to `staging` in `app/.env.staging` and absent (or `production`) in `app/.env.local`.

**PWA icon:** Next.js uses `app/public/` for static assets and reads manifest from `app/app/manifest.ts` (or similar). A staging-specific icon file needs to be added and the manifest needs to conditionally reference it based on env.

**In-app banner:** A component rendered conditionally when `NEXT_PUBLIC_APP_ENV === 'staging'` — visible on every page, unobtrusive but unmistakable. A thin colored top bar or a fixed corner badge works well.

## Acceptance Criteria

- **AC-1** When the staging app is added to the mobile home screen, its icon is visually distinct from the production icon
- **AC-2** When the production app is added to the mobile home screen, it retains the existing "D" expense tracker icon
- **AC-3** The staging app shows a persistent "STAGING" indicator visible on every page (banner, badge, or equivalent)
- **AC-4** The production app shows no staging indicator
- **AC-5** The indicator is driven by env var — no hardcoded project ID checks
- **AC-6** Both `app/.env.staging` and `app/.env.staging.example` are updated with the new env var
