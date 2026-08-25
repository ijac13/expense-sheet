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

## Spec

### Goal

Block any commit whose staged additions introduce a Taiwan-mobile-shaped phone number or a real-looking email address, via a pre-commit hook that installs itself through the existing `npm install` flow and is active in every clone and every worktree without a per-checkout setup step.

### User Stories

- As the captain, I want a commit that adds a real phone number or email to be rejected before it lands, so a third leak onto this public repo is impossible regardless of who or what is typing.
- As the captain, I want detection based on the *shape* of personal data, so a new number that has never leaked before is caught just as reliably as the two that already did.
- As an ensign working in a fresh worktree, I want the hook to already be active without running an install step, because the setup step I have to remember is the one that will be skipped on the commit that matters.
- As an ensign hitting a genuine false positive, I want one obvious, visible override, so I do not invent my own bypass or silently weaken the check.

### Design Decisions

These three decisions were settled by experiment, not assumption. Evidence is cited in the Stage Report.

**D1 — Install via a tracked hook directory + relative `core.hooksPath`. Not Husky.**

The hook script lives at `scripts/hooks/pre-commit`, tracked in git and committed with mode `100755`. A `prepare` script in each of the three `package.json` files runs `node scripts/install-hooks.js`, which sets `core.hooksPath` to the relative path `scripts/hooks`.

Husky was tested and rejected. Husky installs its hooks into `.husky/_`, which Husky itself gitignores. Git config is shared repo-wide across linked worktrees, so a fresh worktree does inherit `core.hooksPath=.husky/_` — but `.husky/_` is not checked out there, git finds no hook, and **the commit silently succeeds**. Measured directly: a Husky-style setup protected the primary checkout and failed open in a zero-setup worktree. This repo's entire workflow is worktree-based ensigns, so that is the exact case that must not fail, and it is the case Husky loses.

The tracked-directory approach wins because the hook is *tracked*: every worktree and every clone checks it out automatically, and the shared repo-level config already points at it. A zero-setup worktree with no `node_modules` at all is protected.

Relative (`scripts/hooks`) rather than absolute is required: git 2.40.1 resolves a relative `core.hooksPath` against the top level of the *current* working tree, so each worktree runs its own checked-out copy. An absolute path would pin every worktree to the primary checkout's copy, so a worktree could never exercise its own change to the hook. Note the repo currently has a local absolute `core.hooksPath=/Users/ijac/Claude-ijac/expense-sheet/.git/hooks`; the install script overwrites it.

`prepare` must be added to all three of root, `app/`, and `functions/` `package.json`. Measured: `npm install` run only inside a subpackage that has no `prepare` leaves the repo unprotected, while a `prepare` in a subpackage can set repo-level config for the whole repo. `prepare` runs on cold `npm install`, warm `npm install`, and `npm ci`, and works even though the root `package.json` has no `name` or `version`.

**D2 — Three regexes plus a small, explicit allowlist.**

    PHONE_LOCAL  /(?<![0-9])09\d{2}[-\s]?\d{3}[-\s]?\d{3}(?![0-9])/g
    PHONE_INTL   /(?<![0-9])\+?886[-\s]?9\d{2}[-\s]?\d{3}[-\s]?\d{3}(?![0-9])/g
    EMAIL        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

`PHONE_LOCAL` is the shape of both numbers from the 051 incident, and covers their `09XX-XXX-XXX` and `09XX XXX XXX` separator variants. `PHONE_INTL` covers the same shape written for an international audience. The digit lookarounds are load-bearing: without them the pattern matches inside longer digit runs such as the repo's `sub-1700000000021` row IDs and `package-lock.json` integrity hashes. `EMAIL` is the shape of the two literal addresses from the 052 incident.

Both regexes were validated against the two real 051 numbers and the two real 052 addresses during this spec. **Those real values are deliberately absent from this document** — restating them here would repeat exactly the leak this entity exists to prevent, which is the mistake 052 made in its own ideation prose. Every phone number and email appearing below is a constructed stand-in of identical shape (`0912345678`, `0987654321`, `real.person@gmail.com`). The build stage must use constructed values too, never the real ones.

