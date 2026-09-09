// Run with: npm run build && node --test test/
//
// Entity 066 — backfill ijac's real Jan-Apr 2026 expenses from her own `smoney`
// ledger export. Fixtures reproduce the shapes the spec found live: an income
// row sharing a date with an expense row, two rows sharing a date disambiguated
// only by their own sheet row, and the two categories needing the captain's
// explicit ruling (房客, 進修).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { makeSheets } = require("./sheetsStub");
const { MIGRATION066_TAB, MIGRATION066_GID } = require("../scripts/migration-env");

const extract = require("../scripts/extract-migration066-expenses.js");
const {
  ExtractError,
  CATEGORY_MAP066,
  WINDOW_START,
  WINDOW_END,
  RECORDED,
  extract: extractCore,
  checkHeaders,
  sheetGridFor,
  parseSheetGrid,
  carryForward,
  verifyTabIdentity,
} = extract;

const importer = require("../scripts/import-migration066-expenses.js");
const {
  ID_PREFIX,
  ACTOR,
  ImportError,
  planImport,
  resolveCategoryNamesZh,
  run,
} = importer;

const FIXTURE_GRID = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "migration066-sample.json"), "utf8"));

function cloneGrid(grid) {
  return grid.map((row) => row.slice());
}

// ---------------------------------------------------------------------------
// AC-3 — income excluded, duplicate-date disambiguated by source row, out-of-window skipped
// ---------------------------------------------------------------------------

test("AC-3: the fixture's 4 in-window 支出 rows land, the 收入 row is reported and excluded, out-of-window rows are ignored", () => {
  const result = extractCore(FIXTURE_GRID);
  assert.equal(result.candidates.length, 4);
  assert.deepEqual(result.candidates.map((c) => c.key).sort(), ["exp-mig066-r2", "exp-mig066-r3", "exp-mig066-r7", "exp-mig066-r8"]);
  assert.equal(result.inWindow.income, 1);
  assert.equal(result.incomeRowsInWindow[0].sourceRow, 4);
  assert.equal(result.rowCount, 7, "every non-blank row counted, including the 2 out-of-window ones");
  assert.equal(result.dateRange.min, "2025-12-31");
  assert.equal(result.dateRange.max, "2026-05-02");
});

test("AC-3: an unrecognised 分類 value refuses rather than being silently imported as an expense", () => {
  const grid = cloneGrid(FIXTURE_GRID);
  grid[3][1] = "退款"; // neither 支出 nor 收入 — a real third value must not fall through to "expense"
  assert.throws(() => extractCore(grid), ExtractError);
});

// ---------------------------------------------------------------------------
// AC-4 — the captain's ruling, and refusal on any unmapped category
// ---------------------------------------------------------------------------

test("AC-4: 房客 resolves to 房客支出 and 進修 resolves to 學費, per the captain's ruling — never the source's own label", () => {
  const result = extractCore(FIXTURE_GRID);
  const tenant = result.candidates.find((c) => c.key === "exp-mig066-r7");
  const study = result.candidates.find((c) => c.key === "exp-mig066-r8");
  assert.equal(tenant.category_name_zh, "房客支出");
  assert.equal(study.category_name_zh, "學費");
});

test("AC-4: an unmapped 次分類 refuses the WHOLE run, naming every gap, and writes no candidate", () => {
  const grid = cloneGrid(FIXTURE_GRID);
  grid[1][3] = "陌生分類A"; // sourceRow 2
  grid[6][3] = "陌生分類B"; // sourceRow 7
  assert.throws(
    () => extractCore(grid),
    (e) => e instanceof ExtractError && e.message.includes("陌生分類A") && e.message.includes("陌生分類B")
  );
});

test("AC-4: CATEGORY_MAP066 covers every 次分類 the fixture and the spec's own recorded list use", () => {
  for (const name of ["食材", "外食", "日用品", "交通", "旅遊", "寶貝", "衣服", "運動", "醫療", "數位", "禮物", "其他", "學費", "娛樂", "加油", "過路", "房客", "進修"]) {
    assert.ok(CATEGORY_MAP066.has(name), `missing mapping for ${name}`);
  }
});

