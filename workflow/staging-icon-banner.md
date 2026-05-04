---
id: "033"
title: Staging Icon and Environment Banner
status: verify
source: captain
started: 2026-05-03T09:41:34Z
completed:
verdict:
score: 0.9
worktree: .worktrees/spacedock-ensign-staging-icon-banner
issue:
pr:
---

Add a distinct PWA icon for staging and an in-app "STAGING" banner so it's obvious which environment you're using — especially when both are pinned to the mobile home screen.

## What the captain wants

- **Production icon:** use 💰 emoji as the expense tracker icon
- **Staging icon:** something visually distinct so the two home screen shortcuts look different at a glance, like 🔧
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

## Spec

### Codebase findings

- **Manifest:** `app/public/manifest.json` — a static JSON file, not a TypeScript route handler. It currently references `/icons/icon-192x192.png` and `/icons/icon-512x512.png`. Both icon paths exist in `public/icons/` but the directory contains only a `.gitkeep` (icons are gitignored or generated at deploy time).
- **Existing icons:** `public/icons/` holds the production icons (192x192 and 512x512). Only a `.gitkeep` is committed; actual PNG files are absent from the repo.
- **Root layout:** `app/app/layout.tsx` — imports components, sets `<link rel="manifest" href="/manifest.json">`, and renders all pages inside `FontSizeProvider > Providers > AuthProvider > AuthGuard`. This is the single mount point for a persistent banner.
- **Env files:** `app/.env.local` (production) has no `APP_ENV` var. `app/.env.staging` has Firebase vars only. Neither defines `NEXT_PUBLIC_APP_ENV` yet.
- **Next.js config:** `output: "export"` — static export mode. No server-side rendering. Env vars baked in at build time only.

### Implementation approach

**Static export constraint:** Because the app uses `output: "export"`, there is no runtime manifest serving. The manifest must be static. To serve a staging-specific manifest, the build must emit a different `manifest.json` at build time using the env var.

**PWA icon (AC-1, AC-2)**

Two options:

Option A — Two manifest files, swap at build time
- Add `public/manifest.staging.json` referencing staging icon paths (e.g. `/icons/icon-staging-192x192.png`, `/icons/icon-staging-512x512.png`)
- Add a `prebuild` or `postbuild` npm script that, when `NEXT_PUBLIC_APP_ENV=staging`, copies `manifest.staging.json` over `manifest.json` before the static export
- Add staging icon PNG files to `public/icons/`

Option B — Generate manifest at build time via a script
- A small Node script reads `NEXT_PUBLIC_APP_ENV` and writes the correct `manifest.json` content before `next build`
- Same outcome as Option A, cleaner separation

Recommendation: **Option A** — simpler, no extra tooling, swap script is one line.

**Staging icon design:** The production icon is a "D" expense tracker. For the staging icon, a visually distinct approach that requires no design tool: use the same base icon with an orange/yellow tint or a "β" / "DEV" text overlay. The simplest no-design approach is a solid colored background (orange `#f97316`) with white "S" or "DEV" text — implementable as an SVG converted to PNG, or by placing a pre-generated PNG.

Since actual icon PNG generation is outside the scope of this spec stage, the implementation stage will need to either: (a) generate SVG-based icons programmatically using a build script, or (b) provide placeholder staging icons. The spec calls for a distinct staging icon; the implementation will use an SVG-to-PNG generation script (using `sharp` or `canvas`, both already common in Next.js projects) or a simple colored PNG.

**In-app banner (AC-3, AC-4, AC-5)**

- Add `NEXT_PUBLIC_APP_ENV=staging` to `app/.env.staging` and `app/.env.staging.example`
- Create `app/app/components/StagingBanner.tsx` — renders a fixed top bar when `process.env.NEXT_PUBLIC_APP_ENV === 'staging'`, returns null otherwise
- Mount `<StagingBanner />` in `app/app/layout.tsx` inside the `<body>`, above `<div className="pb-16">{children}</div>`
- Banner style: thin (e.g. `h-6`) fixed top bar, orange background (`bg-orange-500`), white "STAGING" text centered, `z-50` so it sits above all content

**Manifest swap approach (final decision):**
- Add a `scripts/set-manifest.js` script that writes the correct manifest content based on `NEXT_PUBLIC_APP_ENV`
- Call it via `"prebuild": "node scripts/set-manifest.js"` in `package.json`

### Files to create/modify

| File | Action | Purpose |
|---|---|---|
| `app/public/icons/icon-staging-192x192.png` | Create | Staging PWA icon (192px) |
| `app/public/icons/icon-staging-512x512.png` | Create | Staging PWA icon (512px) |
| `app/scripts/set-manifest.js` | Create | Writes manifest.json based on env at prebuild |
| `app/package.json` | Modify | Add `"prebuild"` script |
| `app/public/manifest.json` | Modified at build | Outcome of set-manifest.js |
| `app/app/components/StagingBanner.tsx` | Create | Conditional staging banner component |
| `app/app/layout.tsx` | Modify | Mount StagingBanner |
| `app/.env.staging` | Modify | Add `NEXT_PUBLIC_APP_ENV=staging` |
| `app/.env.staging.example` | Modify | Add `NEXT_PUBLIC_APP_ENV=staging` |

### Acceptance criteria mapping

- **AC-1:** Staging build uses manifest pointing to staging icons → distinct home screen icon
- **AC-2:** Production build uses existing manifest → "D" icon unchanged
- **AC-3:** `StagingBanner` renders when `NEXT_PUBLIC_APP_ENV === 'staging'` — visible on every page via root layout
- **AC-4:** `StagingBanner` returns null when env var is absent or not `staging`
- **AC-5:** All logic reads `NEXT_PUBLIC_APP_ENV` — no hardcoded project IDs
- **AC-6:** Both env files updated

## Stage Report: spec

- DONE: Implementation approach identified with evidence from codebase (manifest location, icon files, layout component)
  Manifest at `app/public/manifest.json` (static JSON); icons dir `app/public/icons/` (.gitkeep only); layout at `app/app/layout.tsx`; static export mode confirmed in `next.config.ts`
- DONE: Spec written covering PWA icon change and in-app staging banner, with binary AC
  Spec section above covers manifest swap approach, StagingBanner component, env var strategy, and file change table mapping each AC

### Summary

Explored the codebase: manifest is a static JSON file (not a TypeScript route handler), icons directory exists but only has a `.gitkeep`, and the root layout is the right mount point for a banner. The static export constraint (`output: "export"`) means manifest content must be swapped at build time via a prebuild script. Spec covers both the PWA icon approach (prebuild script + staging icon PNGs) and the in-app banner (StagingBanner component in root layout driven by `NEXT_PUBLIC_APP_ENV`).
