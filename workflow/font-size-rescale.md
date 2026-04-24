---
id: "020"
title: Font Size Rescale — Current Large as New Default
status: ideation
source: captain feedback
started:
completed:
verdict:
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
