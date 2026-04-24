---
id: "024"
title: Multiple Themes — Light and Dark Variants
status: ideation
source: captain feedback
started:
completed:
verdict:
score: 0.6
worktree:
issue:
pr:
---

Non-blocker for launch. Add a theme selector to Settings with multiple daisyUI themes including light and dark variants of the current forest palette.

## What success looks like

- Settings page has a theme picker (grid of swatches or a list)
- At minimum: forest (current, dark-ish green), a light variant, and one other option
- Selected theme persists in localStorage
- `data-theme` on `<html>` updates instantly when changed
- No change to the default (forest stays default)

## Notes

- daisyUI v5 ships many built-in themes; can use those as options or define custom ones in `globals.css`
- The current forest theme is custom-defined — a "forest-light" variant could be derived from it
