// Run with: npm run build && node --test test/   (or npm test)
//
// Entity 061 — migrate the captain's 2023 and 2024 historical expenses into the app.
//
// Every fixture here is SYNTHETIC (AC-11): the grid reproduces the archive
// workbook's structure — three stacked bands with byte-identical A-C columns,
// interleaved month-total columns, a blank-labelled amount column holding real
// data, a day with no amount column, text-stored amounts, a duplicated empty date
// pair, an inconsistent month total — with invented numbers.
//
// TWO OF THESE TESTS EXIST BECAUSE THE FAILURE THEY GUARD IS SILENT. A parser that
// drops a column or a text-typed amount reports success: the totals reconcile, the
// categories resolve, the dates are valid, and the records are simply not there. So
// those two do not merely assert the right answer — they REINTRODUCE the defect into
// a patched copy of the script and assert the copy fails, and fails naming the
// column. A green assertion nobody watched go red is not evidence.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { makeSheets } = require("./sheetsStub");

const SCRIPTS = path.resolve(__dirname, "..", "scripts");
const extractor = require(path.join(SCRIPTS, "extract-historical-expenses.js"));
const { resolveTargets, TargetError } = require(path.join(SCRIPTS, "migration-env.js"));

const {
  ExtractError,
  SHEET_COLUMNS,
  CONTROL_ROW_MARKER,
  columnLetter,
  discoverBands,
  bandYear,
  classifyColumns,
  accountForBand,
  emitBandRows,
  varianceForBand,
  renderVarianceReport,
  extract,
  sheetGridFor,
  parseSheetGrid,
  carryForward,
} = extractor;

const FIXTURE_PATH = path.join(__dirname, "fixtures", "historical-bands.json");
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));

const grid = () => JSON.parse(JSON.stringify(FIXTURE.rows));

// Column indexes in the fixture, named so the assertions read as claims about the
// source's shape rather than as magic numbers.
const COL = {
  janTotal: 5,
  d0101name: 6,
  d0101amount: 7,
  d0102amount: 9, // TEXT-stored amount
  d0103amount: 11, // BLANK label — the column-MI shape
  d0104amount: 13,
  febTotal: 16,
  d0201amount: 18,
  d0202name: 19, // no amount column: the next column is a dated 品名
  d0203name: 20, // holds a NUMERIC item name
  d0203amount: 21,
};

const STUB_ENV = {
  SPREADSHEET_ID_STAGING: "staging-sheet",
  GOOGLE_SERVICE_ACCOUNT_KEY_STAGING: JSON.stringify({ client_email: "staging@test.invalid" }),
  SPREADSHEET_ID_PRODUCTION: "production-sheet",
  GOOGLE_SERVICE_ACCOUNT_KEY_PRODUCTION: JSON.stringify({ client_email: "production@test.invalid" }),
};

const silent = () => {};

function tmpFile(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "e061-")), name);
}

// ---------------------------------------------------------------------------
// The falsification harness
// ---------------------------------------------------------------------------

/**
 * Loads a copy of a script with substitutions applied, so a test can reintroduce a
 * specific defect and watch the guard fire on it.
 *
 * `replacements` are exact-string edits; each MUST match exactly once, or the load
 * throws. That matters more than it looks: if a refactor moves the line a patch
 * targets, the patch would silently apply to nothing and the test would go green
 * while proving nothing at all.
 */
function loadPatched(scriptName, replacements) {
  const source = fs.readFileSync(path.join(SCRIPTS, scriptName), "utf8");
  let patched = source;
  for (const [from, to] of replacements) {
    const occurrences = patched.split(from).length - 1;
    assert.equal(
      occurrences,
      1,
      `falsification patch must match exactly once in ${scriptName}, matched ${occurrences}x:\n${from}`
    );
    patched = patched.replace(from, to);
  }
  // Relative requires would not resolve from a temp directory.
  patched = patched.replace(/require\("\.\/([\w-]+)"\)/g, (_m, mod) =>
    `require(${JSON.stringify(path.join(SCRIPTS, mod))})`
  );
  const file = tmpFile(`patched-${scriptName}`);
  fs.writeFileSync(file, patched, "utf8");
  return require(file);
}

