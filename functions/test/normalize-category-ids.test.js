// Run with: npm run build && node --test test/   (or npm test)
//
// Entity 054 — normalize category_id to the live cat_NNN scheme. Every test runs
// the real script against the Sheets stub, so the assertions land on the bytes in
// the grid and on the ranges actually addressed, not on the plan object alone.
//
// The script calls the app's own resolveCategory(), which ships as TypeScript, so
// the compiled module is built here rather than assumed present.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { execFileSync } = require("child_process");

const { makeSheets } = require("./sheetsStub");

const APP_DIR = path.resolve(__dirname, "..", "..", "app");
execFileSync("npm", ["--prefix", APP_DIR, "run", "build:lib"], { encoding: "utf8", stdio: "pipe" });

const {
  READONLY_SCOPE,
  WRITE_SCOPE,
  HaltError,
  VerificationError,
  loadResolveCategory,
  duplicateLiveNames,
  liveCategoriesFrom,
  planTab,
  planMigration,
  writeRanges,
  diffGrids,
  run,
} = require("../scripts/normalize-category-ids.js");

const { EXPENSES_SPEC, SUBSCRIPTIONS_SPEC } = require("../lib/sheetSchema");

const resolveCategory = loadResolveCategory();

// ---------------------------------------------------------------------------
// Production-shaped fixtures
// ---------------------------------------------------------------------------

// Column H is deliberately blank in the header, the shape production's Categories
// tab actually has (`notes` data under an unnamed header).
const CATEGORIES_HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", ""];

// cat_015 is archived — the bridge has to reach it anyway, or 156 `fuel` rows
// migrate to nothing. cat_099 exists in no DEFAULT_CATEGORIES entry, so it is
// only ever reachable as a live id.
const CATEGORY_ROWS = [
  ["cat_001", "Eating Out", "外食", "🍕", "1", "true", "restaurants_accommodation", "note A"],
  ["cat_003", "Groceries", "食材", "🥕", "3", "true", "food_beverage_tobacco", ""],
  ["cat_007", "Digital", "數位", "📱", "7", "true", "transport_communication", ""],
  ["cat_015", "Fuel", "加油", "🛢️", "15", "false", "transport_communication", ""],
  ["cat_020", "Donate", "捐款", "🤲", "20", "true", "miscellaneous", ""],
  ["cat_099", "Bespoke", "訂製", "🧵", "99", "true", "miscellaneous", ""],
];

// Production's Expenses tab carries the captain's `month` / `amount value` helper
// columns at I/J — unknown to EXPENSES_SPEC, and they must survive untouched.
const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at", "month", "amount value"];

const exp = (id, category_id, over = {}) => {
  const e = { date: "2026-08-01", amount: "100", paid_by: "Karen", created_by: "Karen", notes: `note ${id}`, created_at: "2026-08-01T00:00:00Z", month: "2026-08", value: "100", ...over };
  return [id, e.date, e.amount, category_id, e.paid_by, e.created_by, e.notes, e.created_at, e.month, e.value];
};

// Slugs and already-live ids interleave, so a contiguous write range can only be
// produced by genuinely skipping the already-live rows.
const EXPENSE_ROWS = [
  exp("e1", "eating-out"),                     // row 2  -> cat_001
  exp("e2", "groceries"),                      // row 3  -> cat_003
  exp("e3", "cat_001"),                        // row 4  already live
  exp("e4", "fuel"),                           // row 5  -> cat_015 (archived twin)
  exp("e5", "donate"),                         // row 6  -> cat_020
  exp("e6", "cat_099"),                        // row 7  already live, no slug twin
  exp("e7", "digital"),                        // row 8  -> cat_007
  ["e8", "2026-08-02", "50", "", "", "", "", "", "", ""], // row 9 blank, and short after Sheets trims
  exp("e9", "eating-out"),                     // row 10 -> cat_001
];

