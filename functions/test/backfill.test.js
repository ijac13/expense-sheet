// Run with: npm run build && node --test test/
//
// Entity 051 — historical subscription backfill. Fixtures reproduce the four
// failure modes the spec traced on the live sheet (YouTube's price change,
// 0900000001 colliding with it on amount+category, the four-way gym cohort,
// 0900000002's contradictory signatures) rather than abstract data, so a test
// passing here means the real shape is handled.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const { makeSheets } = require("./sheetsStub");
const { runSubscriptionScheduler } = require("../lib/scheduler");
const {
  buildColumnMap,
  rowToSubscription,
  EXPENSES_SPEC,
  SUBSCRIPTIONS_SPEC,
} = require("../lib/sheetSchema");

const backfill = require("../scripts/backfill-subscription-history.js");
const {
  DEFAULT_REPORT,
  READONLY_SCOPE,
  ReportError,
  PartialWriteError,
  fold,
  generateOccurrences,
  analyze,
  renderReport,
  parseReport,
  buildPlan,
  buildBackfillRow,
  applyPlan,
  rowToExpense,
  readRows,
  runAnalyze,
} = backfill;

// Production shape: the captain's `month` / `amount value` helper columns at I/J.
const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at", "month", "amount value"];
const SUBS_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];

const REPO_ROOT = path.resolve(__dirname, "..", "..");

let rowSeq = 0;
const subRow = (over = {}) => {
  const s = { id: "sub-1700000000000", name: "Netflix", amount: "100", category_id: "digital", frequency: "monthly", due_day: "15", due_month: "", paid_by: "ijac", is_active: "true", ...over };
  return [s.id, s.name, s.amount, s.category_id, s.frequency, s.due_day, s.due_month, s.paid_by, s.is_active];
};
const expRow = (over = {}) => {
  const e = { id: `exp-${++rowSeq}`, date: "2025-01-15", amount: "100", category_id: "digital", paid_by: "ijac", created_by: "ijac", notes: "", created_at: "", month: "", value: "", ...over };
  return [e.id, e.date, e.amount, e.category_id, e.paid_by, e.created_by, e.notes, e.created_at, e.month, e.value];
};

const subsOf = (rows) => readRows([SUBS_HEADER, ...rows], SUBSCRIPTIONS_SPEC, rowToSubscription);
const expsOf = (rows) => readRows([EXPENSES_HEADER, ...rows], EXPENSES_SPEC, rowToExpense);

function model({ subs, expenses = [], todayIso = "2026-08-18" }) {
  return analyze({ subscriptions: subsOf(subs), expenses: expsOf(expenses), todayIso });
}
const sectionFor = (m, subId) => m.sections.find((s) => s.sub.id === subId);