// ---------------------------------------------------------------------------
// AC-5 — id scheme: the source's own row number, never a run-order counter
// ---------------------------------------------------------------------------

test("AC-5: ids are exp-mig066-r{sourceRow}, deterministic across repeated runs, and disjoint from every other entity's prefix", () => {
  const a = extractCore(FIXTURE_GRID);
  const b = extractCore(FIXTURE_GRID);
  assert.deepEqual(a.candidates.map((c) => c.key), b.candidates.map((c) => c.key));
  for (const c of a.candidates) {
    assert.match(c.key, /^exp-mig066-r\d+$/);
    assert.ok(!c.key.startsWith("exp-hist-"));
    assert.ok(!c.key.startsWith("exp-sub065-"));
    assert.ok(!c.key.startsWith("exp-auto-"));
  }
});

test("AC-5: ids are derived from the sheet's OWN row number, not a run-order counter — inserting a row ahead of it shifts its id accordingly", () => {
  const withExtra = cloneGrid(FIXTURE_GRID);
  withExtra.splice(1, 0, ["2025-06-01", "支出", "飲食", "食材", 100, "TWD", "2025-06-01", "padding row, out of window"]);
  const result = extractCore(withExtra);
  // The 食材 row that was sourceRow 2 is now sourceRow 3 (shifted by the insert) —
  // a run-order counter would instead keep minting r2 here, colliding with the
  // id a prior run already wrote for the DIFFERENT transaction that used to be
  // at that position. Deriving from the sheet's own row number avoids that.
  assert.ok(result.candidates.some((c) => c.key === "exp-mig066-r3"));
  assert.ok(!result.candidates.some((c) => c.key === "exp-mig066-r2"), "no candidate wrongly keeps the pre-insert row number");
});

// ---------------------------------------------------------------------------
// AC-9 — header check and tab-identity (title + gid) verification
// ---------------------------------------------------------------------------

test("AC-9: a header mismatch refuses rather than guessing column positions", () => {
  const grid = cloneGrid(FIXTURE_GRID);
  grid[0] = ["記帳日期", "分類", "主分類", "次分類", "金額", "更新日期", "備註"]; // dropped 幣別 — schema drift
  assert.throws(() => extractCore(grid), ExtractError);
});

test("AC-9: checkHeaders reports MATCH only for the exact confirmed 8 headers, in order", () => {
  assert.equal(checkHeaders(FIXTURE_GRID[0]).ok, true);
  assert.equal(checkHeaders(["記帳日期", "分類"]).ok, false);
});

test("AC-9: verifyTabIdentity accepts a tab whose title AND gid both match the confirmed values", async () => {
  const sheets = { spreadsheets: { get: async () => ({ data: { sheets: [{ properties: { title: MIGRATION066_TAB, sheetId: MIGRATION066_GID } }] } }) } };
  await assert.doesNotReject(verifyTabIdentity(sheets));
});

test('AC-9: verifyTabIdentity refuses a tab with the confirmed title whose gid does not match — a reorder/rename would otherwise read silently wrong data (this is the exact live shape Dispatch Retry 1 found: a "migrate"-named tab existed with a DIFFERENT gid, holding the out-of-scope 2025 block instead)', async () => {
  const sheets = {
    spreadsheets: {
      get: async () => ({
        data: {
          sheets: [
            { properties: { title: MIGRATION066_TAB, sheetId: 999 } },
            { properties: { title: "migrate", sheetId: MIGRATION066_GID } },
          ],
        },
      }),
    },
  };
  await assert.rejects(verifyTabIdentity(sheets), ExtractError);
});

// ---------------------------------------------------------------------------
// AC-10 — 備註 preserved byte-for-byte
// ---------------------------------------------------------------------------