// ---------------------------------------------------------------------------
// AC-3 — day-column pairing
// ---------------------------------------------------------------------------

test("AC-3a: a day pair is a dated 品名 column plus the NEXT column whatever its label", () => {
  const bands = discoverBands(grid());
  const band = { ...bands[0], year: bandYear(grid(), bands[0]) };
  const c = classifyColumns(grid(), band);

  const blankLabelled = c.days.find((d) => d.amountCol === COL.d0103amount);
  assert.ok(blankLabelled, "the day whose amount column has a BLANK label must still be paired");
  assert.equal(blankLabelled.iso, "2024-01-03");
  assert.equal(
    extractor.text(c.labels[COL.d0103amount]),
    "",
    "fixture precondition: column L's label really is blank, which is the MI defect's shape"
  );

  // It carries real data — 4 of the 2024 band's 10 amount cells sit in it, so
  // dropping it is not a rounding error.
  const fromBlank = emitBandRows(grid(), band, c).filter((r) => r.key.endsWith(`-c${columnLetter(COL.d0103amount)}`));
  assert.equal(fromBlank.length, 3);
  assert.deepEqual(fromBlank.map((r) => r.amount), ["310", "70", "15"]);
});

test("AC-3b: the month-total columns contribute zero expense rows", () => {
  const g = grid();
  const bands = discoverBands(g);
  const band = { ...bands[0], year: bandYear(g, bands[0]) };
  const c = classifyColumns(g, band);

  assert.equal(c.monthTotalColumns ?? c.monthTotalCols.length, 2, "two months in the fixture, two month-total columns");
  assert.deepEqual(c.monthTotalCols, [COL.janTotal, COL.febTotal]);

  const rows = emitBandRows(g, band, c);
  const totalColLetters = [columnLetter(COL.janTotal), columnLetter(COL.febTotal)];
  for (const letter of totalColLetters) {
    assert.equal(
      rows.filter((r) => r.key.endsWith(`-c${letter}`)).length,
      0,
      `column ${letter} is a month total and must contribute no row`
    );
  }

  // And the arithmetic proof that it is not double-counting: the month-total cells
  // hold the same money as the day cells, so a parser that walked columns
  // indiscriminately would report roughly twice the real sum.
  const emitted = rows.reduce((n, r) => n + Number(r.amount), 0);
  const totals = [COL.janTotal, COL.febTotal].reduce((n, col) => {
    for (let r = band.firstDataRow; r <= band.lastDataRow; r++) n += Number(g[r - 1][col] || 0);
    return n;
  }, 0);
  assert.ok(totals > 0);
  assert.equal(emitted, 1840);
  // The month totals are the same money seen twice, except row 5's deliberate
  // February inconsistency (999 against a real 25). A parser that walked the
  // columns indiscriminately would report 2,814 where the household spent 1,840.
  assert.equal(totals, 1840 + (999 - 25));
});

test("AC-3c: a day whose next column is itself a dated 品名 gets no amount column", () => {
  const g = grid();
  const bands = discoverBands(g);
  const band = { ...bands[0], year: bandYear(g, bands[0]) };
  const c = classifyColumns(g, band);

  const feb2 = c.days.find((d) => d.iso === "2024-02-02");
  assert.ok(feb2);
  assert.equal(feb2.amountCol, null, "2024-02-02 has no amount column in the fixture");
  assert.match(feb2.skipReason, new RegExp(columnLetter(COL.d0203name)));

  // The falsifying value: 900 sits in 02-03's ITEM NAME column. A "the amount is
  // always the next column" rule reads it as 02-02's amount.
  assert.equal(g[band.firstDataRow - 1][COL.d0203name], 900, "fixture precondition");
  const rows = emitBandRows(g, band, c);
  assert.equal(
    rows.filter((r) => r.amount === "900").length,
    0,
    "900 is an item name, not an amount — emitting it would invent an expense"
  );
});

test("AC-3d: an amount column labelled neither 金額 nor blank aborts the run", () => {
  const g = grid();
  const bands = discoverBands(g);
  const band = { ...bands[0], year: bandYear(g, bands[0]) };

  g[band.labelRow - 1][COL.d0101amount] = "備註"; // a shape this parser does not understand
  assert.throws(
    () => classifyColumns(g, band),
    (err) =>
      err instanceof ExtractError &&
      err.message.includes(`Column ${columnLetter(COL.d0101amount)}`) &&
      err.message.includes("備註"),
    "an unrecognised amount-column label must abort naming the column, not be guessed at"
  );
});

