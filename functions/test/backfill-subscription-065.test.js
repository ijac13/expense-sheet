// Run with: npm run build && node --test test/
//
// Entity 065 — backfill 3 known recurring expenses for Feb-Aug 2026. Fixtures
// reproduce the real hazard the spec found live (the pre-existing Uber/February
// row `exp-1788759250129`) and decoys under every other id family this repo
// already mints, so a test passing here means the real shape is handled.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { makeSheets } = require("./sheetsStub");
const { buildColumnMap } = require("../lib/sheetSchema");

const backfill = require("../scripts/backfill-subscription-065.js");
const {
  ID_PREFIX,
  MONTHS,
  BackfillError,
  backfillId,
  generateCandidates,
  planCandidates,
  assertCategoriesResolve,
  rowToExpenseShape,
  manifestPathFor,
  run,
} = backfill;

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE_DIR = path.join(__dirname, "..", "scripts", "fixtures", "backfill-065-sample");

const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];
const CATEGORIES_HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active"];
const HIST_PREFIX = "exp-hist-";
const AUTO_ID = (subId, iso) => `exp-auto-${subId}-${iso}`;

function expRow([id, date, amount, category_id, paid_by, created_by, notes, created_at]) {
  return [id, date, amount, category_id, paid_by, created_by, notes ?? "", created_at ?? ""];
}

const REFERENCE_ROWS = [
  expRow(["exp-1788759233590", "2026-01-01", "2105", "cat_024", "wei", "wei", "勞保"]),
  expRow(["exp-1788759216521", "2026-01-01", "2745", "cat_024", "wei", "wei", "三人健保"]),
  expRow(["exp-1788759176279", "2026-01-01", "150", "cat_006", "wei", "wei", ""]),
];
const UBER_FEB_DECOY = expRow(["exp-1788759250129", "2026-02-01", "150", "cat_006", "wei", "wei", ""]);
const HIST_DECOY = expRow([`${HIST_PREFIX}2023-0001`, "2023-03-01", "999", "cat_099", "user1", "user1", "decoy"]);
const AUTO_DECOY = expRow([AUTO_ID("sub-1788759015607", "2026-10-01"), "2026-10-01", "150", "cat_006", "ijac", "ijac", "Uber"]);
const PLAIN_DECOY = expRow(["exp-1690000000000", "2026-04-15", "888", "cat_099", "wei", "wei", "unrelated"]);

const CATEGORY_ROWS = [
  ["cat_024", "Insurance", "保險", "shield", "24", "true"],
  ["cat_006", "Transportation", "交通", "car", "6", "true"],
];

function fixtureSheets({ expenses = [...REFERENCE_ROWS, UBER_FEB_DECOY, HIST_DECOY, AUTO_DECOY, PLAIN_DECOY], categories = CATEGORY_ROWS } = {}) {
  return makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: expenses.map((r) => r.slice()) },
    Categories: { header: CATEGORIES_HEADER, rows: categories.map((r) => r.slice()) },
  });
}

function stubEnv(pair) {
  return {
    SPREADSHEET_ID_STAGING: pair.spreadsheetId,
    GOOGLE_SERVICE_ACCOUNT_KEY_STAGING: "{}",
  };
}

const dataRows = (f) => f.grids.Expenses.slice(1).filter((r) => r[0]);
const mutations = (f) => f.requests.filter((r) => /^(UPDATE|APPEND|INSERT|UPDATECELLS|ADDSHEET|DELETE)/.test(r));

function toRows(rows, header) {
  const map = buildColumnMap([header, ...rows], { tab: "x", required: header, optional: [] });
  return rows.map((r) => rowToExpenseShape(r, map));
}

// ---------------------------------------------------------------------------
// AC-6 — fixed window, never derived from `now`
// ---------------------------------------------------------------------------

