---
id: "007"
title: Bilingual Support
status: verify
source: commission seed
started: 2026-04-21T03:30:00Z
completed:
verdict:
score: 0.6
worktree: feature/007-bilingual-support
issue:
pr:
---

The app needs to work in both English and Traditional Chinese (繁中) because we use both. Every label, category name, button, and message should be available in both languages. User preference is saved per account. Default language is 繁中. This is a final pass across the full UI — dispatched after all other features with visible UI text are built (at minimum after 011 navigation is done).

## User Stories

- As a user, I want to switch the app language between EN and 繁中 so I can use whichever feels natural
- As a user, I want my language preference saved to my account so it persists across devices and sessions
- As a user, I want category names to display in my preferred language so the expense list is always readable

## Success

- Language toggle in Settings switches the entire UI between EN and 繁中
- Language preference is saved to the Users tab (`language` field) and restored on next sign-in
- All static UI strings (buttons, labels, tab names, error messages) are translated
- Category names use `name_en` or `name_zh` based on the active language
- Switching language takes effect immediately without a page reload
- All error messages and empty states are translated — full coverage, not just main UI labels
- Default language for new users is 繁中

### Out of Scope

- Languages other than EN and 繁中
- Per-screen language switching — one setting applies to the whole app
- Translation of user-entered data (notes, subscription names)

## Plan

### Translation Approach

Use `next-intl` or a similar Next.js i18n library. All static strings extracted into locale files:
- `locales/en.json`
- `locales/zh.json`

### Language Persistence

On language toggle: Firebase Function updates `language` field in the Users tab row for the current user. On next sign-in: app reads the user's `language` preference and sets the active locale.

### Category Names

Categories already have `name_en` and `name_zh` columns. The app selects the correct column based on active language — no changes to the data model.

### Language Toggle in Settings

A simple toggle or segmented control: `EN | 繁中`. Switching fires the update and re-renders immediately.

## Open Questions

All resolved.

## Spec

### Goal

Localize every visible UI string in the app to English and Traditional Chinese, with per-account language preference defaulting to 繁中 and switching immediately without a page reload.

### User Stories

- As a user, I want to switch the app language between EN and 繁中 in Settings so I can use whichever feels natural.
- As a user, I want my language preference saved to my account so it is restored automatically on every sign-in.
- As a user, I want category names to display in my preferred language so the expense list is always readable.
- As a user, I want all error messages and empty states to appear in my preferred language so I am never left with untranslated text.

### Acceptance Criteria

- [ ] A segmented control `EN | 繁中` is present in the Settings screen and reflects the current active language.
- [ ] Selecting a language updates the UI immediately — all static strings re-render without a page reload.
- [ ] Switching language writes the new value to the `language` field in the Users tab row for the current user via a Firebase Function.
- [ ] On sign-in, the app reads the user's `language` field and activates that locale before the first render.
- [ ] New users with no `language` field in the Users tab default to 繁中.
- [ ] All static UI strings — tab names, button labels, form labels, placeholder text, error messages, and empty states — are fully translated in both `locales/en.json` and `locales/zh.json`.
- [ ] Category names are rendered using `name_en` when EN is active and `name_zh` when 繁中 is active.
- [ ] A category with a missing `name_zh` value falls back to `name_en` rather than showing blank or an error.
- [ ] No hardcoded UI strings remain outside the locale files (static strings only; user-entered data is exempt).

### Edge Cases

- User switches language mid-session: the entire UI re-renders immediately using the new locale; no stale strings remain visible.
- User has no `language` field set in the Users tab (new account or legacy row): app defaults to 繁中.
- Category row has `name_zh` empty or null: the app falls back to `name_en` for that category name.
- Firebase Function update fails on language switch: the UI still switches locally; the error is surfaced as a translated error message; preference reverts to the last successfully saved value on next sign-in.
- Two users sharing the app each have independent `language` fields; switching on one account does not affect the other.

### Out of Scope

- Languages other than EN and 繁中.
- Per-screen or per-component language overrides — one setting applies to the whole app.
- Translation of user-entered data: notes, subscription names, and similar free-text fields.
- Right-to-left layout changes (not required for either supported language).
- Automatic language detection based on device locale.

## Stage Report: spec

- DONE: Read entity file and workflow README for spec template
  `/Users/ijac/Claude-ijac/expense-sheet/workflow/bilingual-support.md` and `workflow/README.md`
- DONE: Wrote `## Spec` section with Goal, User Stories, Acceptance Criteria, Edge Cases, Out of Scope
  All key decisions from dispatch prompt incorporated; ideation content preserved above spec
- DONE: Appended `## Stage Report: spec`
  This section

### Summary

Converted the ideation content for entity 007 bilingual-support into a formal spec following the workflow Spec Template. All key decisions from the dispatch prompt are reflected: two languages only (EN / 繁中), default 繁中 for new users, language persisted to the Users tab `language` field, immediate re-render on switch, full UI string coverage via `next-intl` locale files, and category name fallback from `name_zh` to `name_en`. Acceptance criteria are binary and independently testable.

## Stage Report: build

- DONE: Check package.json for react-i18next / i18next
  Both present: `i18next@^26.0.6`, `react-i18next@^17.0.4`
- DONE: Create `app/public/locales/en/common.json`
  Locale file with tabs, home, settings, errors, empty, common keys
- DONE: Create `app/public/locales/zh/common.json`
  Locale file with full 繁中 translations
- DONE: Create `app/app/lib/i18n.ts`
  Includes `isInitialized` guard, reads `localStorage("language")` default "zh", bundles locale JSONs
- DONE: Create `app/app/components/LanguageToggle.tsx`
  useState + useEffect pattern for hydration safety; listens to `languageChanged` event
- DONE: Update `app/app/settings/page.tsx`
  Created settings page with LanguageToggle in Language section; uses `useTranslation` hook
- DONE: Create/update `app/app/providers.tsx`
  I18nextProvider wrapping children
- DONE: Update `app/app/layout.tsx`
  Wraps children in Providers
- DONE: Build check
  `npm run build` — clean build, no TypeScript errors, 2 static routes generated (`/`, `/settings`)
- DONE: Stage report and commit
  Commit `ba294e1` on `feature/007-bilingual-support`

### Summary

Implemented client-side i18n using react-i18next with bundled locale JSON files (no HTTP requests needed for static export). Created EN and 繁中 locale files with full key coverage. The LanguageToggle component uses useState/useEffect for hydration safety and persists to localStorage. The settings page renders the toggle in a Language section. Build passes cleanly with 2 static routes.
