---
id: "025"
title: Launch Test Plan — Staging to Production
status: ideation
source: captain plan
started:
completed:
verdict:
score: 1.0
worktree:
issue:
pr:
---

Structured rollout from staging validation through production migration, replacing the existing expense app.

## Phase 1 — Staging UAT (both users)

**Goal:** Confirm core flows work for both household members before touching production.

- [ ] Both users can sign in with Google on staging
- [ ] Unauthorized email shows "Access Denied" (test with a third Google account)
- [ ] Submit an expense — appears in Google Sheets within seconds
- [ ] Edit and delete an expense from History
- [ ] Add a subscription — appears in Subscriptions tab
- [ ] Cancel a subscription
- [ ] Reports show correct totals and correct user names (not "user1"/"user2")
- [ ] Date stepper on home page increments and decrements correctly
- [ ] Category selection, note modal, payer assignment all work
- [ ] Auto sign-out triggers after 1 minute of inactivity
- [ ] Sign out button in Settings works

**Pass criteria:** Both users complete the checklist above with no blocking issues.

### Phase 1 測試清單 — Wei（繁體中文）

**目標：** 確認兩位使用者在正式上線前，核心功能都能正常運作。

- [ ] 使用 Google 帳號登入 staging 環境
- [ ] 輸入一筆消費 — 確認幾秒內出現在 Google 試算表
- [ ] 在「紀錄」頁面編輯一筆消費，再刪除它
- [ ] 新增一筆訂閱 — 確認出現在「訂閱」頁面
- [ ] 取消一筆訂閱
- [ ] 查看「報表」— 確認金額正確、顯示真實姓名（不是「user1」/「user2」）
- [ ] 首頁日期左右切換，確認日期正確遞增遞減
- [ ] 選擇類別、新增備註、切換付款人，功能正常
- [ ] 閒置超過 1 分鐘後自動登出
- [ ] 在「設定」頁面手動登出正常

**通過標準：** 以上所有項目測試通過，無重大問題。

---

## Phase 2 — Production Setup

**Goal:** New Firebase project mirroring staging, ready for real data.

- [ ] New Firebase project created (name: expense-sheet or agreed name)
- [ ] Google Sheets spreadsheet created with correct tab structure (Expenses, Users, Subscriptions, Categories)
- [ ] Firebase Functions deployed with Sheets API wired to new spreadsheet
- [ ] Both user emails in the Users tab of the new sheet
- [ ] Google Auth enabled, both emails authorized
- [ ] App deployed to production hosting URL
- [ ] Both users can sign in on production

**Pass criteria:** Both users signed in on prod, submit one test expense each, confirm it appears in the prod sheet.

---

## Phase 3 — Parallel Run (1 week)

**Goal:** Validate that the new app captures everything the old app does, in parallel.

- [ ] Every expense entered in old app is also entered in new app same day
- [ ] At end of week: compare total count — new app row count matches old app row count for the period
- [ ] Spot-check 5 random entries: amount, category, date, payer all match
- [ ] No data loss incidents (missing rows, wrong amounts, duplicate submissions)
- [ ] Both users agree the UX is usable for daily entry

**Pass criteria:** 100% entry count match, zero data integrity issues, both users comfortable with daily use.

---

## Phase 4 — Data Migration (staging dry run)

**Goal:** Test migrating historical data from the old app into a staging sheet before doing it for real on prod.

- [ ] Entity 008 (data migration tool) is built and reviewed
- [ ] Export full history from old app
- [ ] Run migration into staging sheet
- [ ] Verify row count matches old app export
- [ ] Verify Reports totals on staging match known totals from old app
- [ ] Verify no duplicate entries from the parallel run period
- [ ] Edge cases pass: split expenses, multi-category, special characters in notes

**Pass criteria:** Staging sheet data matches old app export with zero discrepancies. Reports totals reconcile.

---

## Phase 5 — Production Migration and Cutover

**Goal:** Migrate historical data to prod and stop using the old app.

- [ ] Run same migration script against prod sheet (using staging dry run as reference)
- [ ] Verify prod row count and Reports totals match expectations
- [ ] Remove parallel-run duplicate entries from the prod sheet (entries entered in both apps during Phase 3)
- [ ] Both users confirm history looks correct in prod app
- [ ] Old app access revoked or archived (prevent accidental future entries)
- [ ] Announce cutover — prod is now the only app

**Pass criteria:** Prod data matches old app history + parallel run entries with no duplicates. Both users sign off.