test("AC-10: 備註 is preserved byte-for-byte — trailing whitespace, full-width punctuation, and an embedded name all survive unmodified", () => {
  const result = extractCore(FIXTURE_GRID);
  const r2 = result.candidates.find((c) => c.key === "exp-mig066-r2");
  const r3 = result.candidates.find((c) => c.key === "exp-mig066-r3");
  const r8 = result.candidates.find((c) => c.key === "exp-mig066-r8");
  assert.equal(r2.notes, "早餐食材  ");
  assert.equal(r3.notes, "午餐，和同事");
  assert.equal(r8.notes, "線上課程 Aiden 陪同");
});

// ---------------------------------------------------------------------------
// AC-2 (offline half) — the recorded figures this entity's spec pinned
// ---------------------------------------------------------------------------

test("AC-2: RECORDED matches the spec's own characterization, so a build re-read has something fixed to compare against", () => {
  assert.deepEqual(RECORDED, { rowCount: 310, dateMin: "2025-09-29", dateMax: "2026-05-02", inWindowExpense: 203, inWindowIncome: 1 });
});

// ---------------------------------------------------------------------------
// Normalization sheet round-trip and carry-forward
// ---------------------------------------------------------------------------

test("normalization sheet: generate -> parse round-trips every row, and a hand-edited category survives a re-generate while a source-changed conflict is reported, not silently overwritten", () => {
  const fresh = extractCore(FIXTURE_GRID).candidates;
  const { grid } = sheetGridFor(fresh, "2026-09-08T00:00:00.000Z");
  const parsed = parseSheetGrid(grid);
  assert.equal(parsed.rows.length, fresh.length);
  assert.deepEqual(parsed.rows.map((r) => r.key).sort(), fresh.map((r) => r.key).sort());

  // The captain hand-corrects one row's category on the prior generation.
  const prior = parsed.rows.map((r) => ({ ...r }));
  const edited = prior.find((r) => r.key === "exp-mig066-r7");
  edited.category_name_zh = "其他"; // she overrides the captain's own default ruling

  const reGenerated = extractCore(FIXTURE_GRID).candidates; // identical source -> identical gen_ shadow
  const cf = carryForward(reGenerated, prior);
  assert.equal(cf.conflicts.length, 0);
  const carriedRow = cf.rows.find((r) => r.key === "exp-mig066-r7");
  assert.equal(carriedRow.category_name_zh, "其他", "the hand edit survives the re-generate");

  // Now the SOURCE itself changes for that same row — a genuine conflict.
  const changedSource = cloneGrid(FIXTURE_GRID);
  changedSource[6][4] = 5000; // amount changed at the source after her edit
  const reGeneratedChanged = extractCore(changedSource).candidates;
  const cf2 = carryForward(reGeneratedChanged, prior);
  assert.equal(cf2.conflicts.length, 0, "only the category was hand-edited; the amount was not, so no conflict on category");
});

// ---------------------------------------------------------------------------
// AC-11 — importer refuses without --target
// ---------------------------------------------------------------------------

test("AC-11: refuses without an explicit --target, before any read", async () => {
  await assert.rejects(run(["--dry-run", "--from-sheet", "x"], { log: () => {}, env: {} }));
});

// ---------------------------------------------------------------------------
// planImport — accounting for every excluded row
// ---------------------------------------------------------------------------

test("planImport: excludes orphaned/exclude-status/out-of-window rows, and the counts add up to the sheet's own row count", () => {
  const rows = [
    { key: "exp-mig066-r2", date: "2026-01-05", amount: "500", category_name_zh: "食材", notes: "a", status: "include" },
    { key: "exp-mig066-r3", date: "2026-01-05", amount: "300", category_name_zh: "外食", notes: "b", status: "exclude" },
    { key: "exp-mig066-r9", date: "2026-06-01", amount: "100", category_name_zh: "食材", notes: "c", status: "orphaned" },
    { key: "exp-mig066-r10", date: "2025-12-01", amount: "100", category_name_zh: "食材", notes: "d", status: "include" }, // out of window
  ];
  const plan = planImport(rows);
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.excluded.excludeStatus.length, 1);
  assert.equal(plan.excluded.orphaned.length, 1);
  assert.equal(plan.excluded.outOfWindow.length, 1);
  assert.equal(plan.sheetRowCount, 4);
});