Allowlist — a match is suppressed only if it satisfies one of these, each justified by data already in the repo:

- Phone `090000\d{4}` (the reserved block 0900000000–0900009999). The existing synthetic fixtures `0900000001` and `0900000002` are Taiwan-mobile-shaped and appear in `functions/test/backfill.test.js`, `functions/scripts/backfill-subscription-history.js` and two files under `functions/scripts/fixtures/backfill-sample/`. Without this carve-out the hook blocks every commit touching entity 051's test suite.
- Email domain is an RFC 2606 / 6761 reserved name — `example.com`, `example.org`, `example.net`, or any `.example`, `.test`, `.invalid`, `localhost`. Covers all 20 existing test addresses (`ijac@example.com`, `user-one@example.com`, `user-two@example.com`, `stranger@example.com`, `test@example.com`).
- Email domain ends in `.gserviceaccount.com`. These are machine identities, not people, and 15+ occurrences already sit in tracked setup docs and config. Without this the hook blocks routine edits to `SETUP.md` and `STAGING_SETUP.md`.
- Local part or domain begins `TODO_`. The established placeholder convention in the three tracked `.env*.example` templates.
- Local part or domain contains `your-` / `your_`. Covers the documentation placeholders `your-email@gmail.com` and `firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com`.

Validated against the whole repo: 180 tracked text files scanned, **zero false positives**. The only hit was a true positive — see Findings.

**D3 — `git commit --no-verify` is the only override. No inline suppression comment.**

An inline convention such as `// pii-allow` was considered and rejected. The actor this hook guards against is, by the ideation's own account, an AI agent typing real data without noticing the repo is public. An inline suppression is a frictionless escape hatch that an agent can apply to its own blocked line and proceed unaided, which defeats the control precisely when it fires. `--no-verify` is a deliberate, visible change to the command being run, and it does not persist into the diff to be copied by the next agent.

The residual gap — that `--no-verify` disables the hook for the *whole* commit, not one line — is handled by routing class-level false positives to the allowlist instead. A false positive that represents a category (as `.gserviceaccount.com` did) is fixed by extending the allowlist in `scripts/hooks/`, which is a tracked, reviewable code change that benefits every future commit. `--no-verify` is reserved for genuine one-offs.

**D4 — Exactly one path exemption: the hook's own test fixtures.**

A scanner that blocks must-block literals cannot have its own tests committed, because those tests must contain must-block literals by definition. The moment the build stage installs the hook and then tries to commit the tests proving it works, the hook blocks it. That is a guaranteed, self-inflicted deadlock, so it is settled here rather than discovered mid-build.

The scanner skips one path prefix: `scripts/hooks/test/`. That directory is purpose-built, small, reviewed as part of the hook itself, and by policy contains only constructed values. The exemption is a literal path prefix, not a pattern, so it cannot silently widen as files are added elsewhere.

Everything else stays in scope, deliberately. `scripts/hooks/pre-commit` itself is **not** exempt — the scanner's own source has no business carrying a real number. Nothing under `workflow/` is exempt either: workflow prose is precisely where the 052 leak happened, so exempting it would reopen the exact hole this entity exists to close.

This spec document is therefore not exempt, and its Acceptance Criteria section does contain constructed must-block literals. The consequence is accepted and stated plainly: once the hook is live, re-editing those specific AC lines needs `--no-verify`. That is a rare, visible, one-line cost, and it is much cheaper than the alternative of exempting the directory where a real leak has already occurred once.

### Acceptance Criteria

Installation

