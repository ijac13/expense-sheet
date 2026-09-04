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
  structuralFindings,
  renderStructuralFindings,
  emitBandRows,
  varianceForBand,
  renderVarianceReport,
  extract,
  extractMortgageRows,
  mapCategory,
  sheetGridFor,
  parseSheetGrid,
  carryForward,
  MORTGAGE_CATEGORY_NAME,
  MORTGAGE_PREPAYMENT_DATES,
} = extractor;

const FIXTURE_PATH = path.join(__dirname, "fixtures", "historical-bands.json");
const FIXTURE = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));

const HOUSE_FIXTURE_PATH = path.join(__dirname, "fixtures", "house-mortgage.json");
const DEFECTS_2022_FIXTURE_PATH = path.join(__dirname, "fixtures", "historical-2022-defects.json");

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
  // Relative requires would not resolve from a temp directory — neither the
  // sibling scripts nor the compiled `../lib/` modules.
  patched = patched.replace(/require\("(\.\.?\/[\w./-]+)"\)/g, (_m, rel) =>
    `require(${JSON.stringify(path.resolve(SCRIPTS, rel))})`
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
// AC-3 (062) — the three 2022 source-shape defects, on a dedicated fixture
// ---------------------------------------------------------------------------

const DEFECTS_2022_FIXTURE = JSON.parse(fs.readFileSync(DEFECTS_2022_FIXTURE_PATH, "utf8"));
const defectsGrid = () => JSON.parse(JSON.stringify(DEFECTS_2022_FIXTURE.rows));

test("AC-3: the whole-band accounting passes UNACCOUNTED 0 against a live-shape 2022 fixture carrying all three defects", () => {
  const result = extract(defectsGrid(), { years: [2022] });
  assert.equal(result.bands.length, 1);
  assert.equal(result.bands[0].accounting.unaccounted, 0);
  assert.equal(result.bands[0].accounting.residueColumns.length, 0);
});

test("AC-3a: the NO shape — an extra 金額 column immediately after a claimed day-amount column is a second same-day amount, not unclassified", () => {
  const bands = discoverBands(defectsGrid()).map((b) => ({ ...b, year: bandYear(defectsGrid(), b) }));
  const classification = classifyColumns(defectsGrid(), bands[0]);
  const secondary = classification.days.filter((d) => d.secondary);
  assert.equal(secondary.length, 1);
  assert.equal(columnLetter(secondary[0].amountCol), "K");
  assert.equal(secondary[0].iso, "2022-01-02", "it inherits its primary day's date");
  assert.equal(classification.unclassifiedCols.length, 0);
});

test("AC-3b: the August shape — a blank item-name header recovers its date from the amount column's header rather than emitting undated", () => {
  const rows = extract(defectsGrid(), { years: [2022] }).rows;
  const recovered = rows.find((r) => r.key === "2022-r3-cQ");
  assert.ok(recovered, "the row must exist");
  assert.equal(recovered.status, "include");
  assert.equal(recovered.date, "2022-01-05");
  assert.equal(recovered.date_source, "amount-header");
});

test("AC-3c: the ZI/ZJ shape — a well-formed but out-of-sequence day column is not silently accepted, and is named for the report", () => {
  const bands = discoverBands(defectsGrid()).map((b) => ({ ...b, year: bandYear(defectsGrid(), b) }));
  const classification = classifyColumns(defectsGrid(), bands[0]);
  const findings = structuralFindings(classification);
  assert.equal(findings.misdatedColumns.length, 1);
  assert.equal(columnLetter(findings.misdatedColumns[0].nameColumn), "N");
  assert.equal(findings.misdatedColumns[0].iso, "2022-01-02");
  assert.equal(findings.misdatedColumns[0].precedingIso, "2022-01-03");

  // Still imports — the date is well-formed and inside the band's year, so no
  // existing check catches it — but the row it produces carries a captain-visible
  // warning, and the rendered report names it by column reference and cause.
  const rows = extract(defectsGrid(), { years: [2022] }).rows;
  const flagged = rows.find((r) => r.key === "2022-r3-cO");
  assert.equal(flagged.status, "include");
  assert.equal(flagged.date, "2022-01-02");
  assert.match(flagged.captain_note, /mis-dated column/);

  const rendered = renderStructuralFindings(findings).join("\n");
  assert.match(rendered, /Possible mis-dated day column.*N.*2022-01-02.*L.*2022-01-03/s);
});

test("AC-3 falsified: without the NO-shape second pass, the live-shape fixture reproduces this spec's own probe result — an unaccounted column named K", () => {
  const withoutSecondPass = loadPatched("extract-historical-expenses.js", [
    [
      `  // The 2022 \`NO\` shape: an unclassified \`金額\`-labelled column immediately
  // following an already-claimed day-amount column, with no header date of its
  // own — a second entry for THAT day, not a new one. Must run after the pairing
  // loop above, since it depends on knowing which columns are already claimed.
  for (let c = META_COLS; c < maxCol; c++) {
    if (kinds.has(c)) continue;
    if (label(c) !== AMOUNT_LABEL) continue;
    const prev = c - 1;
    if (kinds.get(prev) !== "day-amount") continue;
    const primary = days.find((d) => d.amountCol === prev);
    claim(c, "day-amount");
    days.push({
      nameCol: primary.nameCol,
      amountCol: c,
      iso: primary.iso,
      skipReason: null,
      dateSource: primary.dateSource,
      secondary: true,
    });
  }`,
      ``,
    ],
  ]);

  assert.throws(
    () => withoutSecondPass.extract(defectsGrid(), { years: [2022] }),
    (err) => {
      assert.match(err.message, /whole-band accounting failed/);
      assert.match(err.message, /1 unaccounted/);
      assert.match(err.message, /K \(1 cells, label "金額"\)/);
      return true;
    },
    "with the NO-shape pass removed, column K goes back to being invisible residue"
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

test("AC-16 (062): carry-forward preserves hand corrections on a combined sheet, keyed correctly for a daily AND a mortgage row", () => {
  const dailyFresh = extract(defectsGrid(), { years: [2022] }).rows;
  const mortgageFresh = extractMortgageRows(houseGrid(), { years: [2022] }).rows;
  const freshCombined = [...dailyFresh, ...mortgageFresh];

  const priorDaily = priorTabWithEdits(dailyFresh, { "2022-r3-cH": { amount: "999" } });
  // House-tab fixture row index 2 (2 leading padding rows before it) is
  // sourceRow 7 — January 2022, the fixture's own first real row.
  const mortgageKey = mortgageFresh[0].key;
  assert.equal(mortgageKey, "2022-mortgage-r7");
  const priorMortgage = priorTabWithEdits(mortgageFresh, { [mortgageKey]: { category_name_en: "Other" } });
  const prior = [...priorDaily, ...priorMortgage];

  const merged = carryForward(freshCombined, prior);
  assert.equal(merged.conflicts.length, 0);
  // At least the two edits made here; the defects fixture's own ZI/ZJ-shape row
  // also carries a non-blank generated captain_note, which (like any hand-typed
  // captain_note) counts as "edited" on a re-generate — expected, not a bug.
  assert.ok(merged.carried.some((c) => c.key === "2022-r3-cH" && c.column === "amount"));
  assert.ok(merged.carried.some((c) => c.column === "category_name_en"));

  const dailyRow = merged.rows.find((r) => r.key === "2022-r3-cH");
  assert.equal(dailyRow.amount, "999");
  const mortgageRow = merged.rows.find((r) => r.key === mortgageKey);
  assert.equal(mortgageRow.category_name_en, "Other");

  // The two sources' key templates never collide, so this join could not have
  // silently carried a daily edit onto a mortgage row or vice versa (AC-10).
  assert.equal(merged.rows.filter((r) => r.key.includes("mortgage")).length, mortgageFresh.length);
});

test("AC-16a: --generate into an existing tab exits non-zero and mutates nothing", async () => {
  const existing = { header: ["key"], rows: [["kept"]] };
  const stub = makeSheets({ "Migration 2023-2024": existing, Expenses: { header: ["id"], rows: [] } });
  const before = JSON.stringify(stub.grids);

  await assert.rejects(
    extractor.run(
      ["--generate", "--into", "Migration 2023-2024", "--fixture", FIXTURE_PATH, "--house-fixture", HOUSE_FIXTURE_PATH, "--variance-report", tmpFile("v.md")],
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
    ["--generate", "--into", "Migration 2023-2024", "--fixture", FIXTURE_PATH, "--house-fixture", HOUSE_FIXTURE_PATH, "--variance-report", tmpFile("v.md")],
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
// AC-5 / AC-6 / AC-10 (062) — the House-tab mortgage reader
// ---------------------------------------------------------------------------

const HOUSE_FIXTURE = JSON.parse(fs.readFileSync(HOUSE_FIXTURE_PATH, "utf8"));
const houseGrid = () => JSON.parse(JSON.stringify(HOUSE_FIXTURE.rows));

test("AC-5: the extractor emits exactly 12 mortgage rows for 2022, dated by column D, amounted from column J, all under Mortgage", () => {
  const { rows, perYearCount } = extractMortgageRows(houseGrid(), { years: [2022] });
  assert.equal(rows.length, 12);
  assert.equal(perYearCount.get(2022), 12);
  const months = rows.map((r) => r.date.slice(5, 7)).sort();
  assert.deepEqual(months, Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")));
  for (const row of rows) {
    assert.equal(row.category_name_en, "Mortgage");
    assert.equal(row.category_name_en, MORTGAGE_CATEGORY_NAME);
    assert.equal(row.source, "mortgage");
    assert.equal(row.status, "include");
    assert.ok(row.date.startsWith("2022-"));
    assert.match(row.key, /^2022-mortgage-r\d+$/);
    // None coincides with any of the schedule's six prepayment dates — vacuously
    // true for 2022 today, kept so a future reuse against a year that DOES contain
    // one cannot silently assume it does not.
    assert.ok(!MORTGAGE_PREPAYMENT_DATES.has(row.date));
  }
});

test("AC-5: category_name_en is assigned directly, never through CATEGORY_MAP — the House tab has no A-C taxonomy", () => {
  const { rows } = extractMortgageRows(houseGrid(), { years: [2022] });
  assert.equal(rows[0].bucket, "");
  assert.equal(rows[0].sub_category, "");
  assert.equal(mapCategory("", ""), "Other", "sanity: CATEGORY_MAP would have mapped this to Other, not Mortgage");
});

test("AC-5: a year outside the House tab's populated rows yields zero rows, not an error", () => {
  const { rows } = extractMortgageRows(houseGrid(), { years: [1999] });
  assert.deepEqual(rows, []);
});

test("a House-tab row with exactly one of column D / column J populated aborts naming the row, rather than guessing or skipping it", () => {
  const g = houseGrid();
  // Row index 2 (sourceRow 7) is 2022-03-15's row: blank its amount, keep its date.
  g[2][6] = "";
  assert.throws(
    () => extractMortgageRows(g, { years: [2022] }),
    (err) => err instanceof ExtractError
      && /House!D7\/J7/.test(err.message)
      && /column J .* is blank/.test(err.message)
  );
});

test("a House-tab row with an amount but no date aborts naming the row", () => {
  const g = houseGrid();
  g[2][0] = ""; // blank the date, keep the amount
  assert.throws(
    () => extractMortgageRows(g, { years: [2022] }),
    (err) => err instanceof ExtractError && /column D .* is blank/.test(err.message)
  );
});

test("an out-of-scope-year row with exactly one of D/J populated is skipped silently, never aborting a run that never asked about it", () => {
  // Live finding: row 125 of the real 240-row schedule is dated 2024-11-15 with
  // column J genuinely blank — a real gap, but in a year this run (--years 2022)
  // never requested. It must not block a 2022-only extraction.
  const g = houseGrid();
  const serial2024_11_15 = (Date.UTC(2024, 10, 15) - Date.UTC(1899, 11, 30)) / 86400000;
  g.push([serial2024_11_15, "", "", "", "", "", ""]); // D populated, J blank
  const { rows } = extractMortgageRows(g, { years: [2022] });
  assert.equal(rows.length, 12, "the out-of-range partial row must not abort the 2022 extraction");
});

test("AC-6: the House-tab reader's range is bounded to D5:J255 and never requests column A, B or C", async () => {
  const stub = makeSheets({ House: { header: [], rows: houseGrid() } });
  await extractor.readHouseGrid(stub.sheets);
  const getRequests = stub.requests.filter((r) => r.startsWith("GET "));
  assert.equal(getRequests.length, 1);
  assert.equal(getRequests[0], "GET 'House'!D5:J255");
  assert.ok(!/'House'!A/.test(getRequests[0]));
});

test("AC-6 falsified: reading the House tab with an unbounded range would put column A's content in memory", async () => {
  const wider = loadPatched("extract-historical-expenses.js", [
    [`range: \`'\${HOUSE_TAB}'!\${HOUSE_RANGE}\`,`, `range: \`'\${HOUSE_TAB}'!A5:J255\`,`],
  ]);
  // Header is row 1; three blank filler rows put the data row at row 5, matching
  // where D5:J255 (and this falsified A5:J255) actually starts reading.
  const stub = makeSheets({
    House: {
      header: [],
      rows: [[], [], [], ["BANK / BRANCH / 1234-5678 / 王小明", ...houseGrid()[2]]],
    },
  });
  const grid2 = await wider.readHouseGrid(stub.sheets);
  assert.match(String(grid2[0][0]), /BANK \/ BRANCH/, "the falsified range brings column A's content into the grid");
});

test("AC-10: a mortgage row's notes name the House tab and its own source row, distinct from a Daily-tab row's shape", () => {
  const { buildNotes, parseNotes } = importer;
  const row = { source: "mortgage", key: "2022-mortgage-r91", date: "2022-01-15" };
  const notes = buildNotes(row);
  assert.equal(notes, "House tab row 91 | key=2022-mortgage-r91");
  const parsed = parseNotes(notes);
  assert.deepEqual(parsed, { sourceTab: "House", sourceRow: "91", key: "2022-mortgage-r91" });

  // A Daily-tab row's own shape is unaffected (AC-10's original four fields).
  const dailyNotes = importer.buildNotes({ bucket: "食", sub_category: "食材", detail: "", item_name: "", key: "2022-r63-cH" });
  const dailyParsed = importer.parseNotes(dailyNotes);
  assert.deepEqual(dailyParsed, { bucket: "食", sub_category: "食材", detail: "", item_name: "", key: "2022-r63-cH" });
});

// ---------------------------------------------------------------------------
// AC-13 (062) — the House-tab credential-access check
// ---------------------------------------------------------------------------

test("AC-13: verifyHouseTabAccess passes when both pairs can read the House tab", async () => {
  const { verifyHouseTabAccess } = require(path.join(SCRIPTS, "migration-env.js"));
  const stub = makeSheets({ House: { header: [], rows: houseGrid() } });
  const results = await verifyHouseTabAccess(
    { staging: { name: "staging" }, production: { name: "production" } },
    { sheetsFor: async () => stub.sheets }
  );
  assert.equal(results.staging.ok, true);
  assert.equal(results.production.ok, true);
});

test("AC-13 falsified: a stale production credential is named explicitly, not swallowed into a generic failure", async () => {
  const { verifyHouseTabAccess } = require(path.join(SCRIPTS, "migration-env.js"));
  const workingStub = makeSheets({ House: { header: [], rows: houseGrid() } });
  const sheetsFor = async (pair) => {
    if (pair.name === "production") throw new Error("403 The caller does not have permission");
    return workingStub.sheets;
  };
  await assert.rejects(
    verifyHouseTabAccess({ staging: { name: "staging" }, production: { name: "production" } }, { sheetsFor }),
    (err) => /production \(403 The caller does not have permission\)/.test(err.message)
      && !/staging \(/.test(err.message)
  );
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

// ---------------------------------------------------------------------------
// The importer and the staging Categories reconciliation
// ---------------------------------------------------------------------------

const importer = require(path.join(SCRIPTS, "import-historical-expenses.js"));
const syncCategories = require(path.join(SCRIPTS, "sync-staging-categories.js"));

const {
  ID_PREFIX,
  ImportError,
  buildNotes,
  parseNotes,
  planImport,
  historicalId,
  minorUnits,
  resolveCategoryNames,
  diffSnapshot,
  snapshotOf,
  verifyAgainst,
  assertRehearsed,
} = importer;

const NORMALIZATION_TAB = "Migration 2023-2024";

// Production's Expenses tab carries the captain's `month` / `amount value` helper
// columns — unknown to EXPENSES_SPEC, and they must survive untouched.
const EXPENSES_HEADER = [
  "id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at",
  "month", "amount value",
];

// Two rows the two users logged, which the import must not touch. The second is
// dated inside an imported year, so an undo keyed on the date year would eat it.
//
// `paid_by` holds the DISPLAY NAME, not the user id — read from the live tabs, which
// contain only `ijac` and `wei` on both staging and production. An earlier draft of
// this fixture used `user1`/`user2` here and was simply wrong about the app's own
// storage convention.
const PRE_EXISTING = [
  ["exp-001", "2026-08-01", "120", "cat_003", "ijac", "ijac", "coffee", "2026-08-01T09:00:00.000Z", "2026-08", "120"],
  ["exp-002", "2024-06-15", "80", "cat_003", "wei", "wei", "an old row of theirs", "2024-06-15T09:00:00.000Z", "2024-06", "80"],
];

const CATEGORIES_HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", ""];

/** Staging's tab: agrees with production on cat_001-cat_022, diverges after. */
const STAGING_CATEGORIES = [
  ["cat_003", "Groceries", "食材", "🥕", "3", "true", "food_beverage_tobacco", ""],
  ["cat_012", "Equipment", "家具設備", "🛋️", "12", "true", "miscellaneous", ""],
  ["cat_022", "Other", "雜項", "📦", "22", "true", "miscellaneous", ""],
  ["cat_023", "Test Cat", "測試", "🧪", "23", "true", "", ""],
  ["cat_024", "Antkee", "螞蟻", "🐜", "24", "true", "", ""],
  ["cat_025", "ScrollTest", "捲動", "📜", "25", "true", "", ""],
];

/** Production's: the same ids carrying different meanings from cat_023 on. */
const PRODUCTION_CATEGORIES = [
  ["cat_003", "Groceries", "食材", "🥕", "3", "true", "food_beverage_tobacco", ""],
  ["cat_012", "Equipment", "家具設備", "🛋️", "12", "true", "miscellaneous", ""],
  ["cat_022", "Other", "雜項", "📦", "22", "true", "miscellaneous", ""],
  ["cat_023", "Tenant", "房客", "🏠", "23", "true", "miscellaneous", ""],
  ["cat_024", "Insurance", "保險", "🛡️", "24", "true", "insurance_financial", ""],
  ["cat_025", "Tax", "稅金", "🧾", "25", "true", "miscellaneous", ""],
];

/**
 * A normalization tab as the extractor would have written it, optionally with the
 * captain's approval marker and per-key hand edits applied.
 */
function normalizationTab({ approved = true, edits = {}, rows = null } = {}) {
  const source = rows ?? extract(grid()).rows;
  const { grid: sheet, digest } = sheetGridFor(source, "2026-08-31T00:00:00.000Z");
  if (approved) sheet[0][1] = "APPROVED";
  const keyAt = SHEET_COLUMNS.indexOf("key");
  for (const [key, changes] of Object.entries(edits)) {
    const row = sheet.find((r, i) => i >= 2 && r[keyAt] === key);
    assert.ok(row, `no such key on the tab: ${key}`);
    for (const [col, value] of Object.entries(changes)) {
      row[SHEET_COLUMNS.indexOf(col)] = value;
    }
  }
  return { header: sheet[0], rows: sheet.slice(1), digest };
}

function makeWorld({ normalization = normalizationTab(), stagingCategories = STAGING_CATEGORIES } = {}) {
  // AC-13 — a "House" tab must exist on BOTH stubs, or every importRun call fails
  // the credential-access preflight before it reaches the phase under test.
  const staging = makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: PRE_EXISTING.map((r) => r.slice()) },
    Categories: { header: CATEGORIES_HEADER, rows: stagingCategories.map((r) => r.slice()) },
    [NORMALIZATION_TAB]: { header: normalization.header, rows: normalization.rows },
    House: { header: [], rows: [] },
  });
  const production = makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: PRE_EXISTING.map((r) => r.slice()) },
    Categories: { header: CATEGORIES_HEADER, rows: PRODUCTION_CATEGORIES.map((r) => r.slice()) },
    House: { header: [], rows: [] },
  });
  return {
    staging,
    production,
    digest: normalization.digest,
    sheetsFor: async (pair) => (pair.name === "production" ? production.sheets : staging.sheets),
  };
}

const expenseIds = (stub) => stub.grids.Expenses.slice(1).map((r) => r[0]);
const importedIds = (stub) => expenseIds(stub).filter((id) => id.startsWith(ID_PREFIX));

async function importRun(world, argv, opts = {}) {
  return importer.run(argv, {
    log: opts.log ?? silent,
    env: STUB_ENV,
    sheetsFor: world.sheetsFor,
    now: opts.now ?? (() => new Date("2026-08-31T12:00:00.000Z")),
    ...opts.extra,
  });
}

// ---------------------------------------------------------------------------
// AC-12 / AC-14 — the two gates that have no default
// ---------------------------------------------------------------------------

test("AC-12: the import refuses to run without an explicit target, and writes nothing", async () => {
  const world = makeWorld();
  const before = expenseIds(world.staging).length;

  await assert.rejects(
    importRun(world, ["--dry-run", "--from-sheet", NORMALIZATION_TAB]),
    (err) => /No --target given/.test(err.message) && /never infers a target/.test(err.message)
  );

  assert.equal(expenseIds(world.staging).length, before, "the Expenses row count must be unchanged");
  // The falsifier AC-12 names: falling back to load-local-env's resolved
  // SPREADSHEET_ID, which today is PRODUCTION's.
  assert.equal(expenseIds(world.production).length, before);
  assert.equal(world.staging.requests.filter((r) => r.startsWith("UPDATECELLS")).length, 0);
});

test("AC-14: an unapproved sheet stops the import, and the row count is unchanged", async () => {
  const world = makeWorld({ normalization: normalizationTab({ approved: false }) });
  const before = expenseIds(world.staging).length;

  await assert.rejects(
    importRun(world, ["--apply", "--target", "staging", "--from-sheet", NORMALIZATION_TAB]),
    (err) => err instanceof ImportError && /is not approved/.test(err.message) && /"APPROVED"/.test(err.message)
  );

  assert.equal(expenseIds(world.staging).length, before);
  assert.equal(importedIds(world.staging).length, 0);
});

test("AC-14: --from-sheet has no default, so a re-generate cannot substitute a tab she never approved", async () => {
  const world = makeWorld();
  await assert.rejects(
    importRun(world, ["--apply", "--target", "staging"]),
    (err) => err instanceof ImportError && /--from-sheet/.test(err.message) && /no default/.test(err.message)
  );
  assert.equal(importedIds(world.staging).length, 0);
});

test("a dry-run reports on an unapproved sheet — that is how she sees it before approving — and writes nothing", async () => {
  const world = makeWorld({ normalization: normalizationTab({ approved: false }) });
  const result = await importRun(world, ["--dry-run", "--target", "staging", "--from-sheet", NORMALIZATION_TAB]);
  assert.equal(result.wouldWrite, 19);
  assert.equal(importedIds(world.staging).length, 0);
  assert.equal(world.staging.requests.filter((r) => r.startsWith("UPDATECELLS")).length, 0);
});

// ---------------------------------------------------------------------------
// AC-9 — the pre-write category resolution
// ---------------------------------------------------------------------------

test("AC-9: an unresolvable category name refuses BEFORE the first write, naming it", async () => {
  // `Insurance` exists on production and on staging under no id at all — exactly the
  // override that would deadlock the pipeline without D6's reconciliation.
  const world = makeWorld({ normalization: normalizationTab({ edits: { "2024-r3-cH": { category_name_en: "Insurance" } } }) });

  await assert.rejects(
    importRun(world, ["--apply", "--target", "staging", "--from-sheet", NORMALIZATION_TAB]),
    (err) => {
      assert.match(err.message, /do not exist on staging's Categories tab: Insurance/);
      assert.match(err.message, /Available there:/);
      assert.match(err.message, /Test Cat/, "the refusal must list what the target does have");
      return true;
    }
  );

  // The all-or-nothing property the pre-write check buys. Resolving lazily per row
  // would have written every row up to the first unresolved name and aborted
  // halfway, leaving a partial import for AC-1's diff to report.
  assert.equal(importedIds(world.staging).length, 0, "not one row may be written before every name resolves");
  assert.equal(world.staging.requests.filter((r) => r.startsWith("INSERT Expenses")).length, 0);
});

test("AC-9: resolution is by name and never by id, because the same id means different things", () => {
  const staging = STAGING_CATEGORIES.map((r) => ({ id: r[0], name_en: r[1] }));
  const production = PRODUCTION_CATEGORIES.map((r) => ({ id: r[0], name_en: r[1] }));

  // cat_023 exists on both, so an id-keyed mapping "resolves" and files the row
  // under Test Cat on staging and Tenant on production. The write succeeds; the row
  // is simply wrong. That is the failure this is designed against.
  assert.equal(staging.find((c) => c.id === "cat_023").name_en, "Test Cat");
  assert.equal(production.find((c) => c.id === "cat_023").name_en, "Tenant");

  assert.deepEqual(resolveCategoryNames(["Tenant"], staging).unresolved, ["Tenant"]);
  assert.deepEqual(resolveCategoryNames(["Tenant"], production).unresolved, []);
  assert.equal(resolveCategoryNames(["Tenant"], production).resolved.get("Tenant"), "cat_023");
  // Folded, so a casing difference between the two tabs is not a false miss.
  assert.equal(resolveCategoryNames(["groceries"], staging).resolved.get("groceries"), "cat_003");
});

test("AC-9: a duplicate name_en on the target aborts rather than resolving to one of two ids", () => {
  const withDuplicate = [...STAGING_CATEGORIES.map((r) => ({ id: r[0], name_en: r[1] })), { id: "cat_099", name_en: "Groceries" }];
  assert.deepEqual(resolveCategoryNames(["Groceries"], withDuplicate).duplicates, ["Groceries"]);
});

// ---------------------------------------------------------------------------
// AC-1 / AC-5 / AC-2 / AC-10 — apply and verify
// ---------------------------------------------------------------------------

test("AC-1 + AC-2 + AC-10: apply then verify — nothing pre-existing touched, sums exact, provenance parses", async () => {
  const world = makeWorld();
  const snapshotFile = tmpFile("snap.json");
  const base = ["--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--snapshot-file", snapshotFile];

  await importRun(world, ["--snapshot", ...base]);
  const applied = await importRun(world, ["--apply", ...base]);
  assert.equal(applied.created, 19);

  const { result } = await importRun(world, ["--verify", ...base]);
  assert.equal(result.passed, true);
  assert.equal(result.importedCount, 19);
  assert.equal(result.unmatchedCount, 0);
  assert.equal(result.missingCount, 0);
  assert.equal(result.duplicatedCount, 0);
  assert.equal(result.outOfRangeCount, 0);
  assert.equal(result.unparseableNotesCount, 0);
  // AC-1's number, and it is a diff against a snapshot rather than an assertion.
  assert.equal(result.snapshotDiff.preExistingModified.length, 0);
  assert.equal(result.snapshotDiff.preExistingDeleted.length, 0);
  assert.equal(result.snapshotDiff.foreignAdded.length, 0);
  // AC-9's other half: no category was created.
  assert.equal(result.categoriesBefore, result.categoriesAfter);

  // AC-2: per-year sums EQUAL, not within a tolerance.
  assert.equal(result.yearSums[2024].equal, true);
  assert.equal(result.yearSums[2023].equal, true);
  assert.equal(result.yearSums[2024].expectedMinor, 184000);
  assert.equal(result.yearSums[2023].expectedMinor, 49500);

  // AC-1's falsifier is a WRITE SHAPE, so assert the shape: rows arrive by
  // insertion, never by an in-place update over existing rows.
  assert.ok(world.staging.requests.some((r) => r.startsWith("INSERT Expenses")));
  assert.equal(world.staging.requests.filter((r) => r === "UPDATE Expenses!A2:J3").length, 0);
  assert.deepEqual(
    world.staging.grids.Expenses.slice(1).filter((r) => !r[0].startsWith(ID_PREFIX)).map((r) => r[0]),
    ["exp-001", "exp-002"]
  );
  // The captain's unknown helper columns survive on the rows that had them.
  assert.equal(world.staging.grids.Expenses.find((r) => r[0] === "exp-001")[9], "120");

  // AC-10: four fields, the key among them.
  const imported = world.staging.grids.Expenses.slice(1).filter((r) => r[0].startsWith(ID_PREFIX));
  for (const row of imported) {
    const parsed = parseNotes(row[6]);
    assert.ok(parsed, `notes must parse: ${row[6]}`);
    assert.ok(parsed.key.length > 0);
    assert.equal(typeof parsed.bucket, "string");
    assert.equal(typeof parsed.sub_category, "string");
    assert.equal(typeof parsed.detail, "string");
  }
});

// ---------------------------------------------------------------------------
// AC-2 / AC-9 / AC-10 (062) — a combined sheet: Daily-tab AND mortgage rows,
// one apply, one verify, "Mortgage" resolved on the target's own live tab
// ---------------------------------------------------------------------------

function makeCombinedWorld() {
  const dailyRows = extract(defectsGrid(), { years: [2022] }).rows;
  const mortgageRows = extractMortgageRows(houseGrid(), { years: [2022] }).rows;
  const combined = normalizationTab({ rows: [...dailyRows, ...mortgageRows] });

  const withMortgage = (cats) => [
    ...cats,
    ["cat_099", "Mortgage", "房貸", "🏠", "99", "true", "housing", ""],
  ];
  const staging = makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: PRE_EXISTING.map((r) => r.slice()) },
    Categories: { header: CATEGORIES_HEADER, rows: withMortgage(STAGING_CATEGORIES).map((r) => r.slice()) },
    [NORMALIZATION_TAB]: { header: combined.header, rows: combined.rows },
    House: { header: [], rows: [] },
  });
  const production = makeSheets({
    Expenses: { header: EXPENSES_HEADER, rows: PRE_EXISTING.map((r) => r.slice()) },
    Categories: { header: CATEGORIES_HEADER, rows: withMortgage(PRODUCTION_CATEGORIES).map((r) => r.slice()) },
    House: { header: [], rows: [] },
  });
  return {
    staging, production,
    dailyRows, mortgageRows, digest: combined.digest,
    sheetsFor: async (pair) => (pair.name === "production" ? production.sheets : staging.sheets),
  };
}

test("AC-2/AC-9/AC-10 (062): a combined sheet applies both sources in one run, Mortgage resolves, and each row's provenance matches its own source", async () => {
  const world = makeCombinedWorld();
  const base = ["--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--snapshot-file", tmpFile("snap.json"), "--years", "2022"];

  await importRun(world, ["--snapshot", ...base]);
  const applied = await importRun(world, ["--apply", ...base]);
  assert.equal(applied.created, world.dailyRows.length + world.mortgageRows.length);

  const { result } = await importRun(world, ["--verify", ...base]);
  assert.equal(result.passed, true, JSON.stringify(result.findings));
  assert.equal(result.importedCount, world.dailyRows.length + world.mortgageRows.length);
  // AC-9: "Mortgage" resolved against the target's live Categories tab, and no
  // category was created in the process.
  assert.equal(result.categoriesBefore, result.categoriesAfter);

  const imported = world.staging.grids.Expenses.slice(1).filter((r) => r[0].startsWith(ID_PREFIX));
  const mortgageIds = new Set();
  for (const row of imported) {
    const parsed = parseNotes(row[6]);
    assert.ok(parsed, `notes must parse: ${row[6]}`);
    if (parsed.sourceTab === "House") {
      mortgageIds.add(row[0]);
      assert.equal(row[3], "cat_099", "a mortgage row's category_id resolves to Mortgage's live id");
    } else {
      assert.equal(typeof parsed.bucket, "string", "a daily row keeps its four-field provenance");
    }
  }
  assert.equal(mortgageIds.size, world.mortgageRows.length);
});

test("AC-5: a second apply against the same target writes nothing", async () => {
  const world = makeWorld();
  const base = ["--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--snapshot-file", tmpFile("s.json")];

  const first = await importRun(world, ["--apply", ...base]);
  assert.equal(first.created, 19);
  const inserts = world.staging.requests.filter((r) => r.startsWith("INSERT Expenses")).length;

  const second = await importRun(world, ["--apply", ...base]);
  assert.equal(second.created, 0, "every candidate must be found already present");
  assert.equal(second.skipped, 19);
  assert.equal(
    world.staging.requests.filter((r) => r.startsWith("INSERT Expenses")).length,
    inserts,
    "no further insertion may reach the sheet"
  );
  assert.equal(importedIds(world.staging).length, 19, "not a duplicate set");
});

test("AC-5 falsified: a Date.now()-based id writes a full duplicate set on the second run", () => {
  // The id is what carries idempotency, so the falsification is at the id function.
  const deterministic = [historicalId(2024, 1), historicalId(2024, 1)];
  assert.equal(deterministic[0], deterministic[1]);
  assert.equal(deterministic[0], "exp-hist-2024-0001");

  const rows = extract(grid()).rows;
  const planA = planImport(rows);
  const planB = planImport([...rows].reverse());
  assert.deepEqual(
    planA.candidates.map((c) => `${c.id}:${c.key}`),
    planB.candidates.map((c) => `${c.id}:${c.key}`),
    "ids are keyed to the source cell, so re-sorting the tab cannot renumber them"
  );
});

test("AC-2 falsified: rounding amounts on write breaks the exact per-year sum a 1% tolerance would have absorbed", async () => {
  const withFraction = normalizationTab({ edits: { "2024-r3-cH": { amount: "100.50" } } });
  const rounding = loadPatched("import-historical-expenses.js", [
    ["    amount: String(candidate.amount),", "    amount: String(Math.round(Number(candidate.amount))),"],
  ]);

  const world = makeWorld({ normalization: withFraction });
  const base = ["--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--snapshot-file", tmpFile("s.json")];
  const opts = { log: silent, env: STUB_ENV, sheetsFor: world.sheetsFor, now: () => new Date("2026-08-31T12:00:00.000Z") };

  await rounding.run(["--apply", ...base], opts);
  await assert.rejects(
    rounding.run(["--verify", ...base], opts),
    (err) => /Verification failed/.test(err.message)
  );

  // The same sheet through the unrounded importer verifies clean, so the failure is
  // the rounding and not the fixture.
  const honest = makeWorld({ normalization: withFraction });
  const honestOpts = { ...opts, sheetsFor: honest.sheetsFor };
  const honestBase = ["--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--snapshot-file", tmpFile("s2.json")];
  await importer.run(["--apply", ...honestBase], honestOpts);
  const { result } = await importer.run(["--verify", ...honestBase], honestOpts);
  assert.equal(result.passed, true);
  assert.equal(result.yearSums[2024].expectedMinor % 100, 50, "the fixture really does carry a fractional amount");
});

test("AC-10 falsified: dropping the key from the notes template costs AC-2 its only join handle", () => {
  const row = { bucket: "食", sub_category: "食材", detail: "unit-alpha", item_name: "", key: "2024-r3-cH" };
  const notes = buildNotes(row);
  assert.equal(notes, "食 | 食材 | unit-alpha | key=2024-r3-cH");
  const parsed = parseNotes(notes);
  assert.deepEqual(parsed, { bucket: "食", sub_category: "食材", detail: "unit-alpha", item_name: "", key: "2024-r3-cH" });

  // Without the key the parse yields three fields and returns null, so AC-2 and
  // AC-10 fail TOGETHER rather than AC-2 silently degrading to a row count.
  assert.equal(parseNotes("食 | 食材 | unit-alpha"), null);
  // An item name occupies a fourth segment before the key.
  assert.equal(parseNotes(buildNotes({ ...row, item_name: "rice" })).item_name, "rice");
});

test("AC-4c: verify catches a date hand-edited outside 2023-2024, which the extractor's own guards cannot see", async () => {
  const world = makeWorld({ normalization: normalizationTab({ edits: { "2024-r3-cH": { date: "2022-01-01" } } }) });
  const base = ["--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--snapshot-file", tmpFile("s.json")];

  // planImport excludes it by year rather than writing it — the first line of defence.
  const applied = await importRun(world, ["--apply", ...base]);
  assert.equal(applied.created, 18, "the 2022-dated row is excluded, not written");

  // And if one did reach the tab, verify reports it as a non-zero count.
  const { grid: expensesGrid, map } = { grid: world.staging.grids.Expenses, map: null };
  assert.equal(
    expensesGrid.slice(1).filter((r) => r[0].startsWith(ID_PREFIX) && r[1].startsWith("2022-")).length,
    0
  );

  const smuggled = verifyAgainst({
    expenses: [
      EXPENSES_HEADER,
      ["exp-hist-2022-0001", "2022-01-01", "5", "cat_003", "h", "h", "食 | 食材 |  | key=2022-rX-cA", "x"],
    ],
    map: require("../lib/sheetSchema").buildColumnMap([EXPENSES_HEADER], require("../lib/sheetSchema").EXPENSES_SPEC),
    approved: [{ key: "2022-rX-cA", status: "include", date: "2022-01-01", amount: "5" }],
    plan: { candidates: [], perYear: {}, sheetRowCount: 1 },
    categories: { live: STAGING_CATEGORIES.map((r) => ({ id: r[0], name_en: r[1] })), countBefore: null },
    snapshot: null,
  });
  assert.equal(smuggled.outOfRangeCount, 1);
  assert.ok(smuggled.findings.some((f) => f.label === "AC-4c out-of-range date"));
  assert.equal(smuggled.passed, false);
});

// ---------------------------------------------------------------------------
// AC-6 / AC-18 — the rehearsal and the gate it produces
// ---------------------------------------------------------------------------

test("AC-6 + AC-18: the staging rehearsal runs snapshot -> apply -> verify -> hand-add -> undo -> diff and writes a receipt", async () => {
  const world = makeWorld();
  const receipt = tmpFile("receipt.json");
  const result = await importRun(world, [
    "--rehearse", "--target", "staging", "--from-sheet", NORMALIZATION_TAB,
    "--snapshot-file", tmpFile("s.json"), "--receipt", receipt, "--hand-add-id", "manual-under-test",
  ]);

  assert.deepEqual(
    result.steps.map((s) => s.step),
    ["snapshot", "apply", "verify", "hand-add", "undo", "diff", "restore", "receipt"]
  );
  assert.equal(result.writtenIds.length, 19);
  assert.equal(result.verification.passed, true);

  // AC-6: staging is back exactly as it was found.
  assert.deepEqual(expenseIds(world.staging), ["exp-001", "exp-002"]);
  assert.equal(importedIds(world.staging).length, 0);

  const written = JSON.parse(fs.readFileSync(receipt, "utf8"));
  assert.equal(written.target, "staging");
  assert.equal(written.fromSheet, NORMALIZATION_TAB);
  assert.equal(written.digest, world.digest);
  assert.equal(written.rowCount, 19);
});

test("AC-6 falsified: an undo matching on the date year eats the row a user added by hand", async () => {
  const byYear = loadPatched("import-historical-expenses.js", [
    [
      `    if (list.some((p) => id.startsWith(p))) targetRowIndexes.push(i);`,
      `    if (String(row[map.index.date] ?? "").startsWith("2024-")) targetRowIndexes.push(i);`,
    ],
  ]);
  const world = makeWorld();
  const opts = { log: silent, env: STUB_ENV, sheetsFor: world.sheetsFor, now: () => new Date("2026-08-31T12:00:00.000Z") };

  await assert.rejects(
    byYear.run([
      "--rehearse", "--target", "staging", "--from-sheet", NORMALIZATION_TAB,
      "--snapshot-file", tmpFile("s.json"), "--receipt", tmpFile("r.json"), "--hand-add-id", "manual-under-test",
    ], opts),
    (err) => /did NOT survive the undo|pre-existing row\(s\) deleted/.test(err.message),
    "the rehearsal must fail when undo stops keying on the id prefix"
  );

  // And concretely: exp-002 is dated 2024-06-15 and belongs to the household.
  assert.equal(PRE_EXISTING[1][1], "2024-06-15");
});

// ---------------------------------------------------------------------------
// AC-8 (062) — the undo-scoping fix, proven by falsification
// ---------------------------------------------------------------------------

/**
 * Entity 062's own finding, reading `import-historical-expenses.js` directly:
 * both `deleteRowsByIdPrefix` call sites passed the module-level `ID_PREFIX`
 * unscoped, so `061`'s already-live 2023/2024 rows share the exact prefix a 2022
 * undo would also match. Two runs against IDENTICALLY seeded worlds: the ORIGINAL
 * (unscoped) code reintroduced via `loadPatched`, and the real, fixed code — same
 * fixture, opposite outcome, proving the fix by falsification rather than by
 * asserting the fixed behaviour alone.
 */
function worldWithMixedHistoricalRows() {
  const world = makeWorld();
  world.staging.grids.Expenses.push(
    ["exp-hist-2022-0001", "2022-01-01", "10", "cat_003", "ijac", "ijac", "062's own row | key=2022-r1-cH", "2022-01-01T00:00:00.000Z", "", ""],
    ["exp-hist-2023-0001", "2023-01-01", "20", "cat_003", "ijac", "ijac", "061's row | key=2023-r1-cH", "2023-01-01T00:00:00.000Z", "", ""],
    ["exp-hist-2024-0001", "2024-01-01", "30", "cat_003", "ijac", "ijac", "061's row | key=2024-r1-cH", "2024-01-01T00:00:00.000Z", "", ""],
  );
  return world;
}

test("AC-8 falsified: the unscoped module-level ID_PREFIX deletes 061's live 2023/2024 rows on a 2022-only undo", async () => {
  const buggyWorld = worldWithMixedHistoricalRows();
  const opts = { log: silent, env: STUB_ENV, sheetsFor: buggyWorld.sheetsFor };
  const base = ["--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--undo", "--years", "2022"];

  // Reintroduce 061's original shape: the call site passes ID_PREFIX unscoped,
  // ignoring --years (and the run-scoped prefixes it now builds) entirely.
  const unscoped = loadPatched("import-historical-expenses.js", [
    [
      `    const result = await deleteRowsByIdPrefix(writeSheets, targets.write.spreadsheetId, scopedPrefixesForYears(args.years), log);`,
      `    const result = await deleteRowsByIdPrefix(writeSheets, targets.write.spreadsheetId, ID_PREFIX, log);`,
    ],
  ]);
  await unscoped.run(base, opts);

  const remaining = expenseIds(buggyWorld.staging);
  assert.ok(!remaining.includes("exp-hist-2022-0001"), "sanity: this run's own row must be gone");
  assert.ok(
    !remaining.includes("exp-hist-2023-0001") && !remaining.includes("exp-hist-2024-0001"),
    "the bug must actually reproduce: an unscoped undo wrongly deletes 061's 2023/2024 rows too"
  );

  // Same fixture, the real (fixed) code: only 2022's row is removed.
  const fixedWorld = worldWithMixedHistoricalRows();
  await importer.run(base, { log: silent, env: STUB_ENV, sheetsFor: fixedWorld.sheetsFor });
  const afterFixed = expenseIds(fixedWorld.staging);
  assert.ok(!afterFixed.includes("exp-hist-2022-0001"), "this run's own 2022 row is removed");
  assert.ok(afterFixed.includes("exp-hist-2023-0001"), "061's 2023 row survives, unscoped by year 2022");
  assert.ok(afterFixed.includes("exp-hist-2024-0001"), "061's 2024 row survives, unscoped by year 2022");
});

test("--undo has no default years, and refuses rather than guess a scope", async () => {
  const world = makeWorld();
  await assert.rejects(
    importRun(world, ["--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--undo"]),
    (err) => err instanceof ImportError && /--years/.test(err.message) && /no default/.test(err.message)
  );
});

test("AC-18: a production apply refuses with no receipt, and refuses again on a stale digest", async () => {
  const world = makeWorld();
  const receipt = tmpFile("receipt.json");
  const base = ["--apply", "--target", "production", "--from-sheet", NORMALIZATION_TAB, "--receipt", receipt, "--snapshot-file", tmpFile("s.json")];
  const before = expenseIds(world.production).length;

  await assert.rejects(
    importRun(world, base),
    (err) => err instanceof ImportError && /No staging-rehearsal receipt/.test(err.message)
  );
  assert.equal(expenseIds(world.production).length, before, "nothing written to production");

  // A receipt from an earlier rehearsal of a DIFFERENT generation. Existence alone
  // must not satisfy the gate — that is the whole falsifier.
  fs.writeFileSync(receipt, JSON.stringify({
    entity: "061", target: "staging", fromSheet: NORMALIZATION_TAB,
    digest: "0".repeat(32), rowCount: 19, at: "2026-08-30T00:00:00.000Z",
  }), "utf8");

  await assert.rejects(
    importRun(world, base),
    (err) => err instanceof ImportError && /is NOT the one that was rehearsed/.test(err.message)
  );
  assert.equal(expenseIds(world.production).length, before);
  assert.equal(world.production.requests.filter((r) => r.startsWith("INSERT Expenses")).length, 0);
});

test("assertRehearsed also rejects a receipt for a different sheet, and one from a production run", () => {
  const file = tmpFile("r.json");
  const write = (o) => fs.writeFileSync(file, JSON.stringify(o), "utf8");

  write({ target: "staging", fromSheet: "Migration v2", digest: "abc" });
  assert.throws(() => assertRehearsed(file, { fromSheet: NORMALIZATION_TAB, digest: "abc" }), /rehearsed sheet/);

  write({ target: "production", fromSheet: NORMALIZATION_TAB, digest: "abc" });
  assert.throws(() => assertRehearsed(file, { fromSheet: NORMALIZATION_TAB, digest: "abc" }), /not a staging rehearsal/);

  write({ target: "staging", fromSheet: NORMALIZATION_TAB, digest: "abc", rowCount: 1 });
  assert.equal(assertRehearsed(file, { fromSheet: NORMALIZATION_TAB, digest: "abc" }).rowCount, 1);
});

test("--rehearse refuses to run against production", async () => {
  const world = makeWorld();
  await assert.rejects(
    importRun(world, ["--rehearse", "--target", "production", "--from-sheet", NORMALIZATION_TAB]),
    (err) => err instanceof ImportError && /rehearsal on\s+production is not a rehearsal|runs against staging only/.test(err.message)
  );
  assert.equal(expenseIds(world.production).length, 2);
});

test("the snapshot diff keys on the row id, because an insert at the top shifts every index", () => {
  const map = require("../lib/sheetSchema").buildColumnMap([EXPENSES_HEADER], require("../lib/sheetSchema").EXPENSES_SPEC);
  const before = snapshotOf([EXPENSES_HEADER, ...PRE_EXISTING], map);
  const after = snapshotOf(
    [EXPENSES_HEADER, ["exp-hist-2024-0001", "2024-01-01", "1", "cat_003", "h", "h", "n", "t"], ...PRE_EXISTING],
    map
  );
  const diff = diffSnapshot(before, after);
  assert.deepEqual(diff.modified, [], "a positional diff would report both pre-existing rows as modified");
  assert.deepEqual(diff.deleted, []);
  assert.deepEqual(diff.importedAdded, ["exp-hist-2024-0001"]);
  assert.deepEqual(diff.foreignAdded, []);
});

test("planImport counts every row it does not write, rather than dropping it quietly", () => {
  const rows = extract(grid()).rows;
  const doctored = rows.map((r, i) => {
    if (i === 0) return { ...r, status: "undated", date: "" };
    if (i === 1) return { ...r, status: "orphaned" };
    if (i === 2) return { ...r, status: "exclude" };
    if (i === 3) return { ...r, status: "" };
    if (i === 4) return { ...r, date: "2022-05-05" };
    return r;
  });
  const plan = planImport(doctored);
  assert.equal(plan.candidates.length, rows.length - 5);
  assert.equal(plan.excluded.undated.length, 1);
  assert.equal(plan.excluded.orphaned.length, 1);
  assert.equal(plan.excluded.excludeStatus.length, 1);
  assert.equal(plan.excluded.otherStatus.length, 1);
  assert.equal(plan.excluded.outOfScopeYear.length, 1);
  const accounted = plan.candidates.length + Object.values(plan.excluded).reduce((n, a) => n + a.length, 0);
  assert.equal(accounted, plan.sheetRowCount, "every sheet row is either written or counted as excluded");
});

test("an include row with no usable date stops the run rather than being silently skipped", () => {
  const rows = extract(grid()).rows;
  const bad = rows.map((r, i) => (i === 0 ? { ...r, date: "" } : r));
  assert.throws(() => planImport(bad), (err) => err instanceof ImportError && /not YYYY-MM-DD/.test(err.message));
});

// ---------------------------------------------------------------------------
// AC-20 — the additive staging Categories reconciliation (R1)
// ---------------------------------------------------------------------------

async function syncRun(world, argv, opts = {}) {
  return syncCategories.run(argv, {
    log: opts.log ?? silent,
    env: STUB_ENV,
    sheetsFor: world.sheetsFor,
    now: () => new Date("2026-08-31T12:00:00.000Z"),
  });
}

test("AC-20: R1 adds the three missing production names under NEW ids and leaves the test entries alone", async () => {
  const world = makeWorld();
  const receipt = tmpFile("cats.json");

  const dry = await syncRun(world, ["--dry-run", "--receipt", receipt]);
  assert.deepEqual(dry.plan.additions.map((a) => [a.newId, a.name_en]), [
    ["cat_026", "Tenant"],
    ["cat_027", "Insurance"],
    ["cat_028", "Tax"],
  ], "the captain's R1, exactly: cat_026 Tenant, cat_027 Insurance, cat_028 Tax");
  assert.equal(world.staging.grids.Categories.length, 1 + STAGING_CATEGORIES.length, "--dry-run writes nothing");

  const applied = await syncRun(world, ["--apply", "--receipt", receipt]);
  assert.deepEqual(applied.addedIds, ["cat_026", "cat_027", "cat_028"]);

  const after = world.staging.grids.Categories.slice(1);
  // The assertion that fails under the destructive reading of "make it the same".
  for (const [id, name] of [["cat_023", "Test Cat"], ["cat_024", "Antkee"], ["cat_025", "ScrollTest"]]) {
    const row = after.find((r) => r[0] === id);
    assert.ok(row, `${id} must still exist`);
    assert.equal(row[1], name, `${id} must still mean ${name} — the captain declined R2`);
  }
  // Every production name now resolves on staging, which is all the rehearsal needs.
  for (const row of PRODUCTION_CATEGORIES) {
    assert.ok(after.some((r) => r[1] === row[1]), `${row[1]} must resolve on staging`);
  }
  // Production is the reference, never a target.
  assert.deepEqual(world.production.grids.Categories.slice(1), PRODUCTION_CATEGORIES);
  assert.equal(world.production.requests.filter((r) => !r.startsWith("GET")).length, 0);

  // Reversible: undo removes exactly the ids it recorded.
  await syncRun(world, ["--undo", "--receipt", receipt]);
  assert.deepEqual(
    world.staging.grids.Categories.slice(1).map((r) => r[0]),
    STAGING_CATEGORIES.map((r) => r[0]),
    "the tab is back to its recorded pre-run state"
  );
});

test("AC-20 falsified: implementing the reconciliation as an overwrite fails the pre-existing-name assertion", () => {
  const staging = STAGING_CATEGORIES.map((r) => ({ id: r[0], name_en: r[1], cells: r }));
  const production = PRODUCTION_CATEGORIES.map((r) => ({ id: r[0], name_en: r[1], cells: r }));

  // R2, the destructive reading: overwrite cat_023-cat_025 so staging matches
  // production byte-for-byte. Three categories somebody may be using change meaning
  // rather than breaking, and any staging expense filed under them silently moves.
  const overwritten = staging.map((row) => {
    const prod = production.find((p) => p.id === row.id);
    return prod ? { ...row, name_en: prod.name_en } : row;
  });

  const problems = syncCategories.assertAdditive({
    preExisting: staging.map((r) => ({ id: r.id, name_en: r.name_en })),
    stagingAfter: overwritten,
    productionBefore: production,
    productionAfter: production,
    addedIds: [],
  });
  assert.equal(problems.length, 3);
  assert.ok(problems.some((p) => /cat_023 was "Test Cat", is now "Tenant"/.test(p)));
  assert.ok(problems.some((p) => /cat_024/.test(p)));
  assert.ok(problems.some((p) => /cat_025/.test(p)));
});

test("AC-20: the additive assertions also catch a deletion and a production write", () => {
  const staging = STAGING_CATEGORIES.map((r) => ({ id: r[0], name_en: r[1], cells: r }));
  const production = PRODUCTION_CATEGORIES.map((r) => ({ id: r[0], name_en: r[1], cells: r }));

  const deleted = syncCategories.assertAdditive({
    preExisting: staging.map((r) => ({ id: r.id, name_en: r.name_en })),
    stagingAfter: staging.filter((r) => r.id !== "cat_024"),
    productionBefore: production,
    productionAfter: production,
    addedIds: [],
  });
  assert.ok(deleted.some((p) => /cat_024 \(Antkee\) was DELETED/.test(p)));

  const touchedProduction = syncCategories.assertAdditive({
    preExisting: [],
    stagingAfter: staging,
    productionBefore: production,
    productionAfter: production.map((r) => ({ ...r, cells: [...r.cells, "changed"] })),
    addedIds: [],
  });
  assert.ok(touchedProduction.some((p) => /production's Categories tab CHANGED/.test(p)));
});

test("new ids continue from staging's own highest cat_NNN, so they cannot collide", () => {
  assert.deepEqual(syncCategories.nextCategoryIds(STAGING_CATEGORIES.map((r) => ({ id: r[0] })), 3), ["cat_026", "cat_027", "cat_028"]);
  assert.deepEqual(syncCategories.nextCategoryIds([{ id: "cat_009" }, { id: "legacy-slug" }], 2), ["cat_010", "cat_011"]);
});

test("AC-18 strengthened: a hand edit AFTER the rehearsal is caught, which the C1 digest alone cannot see", async () => {
  // The hole this closes. `C1` is stamped by the EXTRACTOR, so it does not move when
  // the captain corrects a date or an amount by hand. A receipt bound to C1 alone
  // still matches after she edited three rows, and production imports content nobody
  // rehearsed. The receipt therefore carries a second digest over the rows as read.
  const generated = normalizationTab({ approved: true });
  const edited = normalizationTab({ approved: true, edits: { "2024-r3-cH": { amount: "77" } } });

  assert.equal(edited.digest, generated.digest, "the generation digest is BLIND to her edit — that is the hole");

  const receipt = tmpFile("receipt.json");
  const rehearsalWorld = makeWorld({ normalization: generated });
  await importRun(rehearsalWorld, [
    "--rehearse", "--target", "staging", "--from-sheet", NORMALIZATION_TAB,
    "--snapshot-file", tmpFile("s.json"), "--receipt", receipt, "--hand-add-id", "manual",
  ]);
  const written = JSON.parse(fs.readFileSync(receipt, "utf8"));
  assert.equal(written.approvedAtRehearsal, true);
  assert.ok(written.contentDigest, "the receipt must record what it actually rehearsed");

  // Now she edits a row and someone tries production. The generation digest matches;
  // the content digest does not.
  const editedWorld = makeWorld({ normalization: edited });
  const before = expenseIds(editedWorld.production).length;
  await assert.rejects(
    importRun(editedWorld, [
      "--apply", "--target", "production", "--from-sheet", NORMALIZATION_TAB,
      "--receipt", receipt, "--snapshot-file", tmpFile("s.json"),
    ]),
    (err) => err instanceof ImportError && /CONTENT changed after/.test(err.message)
  );
  assert.equal(expenseIds(editedWorld.production).length, before, "nothing reaches production");

  // And the unedited sheet passes the same gate, so the guard is discriminating
  // rather than simply always refusing.
  const cleanWorld = makeWorld({ normalization: generated });
  const accepted = assertRehearsed(receipt, {
    fromSheet: NORMALIZATION_TAB,
    digest: generated.digest,
    contentDigest: importer.contentDigest(parseSheetGrid([generated.header, ...generated.rows]).rows),
  });
  assert.equal(accepted.rowCount, 19);
  assert.equal(cleanWorld.digest, generated.digest);
});

test("--rehearse proceeds on an unapproved sheet and records that it was unapproved", async () => {
  // The rehearsal is what produces the evidence she reads BEFORE approving, so it
  // cannot require her approval. It writes only to staging and restores it.
  const world = makeWorld({ normalization: normalizationTab({ approved: false }) });
  const receipt = tmpFile("r.json");
  await importRun(world, [
    "--rehearse", "--target", "staging", "--from-sheet", NORMALIZATION_TAB,
    "--snapshot-file", tmpFile("s.json"), "--receipt", receipt, "--hand-add-id", "manual",
  ]);
  assert.equal(JSON.parse(fs.readFileSync(receipt, "utf8")).approvedAtRehearsal, false);
  assert.deepEqual(expenseIds(world.staging), ["exp-001", "exp-002"], "staging restored");

  // AC-14 still holds independently: production refuses on B1 whatever the receipt says.
  await assert.rejects(
    importRun(world, [
      "--apply", "--target", "production", "--from-sheet", NORMALIZATION_TAB,
      "--receipt", receipt, "--snapshot-file", tmpFile("s.json"),
    ]),
    (err) => err instanceof ImportError && /is not approved/.test(err.message)
  );
  assert.equal(importedIds(world.production).length, 0);
});

// ---------------------------------------------------------------------------
// paid_by / created_by — the captain's ruling, and the id-vs-name hazard
// ---------------------------------------------------------------------------

// The app's own USERS table, compiled, so these assertions rest on the app's source
// of truth rather than on a second copy of it here.
const APP_USERS = (() => {
  const compiled = path.resolve(__dirname, "..", "..", "app", ".test-build", "users.js");
  if (!fs.existsSync(compiled)) {
    require("child_process").execFileSync(
      "npm", ["--prefix", path.resolve(__dirname, "..", "..", "app"), "run", "build:lib"],
      { encoding: "utf8", stdio: "pipe" }
    );
  }
  return require(compiled).USERS;
})();

test("imported rows carry user1's DISPLAY NAME, which is what the app stores — not the id", async () => {
  const expected = APP_USERS.find((u) => u.id === "user1").name;

  const world = makeWorld();
  await importRun(world, [
    "--apply", "--target", "staging", "--from-sheet", NORMALIZATION_TAB,
    "--snapshot-file", tmpFile("s.json"),
  ]);

  const header = world.staging.grids.Expenses[0];
  const iPaid = header.indexOf("paid_by");
  const iCreated = header.indexOf("created_by");
  const imported = world.staging.grids.Expenses.slice(1).filter((r) => r[0].startsWith(ID_PREFIX));
  assert.equal(imported.length, 19);

  for (const row of imported) {
    // Tied to the app's table, so this fails if the constant becomes "user1",
    // "Historical", or anything else — not merely if it differs from a literal here.
    assert.equal(row[iPaid], expected);
    assert.equal(row[iCreated], expected);
  }
  assert.equal(importer.historicalActorName(), expected);
});

test("the actor is a name the app can resolve back from an id, so the payer filter matches it", () => {
  const actor = importer.historicalActorName();

  // How Reports filters: PayerFilter carries an ID, and `resolvePayerName` turns it
  // into a NAME before comparing against stored `paid_by`
  // (`app/app/lib/reportService.ts`). So a stored value that is not one of the USERS
  // names can never be matched by any filter.
  const resolvableNames = APP_USERS.map((u) => u.name);
  assert.ok(
    resolvableNames.includes(actor),
    `paid_by ${JSON.stringify(actor)} must be one of ${JSON.stringify(resolvableNames)} — ` +
    `anything else is a payer no filter can select and no breakdown can show`
  );

  // The id is NOT such a value, which is the trap the ruling could have walked into.
  assert.equal(resolvableNames.includes("user1"), false);
  assert.notEqual(actor, "user1");
  // And the value the build originally proposed is not one either.
  assert.equal(resolvableNames.includes("Historical"), false);
});

test("falsified: writing the id instead of the name files every row against a payer no filter selects", async () => {
  const byId = loadPatched("import-historical-expenses.js", [
    ["  if (actorNameCache !== null) return actorNameCache;", "  return HISTORICAL_ACTOR_ID;"],
  ]);

  const world = makeWorld();
  await byId.run(["--apply", "--target", "staging", "--from-sheet", NORMALIZATION_TAB, "--snapshot-file", tmpFile("s.json")], {
    log: silent, env: STUB_ENV, sheetsFor: world.sheetsFor, now: () => new Date("2026-08-31T12:00:00.000Z"),
  });

  const header = world.staging.grids.Expenses[0];
  const iPaid = header.indexOf("paid_by");
  const imported = world.staging.grids.Expenses.slice(1).filter((r) => r[0].startsWith(ID_PREFIX));
  assert.equal(imported[0][iPaid], "user1", "the patched run really did write the id");

  // Every pre-existing row in the live sheets holds a NAME; the id joins none of them.
  const existingPayers = new Set(
    world.staging.grids.Expenses.slice(1)
      .filter((r) => !r[0].startsWith(ID_PREFIX))
      .map((r) => r[iPaid])
  );
  assert.ok(existingPayers.size > 0);
  assert.equal(
    existingPayers.has("user1"),
    false,
    "the id appears nowhere in the household's own rows — live staging holds only ijac and wei"
  );
  assert.ok(existingPayers.has(importer.historicalActorName()), "the correct actor DOES join the existing rows");
});
