---
id: "032"
title: Workflow Verify Stage Improvements
status: verify
source: captain
started: 2026-05-03T09:38:20Z
completed:
verdict:
score: 1.0
worktree: .worktrees/spacedock-ensign-workflow-verify-improvements
issue:
pr: #3
mod-block: 
---

Improve the verify stage in the workflow so agents self-correct before the captain sees anything, and so every verify explicitly checks for PII/secrets in the public repo.

## Two Changes

### 1. Agent auto-verify with build feedback loop

Currently verify agents pass everything to the captain even when they find issues. Instead:
- If the verify agent finds any AC failure → stage report verdict is REJECTED → FO auto-bounces back to build (via the existing `feedback-to: build` mechanism) with the specific failures listed
- Build agent fixes the issues and re-commits
- Verify agent runs again (fresh, as always)
- Only when ALL ACs pass does the captain see it

The `feedback-to: build` field is already set in the README — the verify stage definition just needs to make the rejection/bounce behaviour explicit so agents know to use it.

### 2. Mandatory PII check in every verify

Before marking verify complete, the agent must confirm:
- No `.env` files with real values are committed to the branch
- No API keys, tokens, or secrets in any committed file
- No personal data (names, emails, phone numbers) in test fixtures, seed data, or comments
- No private URLs or internal identifiers that shouldn't be public

If any PII/secret is found → automatic REJECT with exact file and line cited → back to build to remove it.

## What Needs to Change

Update `workflow/README.md` — the `### verify` stage definition:
- Add explicit rejection instructions: "If any AC fails, set verdict to REJECTED in the stage report. List each failure with evidence. The FO will automatically route back to build."
- Add PII check as a required checklist item before marking verify complete
- Clarify the two-phase flow: agent auto-verify first, then captain human verify

## Acceptance Criteria

- **AC-1** The verify stage definition in README.md explicitly states that AC failures must be marked REJECTED (not just noted), triggering the build feedback loop
- **AC-2** The verify stage definition includes a mandatory PII/secrets check as a named required step before the stage can be marked complete
- **AC-3** The PII check lists concrete items to inspect: .env files, API keys, personal data in fixtures, private URLs
- **AC-4** The updated README is the only file changed — no entity files, no code, no other scaffolding

## Stage Report: build

- DONE: verify stage definition explicitly states AC failures must be marked REJECTED to trigger the build feedback loop
  Added "Rejection Protocol" subsection to `### verify` in workflow/README.md; states REJECTED verdict required, evidence required, FO auto-routes to build.
- DONE: verify stage definition includes a named mandatory PII/secrets check with concrete items listed
  Added "Mandatory PII / Secrets Check" subsection listing .env files, API keys/tokens/passwords, personal data in fixtures, and private URLs — each as a concrete bullet; failure triggers REJECTED with file+line citation.
- DONE: No other file changed
  Only `workflow/README.md` was edited; entity file receives this stage report appended to its body only.

### Summary

Added two subsections to the `### verify` stage definition in workflow/README.md: a Rejection Protocol that mandates REJECTED verdict and evidence listing for any failing AC (routing back to build via the existing feedback-to mechanism), and a Mandatory PII/Secrets Check with four concrete line items that must all pass before verify can be marked complete. No other files were modified.

## Stage Report: verify

- DONE: All 4 ACs verified against the actual README.md diff with evidence
  Commit ad2b1f5 diff confirms: "Rejection Protocol" subsection added (AC-1 pass); "Mandatory PII / Secrets Check" named step added (AC-2 pass); four concrete items listed (.env files, API keys, personal data, private URLs — AC-3 pass); only workflow/README.md content changed, entity file received mandatory stage report append only (AC-4 pass).
- DONE: PII/secrets check passed on the branch itself
  Scanned README.md diff and entity file diff — no real values, API keys, personal data, or private URLs found. Only documentation text describing what to check for.

### Summary

All four ACs pass against commit ad2b1f5. The README.md diff adds exactly the two subsections specified: Rejection Protocol (AC-1) and Mandatory PII / Secrets Check (AC-2, AC-3). The entity file change is the mandatory build stage report append, not a spec violation — AC-4 intent (no code, no other scaffolding changed) is fully met. Branch PII check is clean.
