---
id: "007"
title: Bilingual Support
status: ideation
source: commission seed
started:
completed:
verdict:
score: 0.6
worktree:
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