// ---------------------------------------------------------------------------
// AC-19 — the whole-band accounting, and the defect it exists to catch
// ---------------------------------------------------------------------------

test("AC-19: every numeric cell in a band is a day amount, a day item name, or a month total", () => {
  const result = extract(grid());
  const y2024 = result.bands.find((b) => b.year === 2024).accounting;
  const y2023 = result.bands.find((b) => b.year === 2023).accounting;

  assert.equal(y2024.dayAmount + y2024.dayItemName + y2024.monthTotal, y2024.total);
  assert.equal(y2024.unaccounted, 0);
  assert.deepEqual(
    [y2024.dayAmount, y2024.dayItemName, y2024.monthTotal, y2024.total],
    [10, 2, 6, 18]
  );
  assert.equal(y2023.unaccounted, 0);
  assert.deepEqual(
    [y2023.dayAmount, y2023.dayItemName, y2023.monthTotal, y2023.total],
    [9, 0, 6, 15]
  );

  // The numeric item names are the part a naive audit gets wrong: 7 and 900 are
  // numbers sitting in 品名 columns. Counting them as amounts would invent two
  // expenses; not counting them at all would leave the accounting short.
  assert.equal(y2024.dayItemName, 2);
});

test("AC-19 falsified: reintroducing the 金額-label discriminator makes the accounting abort naming the column", () => {
  // The exact defect this entity already shipped once and caught late: keying the
  // amount column on its `金額` label. Column L's label is blank, so the old rule
  // never reaches it.
  const OLD_RULE = [
    [
      `    } else {
      const nextLabel = label(next);`,
      `    } else if (label(next) !== AMOUNT_LABEL) {
      skipReason = "reintroduced defect: the amount column's label is not 金額";
    } else {
      const nextLabel = label(next);`,
    ],
  ];
  const broken = loadPatched("extract-historical-expenses.js", OLD_RULE);

  assert.throws(
    () => broken.extract(grid()),
    (err) => {
      assert.match(err.message, /whole-band accounting failed/);
      assert.match(err.message, /unaccounted/);
      // 2023 is extracted first, and column L holds two of its amount cells.
      assert.match(err.message, /^Band 2023: /);
      assert.match(
        err.message,
        new RegExp(`${columnLetter(COL.d0103amount)} \\(2 cells, label ""\\)`),
        "the abort must name column L and how many cells it is about to lose"
      );
      return true;
    },
    "the accounting assertion is the ONLY thing standing between this defect and a silent data loss"
  );

  // And this is why AC-19 is a criterion of its own: with the residue assertion
  // removed, the same defect reports SUCCESS with rows missing. Nothing else in the
  // suite notices — the emitted rows are all correct, there are simply fewer of them.
  const brokenAndUnaudited = loadPatched("extract-historical-expenses.js", [
    ...OLD_RULE,
    ["  if (residueColumns.length > 0 || accounted !== total) {", "  if (false) {"],
  ]);
  const quiet = brokenAndUnaudited.extract(grid());
  const honest = extract(grid());
  assert.equal(honest.rows.length, 19);
  assert.equal(quiet.rows.length, 14, "five real expense records vanish, and the run exits 0");
  const lost = honest.rows.filter((r) => !quiet.rows.some((q) => q.key === r.key));
  assert.deepEqual(
    lost.map((r) => r.key),
    ["2023-r10-cL", "2023-r11-cL", "2024-r3-cL", "2024-r4-cL", "2024-r5-cL"]
  );
});

// ---------------------------------------------------------------------------
// Text-stored amounts — the second silent-drop trap
// ---------------------------------------------------------------------------