/** A monthly row on the 15th of each month in [fromYm, toYm]. */
function monthlyRows(fromYm, toYm, over) {
  const out = [];
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  for (let n = fy * 12 + fm - 1; n <= ty * 12 + tm - 1; n++) {
    const ym = `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
    out.push(expRow({ date: `${ym}-15`, ...over }));
  }
  return out;
}

const at = (iso) => Date.parse(`${iso}T01:00:00+08:00`);
const tmpReport = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "bf-")), "candidates.md");
const dataRows = (f) => f.grids.Expenses.slice(1);
const mutations = (f) => f.requests.filter((r) => /^(UPDATE|APPEND|INSERT|UPDATECELLS|ADDSHEET|DELETE)/.test(r));

function fixtureSheets({ subs = [subRow()], expenses = [] } = {}) {
  return makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: expenses.map((r) => r.slice()) },
    Subscriptions: { header: SUBS_HEADER, rows: subs.map((r) => r.slice()) },
  });
}

// ---------------------------------------------------------------------------
// AC-1 — analysis performs zero writes
// ---------------------------------------------------------------------------

test("AC-1: analysis opens the readonly scope and completes against a sheet whose writes throw", async () => {
  const f = fixtureSheets({ expenses: monthlyRows("2025-01", "2026-07", { notes: "Netflix" }) });
  const boom = async () => { throw new Error("a write was attempted during --analyze"); };
  f.sheets.spreadsheets.batchUpdate = boom;
  f.sheets.spreadsheets.values.update = boom;
  f.sheets.spreadsheets.values.append = boom;

  const scopes = [];
  const id = require.resolve("googleapis");
  const saved = require.cache[id];
  require.cache[id] = {
    id, filename: id, loaded: true,
    exports: { google: {
      auth: {
        getClient: async ({ scopes: s }) => { scopes.push(...s); return {}; },
        GoogleAuth: class { constructor({ scopes: s }) { scopes.push(...s); } async getClient() { return {}; } },
      },
      sheets: () => f.sheets,
    }},
  };
  process.env.SPREADSHEET_ID = "sheet-under-test";
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  const report = tmpReport();
  try {
    await runAnalyze({ analyze: true, report, now: "2026-08-18", fixture: null }, () => {});
  } finally {
    if (saved) require.cache[id] = saved; else delete require.cache[id];
  }

  // A token minted for this scope cannot write, whatever the code does next.
  assert.deepEqual(scopes, [READONLY_SCOPE]);
  assert.deepEqual(mutations(f), [], "no write request reached the sheet");
  assert.ok(fs.existsSync(report), "the report was produced");
});

test("AC-1: the CLI exits 0 running the full analysis against a fixture", () => {
  const report = tmpReport();
  // Exit code is the assertion: execFileSync throws on non-zero.
  execFileSync(process.execPath, [
    "scripts/backfill-subscription-history.js",
    "--analyze",
    "--fixture", "./scripts/fixtures/backfill-sample",
    "--report", report,
    "--now", "2026-08-18",
  ], { cwd: path.join(REPO_ROOT, "functions"), encoding: "utf8" });

  assert.match(fs.readFileSync(report, "utf8"), /^# Subscription backfill candidates/);
});

// ---------------------------------------------------------------------------
// AC-2 — occurrences reuse the scheduler's own semantics
// ---------------------------------------------------------------------------

test("AC-2: day-31 clamps to each month's last day, once per month, never doubled", () => {
  const sub = subsOf([subRow({ due_day: "31" })])[0];
  const occ = generateOccurrences(sub, "2025-01-01", "2026-08-18");

  for (const iso of ["2025-02-28", "2025-04-30", "2026-02-28"]) {
    assert.ok(occ.includes(iso), `${iso} missing — the clamp was dropped`);
  }
  // One per calendar month across the whole window: a clamp that also fired on
  // the 30th, or a generator that emitted both, shows up here.
  const perMonth = new Map();
  for (const iso of occ) perMonth.set(iso.slice(0, 7), (perMonth.get(iso.slice(0, 7)) ?? 0) + 1);
  assert.deepEqual([...new Set(perMonth.values())], [1]);
  // 2025-01 through 2026-07: August 2026's occurrence would be the 31st, which
  // the 2026-08-18 analysis date has not reached yet.
  assert.equal(occ.length, 19);
  assert.equal(occ[occ.length - 1], "2026-07-31");
});

test("AC-2: an annual subscription yields exactly one occurrence per calendar year", () => {
  const sub = subsOf([subRow({ frequency: "annual", due_day: "2", due_month: "6" })])[0];
  assert.deepEqual(generateOccurrences(sub, "2025-01-01", "2026-08-18"), ["2025-06-02", "2026-06-02"]);
});

test("AC-2: the generated dates are the dates the deployed scheduler actually fires on", async () => {
  // Behavioural, not a source check: every date generateOccurrences proposes must
  // be one runSubscriptionScheduler creates a row on, and no other date may be.
  const row = subRow({ id: "sub-1700000000001", due_day: "31" });
  const sub = subsOf([row])[0];
  const generated = new Set(generateOccurrences(sub, "2026-01-01", "2026-04-30"));

  const fired = [];
  for (let month = 1; month <= 4; month++) {
    for (let day = 1; day <= 31; day++) {
      const iso = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (new Date(`${iso}T00:00:00Z`).getUTCDate() !== day) continue;
      const f = fixtureSheets({ subs: [row] });
      if ((await runSubscriptionScheduler(f.sheets, "sheet-under-test", at(iso))).created_count > 0) fired.push(iso);
    }
  }
  assert.deepEqual([...generated].sort(), fired, "a local copy of isDueOn would drift from this");
});

// ---------------------------------------------------------------------------
// AC-3 — window ends at the last already-passed due date
// ---------------------------------------------------------------------------

test("AC-3: with the clock at 2026-08-18 a day-23 subscription stops at 2026-07-23", () => {
  const sub = subsOf([subRow({ due_day: "23" })])[0];
  const occ = generateOccurrences(sub, "2025-01-01", "2026-08-18");
  assert.equal(occ[occ.length - 1], "2026-07-23");
  assert.ok(!occ.includes("2026-08-23"), "a future due date must never be proposed");
});

test("AC-3: a due date falling on the analysis date itself is included", () => {
  const sub = subsOf([subRow({ due_day: "18" })])[0];
  const occ = generateOccurrences(sub, "2025-01-01", "2026-08-18");
  assert.equal(occ[occ.length - 1], "2026-08-18");
});

// ---------------------------------------------------------------------------
// AC-4 — normalised notes matching
// ---------------------------------------------------------------------------

test("AC-4: notes matching lowercases and strips whitespace on both sides", () => {
  assert.equal(fold("Member B gym"), fold("member b gym"));
  assert.equal(fold("Member A gym"), fold("Member Agym"));

  // Through the analysis, not just the helper: each subscription is covered by
  // the row whose note differs from its name only by case or spacing.
  const m = model({
    subs: [
      subRow({ id: "sub-1700000000010", name: "Member B gym", amount: "400", category_id: "sports", due_day: "1" }),
      subRow({ id: "sub-1700000000011", name: "Member A gym", amount: "400", category_id: "sports", due_day: "1" }),
    ],
    expenses: [
      expRow({ date: "2025-01-01", amount: "400", category_id: "sports", notes: "member b gym" }),
      expRow({ date: "2025-01-01", amount: "400", category_id: "sports", notes: "Member Agym" }),
    ],
    todayIso: "2025-01-31",
  });
  assert.equal(sectionFor(m, "sub-1700000000010").coveredByNotes, 1, "case-only difference must match");
  assert.equal(sectionFor(m, "sub-1700000000011").coveredByNotes, 1, "space-only difference must match");
});

// ---------------------------------------------------------------------------
// AC-5 — single-claim rule
// ---------------------------------------------------------------------------

test("AC-5: a row claimed by one subscription's notes leaves every other's evidence pool", () => {
  // The real shape: YouTube's 33 rows at 200/digital, and 0900000001 also at
  // 200/digital with nothing mentioning it anywhere.
  const youtube = subRow({ id: "sub-1700000000020", name: "YouTube", amount: "200", category_id: "digital", due_day: "10" });
  const other = subRow({ id: "sub-1700000000021", name: "0900000001", amount: "200", category_id: "digital", due_day: "10" });
  const m = model({
    subs: [youtube, other],
    expenses: monthlyRows("2025-01", "2026-07", { amount: "200", category_id: "digital", notes: "YouTube Premium" }),
  });

  const b = sectionFor(m, "sub-1700000000021");
  assert.equal(b.notesRowCount, 0);
  assert.equal(b.amountRowCount, 0, "YouTube's rows must not land in 0900000001's pool");
  assert.equal(b.covered, 0);
  assert.equal(b.missing.length, b.expected, "all of its occurrences are candidates");

  const a = sectionFor(m, "sub-1700000000020");
  assert.equal(a.notesRowCount, 19, "YouTube keeps its own rows");
});

// ---------------------------------------------------------------------------
// AC-6 — conflicting signatures are reported, never resolved
// ---------------------------------------------------------------------------

test("AC-6: notes evidence contradicting amount+category evidence marks CONFLICTED with both counts", () => {
  // The real 0900000002 shape: due day 26 at 500, logged on day 7 under the note
  // `Telecom`, with one incidental mention of the subscription's own name.
  const sub = subRow({ id: "sub-1700000000030", name: "0900000002", amount: "500", category_id: "digital", due_day: "26" });
  const rows = monthlyRows("2025-01", "2026-04", { amount: "500", category_id: "digital", notes: "Telecom" });
  rows[0][6] = "Telecom 0900000002";

  const m = model({ subs: [sub], expenses: rows });
  const s = sectionFor(m, "sub-1700000000030");

  assert.equal(s.classification, "CONFLICTED");
  assert.equal(s.notesRowCount, 1);
  assert.equal(s.amountRowCount, 16);
  assert.ok(Math.abs(s.coveredByNotes - s.coveredByAmountCategory) > 1);

  // Both signatures and both row counts reach the report, and the signature line
  // names neither as the answer.
  const text = renderReport({ ...m, generatedAt: "x" });
  const section = text.split("## ")[1];
  assert.match(section, /- signature: CONFLICTED — both signatures listed below, none chosen/);
  assert.match(section, /- notes "0900000002": 1 rows, covers \d+ occurrences/);
  assert.match(section, /- amount\+category 500\/digital: 16 rows, covers \d+ occurrences/);
});

// ---------------------------------------------------------------------------
// AC-7 — coverage counted per month across a cohort
// ---------------------------------------------------------------------------

const GYM = ["Member A gym", "Member B gym", "Member C gym", "Member D gym"].map((name, i) =>
  subRow({ id: `sub-17000000000${40 + i}`, name, amount: "400", category_id: "sports", due_day: "1" })
);

function gymModel(rowCount, ym = "2025-01") {
  return model({
    subs: GYM,
    expenses: Array.from({ length: rowCount }, () =>
      expRow({ date: `${ym}-01`, amount: "400", category_id: "sports", notes: "Gym counter" })
    ),
    todayIso: "2025-01-31",
  });
}

test("AC-7: four indistinguishable subscriptions against 4 rows in a month are all covered", () => {
  const m = gymModel(4);
  assert.equal(m.sections.reduce((n, s) => n + s.missing.length, 0), 0);
});

test("AC-7: the same cohort against 3 rows leaves exactly one missing, not zero and not four", () => {
  const m = gymModel(3);
  assert.equal(m.sections.reduce((n, s) => n + s.missing.length, 0), 1);
});

test("AC-7: a boolean 'is anything there?' test would report zero — one row does not cover four", () => {
  assert.equal(gymModel(1).sections.reduce((n, s) => n + s.missing.length, 0), 3);
});

// ---------------------------------------------------------------------------
// AC-8 — a month logged inside its neighbour
// ---------------------------------------------------------------------------

test("AC-8: April's candidates are flagged when March holds two complete sets", () => {
  // The real shape: 8 gym rows in 2026-03, none in 2026-04.
  const march = Array.from({ length: 8 }, () =>
    expRow({ date: "2026-03-01", amount: "400", category_id: "sports", notes: "Gym counter" })
  );
  const m = model({ subs: GYM, expenses: march, todayIso: "2026-04-30" });

  const april = m.sections.filter((s) => s.missing.includes("2026-04-01"));
  assert.equal(april.length, 4, "all four April occurrences are candidates");
  for (const s of april) {
    assert.ok(
      s.flags.includes("DOUBLE_LOGGED_NEIGHBOUR(2026-03)"),
      `${s.sub.name} must name the surplus month, got ${s.flags.join(",")}`
    );
  }
});

test("AC-8: a shortfall month with no surplus neighbour carries no flag", () => {
  const m = model({ subs: GYM, expenses: [], todayIso: "2026-04-30" });
  assert.ok(!m.sections.some((s) => s.flags.some((f) => f.startsWith("DOUBLE_LOGGED_NEIGHBOUR"))));
});

// ---------------------------------------------------------------------------
// AC-9 — no evidence anywhere
// ---------------------------------------------------------------------------

test("AC-9: a subscription nothing corroborates is NO-EVIDENCE with its full span proposed", () => {
  const m = model({
    subs: [subRow({ id: "sub-1700000000050", name: "Donation Fund Z", amount: "600", category_id: "donate", due_day: "5" })],
    // 27 rows at the same amount, none in its category and none mentioning it —
    // the exact false positive that month+amount matching scored at 19/20.
    expenses: monthlyRows("2025-01", "2026-07", { amount: "600", category_id: "groceries", notes: "Groceries run" }),
  });
  const s = sectionFor(m, "sub-1700000000050");

  assert.equal(s.classification, "NO-EVIDENCE");
  assert.equal(s.covered, 0);
  assert.equal(s.missing.length, s.expected);
  assert.equal(s.expected, 20);
});

// ---------------------------------------------------------------------------
// AC-10 / AC-11 — the report
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = [
  "classification", "signature", "distinct amounts seen", "expected",
  "covered", "missing", "missing dates", "flags", "amount", "decision",
];

test("AC-10: every active subscription appears exactly once with all required fields", () => {
  const subs = [
    ...GYM,
    subRow({ id: "sub-1700000000060", name: "YouTube", amount: "300", category_id: "digital", due_day: "10" }),
    subRow({ id: "sub-1700000000061", name: "Cancelled", is_active: "false" }),
  ];
  const m = model({ subs, expenses: monthlyRows("2025-01", "2026-07", { amount: "200", category_id: "digital", notes: "YouTube" }) });
  const text = renderReport({ ...m, generatedAt: "2026-08-18T00:00:00.000Z" });

  const headings = text.split("\n").filter((l) => l.startsWith("## "));
  assert.equal(headings.length, 5, "five active subscriptions, and the cancelled one is absent");

  const sections = parseReport(text);
  assert.deepEqual(sections.map((s) => s.subId).sort(), subs.slice(0, 5).map((r) => r[0]).sort());
  for (const s of sections) {
    for (const field of REQUIRED_FIELDS) {
      assert.ok(s.fields[field] !== undefined, `${s.subId} is missing "${field}"`);
    }
  }
});

test("AC-11: the report path is gitignored and an analysis run leaves the tree clean", async () => {
  fs.mkdirSync(path.dirname(DEFAULT_REPORT), { recursive: true });
  fs.writeFileSync(DEFAULT_REPORT, "# generated by a test\n", "utf8");

  // check-ignore exits 0 only when git itself considers the path ignored.
  execFileSync("git", ["check-ignore", "-q", DEFAULT_REPORT], { cwd: REPO_ROOT });

  const porcelain = execFileSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.ok(!porcelain.includes("backfill-reports"), `report surfaced in git status:\n${porcelain}`);
});

// ---------------------------------------------------------------------------
// AC-12 / AC-13 — decisions gate every write
// ---------------------------------------------------------------------------

function reportFor({ subs, expenses = [], todayIso = "2026-08-18" }) {
  const m = model({ subs, expenses, todayIso });
  return renderReport({ ...m, generatedAt: "2026-08-18T00:00:00.000Z" });
}

test("AC-12: every decision is generated as skip, and an unedited report writes nothing", async () => {
  const subs = [subRow({ id: "sub-1700000000070", name: "Sponsorship Fund Y", amount: "1000", category_id: "other", due_day: "20" })];
  const text = reportFor({ subs });

  for (const line of text.split("\n").filter((l) => l.startsWith("- decision:"))) {
    assert.equal(line, "- decision: skip");
  }

  const f = fixtureSheets({ subs });
  const plan = buildPlan(parseReport(text), subsOf(subs), "2026-08-18");
  assert.deepEqual(plan, [], "nothing is planned from an unedited report");

  const result = await applyPlan({
    sheets: f.sheets, spreadsheetId: "sheet-under-test", plan,
    createdAtIso: "2026-08-18T00:00:00.000Z", log: () => {},
  });
  assert.equal(result.created, 0);
  assert.deepEqual(mutations(f), [], "zero write calls reached the sheet");
});

test("AC-13: only backfill-marked subscriptions are written, and only their listed dates", async () => {
  const target = subRow({ id: "sub-1700000000080", name: "Netflix", amount: "150", category_id: "digital", due_day: "3" });
  const subs = [target, ...GYM];
  const text = reportFor({ subs });

  // Mark exactly one section backfill, and trim its dates to two.
  const edited = text
    .replace(/(## sub-1700000000080[\s\S]*?)- missing dates: [^\n]*/, "$1- missing dates: 2025-01-03, 2025-02-03")
    .replace(/(## sub-1700000000080[\s\S]*?)- decision: skip/, "$1- decision: backfill");

  const f = fixtureSheets({ subs });
  const plan = buildPlan(parseReport(edited), subsOf(subs), "2026-08-18");
  const result = await applyPlan({
    sheets: f.sheets, spreadsheetId: "sheet-under-test", plan,
    createdAtIso: "2026-08-18T00:00:00.000Z", log: () => {},
  });

  assert.equal(result.created, 2);
  assert.deepEqual(dataRows(f).map((r) => r[0]), [
    "exp-auto-sub-1700000000080-2025-01-03",
    "exp-auto-sub-1700000000080-2025-02-03",
  ], "no gym row was written and no other Netflix date");
});

// ---------------------------------------------------------------------------
// AC-14 — the amount is explicit and confirmable
// ---------------------------------------------------------------------------

test("AC-14: an amount the evidence contradicts is annotated with both, and apply writes the line's value", async () => {
  const youtube = subRow({ id: "sub-1700000000090", name: "YouTube", amount: "300", category_id: "digital", due_day: "10" });
  const text = reportFor({
    subs: [youtube],
    expenses: monthlyRows("2025-01", "2026-07", { amount: "200", category_id: "digital", notes: "YouTube" }),
  });

  const amountLine = text.split("\n").find((l) => l.startsWith("- amount:"));
  assert.match(amountLine, /300/, "the record amount is the default");
  assert.match(amountLine, /200/, "the observed amount is named too");

  // The captain resolves it to the historical price; that is what gets written.
  const edited = text
    .replace(/- amount: [^\n]*/, "- amount: 200")
    .replace(/- missing dates: [^\n]*/, "- missing dates: 2025-03-10")
    .replace("- decision: skip", "- decision: backfill");

  const f = fixtureSheets({ subs: [youtube] });
  const plan = buildPlan(parseReport(edited), subsOf([youtube]), "2026-08-18");
  await applyPlan({ sheets: f.sheets, spreadsheetId: "sheet-under-test", plan, createdAtIso: "2026-08-18T00:00:00.000Z", log: () => {} });

  assert.equal(dataRows(f)[0][EXPENSES_HEADER.indexOf("amount")], "200");
});

test("AC-14: an unedited amount line still parses despite its trailing annotation", () => {
  const youtube = subRow({ id: "sub-1700000000091", name: "YouTube", amount: "300", category_id: "digital", due_day: "10" });
  const text = reportFor({
    subs: [youtube],
    expenses: monthlyRows("2025-01", "2026-07", { amount: "200", category_id: "digital", notes: "YouTube" }),
  }).replace("- decision: skip", "- decision: backfill");

  const plan = buildPlan(parseReport(text), subsOf([youtube]), "2026-08-18");
  assert.equal(plan[0].amount, 300, "the comment must not leak into the value");
});

// ---------------------------------------------------------------------------
// AC-15 — the row is byte-identical to the scheduler's
// ---------------------------------------------------------------------------

test("AC-15: a backfilled row deep-equals the row runSubscriptionScheduler builds for the same date", async () => {
  const row = subRow({ id: "sub-1700000000100", name: "Netflix", amount: "150", category_id: "digital", due_day: "15" });
  const sub = subsOf([row])[0];
  const date = "2026-08-15";

  const f = fixtureSheets({ subs: [row] });
  const result = await runSubscriptionScheduler(f.sheets, "sheet-under-test", at(date));
  assert.equal(result.created_count, 1);
  const schedulerRow = dataRows(f)[0];

  const map = buildColumnMap([EXPENSES_HEADER], EXPENSES_SPEC);
  const backfilled = buildBackfillRow(map, sub, date, sub.amount, new Date(at(date)).toISOString());

  assert.deepEqual(backfilled, schedulerRow);
  assert.equal(backfilled.length, 10, "header width, not a hardcoded 8");
  assert.equal(backfilled[8], "", "month left blank");
  assert.equal(backfilled[9], "", "amount value left blank");
  assert.equal(backfilled[0], "exp-auto-sub-1700000000100-2026-08-15");
  assert.ok(!backfilled.includes("confirmed"), "no status field");
  assert.equal(map.index.status, undefined, "neither status nor subscription_id is a column");
  assert.equal(map.index.subscription_id, undefined);
});

test("AC-15: a renamed Expenses header halts the write instead of landing in the wrong column", async () => {
  const f = makeSheets({
    Expenses: { header: ["id", "date", "amount", "category_id", "paid_by", "created_by", "note", "created_at"], rows: [] },
    Subscriptions: { header: SUBS_HEADER, rows: [subRow()] },
  });
  const sub = subsOf([subRow()])[0];
  await assert.rejects(
    applyPlan({
      sheets: f.sheets, spreadsheetId: "sheet-under-test",
      plan: [{ sub, amount: 100, dates: ["2025-01-15"] }],
      createdAtIso: "2026-08-18T00:00:00.000Z", log: () => {},
    }),
    /missing required column header "notes"/
  );
  assert.equal(dataRows(f).length, 0, "nothing was written");
});

// ---------------------------------------------------------------------------
// AC-16 / AC-17 — existing ids and idempotency
// ---------------------------------------------------------------------------

const NF = subRow({ id: "sub-1700000000110", name: "Netflix", amount: "150", category_id: "digital", due_day: "3" });
const nfPlan = (dates) => [{ sub: subsOf([NF])[0], amount: 150, dates }];

test("AC-16: a candidate whose id already exists is skipped and counted, not rewritten", async () => {
  const seeded = expRow({ id: "exp-auto-sub-1700000000110-2025-01-03", date: "2025-01-03", amount: "111", notes: "hand-logged" });
  const f = fixtureSheets({ subs: [NF], expenses: [seeded] });

  const result = await applyPlan({
    sheets: f.sheets, spreadsheetId: "sheet-under-test",
    plan: nfPlan(["2025-01-03", "2025-02-03"]),
    createdAtIso: "2026-08-18T00:00:00.000Z", log: () => {},
  });

  assert.deepEqual({ created: result.created, skipped: result.skipped }, { created: 1, skipped: 1 });
  const survivor = dataRows(f).find((r) => r[0] === seeded[0]);
  assert.deepEqual(survivor, seeded, "the pre-existing row is untouched");
});

test("AC-17: a second apply against the same sheet and decisions creates nothing", async () => {
  const f = fixtureSheets({ subs: [NF] });
  const dates = ["2025-01-03", "2025-02-03", "2025-03-03"];
  const args = { sheets: f.sheets, spreadsheetId: "sheet-under-test", createdAtIso: "2026-08-18T00:00:00.000Z", log: () => {} };

  const first = await applyPlan({ ...args, plan: nfPlan(dates) });
  assert.equal(first.created, 3);
  const after = dataRows(f).map((r) => r.slice());

  const second = await applyPlan({ ...args, plan: nfPlan(dates) });
  assert.deepEqual({ created: second.created, skipped: second.skipped }, { created: 0, skipped: 3 });
  assert.deepEqual(dataRows(f), after, "row count and every row's contents unchanged");
});

// ---------------------------------------------------------------------------
// AC-18 — dry run
// ---------------------------------------------------------------------------

test("AC-18: --dry-run prints one line per row and touches nothing", async () => {
  const f = fixtureSheets({ subs: [NF] });
  const boom = async () => { throw new Error("a write was attempted during --dry-run"); };
  f.sheets.spreadsheets.batchUpdate = boom;
  f.sheets.spreadsheets.values.update = boom;
  f.sheets.spreadsheets.values.append = boom;

  const lines = [];
  const result = await applyPlan({
    sheets: f.sheets, spreadsheetId: "sheet-under-test",
    plan: nfPlan(["2025-01-03", "2025-02-03", "2025-03-03"]),
    createdAtIso: "2026-08-18T00:00:00.000Z", dryRun: true, log: (l) => lines.push(l),
  });

  assert.equal(result.created, 0);
  assert.equal(result.wouldCreate, 3);
  const printed = lines.filter((l) => l.startsWith("[dry-run] would write "));
  assert.equal(printed.length, 3, "one line per row it would have written");
  assert.match(printed[0], /exp-auto-sub-1700000000110-2025-01-03/);
  assert.equal(dataRows(f).length, 0);
});

// ---------------------------------------------------------------------------
// AC-19 — partial failure is recoverable and reported
// ---------------------------------------------------------------------------

test("AC-19: a batch failing partway names the ids that landed, and a re-run finishes the rest", async () => {
  const f = fixtureSheets({ subs: [NF] });
  const dates = ["2025-01-03", "2025-02-03", "2025-03-03"];
  const real = f.sheets.spreadsheets.batchUpdate;
  let calls = 0;
  f.sheets.spreadsheets.batchUpdate = async (args) => {
    if (++calls === 2) throw new Error("Sheets 503: backend error");
    return real(args);
  };

  const args = { sheets: f.sheets, spreadsheetId: "sheet-under-test", createdAtIso: "2026-08-18T00:00:00.000Z", batchSize: 1, log: () => {} };
  const err = await applyPlan({ ...args, plan: nfPlan(dates) }).then(
    () => null,
    (e) => e
  );

  assert.ok(err instanceof PartialWriteError, "the failure is typed so the CLI can report it");
  assert.deepEqual(err.writtenIds, ["exp-auto-sub-1700000000110-2025-01-03"]);
  assert.equal(dataRows(f).length, 1);

  f.sheets.spreadsheets.batchUpdate = real;
  const retry = await applyPlan({ ...args, plan: nfPlan(dates) });
  assert.deepEqual({ created: retry.created, skipped: retry.skipped }, { created: 2, skipped: 1 });
  assert.deepEqual(dataRows(f).map((r) => r[0]).sort(), dates.map((d) => `exp-auto-sub-1700000000110-${d}`));
});

// ---------------------------------------------------------------------------
// AC-20 — backfill and scheduler cannot collide
// ---------------------------------------------------------------------------

test("AC-20: the daily scheduler seeing a backfilled date creates no second row", async () => {
  const date = "2026-08-03";
  const f = fixtureSheets({ subs: [NF] });

  await applyPlan({
    sheets: f.sheets, spreadsheetId: "sheet-under-test", plan: nfPlan([date]),
    createdAtIso: new Date(at(date)).toISOString(), log: () => {},
  });
  const before = dataRows(f).length;
  assert.equal(before, 1);

  const result = await runSubscriptionScheduler(f.sheets, "sheet-under-test", at(date));
  assert.deepEqual(
    { created: result.created_count, skipped: result.skipped_count },
    { created: 0, skipped: 1 }
  );
  assert.equal(f.grids.Expenses.slice(1).filter((r) => r[0]).length, before, "row count unchanged");
});

// ---------------------------------------------------------------------------
// Edge cases with no AC of their own
// ---------------------------------------------------------------------------

test("an invalid decision word halts with the offending line quoted and writes nothing", () => {
  const text = reportFor({ subs: [NF] }).replace("- decision: skip", "- decision: yes please");
  assert.throws(
    () => buildPlan(parseReport(text), subsOf([NF]), "2026-08-18"),
    (e) => e instanceof ReportError && /yes please/.test(e.message) && /line \d+:/.test(e.message)
  );
});

test("a date the subscription was never due on halts rather than being written", () => {
  const text = reportFor({ subs: [NF] })
    .replace(/- missing dates: [^\n]*/, "- missing dates: 2025-01-04")
    .replace("- decision: skip", "- decision: backfill");
  assert.throws(
    () => buildPlan(parseReport(text), subsOf([NF]), "2026-08-18"),
    (e) => e instanceof ReportError && /never due on 2025-01-04/.test(e.message)
  );
});

test("a non-numeric amount halts rather than writing NaN into the sheet", () => {
  const text = reportFor({ subs: [NF] })
    .replace(/- amount: [^\n]*/, "- amount: about five hundred")
    .replace("- decision: skip", "- decision: backfill");
  assert.throws(
    () => buildPlan(parseReport(text), subsOf([NF]), "2026-08-18"),
    (e) => e instanceof ReportError && /not a positive number/.test(e.message)
  );
});

test("a subscription deactivated between analyze and apply halts rather than writing", () => {
  const text = reportFor({ subs: [NF] })
    .replace(/- missing dates: [^\n]*/, "- missing dates: 2025-01-03")
    .replace("- decision: skip", "- decision: backfill");
  const deactivated = subsOf([subRow({ id: NF[0], name: "Netflix", due_day: "3", is_active: "false" })]);
  assert.throws(
    () => buildPlan(parseReport(text), deactivated, "2026-08-18"),
    (e) => e instanceof ReportError && /not active/.test(e.message)
  );
});

test("a span reaching back before both the record and any evidence is flagged, not proposed silently", () => {
  // sub-<epoch> for 2026-07-29, with nothing corroborating it in 19 months.
  const created = Date.parse("2026-07-29T00:00:00+08:00");
  const m = model({
    subs: [subRow({ id: `sub-${created}`, name: "Unknowable", amount: "1234", category_id: "other", due_day: "8" })],
  });
  const s = m.sections[0];
  assert.equal(s.classification, "NO-EVIDENCE");
  assert.ok(s.flags.includes("SPAN_PRECEDES_RECORD_CREATION"), s.flags.join(","));
  assert.equal(s.recordCreatedAt, "2026-07-29");
});

test("an annual subscription's small occurrence count is reported like any other", () => {
  const m = model({
    subs: [subRow({ id: "sub-1700000000120", name: "Annual Levy Z", amount: "700", category_id: "tax", frequency: "annual", due_day: "2", due_month: "6" })],
  });
  assert.equal(m.sections[0].expected, 2);
  assert.deepEqual(m.sections[0].missing, ["2025-06-02", "2026-06-02"]);
});
