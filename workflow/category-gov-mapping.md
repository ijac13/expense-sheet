---
id: "036"
title: Category → Government Category Mapping
status: spec
source: captain
started: 2026-05-21T03:07:30Z
completed:
verdict:
score:
worktree:
issue:
pr:
---

Every expense category maps to a `gov_category` — a government-defined classification. The mapping is set when a category is created, existing categories get mapped on launch, and the mapping is visible in the UI as reference information.

## Why This Matters

Taiwan household expense tracking often needs to align with government tax categories (e.g. for deductible expenses, annual tax filing, or health insurance reporting). Without a canonical mapping, every export or report has to re-derive the classification manually.

## What the Captain Said

> "Every category should map to gov_category. When created, I add mapping for existing categories. Show the mapping on the UI as information."

Key signals:
- The mapping is **captain-defined**, not auto-generated
- Existing categories need to be mapped retroactively on launch
- The UI shows the mapping as **read-only information** (not editable by end users inline)

## Open Questions

1. What are the valid `gov_category` values? Is this a fixed enum (e.g. Taiwan tax deduction categories) or a free-form string?
2. Is the mapping editable after creation, or set once?
3. Where in the UI should the mapping appear — category list, expense detail, reports, or all three?
4. Should unmapped categories be flagged or blocked from use?