test("text-stored amounts parse rather than being dropped by a typeof-number check", () => {
  const g = grid();
  const result = extract(g);

  // Which cells in the fixture store their amount as a STRING. On the live source
  // this is 10 cells in 2024 and 47 in 2023.
  const textCells = [];
  for (const band of result.bands) {
    const bands = discoverBands(g);
    const b = bands.find((x) => x.firstDataRow === band.firstDataRow);
    const c = classifyColumns(g, { ...b, year: band.year });
    for (const day of c.days) {
      if (day.amountCol === null) continue;
      for (let r = band.firstDataRow; r <= band.lastDataRow; r++) {
        const v = g[r - 1][day.amountCol];
        if (typeof v === "string" && v.trim() !== "") {
          textCells.push({ key: `${band.year}-r${r}-c${columnLetter(day.amountCol)}`, raw: v });
        }
      }
    }
  }
  assert.equal(textCells.length, 3, "fixture precondition: three amounts are stored as text");

  for (const cell of textCells) {
    const row = result.rows.find((r) => r.key === cell.key);
    assert.ok(row, `${cell.key} stores its amount as the string ${JSON.stringify(cell.raw)} and must still be emitted`);
    assert.equal(row.amount, String(Number(cell.raw)));
  }
});

test("falsified: a typeof-number amount check silently drops every text-stored amount", () => {
  const broken = loadPatched("extract-historical-expenses.js", [
    ["      if (text(raw) === \"\") return;", "      if (typeof raw !== \"number\") return;"],
  ]);
  const quiet = broken.extract(grid());
  const honest = extract(grid());

  const lost = honest.rows.filter((r) => !quiet.rows.some((q) => q.key === r.key));
  assert.deepEqual(
    lost.map((r) => `${r.key}=${r.amount}`),
    ["2023-r9-cJ=22", "2023-r10-cJ=33", "2024-r3-cJ=250"],
    "three real expense records, gone, with exit code 0 and no warning"
  );
  assert.equal(quiet.rows.length, honest.rows.length - 3);
});

test("an amount that genuinely does not parse aborts naming the cell, and never becomes 0", () => {
  const g = grid();
  const bands = discoverBands(g);
  const band = { ...bands[0], year: bandYear(g, bands[0]) };
  g[band.firstDataRow - 1][COL.d0101amount] = "not-a-number";
  const c = classifyColumns(g, band);

  assert.throws(
    () => emitBandRows(g, band, c),
    (err) =>
      err instanceof ExtractError &&
      err.message.includes(`Daily!${columnLetter(COL.d0101amount)}${band.firstDataRow}`),
    "the abort must name the source cell so the captain can go look at it"
  );

  const broken = loadPatched("extract-historical-expenses.js", [
    [
    `  if (s === "" || !Number.isFinite(n)) {`,
    `  if (false) {`,
    ],
  ]);
  const brokenBands = broken.discoverBands(g);
  const quiet = broken.emitBandRows(g, { ...brokenBands[0], year: 2024 }, broken.classifyColumns(g, brokenBands[0]));
  const zeroed = quiet.filter((r) => r.amount === "NaN" || r.amount === "0");
  assert.equal(zeroed.length, 1, "without the abort, an unparseable amount becomes a row nobody would question");
});

// ---------------------------------------------------------------------------
// AC-4 — no row dated outside 2023 or 2024
// ---------------------------------------------------------------------------

test("AC-4a: bands are discovered from column A and selected by year, never by position", () => {
  const g = grid();
  const bands = discoverBands(g);
  assert.equal(bands.length, 3, "the fixture holds three bands, as the live tab does");
  assert.deepEqual(
    bands.map((b) => [b.dateHeaderRow, b.labelRow, b.firstDataRow, b.lastDataRow]),
    [[1, 2, 3, 5], [7, 8, 9, 11], [13, 14, 15, 17]]
  );
  assert.deepEqual(bands.map((b) => bandYear(g, b)), [2024, 2023, 2022]);

  const result = extract(g);
  assert.deepEqual(result.bands.map((b) => b.year), [2023, 2024]);
  assert.deepEqual(result.skippedBands, [{ year: 2022, firstDataRow: 15, lastDataRow: 17 }]);
  assert.equal(result.rows.filter((r) => !["2023", "2024"].includes(r.year)).length, 0);
  assert.equal(result.rows.filter((r) => r.date.startsWith("2022-")).length, 0);

  // The 2022 band is not empty — it carries data, so a positional selector would
  // land eight well-formed, correctly-categorised rows in the app under the wrong
  // year. Columns A-C are byte-identical across the three bands, so nothing in the
  // taxonomy would look wrong.
  const withOutOfScope = extract(g, { years: [2022, 2023, 2024] });
  assert.equal(withOutOfScope.rows.filter((r) => r.year === "2022").length, 6);
  assert.deepEqual(g[2].slice(0, 3), g[8].slice(0, 3));
  assert.deepEqual(g[2].slice(0, 3), g[14].slice(0, 3));
});