const SUBS_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];
const sub = (id, name, category_id) => [id, name, "390", category_id, "monthly", "15", "", "Karen", "true"];
const SUBSCRIPTION_ROWS = [
  sub("sub-1", "Netflix", "digital"),   // row 2 -> cat_007
  sub("sub-2", "Spotify", "cat_099"),   // row 3 already live
  sub("sub-3", "Charity", "donate"),    // row 4 -> cat_020
];

function fixture({ categories = CATEGORY_ROWS, expenses = EXPENSE_ROWS, subscriptions = SUBSCRIPTION_ROWS } = {}) {
  return makeSheets({
    Categories: { header: CATEGORIES_HEADER, rows: categories },
    Expenses: { header: EXPENSES_HEADER, rows: expenses },
    Subscriptions: { header: SUBS_HEADER, rows: subscriptions },
  });
}

const clone = (grid) => JSON.parse(JSON.stringify(grid));
const silent = () => {};
const collect = () => {
  const lines = [];
  const log = (line) => lines.push(String(line));
  log.text = () => lines.join("\n");
  return log;
};

const categoryColumn = (grid) => grid.slice(1).map((r) => r[3] ?? "");
const writeCalls = (requests) => requests.filter((r) => /^(UPDATE|BATCHUPDATE|APPEND|INSERT|UPDATECELLS|DELETE|ADDSHEET)/.test(r));

const doRun = ({ sheets }, opts = {}) =>
  run({ sheets, spreadsheetId: "sheet-under-test", resolveCategory, log: silent, ...opts });

// ---------------------------------------------------------------------------
// AC-1, AC-2, AC-3 — every stored value ends up a live id, derived by the app's
// own resolver rather than a table in this repo
// ---------------------------------------------------------------------------

test("AC-1/AC-2: after a live run no non-empty category_id is a slug", async () => {
  const s = fixture();
  await doRun(s, { dryRun: false });

  const liveIds = new Set(CATEGORY_ROWS.map((r) => r[0]));
  for (const tab of ["Expenses", "Subscriptions"]) {
    for (const value of categoryColumn(s.grids[tab])) {
      if (value === "") continue;
      assert.ok(liveIds.has(value), `${tab} still holds a non-live category_id "${value}"`);
    }
  }
  // The blank row stayed blank rather than being filled in with a guess.
  assert.equal(s.grids.Expenses[8][3] ?? "", "");
});

test("AC-3: every rewritten value equals resolveCategory(old, live).id", async () => {
  const s = fixture();
  const before = clone(s.grids.Expenses);
  const live = liveCategoriesFrom(clone(s.grids.Categories));
  await doRun(s, { dryRun: false });

  let compared = 0;
  for (let i = 1; i < before.length; i++) {
    const was = before[i][3] ?? "";
    const now = s.grids.Expenses[i][3] ?? "";
    if (was === "" || was === now) continue;
    assert.equal(now, resolveCategory(was, live).id, `row ${i + 1} (${was})`);
    compared += 1;
  }
  assert.equal(compared, 6, "six slug rows were rewritten");
  // The archived twin is the one a naive is_active filter would drop.
  assert.equal(s.grids.Expenses[4][3], "cat_015");
});

test("AC-4: row counts are unchanged and each target's total is slug rows + live twin rows", async () => {
  const s = fixture();
  const beforeRows = s.grids.Expenses.length;
  await doRun(s, { dryRun: false });

  assert.equal(s.grids.Expenses.length, beforeRows);
  assert.equal(s.grids.Subscriptions.length, SUBSCRIPTION_ROWS.length + 1);

  const totals = {};
  for (const v of categoryColumn(s.grids.Expenses)) {
    if (v !== "") totals[v] = (totals[v] ?? 0) + 1;
  }
  // eating-out (2 rows) collapses into the 1 row already on cat_001.
  assert.equal(totals.cat_001, 3);
  assert.equal(totals.cat_099, 1);
  assert.equal(totals.cat_015, 1);
  assert.equal(Object.values(totals).reduce((a, b) => a + b, 0), 8, "8 non-blank rows, 1 blank");
});

