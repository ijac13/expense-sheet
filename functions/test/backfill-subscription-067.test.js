// Run with: npm run build && node --test test/
//
// Entity 067 — backfill 2 known recurring expenses (ijac's own 健保/勞保) for
// Jan-Sep 2026. Fixtures reproduce every other id family this repo already
// mints (including a decoy under 065's own `exp-sub065-` prefix, and the live
// scheduler's own future `exp-auto-` write for one of these SAME 2
// subscriptions, dated October) plus one value-collision decoy that must be
// caught by the (date, amount, category_id, paid_by) dedup key even though no
// such collision exists in production today — so a test passing here means the
// real shape is handled.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { makeSheets } = require("./sheetsStub");
const { buildColumnMap } = require("../lib/sheetSchema");

const backfill = require("../scripts/backfill-subscription-067.js");
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
const FIXTURE_DIR = path.join(__dirname, "..", "scripts", "fixtures", "backfill-067-sample");

const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];
const CATEGORIES_HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active"];

// The other 6 known id families this repo mints, plus the value-collision
// decoy exercising the dedup key rather than the id namespace (AC-1, AC-2,
// AC-4, AC-5).
function expRow([id, date, amount, category_id, paid_by, created_by, notes, created_at]) {
  return [id, date, amount, category_id, paid_by, created_by, notes ?? "", created_at ?? ""];
}
const HIST_DECOY = expRow(["exp-hist-2023-0001", "2023-03-01", "999", "cat_099", "user1", "user1", "decoy historical row"]);
const HIST_MORTGAGE_DECOY = expRow(["exp-hist-mortgage-2023-0001", "2023-04-01", "5000", "cat_099", "user1", "user1", "decoy mortgage row"]);
const SUB065_DECOY = expRow(["exp-sub065-sub-1788758970594-2026-01-01", "2026-01-01", "2105", "cat_024", "wei", "wei", "勞保"]);
const MIG066_DECOY = expRow(["exp-mig066-r1", "2026-02-15", "500", "cat_005", "ijac", "ijac", "decoy migration row"]);
// The live scheduler's own future write for the SAME 健保 subscription id this
// entity backfills — dated October, past this entity's own Jan-Sep window.
const AUTO_DECOY = expRow(["exp-auto-sub-1788741741902-2026-10-05", "2026-10-05", "3172", "cat_024", "ijac", "ijac", "健保 ijac"]);
const PLAIN_DECOY = expRow(["exp-1690000000000", "2026-04-15", "888", "cat_099", "wei", "wei", "unrelated manual row"]);
const LEGACY_DECOY = expRow(["exp_2024_0007", "2024-05-01", "777", "cat_099", "user2", "user2", "legacy decoy row"]);
// Collides on (date, amount, category_id, paid_by) with the 健保/March
// candidate, under an unrelated manual id — must be recognized and skipped.
const VALUE_COLLISION_DECOY = expRow(["exp-1788800000000", "2026-03-05", "3172", "cat_024", "ijac", "ijac", "健保 paid manually before backfill ran"]);

const ALL_DECOYS = [HIST_DECOY, HIST_MORTGAGE_DECOY, SUB065_DECOY, MIG066_DECOY, AUTO_DECOY, PLAIN_DECOY, LEGACY_DECOY, VALUE_COLLISION_DECOY];

const CATEGORY_ROWS = [
  ["cat_024", "Insurance", "保險", "shield", "24", "true"],
  ["cat_099", "Other", "其他", "dots", "99", "true"],
];