test("AC-4b: a day column dated outside its band's declared year aborts, naming the row", () => {
  const g = grid();
  const bands = discoverBands(g);
  const band = { ...bands[0], year: 2024 };
  const c = classifyColumns(g, band);
  // The band still declares 2024; one of its day columns now claims 2023. This is
  // the enforcement point that catches a band whose header row disagrees with its
  // own day columns — the case bandYear() cannot see because it derives the year
  // from those same dates.
  c.days.find((d) => d.iso === "2024-01-01").iso = "2023-01-01";

  assert.throws(
    () => emitBandRows(g, band, c),
    (err) => err instanceof ExtractError && err.message.includes("outside") && err.message.includes("2023-01-01"),
    "a row attributed to the wrong year is well-formed and correctly categorised — only a date check sees it"
  );
});

test("bandYear refuses to pick a year when a header row carries two", () => {
  const g = grid();
  const bands = discoverBands(g);
  g[bands[0].dateHeaderRow - 1][COL.d0102amount - 1] = g[bands[1].dateHeaderRow - 1][COL.d0102amount - 1];
  assert.throws(
    () => bandYear(g, bands[0]),
    (err) => err instanceof ExtractError && /distinct years/.test(err.message)
  );
});

// ---------------------------------------------------------------------------
// AC-15 — the workbook's self-disagreement is reported and gates nothing
// ---------------------------------------------------------------------------

test("AC-15: an inconsistent month total is reported, and the run still exits 0", () => {
  const g = grid();
  const bands = discoverBands(g);
  const band = { ...bands[0], year: 2024 };
  const months = varianceForBand(g, band, classifyColumns(g, band));

  assert.equal(months.length, 2);
  assert.deepEqual(months.map((m) => m.month), ["2024-01", "2024-02"]);

  const feb = months.find((m) => m.month === "2024-02");
  assert.equal(feb.rowMismatchCount, 1, "row 5's February total says 999 where its day cells say 25");
  assert.deepEqual(feb.rowMismatches.map((x) => x.row), [5]);
  assert.equal(feb.difference, 999 - 25);

  const jan = months.find((m) => m.month === "2024-01");
  assert.equal(jan.rowMismatchCount, 0);
  assert.equal(jan.difference, 0);

  // The property, not the number: a variance does not gate. Falsified by making the
  // extractor exit non-zero past a threshold — which is what made the original AC-2
  // unfalsifiable, breaking on the captain's spreadsheet rather than on our defect.
  assert.doesNotThrow(() => extract(g));
  const rendered = renderVarianceReport([{ year: 2024, months }], "2026-08-31T00:00:00.000Z");
  assert.match(rendered, /gates nothing/);
  assert.match(rendered, /2024-02/);
});

// ---------------------------------------------------------------------------
// AC-16 — a re-generate cannot lose a hand correction
// ---------------------------------------------------------------------------

/** The prior tab as it would exist after the captain edited four cells by hand. */
function priorTabWithEdits(rows, edits = {}) {
  const withShadows = rows.map((r) => {
    const out = { ...r };
    for (const col of extractor.SHADOWED_COLUMNS) out[`gen_${col}`] = r[col] ?? "";
    return out;
  });
  for (const [key, changes] of Object.entries(edits)) {
    const row = withShadows.find((r) => r.key === key);
    assert.ok(row, `no such key in the fixture extraction: ${key}`);
    Object.assign(row, changes);
  }
  return withShadows;
}