// ---------------------------------------------------------------------------
// AC-6 — dry-run writes nothing and prints the full plan
// ---------------------------------------------------------------------------

test("AC-6: --dry-run leaves both grids byte-identical and issues no write call", async () => {
  const s = fixture();
  const before = { Expenses: clone(s.grids.Expenses), Subscriptions: clone(s.grids.Subscriptions), Categories: clone(s.grids.Categories) };

  const result = await doRun(s, { dryRun: true });

  assert.equal(result.wouldChange, 8);
  assert.deepEqual(writeCalls(s.requests), [], "a dry-run reached no write endpoint");
  for (const tab of Object.keys(before)) assert.deepEqual(s.grids[tab], before[tab], tab);
});

test("AC-6: the dry-run plan names each old value, its target and its row count, per tab", async () => {
  const s = fixture();
  const log = collect();
  await doRun(s, { dryRun: true, log });
  const text = log.text();

  assert.match(text, /\[Expenses\] 9 data row\(s\)/);
  assert.match(text, /change {3}eating-out -> cat_001 {2}\(2 row\(s\)\)/);
  assert.match(text, /change {3}fuel -> cat_015 {2}\(1 row\(s\)\)/);
  assert.match(text, /\[Subscriptions\] 3 data row\(s\)/);
  assert.match(text, /change {3}digital -> cat_007 {2}\(1 row\(s\)\)/);
  assert.match(text, /8 row\(s\) would change/);
});

test("already-live rows are reported apart from blanks, and excluded from the write set", async () => {
  const s = fixture();
  const log = collect();
  await doRun(s, { dryRun: true, log });

  assert.match(log.text(), /already live {2}cat_001 {2}\(1 row\(s\)\) — excluded from the write set/);
  assert.match(log.text(), /already live {2}cat_099 {2}\(1 row\(s\)\)/);
  assert.match(log.text(), /blank {4}1 row\(s\) with an empty category_id — left untouched/);
  assert.match(log.text(), /totals: 6 to change, 2 already live, 1 blank/);
});

test("no write range covers an already-live or blank row", async () => {
  const s = fixture();
  await doRun(s, { dryRun: false });

  const ranges = s.requests.filter((r) => r.startsWith("BATCHUPDATE")).map((r) => r.slice("BATCHUPDATE ".length));
  assert.deepEqual(ranges, ["Expenses!D2:D3", "Expenses!D5:D6", "Expenses!D8:D8", "Expenses!D10:D10", "Subscriptions!D2:D2", "Subscriptions!D4:D4"]);
  // Rows 4, 7 (already live) and 9 (blank) fall in no range at all — an
  // already-correct cell is never rewritten with its own value.
  const covered = new Set();
  for (const range of ranges.filter((r) => r.startsWith("Expenses"))) {
    const [, from, to] = /!D(\d+):D(\d+)$/.exec(range);
    for (let r = Number(from); r <= Number(to); r++) covered.add(r);
  }
  assert.deepEqual([...covered].sort((a, b) => a - b), [2, 3, 5, 6, 8, 10]);
});

// ---------------------------------------------------------------------------
// AC-7 — halt, do not guess
// ---------------------------------------------------------------------------