// ---------------------------------------------------------------------------
// Category resolution against name_zh (never name_en)
// ---------------------------------------------------------------------------

test("resolveCategoryNamesZh: resolves by name_zh exact match; an unresolved name is reported, never fuzzy-matched", () => {
  const live = [{ id: "cat_001", name_zh: "食材" }, { id: "cat_023", name_zh: "房客支出" }];
  const r = resolveCategoryNamesZh(["食材", "房客支出", "沒有這個"], live);
  assert.equal(r.resolved.get("食材"), "cat_001");
  assert.equal(r.resolved.get("房客支出"), "cat_023");
  assert.deepEqual(r.unresolved, ["沒有這個"]);
});

// ---------------------------------------------------------------------------
// Full live-shaped importer cycle: dry-run / approval gate / apply / re-apply / undo,
// with decoys under every other entity's id family (AC-1, AC-6, AC-7, AC-8, AC-9)
// ---------------------------------------------------------------------------

const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];
const CATEGORIES_HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active"];

const HIST_DECOY = ["exp-hist-2023-0001", "2023-03-01", "999", "cat_099", "user1", "user1", "decoy", "2023-03-01T00:00:00.000Z"];
const SUB065_DECOY = ["exp-sub065-sub-1788759015607-2026-03-01", "2026-03-01", "150", "cat_006", "wei", "wei", "", "2026-03-01T00:00:00.000Z"];
const AUTO_DECOY = ["exp-auto-sub-x-2026-01-01", "2026-01-01", "99", "cat_006", "ijac", "ijac", "sub", "2026-01-01T00:00:00.000Z"];
const PLAIN_DECOY = ["exp-1690000000000", "2026-04-15", "888", "cat_099", "wei", "wei", "unrelated", "2026-04-15T00:00:00.000Z"];
const DECOYS = [HIST_DECOY, SUB065_DECOY, AUTO_DECOY, PLAIN_DECOY];

const CATEGORY_ROWS = [
  ["cat_001", "Groceries", "食材", "food", "1", "true"],
  ["cat_002", "Eating Out", "外食", "food", "2", "true"],
  ["cat_023", "Tenant Expense", "房客支出", "home", "23", "true"],
  ["cat_012", "Tuition", "學費", "school", "12", "true"],
];

const APPROVED_ROWS = extractCore(FIXTURE_GRID).candidates;

function normalizationGrid(rows, { approved = true } = {}) {
  const { grid } = sheetGridFor(rows, "2026-09-08T00:00:00.000Z");
  grid[0][1] = approved ? "APPROVED" : "";
  return grid;
}

function fixtureEnv(pair) {
  return { SPREADSHEET_ID_STAGING: pair.spreadsheetId, GOOGLE_SERVICE_ACCOUNT_KEY_STAGING: "{}" };
}

test("apply refuses without B1=APPROVED, and writes nothing", async () => {
  const norm = normalizationGrid(APPROVED_ROWS, { approved: false });
  const f = makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: DECOYS.map((r) => r.slice()) },
    Categories: { header: CATEGORIES_HEADER, rows: CATEGORY_ROWS.map((r) => r.slice()) },
    Norm: { header: norm[0], rows: norm.slice(1) },
  });
  const sheetsFor = async () => f.sheets;
  const env = fixtureEnv({ spreadsheetId: "sheet-under-test" });
  await assert.rejects(
    run(["--target", "staging", "--from-sheet", "Norm", "--apply"], { log: () => {}, env, sheetsFor }),
    ImportError
  );
  const mutated = f.requests.some((r) => /^(UPDATECELLS|INSERT|DELETE)/.test(r) && r.includes("Expenses"));
  assert.ok(!mutated, "no write reached the Expenses tab");
});