test("AC-16b: four hand edits carry forward onto the right keys, matched on key and not on row position", () => {
  const fresh = extract(grid()).rows;
  const prior = priorTabWithEdits(fresh, {
    "2024-r3-cH": { date: "2024-01-05" },
    "2024-r3-cJ": { amount: "999" },
    "2024-r4-cL": { category_name_en: "Medical" },
    "2024-r5-cV": { status: "exclude" },
    "2023-r9-cH": { captain_note: "check this one" },
  });

  const merged = carryForward(fresh, prior);
  assert.deepEqual(merged.conflicts, []);
  const byKey = new Map(merged.rows.map((r) => [r.key, r]));

  assert.equal(byKey.get("2024-r3-cH").date, "2024-01-05");
  assert.equal(byKey.get("2024-r3-cH").date_source, "captain", "a hand-corrected date is marked as hers");
  assert.equal(byKey.get("2024-r3-cJ").amount, "999");
  assert.equal(byKey.get("2024-r4-cL").category_name_en, "Medical");
  assert.equal(byKey.get("2024-r5-cV").status, "exclude");
  assert.equal(byKey.get("2023-r9-cH").captain_note, "check this one");

  // Untouched rows keep the extractor's values.
  assert.equal(byKey.get("2024-r3-cL").amount, "310");
  assert.equal(byKey.get("2024-r3-cL").date_source, "header");

  // The falsifier AC-16 names: matching on row index instead of on key. Drop one
  // row from the fresh extraction and every positional match after it shifts, while
  // the key match does not move at all.
  const shifted = fresh.filter((r) => r.key !== "2023-r9-cH");
  const shiftedMerge = carryForward(shifted, prior);
  const shiftedByKey = new Map(shiftedMerge.rows.map((r) => [r.key, r]));
  assert.equal(shiftedByKey.get("2024-r3-cJ").amount, "999");
  assert.equal(shiftedByKey.get("2024-r4-cL").category_name_en, "Medical");
  assert.equal(shiftedByKey.get("2024-r5-cV").status, "exclude");
});

test("AC-16c: a key whose source cell was blanked arrives as orphaned rather than vanishing", () => {
  const fresh = extract(grid()).rows;
  const prior = priorTabWithEdits(fresh, { "2024-r3-cH": { amount: "888", captain_note: "hers" } });

  const g = grid();
  g[2][COL.d0101amount] = ""; // blank the source cell behind 2024-r3-cH
  const afterBlank = extract(g).rows;
  assert.equal(afterBlank.some((r) => r.key === "2024-r3-cH"), false, "the source no longer produces that key");

  const merged = carryForward(afterBlank, prior);
  const orphan = merged.rows.find((r) => r.key === "2024-r3-cH");
  assert.ok(orphan, "her correction must not disappear because a source cell went blank");
  assert.equal(orphan.status, "orphaned");
  assert.equal(orphan.amount, "888");
  assert.equal(orphan.captain_note, "hers");
  assert.equal(merged.orphaned.length, 1);
});

test("AC-16: a correction the extractor cannot reconcile stops the run instead of picking a winner", () => {
  const fresh = extract(grid()).rows;
  // She edited the amount; the source cell has since changed underneath it. Neither
  // value is safe to choose for her.
  const prior = priorTabWithEdits(fresh, { "2024-r3-cH": { amount: "500" } });
  prior.find((r) => r.key === "2024-r3-cH").gen_amount = "100";

  const g = grid();
  g[2][COL.d0101amount] = 123;
  const merged = carryForward(extract(g).rows, prior);

  assert.equal(merged.conflicts.length, 1);
  assert.deepEqual(merged.conflicts[0], {
    key: "2024-r3-cH",
    column: "amount",
    captainValue: "500",
    previouslyGenerated: "100",
    nowGenerated: "123",
  });
});

test("AC-16a: --generate into an existing tab exits non-zero and mutates nothing", async () => {
  const existing = { header: ["key"], rows: [["kept"]] };
  const stub = makeSheets({ "Migration 2023-2024": existing, Expenses: { header: ["id"], rows: [] } });
  const before = JSON.stringify(stub.grids);

  await assert.rejects(
    extractor.run(
      ["--generate", "--into", "Migration 2023-2024", "--fixture", FIXTURE_PATH, "--variance-report", tmpFile("v.md")],
      { log: silent, env: STUB_ENV, sheetsFor: async () => stub.sheets }
    ),
    (err) => err instanceof ExtractError && /already exists/.test(err.message) && /--carry-from/.test(err.message)
  );

  assert.equal(JSON.stringify(stub.grids), before, "the tab holding her corrections must be byte-identical");
  assert.equal(stub.requests.filter((r) => r.startsWith("ADDSHEET")).length, 0);
  assert.equal(stub.requests.filter((r) => r.startsWith("UPDATE")).length, 0);
});