const haltCases = [
  {
    name: "a slug whose live twin was renamed",
    categories: CATEGORY_ROWS.map((r) => (r[0] === "cat_003" ? [...r.slice(0, 1), "Grocery Shopping", ...r.slice(2)] : r)),
    expenses: EXPENSE_ROWS,
    expect: /"groceries" — 1 row\(s\); resolves only to the baked-in "groceries"/,
  },
  {
    name: "a cat_NNN id absent from the live Categories tab",
    expenses: [...EXPENSE_ROWS, exp("e10", "cat_777")],
    expect: /"cat_777" — 1 row\(s\); matches no live id and no DEFAULT_CATEGORIES slug/,
  },
  {
    name: "a value with untrimmed whitespace",
    expenses: [...EXPENSE_ROWS, exp("e10", " eating-out")],
    expect: /" eating-out" — 1 row\(s\)/,
  },
  {
    name: "a slug that exists in neither list",
    expenses: [...EXPENSE_ROWS, exp("e10", "crypto")],
    expect: /"crypto" — 1 row\(s\)/,
  },
];

for (const c of haltCases) {
  for (const dryRun of [true, false]) {
    test(`AC-7: ${c.name} halts in ${dryRun ? "dry-run" : "live"} mode having written nothing`, async () => {
      const s = fixture({ categories: c.categories, expenses: c.expenses });
      const before = clone(s.grids.Expenses);

      await assert.rejects(
        () => doRun(s, { dryRun }),
        (err) => {
          assert.ok(err instanceof HaltError, `expected HaltError, got ${err.name}`);
          assert.match(err.message, c.expect);
          assert.match(err.message, /Nothing was written/);
          return true;
        }
      );
      assert.deepEqual(writeCalls(s.requests), []);
      assert.deepEqual(s.grids.Expenses, before);
    });
  }
}

test("AC-7: unmappable values from BOTH tabs are named in one halt, with row counts", async () => {
  const s = fixture({
    expenses: [...EXPENSE_ROWS, exp("e10", "crypto"), exp("e11", "crypto")],
    subscriptions: [...SUBSCRIPTION_ROWS, sub("sub-9", "Mystery", "cat_777")],
  });
  await assert.rejects(() => doRun(s, { dryRun: true }), (err) => {
    assert.match(err.message, /"crypto" — 2 row\(s\)/);
    assert.match(err.message, /"cat_777" — 1 row\(s\)/);
    assert.match(err.message, /2 category_id value\(s\) resolve to no live category/);
    assert.match(err.message, /Expenses:/);
    assert.match(err.message, /Subscriptions:/);
    return true;
  });
});

test("AC-7: two live categories sharing a name_en halt rather than letting find() pick one", async () => {
  const s = fixture({
    categories: [...CATEGORY_ROWS, ["cat_100", "Groceries", "食材", "🥦", "100", "true", "food_beverage_tobacco", ""]],
  });
  await assert.rejects(() => doRun(s, { dryRun: true }), (err) => {
    assert.ok(err instanceof HaltError);
    assert.match(err.message, /"Groceries" is shared by cat_003, cat_100/);
    assert.match(err.message, /Nothing was written/);
    return true;
  });
  assert.deepEqual(writeCalls(s.requests), []);
});

test("duplicateLiveNames reports only genuine duplicates", () => {
  assert.deepEqual(duplicateLiveNames(liveCategoriesFrom([CATEGORIES_HEADER, ...CATEGORY_ROWS])), []);
});

// ---------------------------------------------------------------------------
// AC-8 — idempotent
// ---------------------------------------------------------------------------

test("AC-8: an immediate re-run changes nothing and writes nothing", async () => {
  const s = fixture();
  await doRun(s, { dryRun: false });
  const afterFirst = clone(s.grids.Expenses);
  s.requests.length = 0;

  const log = collect();
  const second = await doRun(s, { dryRun: false, log });

  assert.equal(second.changed, 0);
  assert.deepEqual(writeCalls(s.requests), []);
  assert.deepEqual(s.grids.Expenses, afterFirst);
  assert.match(log.text(), /every category_id is already a live id — nothing to write/);
});

// ---------------------------------------------------------------------------
// AC-9, AC-10 — nothing but the category_id cell moves
// ---------------------------------------------------------------------------