function fixtureSheets({ expenses = ALL_DECOYS, categories = CATEGORY_ROWS } = {}) {
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

test("AC-6: the candidate window is 2026-01-05..2026-09-05 (the 5th of each month), 2 subscriptions x 9 months, unaffected by any clock", () => {
  assert.deepEqual(MONTHS, [
    "2026-01-05", "2026-02-05", "2026-03-05", "2026-04-05",
    "2026-05-05", "2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05",
  ]);
  const a = generateCandidates();
  const b = generateCandidates();
  assert.deepEqual(a, b, "no source of non-determinism (a clock, Math.random) may leak into candidate generation");
  assert.equal(a.length, 18, "2 subscriptions x 9 months");
  assert.equal(new Set(a.map((c) => c.date)).size, 9);
});

test("AC-6: generateCandidates is unaffected by what `now` is when the script runs (no October-onward leakage)", () => {
  // The generator takes no clock argument at all — this asserts that shape
  // directly, since a future refactor deriving MONTHS from `now` would still
  // pass the plain determinism check above if `now` were frozen in the test.
  assert.equal(generateCandidates.length, 0, "generateCandidates must take no arguments, including no `now`");
});

// ---------------------------------------------------------------------------
// AC-4 — id namespace disjoint by construction from all 7 known families
// ---------------------------------------------------------------------------

test("AC-4: exp-sub067- ids are pairwise disjoint from all 7 known id families", () => {
  const candidates = generateCandidates();
  for (const c of candidates) {
    assert.ok(c.id.startsWith(ID_PREFIX), c.id);
    assert.ok(!c.id.startsWith("exp-hist-"), c.id); // also covers exp-hist-mortgage- (a superstring prefix)
    assert.ok(!c.id.startsWith("exp-sub065-"), c.id);
    assert.ok(!c.id.startsWith("exp-mig066-"), c.id);
    assert.ok(!c.id.startsWith("exp-auto-"), c.id);
    assert.doesNotMatch(c.id, /^exp-\d+$/, "must not collide with the plain manual-entry shape");
    assert.doesNotMatch(c.id, /^exp_\d{4}_\d+$/, "must not collide with the legacy exp_{year}_{NNNN} shape");
  }
  // Zero overlap against every decoy family actually present on the fixture sheet.
  const existingIds = new Set(ALL_DECOYS.map((r) => r[0]));
  for (const c of candidates) assert.ok(!existingIds.has(c.id), `${c.id} collides with an existing row`);
});

test("AC-4: the live scheduler's own future exp-auto- id for the same subscription never collides with this entity's id, even for the same (subscriptionId, isoDate) pair", () => {
  // The scheduler mints exp-auto-{subscriptionId}-{isoDate}; this entity mints
  // exp-sub067-{subscriptionId}-{isoDate}. Same inputs, disjoint prefixes.
  const autoId = `exp-auto-sub-1788741741902-2026-10-05`;
  const backfillIdSameInputs = backfillId("sub-1788741741902", "2026-10-05");
  assert.notEqual(autoId, backfillIdSameInputs);
  assert.ok(backfillIdSameInputs.startsWith(ID_PREFIX));
});

test("AC-4: backfillId is deterministic from (subscriptionId, date), not from a clock", () => {
  assert.equal(backfillId("sub-1788741741902", "2026-01-05"), "exp-sub067-sub-1788741741902-2026-01-05");
  assert.equal(backfillId("sub-1788741741902", "2026-01-05"), backfillId("sub-1788741741902", "2026-01-05"));
});

// ---------------------------------------------------------------------------
// AC-2 / AC-3 — dedup catches a value-level collision, values are exact
// ---------------------------------------------------------------------------

test("AC-2: the 健保/March candidate is recognized as covered by a pre-existing value-collision row and skipped, not duplicated", () => {
  const candidates = generateCandidates();
  const existing = toRows(ALL_DECOYS, EXPENSES_HEADER);
  const { toWrite, skipped } = planCandidates(candidates, existing);

  assert.equal(toWrite.length, 17, "17 new rows, not 18");
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0].candidate.id, backfillId("sub-1788741741902", "2026-03-05"));
  assert.equal(skipped[0].matchedId, "exp-1788800000000");
  assert.ok(!toWrite.some((c) => c.date === "2026-03-05" && c.subscriptionId === "sub-1788741741902"), "no duplicate 健保/March row planned");
});