- [ ] AC-1 — `scripts/hooks/pre-commit` is tracked and `git ls-files -s scripts/hooks/pre-commit` reports mode `100755`.
- [ ] AC-2 — In a fresh clone, `npm install` at the repo root makes `git config --get core.hooksPath` return exactly `scripts/hooks`.
- [ ] AC-3 — The same holds for `npm install` run only in `app/`, and for `npm install` run only in `functions/`.
- [ ] AC-4 — In a fresh clone after any one of those three installs, `git commit` of a file adding the line `phone 0912345678` exits non-zero and creates no commit.
- [ ] AC-5 — `git worktree add` from a configured checkout, with **no** `npm install` and no `node_modules` in the worktree, blocks that same commit. (This is the criterion Husky fails.)
- [ ] AC-6 — The hook fires when `git commit` is run from the `app/` and `functions/` subdirectories, not only from the repo root.
- [ ] AC-7 — `node scripts/install-hooks.js` is idempotent across repeated runs, and exits 0 without error when run outside a git checkout.

Detection

- [ ] AC-8 — Each of `0912345678`, `0987654321`, `0912-345-678`, `0912 345 678` is blocked when added.
- [ ] AC-9 — Each of `+886912345678`, `+886-912-345-678`, `886912345678` is blocked when added.
- [ ] AC-10 — Each of `real.person@gmail.com`, `someone.real@company.com.tw`, `a.b+tag@outlook.com` is blocked when added.
- [ ] AC-11 — None of the allowlisted values in D2 is blocked: the five `@example.com` addresses, a `.gserviceaccount.com` address, a `TODO_`-prefixed address, `your-email@gmail.com`.
- [ ] AC-12 — `0900000001` and `0900000002` are not blocked; `0900010001` (outside the reserved block) is blocked.
- [ ] AC-13 — Scanning every tracked text file (excluding `package-lock.json`, `.next/`, `node_modules/`) reports no match anywhere under `app/`, `functions/`, `docs/`, or the repo root.
- [ ] AC-14 — A blocked commit prints, to stderr, the file path, the line number, the match kind, and the matched value, and exits 1.
- [ ] AC-15 — A commit with no matches exits 0 and prints nothing to stderr.

Override

- [ ] AC-16 — `git commit --no-verify` succeeds on content that AC-4 blocks.
- [ ] AC-17 — A line carrying a trailing `// pii-allow` comment alongside `0912345678` is still blocked, confirming no inline suppression is honored.

Edge cases

- [ ] AC-18 — A staged change that only *deletes* lines containing a real phone number or email exits 0.
- [ ] AC-19 — A commit staging only a binary file whose bytes contain `0912345678` and `real.person@gmail.com` exits 0, and the hook reports the count of binary files it skipped.
- [ ] AC-20 — A staged diff of 60,000 added lines completes in under 2 seconds.
- [ ] AC-21 — The scan skips exactly these and nothing else: `package-lock.json`, any path under `scripts/hooks/test/`, and any file git reports as binary.

Self-reference (D4)

- [ ] AC-22 — A file under `scripts/hooks/test/` containing the AC-8 and AC-10 literals commits cleanly with no override.
- [ ] AC-23 — The same literals added to `scripts/hooks/pre-commit` itself, or to any file under `workflow/`, are still blocked — proving the exemption is one path prefix, not the whole hooks tree.
- [ ] AC-24 — The build stage can commit the hook together with its full test suite in one commit, without `--no-verify`.

### Edge Cases

