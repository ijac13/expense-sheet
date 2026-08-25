---
id: 056
title: Pre-Commit PII Scanner
status: spec
source: captain
started:
completed:
verdict:
score:
worktree:
issue:
pr:
---

This session leaked real personal data into tracked files on this public repo twice: entity 052 wrote both real emails into its own ideation prose (caught late, redacted after the fact); entity 051's build wrote two real phone numbers and four family members' subscription names into test fixtures (caught by verify, required a full history rewrite to actually remove). Both times, a person (the AI doing the work) typed real data into a file without noticing the repo is public, and the mistake was only caught downstream, by chance, in a later review step.

Captain's direct instruction: a pre-commit hook, so this is caught before it's even committed, not after.

## User Stories

- As the captain, I want a commit containing a real phone number, email, or other personal data to be blocked automatically, so this can't happen a third time no matter who's typing.
- As the captain, I want the check to catch the *shape* of personal data (phone number formats, real-looking emails), not just a fixed list of the two things that already leaked — a maintained blocklist protects against repeats of the exact same mistake, not new ones.

## Success

- Attempting to commit a file containing a Taiwan-mobile-shaped phone number (09 + 8 digits, with or without common separators) is blocked, with a clear message naming the file and match.
- Attempting to commit a real-looking email address (anything not matching an explicit safe pattern — `.example` domains, the existing `TODO_`-prefixed placeholders) is blocked the same way.
- The hook runs automatically on every commit, on every clone/worktree, without a manual per-machine setup step — installed via the existing `npm install` flow, not a README instruction someone has to remember.
- A genuine false positive (synthetic test data that happens to match the shape) has a documented, intentional override — not a silent bypass.

### Out of Scope

- Scanning for secrets/API keys/tokens — a related but separate concern; this entity is scoped to personal data (phone numbers, emails), per the two actual incidents.
- A maintained list of specific real values to block — deliberately rejected; see Success above. Shape-based detection generalizes, a hardcoded list of "known leaks" does not, and the list itself would need to store the sensitive values somehow.
- Retroactively scanning existing history — this session's incidents are already handled (052's accepted as residual risk, 051's fully scrubbed via history rewrite).
- CI/GitHub Action enforcement — captain explicitly scoped this to the pre-commit hook only.

## Plan

Likely Husky (or an equivalent git-hooks-via-npm tool) wired into a `prepare` script so it installs automatically for anyone/anything that runs `npm install` — matching how this is a Next.js/Node monorepo already. The hook scans `git diff --cached` (staged changes only, not the whole tree, for speed) against a small set of shape-based regexes. Spec should decide the exact regex set, the override mechanism (`--no-verify` is the standard git escape hatch — decide whether that's sufficient or whether an inline suppression convention is worth the added complexity), and whether the hook needs a real Google Sheets test to distinguish "real" vs "synthetic" or can rely purely on shape (synthetic test data in this repo already avoids real-looking phone numbers per entity 051's fixture fix, so shape-only detection should already be compatible with the existing test suite — spec should verify this holds, not assume it).