test("AC-2: an id-only dedup (ignoring date/amount/category/payer) MISSES the value-collision decoy — committed as a permanent regression test", () => {
  const candidates = generateCandidates();
  const existingIds = new Set(ALL_DECOYS.map((r) => r[0]));
  // The wrong rule this test exists to keep failing: "already written" checked only
  // by this run's own id, never against a pre-existing row's (date, amount,
  // category, payer). Under that rule the 健保/March candidate looks new.
  const wronglyPlanned = candidates.filter((c) => !existingIds.has(c.id));
  assert.equal(wronglyPlanned.length, 18, "an id-only check would plan all 18, duplicating the value-collision row");
});

test("AC-2: today's actual production shape (no collisions) plans all 18 candidates with 0 skips", () => {
  // Mirrors the spec's own live finding: zero pre-existing coverage anywhere in
  // the Jan-Sep 2026 window for either subscription's exact amount.
  const candidates = generateCandidates();
  const { toWrite, skipped } = planCandidates(candidates, []);
  assert.equal(toWrite.length, 18);
  assert.equal(skipped.length, 0);
});

test("AC-3: the 17-row write set carries exact spec-pinned values, not the live Subscriptions tab", () => {
  const candidates = generateCandidates();
  const { toWrite } = planCandidates(candidates, toRows(ALL_DECOYS, EXPENSES_HEADER));

  const health = toWrite.filter((c) => c.subscriptionId === "sub-1788741741902");
  const labor = toWrite.filter((c) => c.subscriptionId === "sub-1788741714162");

  assert.equal(health.length, 8, "March already covered by the value-collision decoy — only 8 of 9 remain");
  assert.ok(health.every((c) => c.amount === 3172 && c.category_id === "cat_024" && c.paid_by === "ijac" && c.created_by === "ijac" && c.notes === "健保 ijac"));
  assert.deepEqual(health.map((c) => c.date).sort(), ["2026-01-05", "2026-02-05", "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05"]);

  assert.equal(labor.length, 9);
  assert.ok(labor.every((c) => c.amount === 1145 && c.category_id === "cat_024" && c.paid_by === "ijac" && c.created_by === "ijac" && c.notes === "勞保 ijac"));
  assert.deepEqual(labor.map((c) => c.date).sort(), MONTHS);
});

// ---------------------------------------------------------------------------
// AC-7 — category resolution guards every write, by pinned id not name
// ---------------------------------------------------------------------------

test("AC-7: the required category (cat_024) resolves and assertCategoriesResolve does not throw", () => {
  assert.doesNotThrow(() => assertCategoriesResolve([{ id: "cat_024" }, { id: "cat_099" }]));
});

test("AC-7: a missing cat_024 throws naming exactly the missing id", () => {
  assert.throws(
    () => assertCategoriesResolve([{ id: "cat_099" }]),
    (e) => e instanceof BackfillError && e.message.includes("cat_024")
  );
});

test("AC-7: a target missing cat_024 refuses before any write, naming the missing id — even if a differently-meaning cat_024 exists is not tested here by name, only by id", async () => {
  const f = fixtureSheets({ categories: [CATEGORY_ROWS[1]] }); // only cat_099
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
    execFileSync(process.execPath, ["scripts/backfill-subscription-067.js", "--dry-run", "--fixture", FIXTURE_DIR], {
      cwd: path.join(REPO_ROOT, "functions"),
      encoding: "utf8",
    })
  );
});

// ---------------------------------------------------------------------------
// AC-1 / AC-8 — apply writes exactly 17, a second apply writes 0, nothing pre-existing changes
// ---------------------------------------------------------------------------