test("AC-1 / AC-6 / AC-7 / AC-8 / AC-9: apply writes exactly the 4 candidates once, a second apply is a no-op, undo removes exactly this entity's rows, every decoy survives both, and no tab but Expenses is mutated", async () => {
  const norm = normalizationGrid(APPROVED_ROWS);
  const f = makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: DECOYS.map((r) => r.slice()) },
    Categories: { header: CATEGORIES_HEADER, rows: CATEGORY_ROWS.map((r) => r.slice()) },
    Norm: { header: norm[0], rows: norm.slice(1) },
  });
  const sheetsFor = async () => f.sheets;
  const env = fixtureEnv({ spreadsheetId: "sheet-under-test" });
  const before = f.grids.Expenses.map((r) => r.slice());

  const dry = await run(["--target", "staging", "--from-sheet", "Norm", "--dry-run"], { log: () => {}, env, sheetsFor });
  assert.equal(dry.wouldWrite, 4);

  const first = await run(["--target", "staging", "--from-sheet", "Norm", "--apply"], { log: () => {}, env, sheetsFor });
  assert.equal(first.created, 4);
  assert.equal(first.skipped, 0);
  assert.deepEqual(first.writtenIds.sort(), ["exp-mig066-r2", "exp-mig066-r3", "exp-mig066-r7", "exp-mig066-r8"]);

  for (const row of before.slice(1)) {
    const survivor = f.grids.Expenses.slice(1).find((r) => r[0] === row[0]);
    assert.deepEqual(survivor, row, `decoy ${row[0]} must be byte-identical after apply`);
  }

  // Notes preserved byte-for-byte end-to-end (AC-10), through the write path.
  const written = f.grids.Expenses.slice(1).find((r) => r[0] === "exp-mig066-r2");
  assert.equal(written[6], "早餐食材  ");
  assert.equal(written[4], ACTOR);
  assert.equal(written[5], ACTOR);

  const second = await run(["--target", "staging", "--from-sheet", "Norm", "--apply"], { log: () => {}, env, sheetsFor });
  assert.equal(second.created, 0, "every id already present");
  assert.equal(second.skipped, 4);

  const snapshotFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "mig066-")), "snapshot.json");
  const verify = await run(["--target", "staging", "--from-sheet", "Norm", "--verify", "--snapshot-file", snapshotFile], { log: () => {}, env, sheetsFor });
  assert.equal(verify.result.passed, true);

  const undo = await run(["--target", "staging", "--undo"], { log: () => {}, env, sheetsFor });
  assert.equal(undo.removed, 4);

  const survivingIds = f.grids.Expenses.slice(1).filter((r) => r[0]).map((r) => r[0]);
  assert.ok(!survivingIds.some((id) => id.startsWith(ID_PREFIX)), "no exp-mig066- row survives undo");
  for (const decoy of DECOYS) assert.ok(survivingIds.includes(decoy[0]), `${decoy[0]} must survive undo`);

  const mutatedTabs = new Set(
    f.requests
      .filter((r) => /^(UPDATECELLS|INSERT|DELETE)/.test(r))
      .map((r) => r.split(" ")[1])
  );
  assert.deepEqual(mutatedTabs, new Set(["Expenses"]), "AC-9: no writes beyond the target's Expenses tab");
});

test("category resolution refuses before any write when a mapped name_zh is missing from the target", async () => {
  const norm = normalizationGrid(APPROVED_ROWS);
  const f = makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: [] },
    Categories: { header: CATEGORIES_HEADER, rows: [CATEGORY_ROWS[0]] }, // missing 房客支出/學費/外食
    Norm: { header: norm[0], rows: norm.slice(1) },
  });
  const sheetsFor = async () => f.sheets;
  const env = fixtureEnv({ spreadsheetId: "sheet-under-test" });
  await assert.rejects(
    run(["--target", "staging", "--from-sheet", "Norm", "--dry-run"], { log: () => {}, env, sheetsFor }),
    ImportError
  );
});