test("AC-6: the candidate window is 2026-02-01..2026-08-01, one row per subscription per month, unaffected by any clock", () => {
  assert.deepEqual(MONTHS, ["2026-02-01", "2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"]);
  const a = generateCandidates();
  const b = generateCandidates();
  assert.deepEqual(a, b, "no source of non-determinism (a clock, Math.random) may leak into candidate generation");
  assert.equal(a.length, 21, "3 subscriptions x 7 months");
  assert.equal(new Set(a.map((c) => c.date)).size, 7);
});

// ---------------------------------------------------------------------------
// AC-4 — id namespace disjoint by construction
// ---------------------------------------------------------------------------

test("AC-4: exp-sub065- ids are pairwise disjoint from exp-hist-, exp-auto-, and plain exp-{timestamp}", () => {
  const candidates = generateCandidates();
  for (const c of candidates) {
    assert.ok(c.id.startsWith(ID_PREFIX), c.id);
    assert.ok(!c.id.startsWith(HIST_PREFIX), c.id);
    assert.ok(!c.id.startsWith("exp-auto-"), c.id);
    assert.doesNotMatch(c.id, /^exp-\d+$/, "must not collide with the plain manual-entry shape");
  }
  // Zero overlap against the 4 decoy families actually present on the fixture sheet.
  const existingIds = new Set([...REFERENCE_ROWS, UBER_FEB_DECOY, HIST_DECOY, AUTO_DECOY, PLAIN_DECOY].map((r) => r[0]));
  for (const c of candidates) assert.ok(!existingIds.has(c.id), `${c.id} collides with an existing row`);
});

test("AC-4: backfillId is deterministic from (subscriptionId, date), not from a clock", () => {
  assert.equal(backfillId("sub-1788758970594", "2026-02-01"), "exp-sub065-sub-1788758970594-2026-02-01");
  assert.equal(backfillId("sub-1788758970594", "2026-02-01"), backfillId("sub-1788758970594", "2026-02-01"));
});

// ---------------------------------------------------------------------------
// AC-2 / AC-3 — dedup catches the pre-existing Uber/February row, values are exact
// ---------------------------------------------------------------------------

test("AC-2: the Uber/February candidate is recognized as covered by the pre-existing row and skipped, not duplicated", () => {
  const candidates = generateCandidates();
  const existing = toRows([...REFERENCE_ROWS, UBER_FEB_DECOY], EXPENSES_HEADER);
  const { toWrite, skipped } = planCandidates(candidates, existing);

  assert.equal(toWrite.length, 20, "20 new rows, not 21");
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].candidate.id, backfillId("sub-1788759015607", "2026-02-01"));
  assert.equal(skipped[0].matchedId, "exp-1788759250129");
  assert.ok(!toWrite.some((c) => c.date === "2026-02-01" && c.category_id === "cat_006"), "no duplicate Uber/February row planned");
});

test("AC-2: an id-only dedup (ignoring date/amount/category/payer) MISSES the Uber/February collision — committed as a permanent regression test", () => {
  const candidates = generateCandidates();
  const existingIds = new Set([...REFERENCE_ROWS, UBER_FEB_DECOY].map((r) => r[0]));
  // The wrong rule this test exists to keep failing: "already written" checked only
  // by this run's own id, never against a pre-existing row's (date, amount,
  // category, payer). Under that rule the Uber/February candidate looks new.
  const wronglyPlanned = candidates.filter((c) => !existingIds.has(c.id));
  assert.equal(wronglyPlanned.length, 21, "an id-only check would plan all 21, duplicating the Uber/February row");
});