test("--generate writes the control row with a blank approval cell and a digest", async () => {
  const stub = makeSheets({ Expenses: { header: ["id"], rows: [] } });
  const result = await extractor.run(
    ["--generate", "--into", "Migration 2023-2024", "--fixture", FIXTURE_PATH, "--variance-report", tmpFile("v.md")],
    { log: silent, env: STUB_ENV, sheetsFor: async () => stub.sheets }
  );

  const written = stub.grids["Migration 2023-2024"];
  assert.ok(written, "the tab must have been created");
  assert.equal(written[0][0], CONTROL_ROW_MARKER);
  assert.equal(written[0][1], "", "B1 must be blank — the import refuses until the captain types APPROVED");
  assert.match(written[0][2], /^generated=\S+ digest=[0-9a-f]{32}$/);
  assert.deepEqual(written[1], SHEET_COLUMNS);
  assert.equal(written.length, 2 + result.rows.length);

  const parsed = parseSheetGrid(written);
  assert.equal(parsed.control.approval, "");
  assert.equal(parsed.control.digest, result.digest);
  assert.equal(parsed.rows.length, 19);
});

test("the normalization sheet round-trips through its own parser", () => {
  const rows = extract(grid()).rows;
  const { grid: sheet, digest } = sheetGridFor(rows, "2026-08-31T00:00:00.000Z");
  const parsed = parseSheetGrid(sheet);
  assert.equal(parsed.control.digest, digest);
  assert.deepEqual(parsed.rows.map((r) => r.key), rows.map((r) => r.key));
  assert.deepEqual(parsed.rows.map((r) => r.amount), rows.map((r) => r.amount));
  // The extractor's own values are shadowed, so a later hand edit is detectable.
  for (const row of parsed.rows) {
    assert.equal(row.gen_amount, row.amount);
    assert.equal(row.gen_status, row.status);
  }
});

// ---------------------------------------------------------------------------
// AC-17 — the two credential sets, side by side
// ---------------------------------------------------------------------------

test("AC-17: --target staging resolves the staging write id, not load-local-env's own", () => {
  const env = { ...STUB_ENV, SPREADSHEET_ID: "whatever-load-local-env-resolved" };
  const t = resolveTargets({ target: "staging", env });
  assert.equal(t.write.spreadsheetId, "staging-sheet");
  assert.notEqual(t.write.spreadsheetId, env.SPREADSHEET_ID);
});

test("AC-17: --target production writes to production while STILL reading with staging credentials", () => {
  const t = resolveTargets({ target: "production", env: STUB_ENV });

  assert.equal(t.write.spreadsheetId, "production-sheet");
  assert.equal(t.write.name, "production");
  // The half a write-only test would miss. The production service account gets
  // `403 The caller does not have permission` on the captain's archive workbook, so
  // a single swappable credential pair makes `--target production` unable to read
  // its own source. The read pair must stay staging.
  assert.equal(t.read.name, "staging");
  assert.equal(t.read.spreadsheetId, "staging-sheet");
  assert.equal(
    JSON.parse(t.read.credentialsJson).client_email,
    "staging@test.invalid"
  );
  assert.equal(
    JSON.parse(t.write.credentialsJson).client_email,
    "production@test.invalid"
  );

  // Two distinct objects in the same run, not one mutated in place.
  assert.notEqual(t.read, t.write);
  assert.notEqual(t.read.credentialsJson, t.write.credentialsJson);
});

test("AC-17: a missing staging credential fails before any target is contacted", () => {
  assert.throws(
    () => resolveTargets({ target: "production", env: { ...STUB_ENV, GOOGLE_SERVICE_ACCOUNT_KEY_STAGING: "" } }),
    (err) => err instanceof TargetError && /readable only by the staging service account/.test(err.message)
  );
});

test("resolveTargets refuses an absent or unknown target", () => {
  assert.throws(() => resolveTargets({ target: null, env: STUB_ENV }), TargetError);
  assert.throws(() => resolveTargets({ target: "prod", env: STUB_ENV }), TargetError);
});
