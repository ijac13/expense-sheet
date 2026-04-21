---
id: "006"
title: Auth and Multi-User
status: build
source: commission seed
started: 2026-04-21T02:00:00Z
completed:
verdict:
score: 0.9
worktree: feature/006-auth-and-multi-user
issue:
pr:
---

Both my husband and I need to log expenses independently on our own phones and see each other's entries. Sign in with Google. Access controlled by whether your email is in the Users sheet. All authorized users see all expenses. Every expense has a "paid by" field so we know who actually spent the money — important for the reports to make sense.

## User Stories

- As a user, I want to sign in with my Google account so I don't need to manage a separate password
- As a user, I want to be automatically signed out after inactivity so my financial data is protected on a shared or unattended phone
- As a user, I want to see my husband's expenses and have him see mine so we have a shared view of household spending
- As an unauthorized user, I want to be blocked from accessing the app so our private data stays private

## Success

- Sign in with Google works on mobile browser in iOS and Andriod
- Only emails listed in the Users tab can access the app — any other Google account is rejected after sign-in
- Session auto-expires after 1 minute of inactivity
- Reports screen requires Google re-authentication before loading
- Both users see all expenses, categories, and subscriptions and users
- Each expense records `created_by` (who logged it) and `paid_by` (who paid) — these can be different people, but by default they will be the same person.
- User management is visible in Settings → User management (view only — adding/removing users is done directly in the Users tab) 

### Out of Scope

- Registering new users from within the app — done by editing the Users tab directly in Google Sheets
- Role-based permissions — all authorized users have equal access
- Sharing with more than 2 users — exactly 2 users, no temporary or guest access
- Password-based login — Google Sign-In only

## Plan

### Sign-In Flow

1. App loads → check Firebase Auth session
2. If no session → show sign-in screen with "Sign in with Google" button
3. After Google sign-in → Firebase Auth returns the user's email
4. Firebase Function checks the email against the Users tab
5. If email found → allow access, load the app
6. If email not found → sign out immediately, show "This account isn't authorized"

### Session Management

- Firebase Auth tokens expire after 1 hour — not extended
- App tracks last activity timestamp in memory (not localStorage)
- After 1 minute of inactivity → auto sign-out, redirect to sign-in screen
- Activity = any tap or navigation event

### Re-auth for Reports

Before the Reports screen loads (once per session), trigger a Google re-authentication prompt. If the user completes it, proceed. If cancelled, stay on previous screen. Re-auth is not required again until the session ends.

### User Management Screen (Settings)

Read-only view of who has access:
- List of emails from the Users tab with display names
- No add/remove UI — users are managed directly in the Google Sheet

### Users Tab

Defined in `project-setup.md`. The captain adds/removes users by editing this tab directly. The app reads it on every auth check.

## Open Questions

All resolved.

## Spec

### Goal

Enable two household users to sign in with Google and access a shared expense tracker on mobile, with access gated by a Users tab in Google Sheets and automatic session expiry after inactivity.

### User Stories

- As a user, I want to sign in with my Google account so I do not need to manage a separate password.
- As a user, I want to be automatically signed out after 1 minute of inactivity so my financial data is protected if I leave my phone unattended.
- As a user, I want to see all expenses regardless of who logged them so my husband and I have a complete shared view of household spending.
- As an unauthorized user, I want to see a clear rejection message after attempting sign-in so I understand why I cannot access the app.

### Acceptance Criteria

- [ ] Google Sign-In button appears on the sign-in screen and initiates the Google OAuth flow.
- [ ] Sign-in works on mobile browser on iOS and Android.
- [ ] After Google sign-in, the app checks the signed-in email against the Users tab in Google Sheets.
- [ ] If the email is found in the Users tab, the user is granted access and the app loads.
- [ ] If the email is not found in the Users tab, the user is signed out immediately and sees the message "This account isn't authorized".
- [ ] A timer resets on every tap or navigation event; after 1 minute of inactivity the user is signed out and redirected to the sign-in screen.
- [ ] The inactivity timer is stored in memory only — it does not persist across page loads or tabs.
- [ ] Firebase Auth tokens expire after 1 hour and are not extended.
- [ ] Before the Reports screen loads for the first time in a session, the app triggers a Google re-authentication prompt.
- [ ] If re-authentication is completed, the Reports screen loads; if cancelled, the user remains on the previous screen.
- [ ] Re-authentication is required only once per session — subsequent opens of Reports do not prompt again.
- [ ] Both users see all expenses, categories, subscriptions, and the user list.
- [ ] Every expense stores `created_by` (the logged-in user at time of entry) and `paid_by` (defaults to `created_by` but is editable).
- [ ] Settings → User Management displays a read-only list of emails and display names from the Users tab.
- [ ] Settings → User Management has no add or remove controls.

### Edge Cases

- User signs in with a valid Google account whose email is not in the Users tab: the user is signed out immediately after OAuth completes and sees "This account isn't authorized". No app data is accessible.
- Session expires while the user has an unsaved form open: the user is redirected to sign-in; in-progress form data is lost (not persisted).
- Re-authentication is cancelled on the Reports screen: the app stays on whichever screen the user was on before navigating to Reports; no report data is loaded.
- Both users are signed in simultaneously on different devices: each has an independent session; both see all shared data; one user's session expiry does not affect the other.

### Out of Scope

- Registering or inviting users from within the app — users are added or removed by editing the Users tab directly in Google Sheets.
- Role-based permissions — all authorized users have identical access.
- More than 2 users, guest access, or temporary access.
- Password-based or email-link login — Google Sign-In only.

## Stage Report: spec

Spec written from approved ideation content and key decisions. All acceptance criteria are binary and independently testable. Edge cases cover the four scenarios identified in the brief. No changes made to ideation content.