test("AC-9: every column other than category_id is byte-identical after the run", async () => {
  const s = fixture();
  const before = { Expenses: clone(s.grids.Expenses), Subscriptions: clone(s.grids.Subscriptions) };
  await doRun(s, { dryRun: false });

  for (const tab of ["Expenses", "Subscriptions"]) {
    const b = before[tab];
    const a = s.grids[tab];
    assert.equal(a.length, b.length, `${tab} row count`);
    for (let r = 0; r < b.length; r++) {
      const width = Math.max(b[r].length, a[r].length);
      for (let c = 0; c < width; c++) {
        if (c === 3 && r > 0) continue;
        assert.equal(String(a[r][c] ?? ""), String(b[r][c] ?? ""), `${tab} r${r + 1}c${c}`);
      }
    }
  }
  // The captain's unnamed helper columns at I/J are the ones a positional write
  // would clobber first.
  assert.equal(s.grids.Expenses[1][8], "2026-08");
  assert.equal(s.grids.Expenses[1][9], "100");
});

test("AC-10: no row or column is added, removed or reordered, and Categories is never written", async () => {
  const s = fixture();
  const categoriesBefore = clone(s.grids.Categories);
  await doRun(s, { dryRun: false });

  assert.deepEqual(s.grids.Expenses[0], EXPENSES_HEADER);
  assert.deepEqual(s.grids.Subscriptions[0], SUBS_HEADER);
  assert.deepEqual(s.grids.Categories, categoriesBefore);
  assert.deepEqual(
    s.requests.filter((r) => r.includes("Categories") && !r.startsWith("GET")),
    []
  );
});

test("the post-run verification fails loudly when a neighbouring cell moves", () => {
  const rows = [EXPENSES_HEADER, exp("e1", "eating-out")];
  const map = require("../lib/sheetSchema").buildColumnMap(rows, EXPENSES_SPEC);
  const after = clone(rows);
  after[1][3] = "cat_001";
  after[1][6] = "tampered";

  const failures = diffGrids({ before: rows, after, map, changes: [{ rowNumber: 2, from: "eating-out", to: "cat_001" }], tab: "Expenses" });
  assert.deepEqual(failures, ['Expenses!G2: "note e1" -> "tampered" (must not change)']);
});

test("a run whose write lands in the wrong column throws VerificationError", async () => {
  const s = fixture();
  // Corrupt the sheet behind the script's back, between its write and its re-read.
  const realBatch = s.sheets.spreadsheets.values.batchUpdate;
  s.sheets.spreadsheets.values.batchUpdate = async (args) => {
    const out = await realBatch(args);
    s.grids.Expenses[1][6] = "clobbered";
    return out;
  };

  await assert.rejects(() => doRun(s, { dryRun: false }), (err) => {
    assert.ok(err instanceof VerificationError, `expected VerificationError, got ${err.name}`);
    assert.match(err.message, /Expenses!G2: "note e1" -> "clobbered"/);
    return true;
  });
});

// ---------------------------------------------------------------------------
// AC-11 — the column is found by header name
// ---------------------------------------------------------------------------

test("AC-11: a reordered tab is written at the header's column, not at D", async () => {
  // category_id moved from D to B; `notes` takes D's place, so a hardcoded D
  // would overwrite a note with a category id.
  const header = ["id", "category_id", "amount", "notes", "date", "paid_by", "created_by", "created_at"];
  const rows = [
    ["e1", "eating-out", "100", "keep me", "2026-08-01", "Karen", "Karen", ""],
    ["e2", "cat_099", "100", "keep me too", "2026-08-01", "Karen", "Karen", ""],
  ];
  const s = makeSheets({
    Categories: { header: CATEGORIES_HEADER, rows: CATEGORY_ROWS },
    Expenses: { header, rows },
    Subscriptions: { header: SUBS_HEADER, rows: SUBSCRIPTION_ROWS },
  });

  await doRun(s, { dryRun: false });

  assert.ok(s.requests.includes("BATCHUPDATE Expenses!B2:B2"), `ranges: ${s.requests.join(", ")}`);
  assert.equal(s.grids.Expenses[1][1], "cat_001");
  assert.equal(s.grids.Expenses[1][3], "keep me");
});