- **A commit that only removes PII.** Never blocked. The hook scans only `+` lines of `git diff --cached`, so redacting or deleting a leaked value is always permitted. Blocking it would make the repo harder to clean up than to dirty, and would have blocked the redaction commits this session already needed.
- **Existing PII already in history.** Also never blocked, for the same reason — an unrelated edit to a file that already contains a real number does not trip the hook, because that line is not an addition. This is what keeps the known `workflow/_archive` leak (see Findings) from blocking every future workflow commit.
- **Binary files.** Skipped, and the skip is *reported* rather than silent, so the gap is visible. Scanning binary yields unusable line numbers and coincidental matches. This is a real, accepted gap: a binary blob containing a real phone number commits cleanly. Personal image content is already handled separately — `feedback-screenshots/` is gitignored.
- **Very large diffs.** Not a concern in practice: 60,000 added lines scan in ~0.17s, so the hook is imperceptible on any realistic commit. `package-lock.json` is skipped anyway, since it is both the largest churn source and a known producer of coincidental digit matches inside integrity hashes.
- **Git run from a subdirectory.** Works. Git 2.40.1 resolves relative `core.hooksPath` from the working-tree top level, not the caller's cwd, so `git commit` from `app/` or `functions/` still finds the hook.
- **Fresh clone before any `npm install`.** Unprotected — git does not copy local config on clone, so `core.hooksPath` is unset until something sets it. This is inherent to git and cannot be closed from inside the repo. Accepted residual risk: the realistic path into this repo always runs `npm install`, and worktrees (the dominant case) inherit config and are protected with zero setup.
- **`npm install <package>`.** Does not run `prepare`, so a targeted dependency install does not re-assert the config. Harmless, because the config only needs to be set once per clone and any plain `npm install` or `npm ci` re-asserts it.
- **CJK content.** Files are read as UTF-8; the repo's Chinese-language fixtures and prose scan correctly.
- **The hook's own tests, and this spec.** The hook cannot scan its own test fixtures without blocking them. Resolved by the single `scripts/hooks/test/` path exemption in D4. This spec document is not exempt and does contain must-block literals in its AC section, so re-editing those specific lines after the hook goes live needs `--no-verify` — an accepted, deliberate cost.

### Out of Scope

- Scanning for secrets, API keys, or tokens — a related but separate concern. This entity is scoped to personal data, matching the two actual incidents.
- A maintained blocklist of specific known real values — deliberately rejected. Shape-based detection generalizes to numbers that have never leaked before; a list of known leaks does not, and the list itself would have to store the sensitive values.
- Retroactive scanning or rewriting of existing history. 051's fixtures were already scrubbed by history rewrite and 052's was accepted as residual risk. The one live exception found during this spec is reported under Findings for the captain to decide on separately — it is not this entity's work.
- CI or GitHub Action enforcement. Captain explicitly scoped this to the pre-commit hook only.
- Detecting other personal-data classes — national ID numbers, addresses, bank accounts, real names. Phone and email only, per the two incidents.
- Any change to what is gitignored, or to `feedback-screenshots/` handling.

### Findings

Flagged for the captain, outside this entity's scope. `workflow/_archive/051-subscription-backfill-historical.md:20` contains a real Taiwan mobile number — deliberately not restated here — and is tracked on `main` right now. The 051 history rewrite scrubbed the build fixtures under `functions/`, but the number sits in the entity's own ideation prose and survived, the same failure mode as the 052 incident. It is the single true positive the prototype scanner found across all 180 tracked text files.

This does not affect the hook's design: because only added lines are scanned, the line does not block future commits. Deciding whether to redact it (and whether that needs another history rewrite, given the remote is public) is a separate call for the captain.

## Stage Report: spec

- DONE: Write the formal spec using the Spec Template (Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope) from the ideation body
  `## Spec` section added above with all five template sections plus a Design Decisions block carrying the justifications the checklist asked for.
- DONE: Decide and specify the exact installation mechanism ... and confirm this actually works by testing a fresh clone/worktree checkout, not just the existing working directory
  Settled by experiment against real clones and worktrees, not inspection. Tracked `scripts/hooks/pre-commit` + relative `core.hooksPath` + `prepare` in all three package.json files. Husky tested and rejected: in a zero-setup worktree the Husky-style layout let a phone-number commit through, because `.husky/_` is gitignored and never checked out; the tracked-directory layout blocked the same commit with no `node_modules` present at all. Also measured: relative hooksPath resolves from the working-tree top level so subdirectory commits are covered; a fresh clone is unprotected until `npm install`; `npm install` inside a subpackage lacking `prepare` leaves the repo unprotected; `prepare` fires on cold/warm `npm install` and `npm ci` despite the root package.json having no `name`/`version`.
