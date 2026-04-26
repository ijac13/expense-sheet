---
id: "020"
title: Font Size Rescale — Current Large as New Default
status: done
source: captain feedback
started: 2026-04-25
completed:
verdict: PASSED
score: 0.8
worktree:
issue:
pr:
---

Current "large" font size feels right as the everyday default. The size scale needs to shift so that "medium" becomes what "large" is today, and a new "small" and "large" are defined relative to that baseline.

## What to change

- Current: small=14px, medium=16px, large=18px
- New: small=16px, medium=18px, large=20px (or similar — exact values TBD by build agent)
- Update `FontSizeProvider` CSS vars and the settings page labels/descriptions accordingly
- Default size stored in localStorage (`font-size` key) should remain `"medium"` but now resolve to the larger base

## Stage Report: font-size-rescale

- DONE: Update globals.css font size rules to 16/18/20px
  `app/app/globals.css` lines 46-48 updated
- DONE: Update FONT_OPTIONS descriptions in settings page to 16px/18px/20px
  `app/app/settings/page.tsx` FONT_OPTIONS updated
- DONE: FontSizeProvider.tsx — no pixel values present; sets data-font-size attribute by name only, no change needed
  File reviewed; CSS handles all pixel resolution via data-font-size attribute
- DONE: npm run build passes
  14/14 static pages generated, TypeScript clean, no errors

### Summary

Shifted the font size scale up by 2px across all three tiers (small: 14→16, medium: 16→18, large: 18→20px). The `FontSizeProvider` required no changes as it only sets the `data-font-size` attribute name on `<html>` — all pixel values live in `globals.css`. Settings page descriptions updated to reflect the new values. Build passes cleanly.
