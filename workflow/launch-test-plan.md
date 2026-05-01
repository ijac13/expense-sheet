---
id: "025"
title: Launch Test Plan — Staging to Production
status: build
source: captain plan
started: 2026-04-29
completed:
verdict:
score: 1.0
worktree:
issue:
pr:
---

Structured rollout from staging validation through production migration, replacing the existing expense app.

**Revised sequence (2026-05-01):** Current project (`expense-sheet-b2db8`) is production. Staging project to be created later for Phase 4. Phase 2 reframed accordingly.

**Current phase: Phase 3 — Parallel Run**

## Phase 1 — Staging UAT (both users)

**Goal:** Confirm core flows work for both household members before touching production.

- [x] Both users can sign in with Google on staging
- [x] Unauthorized email shows "Access Denied" (test with a third Google account)
- [x] Submit an expense — appears in Google Sheets within seconds
- [x] Edit and delete an expense from History
- [x] Add a subscription — appears in Subscriptions tab
- [x] Cancel a subscription
- [x] Reports show correct totals and correct user names (not "user1"/"user2")
- [x] Date stepper on home page increments and decrements correctly
- [x] Category selection, note modal, payer assignment all work
- [x] Auto sign-out triggers after 1 minute of inactivity
- [x] Sign out button in Settings works

**Pass criteria:** Both users complete the checklist above with no blocking issues.

### Phase 1 測試清單 — Wei（繁體中文）

**目標：** 確認兩位使用者在正式上線前，核心功能都能正常運作。

- [x] 使用 Google 帳號登入 staging 環境
- [x] 輸入一筆消費 — 確認幾秒內出現在 Google 試算表
- [x] 在「紀錄」頁面編輯一筆消費，再刪除它
- [x] 新增一筆訂閱 — 確認出現在「訂閱」頁面
- [x] 取消一筆訂閱
- [x] 查看「報表」— 確認金額正確、顯示真實姓名（不是「user1」/「user2」）
- [x] 首頁日期左右切換，確認日期正確遞增遞減
- [x] 選擇類別、新增備註、切換付款人，功能正常
- [x] 閒置超過 1 分鐘後自動登出
- [x so, do we have a plan for this GCP billing things?] 在「設定」頁面手動登出正常

**通過標準：** 以上所有項目測試通過，無重大問題。

---

## Phase 2 — Production Setup ✓

**Goal:** Current project declared as production, test data cleared, sheets renamed.

- [x] `expense-sheet-b2db8` declared as production project (no new project needed)
- [x] Production spreadsheet cleaned of all Phase 1 test data
- [x] Production spreadsheet renamed to reflect prod status
- [x] New Google Sheet created with correct tab structure (Expenses, Users, Subscriptions, Categories) — reserved for staging
- [x] Firebase Functions already deployed on production project
- [x] Both users authorized (confirmed in Phase 1)
- [x] App live at production hosting URL

**Pass criteria met.** ✓

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
