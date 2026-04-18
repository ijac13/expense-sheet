---
id: "001"
title: Project Setup
status: ideation
source: commission seed
started:
completed:
verdict:
score: 1.0
worktree:
issue:
pr:
---

Every other feature depends on this. The goal is a running skeleton: code deployed, auth working, data store structured — so every subsequent feature has a real environment to build and test against.

## Public/Private Separation

This project follows a strict three-layer separation:

| Layer | Where it lives | Public? |
|-------|---------------|---------|
| App code (Next.js, Firebase Functions) | GitHub repo (`ijac13/expense-sheet`) | ✓ Public |
| Credentials (Firebase config, Sheet ID, API keys) | `.env` file, gitignored | ✗ Private |
| Actual data (expenses, users, subscriptions) | Google Sheets (Google Drive) | ✗ Private |

Nothing sensitive should ever be committed. All credentials go in `.env`. The repo contains only code and `.env.example` with placeholder values.

## Data Store

One Google Spreadsheet with 4 tabs:

- **Expenses** — all expense records (one-time and auto-created from subscriptions). No year separation needed — Google Sheets handles 500,000+ rows per tab, and personal expense volume (even 20 years at 10/day) stays well under 150,000 rows.
- **Categories** — category definitions with emoji, English name, Chinese name, sort order
- **Subscriptions** — recurring expense templates with frequency and due date
- **Users** — authorized user accounts (email, name, language preference)

Schema for each tab is defined in `2026-02-17-expense-tracker-design.md`.

## What Needs to Be Set Up

The agent should produce the code structure and setup instructions. The human (Captain) executes the one-time manual steps:

**Agent delivers:**
- Initialized Next.js project with Firebase Functions folder layout
- `.env.example` listing every required variable with descriptions
- Google Sheet setup script or step-by-step instructions to create the 4 tabs with correct columns
- Firebase project configuration files (without real credentials)
- Deployment pipeline (Firebase Hosting + Functions)

**Captain does manually (once):**
- Create the Google Spreadsheet and set up the 4 tabs
- Create a Firebase project and enable Hosting, Functions, and Google Sign-In auth
- Copy `.env.example` to `.env` and fill in real values
- Share the Google Sheet with both user email addresses

## Stack Context

Captain is not familiar with Firebase or Next.js. The agent should:
- Reference `2026-02-17-expense-tracker-design.md` for the full stack and schema (review it before starting — some details may need revisiting)
- Keep setup instructions clear and step-by-step for the manual parts
- Explain what each piece does, not just how to run it

## Success

The project setup is done when:
- The app runs locally and deploys to Firebase Hosting
- Google Sign-In works for both users
- The Google Sheet is structured and accessible via the app
- No credentials or personal data are in the committed code