test("AC-3: the 20-row set carries exact values from the ideation-pinned figures, not the live Subscriptions tab", () => {
  const candidates = generateCandidates();
  const { toWrite } = planCandidates(candidates, toRows([...REFERENCE_ROWS, UBER_FEB_DECOY], EXPENSES_HEADER));

  const insurance1 = toWrite.filter((c) => c.subscriptionId === "sub-1788758970594");
  const insurance2 = toWrite.filter((c) => c.subscriptionId === "sub-1788758990082");
  const uber = toWrite.filter((c) => c.subscriptionId === "sub-1788759015607");

  assert.equal(insurance1.length, 7);
  assert.ok(insurance1.every((c) => c.amount === 2105 && c.category_id === "cat_024" && c.paid_by === "wei" && c.created_by === "wei" && c.notes === "勞保"));
  assert.equal(insurance2.length, 7);
  assert.ok(insurance2.every((c) => c.amount === 2745 && c.category_id === "cat_024" && c.notes === "三人健保"));
  assert.equal(uber.length, 6, "Feb already covered — only Mar-Aug remain");
  assert.deepEqual(uber.map((c) => c.date).sort(), ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01"]);
  assert.ok(uber.every((c) => c.amount === 150 && c.category_id === "cat_006" && c.notes === ""));
});

// ---------------------------------------------------------------------------
// AC-7 — category resolution guards every write
// ---------------------------------------------------------------------------

test("AC-7: both required categories resolve and assertCategoriesResolve does not throw", () => {
  assert.doesNotThrow(() => assertCategoriesResolve([{ id: "cat_024" }, { id: "cat_006" }, { id: "cat_099" }]));
});

test("AC-7: a missing required category throws naming exactly the missing id", () => {
  assert.throws(
    () => assertCategoriesResolve([{ id: "cat_006" }]),
    (e) => e instanceof BackfillError && e.message.includes("cat_024") && !e.message.includes("cat_006")
  );
});

test("AC-7: a target missing cat_024 refuses before any write, naming the missing id", async () => {
  const f = fixtureSheets({ categories: [CATEGORY_ROWS[1]] }); // only cat_006
  const sheetsFor = async () => f.sheets;
  const env = stubEnv({ spreadsheetId: "sheet-under-test" });

  await assert.rejects(
    run(["--target", "staging", "--dry-run"], { log: () => {}, env, sheetsFor }),
    (e) => e instanceof BackfillError && /cat_024/.test(e.message)
  );
  assert.deepEqual(mutations(f), [], "zero write calls reached the sheet");
});

// ---------------------------------------------------------------------------
// AC-9 — refuses without --target
// ---------------------------------------------------------------------------

test("AC-9: refuses without an explicit --target, before any read", async () => {
  await assert.rejects(
    run(["--dry-run"], { log: () => {}, env: {} }),
    (e) => e instanceof BackfillError && /--target/.test(e.message)
  );
});

test("AC-9: the CLI exits non-zero and touches nothing without --target", () => {
  assert.throws(() =>
    execFileSync(process.execPath, ["scripts/backfill-subscription-065.js", "--dry-run", "--fixture", FIXTURE_DIR], {
      cwd: path.join(REPO_ROOT, "functions"),
      encoding: "utf8",
    })
  );
});

// ---------------------------------------------------------------------------
// AC-1 / AC-8 — apply writes exactly 20, a second apply writes 0, nothing pre-existing changes
// ---------------------------------------------------------------------------

test("AC-1 / AC-8: --apply writes 20 rows once, a second --apply writes nothing further, and every pre-existing row survives byte-identical", async () => {
  const f = fixtureSheets();
  const before = f.grids.Expenses.map((r) => r.slice());
  const sheetsFor = async () => f.sheets;
  const env = stubEnv({ spreadsheetId: "sheet-under-test" });
  const manifest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bf065-")), "manifest.json");

  const first = await run(["--target", "staging", "--apply", "--manifest", manifest], { log: () => {}, env, sheetsFor });
  assert.equal(first.created, 20);
  assert.equal(first.skipped, 1);
  assert.equal(dataRows(f).length, before.slice(1).filter((r) => r[0]).length + 20);

  for (const row of before.slice(1)) {
    const survivor = dataRows(f).find((r) => r[0] === row[0]);
    assert.deepEqual(survivor, row, `pre-existing row ${row[0]} must be byte-identical`);
  }

  const afterFirst = f.grids.Expenses.map((r) => r.slice());
  const second = await run(["--target", "staging", "--apply", "--manifest", manifest], { log: () => {}, env, sheetsFor });
  assert.equal(second.created, 0, "every one of the 20 ids is already present");
  assert.equal(second.skipped, 21, "all 21 candidates now match an existing row by id or by (date, amount, category, payer)");
  assert.deepEqual(f.grids.Expenses, afterFirst, "row count and contents unchanged by the no-op re-apply");
});

// ---------------------------------------------------------------------------
// AC-5 — manifest-backed undo removes exactly this run's own ids
// ---------------------------------------------------------------------------

test("AC-5: undo removes exactly this run's manifest ids and leaves every decoy family untouched", async () => {
  const f = fixtureSheets();
  const sheetsFor = async () => f.sheets;
  const env = stubEnv({ spreadsheetId: "sheet-under-test" });
  const manifest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bf065-")), "manifest.json");

  await run(["--target", "staging", "--apply", "--manifest", manifest], { log: () => {}, env, sheetsFor });
  const afterApply = dataRows(f).map((r) => r[0]);
  assert.equal(afterApply.filter((id) => id.startsWith(ID_PREFIX)).length, 20);

  const result = await run(["--target", "staging", "--undo", "--manifest", manifest], { log: () => {}, env, sheetsFor });
  assert.equal(result.removed, 20);

  const survivingIds = dataRows(f).map((r) => r[0]);
  assert.ok(!survivingIds.some((id) => id.startsWith(ID_PREFIX)), "no exp-sub065- row survives undo");
  for (const decoyId of [...REFERENCE_ROWS, UBER_FEB_DECOY, HIST_DECOY, AUTO_DECOY, PLAIN_DECOY].map((r) => r[0])) {
    assert.ok(survivingIds.includes(decoyId), `${decoyId} must survive undo untouched`);
  }
});

test("AC-5: undo refuses without a manifest, and refuses a manifest naming an id outside its own prefix", async () => {
  const f = fixtureSheets();
  const sheetsFor = async () => f.sheets;
  const env = stubEnv({ spreadsheetId: "sheet-under-test" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf065-"));

  await assert.rejects(
    run(["--target", "staging", "--undo", "--manifest", path.join(dir, "missing.json")], { log: () => {}, env, sheetsFor }),
    (e) => e instanceof BackfillError && /No manifest/.test(e.message)
  );

  const poisoned = path.join(dir, "poisoned.json");
  fs.writeFileSync(poisoned, JSON.stringify({ writtenIds: ["exp-1788759233590"] }), "utf8");
  await assert.rejects(
    run(["--target", "staging", "--undo", "--manifest", poisoned], { log: () => {}, env, sheetsFor }),
    (e) => e instanceof BackfillError && /outside this entity's own/.test(e.message)
  );
  assert.deepEqual(mutations(f), [], "a poisoned manifest must never reach a delete call");
});

// ---------------------------------------------------------------------------
// Edge cases with no AC of their own
// ---------------------------------------------------------------------------

test("dry-run against the checked-in fixture directory reports the plan and touches nothing", () => {
  const out = execFileSync(process.execPath, [
    "scripts/backfill-subscription-065.js",
    "--target", "staging",
    "--dry-run",
    "--fixture", FIXTURE_DIR,
  ], {
    cwd: path.join(REPO_ROOT, "functions"),
    encoding: "utf8",
    env: { ...process.env, SPREADSHEET_ID_STAGING: "sheet-under-test", GOOGLE_SERVICE_ACCOUNT_KEY_STAGING: "{}" },
  });
  assert.match(out, /20 to write, 1 skipped/);
});

test("--fixture is rejected outside --dry-run", async () => {
  await assert.rejects(
    run(["--target", "staging", "--apply", "--fixture", FIXTURE_DIR], { log: () => {}, env: stubEnv({ spreadsheetId: "x" }) }),
    (e) => e instanceof BackfillError && /--fixture is --dry-run only/.test(e.message)
  );
});

test("manifestPathFor scopes the default path per target, so staging and production never share one manifest", () => {
  assert.notEqual(manifestPathFor("staging"), manifestPathFor("production"));
  assert.equal(manifestPathFor("staging", "/tmp/x.json"), "/tmp/x.json");
});