test("AC-1 / AC-8: --apply writes 17 rows once, a second --apply writes nothing further, and every pre-existing row (all 7 decoy families) survives byte-identical", async () => {
  const f = fixtureSheets();
  const before = f.grids.Expenses.map((r) => r.slice());
  const sheetsFor = async () => f.sheets;
  const env = stubEnv({ spreadsheetId: "sheet-under-test" });
  const manifest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bf067-")), "manifest.json");

  const first = await run(["--target", "staging", "--apply", "--manifest", manifest], { log: () => {}, env, sheetsFor });
  assert.equal(first.created, 17);
  assert.equal(first.skipped, 1);
  assert.equal(dataRows(f).length, before.slice(1).filter((r) => r[0]).length + 17);

  for (const row of before.slice(1)) {
    const survivor = dataRows(f).find((r) => r[0] === row[0]);
    assert.deepEqual(survivor, row, `pre-existing row ${row[0]} must be byte-identical`);
  }

  const afterFirst = f.grids.Expenses.map((r) => r.slice());
  const second = await run(["--target", "staging", "--apply", "--manifest", manifest], { log: () => {}, env, sheetsFor });
  assert.equal(second.created, 0, "every one of the 17 written ids is already present");
  assert.equal(second.skipped, 18, "all 18 candidates now match an existing row by id or by (date, amount, category, payer)");
  assert.deepEqual(f.grids.Expenses, afterFirst, "row count and contents unchanged by the no-op re-apply");
});

// ---------------------------------------------------------------------------
// AC-5 — manifest-backed undo removes exactly this run's own ids
// ---------------------------------------------------------------------------

test("AC-5: undo removes exactly this run's manifest ids and leaves every decoy family (all 7) untouched", async () => {
  const f = fixtureSheets();
  const sheetsFor = async () => f.sheets;
  const env = stubEnv({ spreadsheetId: "sheet-under-test" });
  const manifest = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bf067-")), "manifest.json");

  await run(["--target", "staging", "--apply", "--manifest", manifest], { log: () => {}, env, sheetsFor });
  const afterApply = dataRows(f).map((r) => r[0]);
  assert.equal(afterApply.filter((id) => id.startsWith(ID_PREFIX)).length, 17);

  const result = await run(["--target", "staging", "--undo", "--manifest", manifest], { log: () => {}, env, sheetsFor });
  assert.equal(result.removed, 17);

  const survivingIds = dataRows(f).map((r) => r[0]);
  assert.ok(!survivingIds.some((id) => id.startsWith(ID_PREFIX)), "no exp-sub067- row survives undo");
  for (const decoyId of ALL_DECOYS.map((r) => r[0])) {
    assert.ok(survivingIds.includes(decoyId), `${decoyId} must survive undo untouched`);
  }
});

test("AC-5: undo refuses without a manifest, and refuses a manifest naming an id outside its own prefix", async () => {
  const f = fixtureSheets();
  const sheetsFor = async () => f.sheets;
  const env = stubEnv({ spreadsheetId: "sheet-under-test" });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bf067-"));

  await assert.rejects(
    run(["--target", "staging", "--undo", "--manifest", path.join(dir, "missing.json")], { log: () => {}, env, sheetsFor }),
    (e) => e instanceof BackfillError && /No manifest/.test(e.message)
  );

  const poisoned = path.join(dir, "poisoned.json");
  fs.writeFileSync(poisoned, JSON.stringify({ writtenIds: ["exp-sub065-sub-1788758970594-2026-01-01"] }), "utf8");
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
    "scripts/backfill-subscription-067.js",
    "--target", "staging",
    "--dry-run",
    "--fixture", FIXTURE_DIR,
  ], {
    cwd: path.join(REPO_ROOT, "functions"),
    encoding: "utf8",
    env: { ...process.env, SPREADSHEET_ID_STAGING: "sheet-under-test", GOOGLE_SERVICE_ACCOUNT_KEY_STAGING: "{}" },
  });
  assert.match(out, /17 to write, 1 skipped/);
});

test("--fixture is rejected outside --dry-run", async () => {
  await assert.rejects(
    run(["--target", "staging", "--apply", "--fixture", FIXTURE_DIR], { log: () => {}, env: stubEnv({ spreadsheetId: "x" }) }),
    (e) => e instanceof BackfillError && /--fixture is --dry-run only/.test(e.message)
  );
});

test("manifestPathFor scopes the default path per target, so staging and production never share one manifest, and never collides with entity 065's own manifest naming", () => {
  assert.notEqual(manifestPathFor("staging"), manifestPathFor("production"));
  assert.equal(manifestPathFor("staging", "/tmp/x.json"), "/tmp/x.json");
  assert.match(manifestPathFor("staging"), /067-manifest-staging\.json$/);
});