test("writeRanges groups consecutive rows and breaks the run on a gap", () => {
  const map = require("../lib/sheetSchema").buildColumnMap(
    [["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"]],
    EXPENSES_SPEC
  );
  const ranges = writeRanges({ tab: "Expenses", map, changes: [{ rowNumber: 5, to: "cat_001" }, { rowNumber: 6, to: "cat_003" }, { rowNumber: 9, to: "cat_007" }] });
  assert.deepEqual(ranges, [
    { range: "Expenses!D5:D6", values: [["cat_001"], ["cat_003"]] },
    { range: "Expenses!D9:D9", values: [["cat_007"]] },
  ]);
});

// ---------------------------------------------------------------------------
// AC-5 / AC-6 — the dry-run token itself cannot write
// ---------------------------------------------------------------------------

test("AC-6: --dry-run mints a readonly token; a live run mints a write token", async () => {
  const scopes = [];
  const googleapisId = require.resolve("googleapis");
  const saved = require.cache[googleapisId];
  const s = fixture();
  require.cache[googleapisId] = {
    id: googleapisId,
    filename: googleapisId,
    loaded: true,
    exports: {
      google: {
        auth: { getClient: async (opts) => { scopes.push(opts.scopes); return {}; } },
        sheets: () => s.sheets,
      },
    },
  };
  const savedArgv = process.argv;
  const savedId = process.env.SPREADSHEET_ID;
  const savedKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  process.env.SPREADSHEET_ID = "sheet-under-test";

  const { sheetsClient } = require("../scripts/normalize-category-ids.js");
  try {
    await sheetsClient(READONLY_SCOPE);
    await sheetsClient(WRITE_SCOPE);
  } finally {
    process.argv = savedArgv;
    if (savedId === undefined) delete process.env.SPREADSHEET_ID; else process.env.SPREADSHEET_ID = savedId;
    if (savedKey !== undefined) process.env.GOOGLE_SERVICE_ACCOUNT_KEY = savedKey;
    if (saved) require.cache[googleapisId] = saved; else delete require.cache[googleapisId];
  }

  assert.deepEqual(scopes, [[READONLY_SCOPE], [WRITE_SCOPE]]);
  assert.equal(READONLY_SCOPE, "https://www.googleapis.com/auth/spreadsheets.readonly");
});

// ---------------------------------------------------------------------------
// Planning details
// ---------------------------------------------------------------------------

test("planTab reads a Sheets-truncated row as blank rather than crashing", () => {
  const rows = [EXPENSES_HEADER, ["e1", "2026-08-01", "50"]];
  const plan = planTab({
    rows,
    spec: EXPENSES_SPEC,
    liveCategories: liveCategoriesFrom([CATEGORIES_HEADER, ...CATEGORY_ROWS]),
    resolveCategory,
  });
  assert.deepEqual(plan.blank, [2]);
  assert.deepEqual(plan.changes, []);
  assert.deepEqual(plan.unmappable, []);
});

test("planMigration covers both migrated tabs and never touches Categories", () => {
  const { plans } = planMigration({
    categoriesRows: [CATEGORIES_HEADER, ...CATEGORY_ROWS],
    tabRows: {
      [EXPENSES_SPEC.tab]: [EXPENSES_HEADER, ...EXPENSE_ROWS],
      [SUBSCRIPTIONS_SPEC.tab]: [SUBS_HEADER, ...SUBSCRIPTION_ROWS],
    },
    resolveCategory,
  });
  assert.deepEqual(plans.map((p) => p.tab), ["Expenses", "Subscriptions"]);
  assert.equal(plans[0].changes.length, 6);
  assert.equal(plans[1].changes.length, 2);
});