- DONE: Decide the exact regex/shape set and justify each against the two real incidents ... while NOT flagging the established safe patterns already in this repo — survey these first
  Surveyed first, then designed. Three regexes plus a five-rule allowlist, each rule tied to data actually present in the repo. Prototype run over all 180 tracked text files: zero false positives. Detection re-tested against 13 must-block strings (both 051 numbers, separator and `+886` variants, the 052-style emails) and 19 must-allow strings (the `@example.com` fixtures, `.gserviceaccount.com` identities, `TODO_`/`your-` placeholders, the `sub-17000000000NN` row IDs, a base64 integrity fragment) — all 32 correct. Dropping the digit lookarounds is the change that would break it: the `sub-1700000000021` and lockfile-hash cases start matching.
- DONE: Acceptance criteria must be binary/independently testable, covering [the six named areas]
  AC-1..AC-24, each a single observable outcome (exit code, exact config value, presence of a string in stderr). All six named areas covered: automatic install AC-2/3/4/5, staged-only scanning AC-18, blocked-with-file-and-match AC-14, clean commit unaffected AC-15, `--no-verify` AC-16, and the inline-suppression decision made explicit and testable as AC-17. AC-22/23/24 were added after running the prototype over the draft spec exposed a deadlock the checklist did not anticipate: the hook blocks its own test fixtures, so the build stage could not commit the tests proving the hook works. D4 resolves it with a single `scripts/hooks/test/` path prefix, and AC-23 pins the exemption narrow by requiring the same literals to stay blocked in `scripts/hooks/pre-commit` and under `workflow/`.
- DONE: Edge cases: binary or very large file; the worktree-based workflow; deletion-only commits; performance on a large diff
  All four decided against measurement, not judgement. Binary skipped-and-reported (verified in a scratch repo: a 300KB blob with a real-shaped number and a real-shaped email planted in its bytes commits cleanly at exit 0, with `grep -a` confirming the values genuinely were in those bytes — an honest, documented gap). Worktree confirmed protected with zero setup. Deletion-only confirmed exit 0 with the removed line visibly in the staged diff. Performance measured at 0.165s for 60,000 added lines, and a leak planted at line 60,001 was still caught in 0.161s — so the pass is not a scanner that quietly gave up on large input.
- DONE: Confirm scope boundary: no secrets/API-key scanning, no maintained list of known-sensitive values, no retroactive history scanning, no CI/GitHub Action enforcement
  All four carried into `### Out of Scope` verbatim in intent, with the reasoning preserved, plus two boundaries the ideation implied but did not state: no other PII classes (ID numbers, addresses, real names) and no gitignore changes.

### Summary

The spec is settled by experiment rather than assumption on all three load-bearing decisions. The significant finding is that Husky — the obvious choice, and the one the ideation leaned toward — fails open in exactly this repo's dominant case: an ensign's fresh worktree, where `.husky/_` is gitignored and git therefore finds no hook and commits silently. A tracked hook directory with a relative `core.hooksPath` protects zero-setup worktrees with no `node_modules` at all, so the spec goes that way. The regex set was validated against the repo's real corpus before being committed to: 180 tracked text files, zero false positives, and the existing `0900000001`/`0900000002` fixtures and 15+ `.gserviceaccount.com` addresses needed explicit carve-outs that a naive regex would have blocked.

One process note worth recording: the first draft of this spec quoted the real 051 numbers and the captain's real email as AC test values, and the prototype scanner caught them when run over the draft before commit. That is a third instance of the same mistake, made while specifying the fix for it, and it is the strongest available argument that this hook needs to exist. All such values are now constructed stand-ins.

Two items need the captain's attention. First, `workflow/_archive/051-subscription-backfill-historical.md:20` still carries a real phone number on `main` today — the 051 rewrite missed it, and it was the prototype's sole true positive. Second, a fresh clone is unprotected until someone runs `npm install`; that gap is inherent to git not copying local config on clone and cannot be closed from inside the repo, so the spec accepts it explicitly rather than papering over it.
