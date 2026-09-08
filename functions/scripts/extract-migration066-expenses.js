/**
 * Entity 066, phase 1 of 2 — read ijac's own `smoney` ledger export ("migrate"
 * tab) and write a normalization sheet the captain can read and correct, one row
 * per in-window (2026-01-01..2026-04-30) 支出 (expense) row.
 *
 * This script NEVER writes an expense row — the importer does that, from a tab
 * this script produced and the captain then marked `APPROVED`. Same two-script
 * split `061`/`064` use, for the same reason: her approval sits structurally
 * between extract and import.
 *
 * Usage:
 *   node -r ./scripts/load-local-env.js scripts/extract-migration066-expenses.js --report
 *       read-only: prints the live header/row-count/date-range, the in-window
 *       支出/收入 split, and any unmapped category. Writes nothing.
 *   node -r ./scripts/load-local-env.js scripts/extract-migration066-expenses.js \
 *       --generate --into "Migration066 Jan-Apr 2026"
 *   node -r ./scripts/load-local-env.js scripts/extract-migration066-expenses.js \
 *       --generate --into "Migration066 Jan-Apr 2026 v2" --carry-from "Migration066 Jan-Apr 2026"
 *
 *   --fixture <path/to/grid.json>   run the whole core against a local grid
 *
 * Read is staging-only, always — the migration workbook is readable only by the
 * staging service account (per the spec's Blocking precondition). The
 * normalization tab is written to the STAGING app spreadsheet, same as `061`.
 *
 * The source, exactly as the spec characterized it: 8 columns (記帳日期 / 分類 /
 * 主分類 / 次分類 / 金額 / 幣別 / 更新日期 / 備註), one row per transaction, single
 * owner (every row is ijac's), no payer column. `分類` is `支出` (expense) or
 * `收入` (income) — the app's Expenses schema has no income field, so `收入` rows
 * are excluded from the import and reported, never silently dropped.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  READONLY_SCOPE,
  WRITE_SCOPE,
  MIGRATION066_SPREADSHEET_ID,
  MIGRATION066_TAB,
  MIGRATION066_GID,
  resolveCredentialPairs,
  sheetsClientFor,
  accountEmail,
} = require("./migration-env");

// ---------------------------------------------------------------------------
// The source's own vocabulary
// ---------------------------------------------------------------------------

const EXPENSE_TYPE = "支出";
const INCOME_TYPE = "收入";
const EXPECTED_HEADERS = ["記帳日期", "分類", "主分類", "次分類", "金額", "幣別", "更新日期", "備註"];
const COL = { date: 0, type: 1, mainCategory: 2, subCategory: 3, amount: 4, currency: 5, updatedAt: 6, notes: 7 };

/** This entity's own fixed window (Out of Scope: any month outside it). */
const WINDOW_START = "2026-01-01";
const WINDOW_END = "2026-04-30";

/** What the spec recorded at characterization time — printed for comparison, never gating (AC-2 allows drift from rows added/edited between spec and build). */
const RECORDED = { rowCount: 310, dateMin: "2025-09-29", dateMax: "2026-05-02", inWindowExpense: 203, inWindowIncome: 1 };

/**
 * `次分類` (source sub-category) -> target `name_zh`, exact string match against
 * the live Categories tab. 16 pairs are identity mappings (the source's own label
 * already IS the target's `name_zh`, confirmed live on both staging and
 * production at spec time); `房客` and `進修` carry the captain's explicit ruling
 * from the spec gate resolution, never a fuzzy auto-match (AC-4).
 */
const CATEGORY_MAP066 = new Map(Object.entries({
  食材: "食材",
  外食: "外食",
  日用品: "日用品",
  交通: "交通",
  旅遊: "旅遊",
  寶貝: "寶貝",
  衣服: "衣服",
  運動: "運動",
  醫療: "醫療",
  數位: "數位",
  禮物: "禮物",
  其他: "其他",
  學費: "學費",
  娛樂: "娛樂",
  加油: "加油",
  過路: "過路",
  // Captain's ruling, spec gate resolution 2026-09-08: staging carries an exact
  // `房客` match AND a separate `房客支出`; production carries only `房客支出`. A
  // mapping built on staging's exact match would be undefined on production.
  房客: "房客支出",
  // Captain's ruling: no target carries `進修` at all.
  進修: "學費",
}));

class ExtractError extends Error {}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

function text(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

/** Notes must survive byte-for-byte (AC-10) — never trimmed, never re-encoded. */
function rawText(v) {
  return v === undefined || v === null ? "" : String(v);
}

/**
 * A ledger date, as ISO. Live reads come back as Sheets serials under
 * `UNFORMATTED_VALUE`; a hand-written fixture may use either an ISO string or
 * the same serial, so both are accepted — the same dual-shape contract
 * `extract-historical-expenses.js`'s `parseHeaderDate` uses.
 */
function parseDateCell(v) {
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const ms = Math.round(v) * 86400000 + Date.UTC(1899, 11, 30);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = text(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/** Never silently returns 0 — a dropped or zeroed amount is invisible in every total. */
function parseAmount(v, ref) {
  const s = text(v);
  const n = Number(s);
  if (s === "" || !Number.isFinite(n)) {
    throw new ExtractError(`${ref}: amount ${JSON.stringify(v)} does not parse as a number.`);
  }
  return n;
}

function isBlankRow(row) {
  return !row || row.every((c) => text(c) === "");
}

// ---------------------------------------------------------------------------
// Header check (AC-2 / AC-9)
// ---------------------------------------------------------------------------

function checkHeaders(headerRow) {
  const found = (headerRow ?? []).map((c) => text(c));
  const ok = EXPECTED_HEADERS.every((h, i) => found[i] === h);
  return { ok, expected: EXPECTED_HEADERS, found };
}

// ---------------------------------------------------------------------------
// Core extraction (pure, fixture-testable)
// ---------------------------------------------------------------------------

/**
 * `grid[0]` is the header row (sheet row 1); `grid[i]` for `i >= 1` is sheet row
 * `i + 1`. `sourceRow` is that 1-based sheet row number — never a run-order
 * counter — which is what makes `exp-mig066-r{sourceRow}` collision-free and
 * stable across re-runs (AC-5).
 *
 * Refuses to emit ANY row if a single in-window 支出 row's `次分類` is unmapped
 * (AC-4): all missing sub-categories are collected across the whole scan first,
 * so one run names every gap rather than aborting on the first.
 */
function extract(grid, { windowStart = WINDOW_START, windowEnd = WINDOW_END, categoryMap = CATEGORY_MAP066 } = {}) {
  const headerCheck = checkHeaders(grid[0]);
  if (!headerCheck.ok) {
    throw new ExtractError(
      `"${MIGRATION066_TAB}" tab headers do not match. Expected ${JSON.stringify(EXPECTED_HEADERS)}, ` +
      `found ${JSON.stringify(headerCheck.found)}. Refusing to guess column positions on a changed schema.`
    );
  }

  let dateMin = null;
  let dateMax = null;
  let totalRows = 0;
  const missingCategoryMappings = new Set();
  const incomeRowsInWindow = [];
  const candidates = [];

  for (let i = 1; i < grid.length; i++) {
    const row = grid[i];
    if (isBlankRow(row)) continue;
    totalRows++;

    const sourceRow = i + 1;
    const ref = `${MIGRATION066_TAB}!A${sourceRow}`;
    const iso = parseDateCell(row[COL.date]);
    if (iso === null) {
      throw new ExtractError(`${ref}: date ${JSON.stringify(row[COL.date])} does not parse as a date.`);
    }
    if (dateMin === null || iso < dateMin) dateMin = iso;
    if (dateMax === null || iso > dateMax) dateMax = iso;

    if (iso < windowStart || iso > windowEnd) continue; // out of scope — every other month

    const type = text(row[COL.type]);
    const subCategory = text(row[COL.subCategory]);
    const amountRaw = row[COL.amount];
    const notes = rawText(row[COL.notes]);

    if (type === INCOME_TYPE) {
      incomeRowsInWindow.push({ sourceRow, date: iso, subCategory, amount: text(amountRaw), notes });
      continue; // the app's Expenses schema has no income field — excluded, not imported
    }
    if (type !== EXPENSE_TYPE) {
      throw new ExtractError(
        `${ref}: 分類 is ${JSON.stringify(row[COL.type])}, expected exactly "${EXPENSE_TYPE}" or "${INCOME_TYPE}". ` +
        `Refusing to guess how to treat an unrecognised type.`
      );
    }

    const categoryNameZh = categoryMap.get(subCategory);
    if (categoryNameZh === undefined) {
      missingCategoryMappings.add(subCategory);
      continue; // collected, not thrown yet — one run should name every gap
    }

    const amount = parseAmount(amountRaw, `${ref} (金額)`);
    candidates.push({
      key: `exp-mig066-r${sourceRow}`,
      source_row: String(sourceRow),
      date: iso,
      sub_category: subCategory,
      category_name_zh: categoryNameZh,
      amount: String(amount),
      notes,
      status: "include",
      captain_note: "",
    });
  }

  if (missingCategoryMappings.size > 0) {
    throw new ExtractError(
      `${missingCategoryMappings.size} 次分類 value(s) have no entry in CATEGORY_MAP066: ` +
      `${[...missingCategoryMappings].join(", ")}. Refusing to emit any row — a guessed or ` +
      `fuzzy-matched category is what AC-4 exists to prevent.`
    );
  }

  return {
    headerCheck,
    rowCount: totalRows,
    dateRange: { min: dateMin, max: dateMax },
    inWindow: { expense: candidates.length, income: incomeRowsInWindow.length },
    incomeRowsInWindow,
    candidates,
  };
}

// ---------------------------------------------------------------------------
// Normalization sheet shape (self-contained — the source shape is too different
// from `061`'s band grid to share its SHEET_COLUMNS/carryForward implementation)
// ---------------------------------------------------------------------------

const SHADOWED_COLUMNS = ["date", "amount", "category_name_zh", "status"];
const EDITABLE_COLUMNS = [...SHADOWED_COLUMNS, "captain_note"];
const SHEET_COLUMNS = [
  "key",
  "source_row",
  "date",
  "sub_category",
  "category_name_zh",
  "amount",
  "notes",
  "status",
  "captain_note",
  ...SHADOWED_COLUMNS.map((c) => `gen_${c}`),
];

const CONTROL_ROW_MARKER = "STATUS";
const APPROVAL_MARKER = "APPROVED";

/** Over the fields a hand edit could change, so a re-generate detects one. */
function dataDigest(rows) {
  const canonical = rows.map((r) => ["key", "date", "amount", "category_name_zh", "notes", "status"].map((c) => r[c] ?? "").join("")).join("\n");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 32);
}

function controlCellValue(generatedAt, digest) {
  return `generated=${generatedAt} digest=${digest}`;
}

function parseControlCell(value) {
  const s = text(value);
  return { generatedAt: /generated=(\S+)/.exec(s)?.[1] ?? null, digest: /digest=([0-9a-f]+)/.exec(s)?.[1] ?? null };
}

function sheetGridFor(rows, generatedAt) {
  const digest = dataDigest(rows);
  const control = [CONTROL_ROW_MARKER, "", controlCellValue(generatedAt, digest)];
  while (control.length < SHEET_COLUMNS.length) control.push("");
  const header = SHEET_COLUMNS.slice();
  const body = rows.map((r) =>
    SHEET_COLUMNS.map((c) => (c.startsWith("gen_") ? String(r[c] ?? r[c.slice(4)] ?? "") : String(r[c] ?? "")))
  );
  return { grid: [control, header, ...body], digest };
}

function parseSheetGrid(grid) {
  const control = grid[0] ?? [];
  const header = (grid[1] ?? []).map((c) => text(c));
  if (header.length === 0) throw new ExtractError("Normalization tab has no header row in row 2.");
  const index = new Map(header.map((name, i) => [name, i]));
  for (const required of ["key", ...SHADOWED_COLUMNS]) {
    if (!index.has(required)) {
      throw new ExtractError(`Normalization tab is missing the "${required}" column. Found: ${header.join(", ")}.`);
    }
  }
  const rows = [];
  for (let i = 2; i < grid.length; i++) {
    const raw = grid[i] ?? [];
    const key = text(raw[index.get("key")]);
    if (key === "") continue;
    const row = {};
    // `notes` must survive AC-10's byte-for-byte contract even through a captain
    // round-trip — every other column is a controlled/structured value, safe to trim.
    for (const [name, at] of index) row[name] = name === "notes" ? rawText(raw[at]) : text(raw[at]);
    rows.push(row);
  }
  return { control: { marker: text(control[0]), approval: text(control[1]), ...parseControlCell(control[2]) }, header, rows };
}

/**
 * Carries the captain's hand corrections from a prior generation into a fresh
 * extraction, matched on `key` (the source row's own coordinate) and never on
 * row position — same contract `061`'s `carryForward` proved.
 */
function carryForward(freshRows, priorRows) {
  const priorByKey = new Map(priorRows.map((r) => [r.key, r]));
  const conflicts = [];
  const carried = [];
  const merged = freshRows.map((fresh) => {
    const prior = priorByKey.get(fresh.key);
    if (!prior) return { ...fresh };
    const out = { ...fresh };
    for (const col of SHADOWED_COLUMNS) out[`gen_${col}`] = fresh[col] ?? "";
    for (const col of EDITABLE_COLUMNS) {
      const priorValue = prior[col] ?? "";
      const priorGenerated = SHADOWED_COLUMNS.includes(col) ? (prior[`gen_${col}`] ?? "") : "";
      const captainEdited = SHADOWED_COLUMNS.includes(col) ? priorValue !== priorGenerated : priorValue !== "";
      if (!captainEdited) continue;
      if (SHADOWED_COLUMNS.includes(col) && priorGenerated !== (fresh[col] ?? "")) {
        conflicts.push({ key: fresh.key, column: col, captainValue: priorValue, previouslyGenerated: priorGenerated, nowGenerated: fresh[col] ?? "" });
        continue;
      }
      out[col] = priorValue;
      carried.push({ key: fresh.key, column: col });
    }
    return out;
  });

  const freshKeys = new Set(freshRows.map((r) => r.key));
  const orphaned = [];
  for (const prior of priorRows) {
    if (freshKeys.has(prior.key)) continue;
    const row = {};
    for (const col of SHEET_COLUMNS) row[col] = prior[col] ?? "";
    row.status = "orphaned";
    orphaned.push(row);
  }

  return { rows: [...merged, ...orphaned], conflicts, carried, orphaned };
}

// ---------------------------------------------------------------------------
// Live IO
// ---------------------------------------------------------------------------

/**
 * AC-9 — confirms the tab named `migrate` is the SAME tab whose gid this spec
 * pinned, via one `spreadsheets.get` metadata call. A spreadsheet reorder that
 * renamed a different tab to "migrate" (or moved this one) surfaces here, before
 * any data is read.
 */
async function verifyTabIdentity(sheets) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: MIGRATION066_SPREADSHEET_ID, fields: "sheets.properties" });
  const found = (meta.data.sheets ?? []).find((s) => s.properties?.title === MIGRATION066_TAB);
  if (!found) {
    throw new ExtractError(`No tab named "${MIGRATION066_TAB}" in spreadsheet ${MIGRATION066_SPREADSHEET_ID}.`);
  }
  if (found.properties.sheetId !== MIGRATION066_GID) {
    throw new ExtractError(
      `Tab "${MIGRATION066_TAB}" has gid ${found.properties.sheetId}, expected the confirmed gid ${MIGRATION066_GID}. ` +
      `Refusing to read a tab whose identity does not match what this entity pinned.`
    );
  }
  return found.properties;
}

async function readMigrationGrid(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: MIGRATION066_SPREADSHEET_ID,
    range: `'${MIGRATION066_TAB}'!A:H`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  return res.data.values ?? [];
}

async function tabTitles(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  return (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean);
}

async function readNormalizationTab(sheets, spreadsheetId, tab) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:${columnLetter(SHEET_COLUMNS.length - 1)}` });
  return res.data.values ?? [];
}

function columnLetter(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    out = String.fromCharCode(65 + remainder) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

const SHEET_WRITE_BATCH = 400;

async function writeNormalizationTab(sheets, spreadsheetId, tab, grid) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: tab, gridProperties: { rowCount: grid.length + 10, columnCount: SHEET_COLUMNS.length } } } }],
    },
  });
  const lastCol = columnLetter(SHEET_COLUMNS.length - 1);
  for (let i = 0; i < grid.length; i += SHEET_WRITE_BATCH) {
    const chunk = grid.slice(i, i + SHEET_WRITE_BATCH);
    const width = SHEET_COLUMNS.length;
    const padded = chunk.map((row) => {
      const out = row.slice(0, width);
      while (out.length < width) out.push("");
      return out;
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${tab}'!A${i + 1}:${lastCol}${i + chunk.length}`,
      valueInputOption: "RAW", // never USER_ENTERED — a note beginning "=" must stay text
      requestBody: { values: padded },
    });
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  return {
    report: argv.includes("--report"),
    generate: argv.includes("--generate"),
    into: value("--into"),
    carryFrom: value("--carry-from"),
    fixture: value("--fixture"),
  };
}

function renderReport({ headerCheck, rowCount, dateRange, inWindow, incomeRowsInWindow }) {
  const lines = [
    `[report] headers ${headerCheck.ok ? "MATCH" : "MISMATCH"}: ${JSON.stringify(headerCheck.found)}`,
    `[report] live: ${rowCount} row(s) spanning ${dateRange.min}..${dateRange.max}`,
    `[report] recorded (spec): ${RECORDED.rowCount} row(s) spanning ${RECORDED.dateMin}..${RECORDED.dateMax}`,
    `[report] in-window (${WINDOW_START}..${WINDOW_END}): ${inWindow.expense} 支出, ${inWindow.income} 收入`,
    `[report] recorded in-window: ${RECORDED.inWindowExpense} 支出, ${RECORDED.inWindowIncome} 收入`,
  ];
  for (const r of incomeRowsInWindow) {
    lines.push(`[report] excluded 收入 row: sourceRow=${r.sourceRow} date=${r.date} amount=${r.amount} notes=${JSON.stringify(r.notes)}`);
  }
  return lines.join("\n");
}

async function run(argv, { log = console.log, env = process.env, sheetsFor = sheetsClientFor, now = () => new Date() } = {}) {
  const args = parseArgs(argv);

  let grid;
  let sheets = null;
  let stagingPair = null;
  if (args.fixture) {
    grid = JSON.parse(fs.readFileSync(args.fixture, "utf8"));
  } else {
    const pairs = resolveCredentialPairs(env);
    stagingPair = pairs.staging;
    if (!stagingPair.spreadsheetId || !stagingPair.credentialsJson) {
      throw new ExtractError(
        "Staging credentials are required to read the migration tab (SPREADSHEET_ID_STAGING / " +
        "GOOGLE_SERVICE_ACCOUNT_KEY_STAGING via `node -r ./scripts/load-local-env.js`)."
      );
    }
    // Same staging credentials read BOTH the migration workbook (MIGRATION066_SPREADSHEET_ID,
    // hardcoded into every call below) and, for --generate, the staging APP spreadsheet
    // (stagingPair.spreadsheetId) — one client suffices for both, since only the
    // credentials (not the spreadsheet id) are baked into it.
    const sourceSheets = await sheetsFor(stagingPair, READONLY_SCOPE);
    await verifyTabIdentity(sourceSheets);
    log(`[extract] "${MIGRATION066_TAB}" tab identity confirmed (gid ${MIGRATION066_GID}), read as ${accountEmail(stagingPair)}`);
    grid = await readMigrationGrid(sourceSheets);
    // Least privilege: a --report run never writes, so it never asks for WRITE_SCOPE.
    sheets = argv.includes("--generate") ? await sheetsFor(stagingPair, WRITE_SCOPE) : sourceSheets;
  }

  const result = extract(grid);
  log(renderReport(result));

  if (args.report) return { phase: "report", ...result };

  if (args.generate) {
    if (!args.into) throw new ExtractError('--generate requires --into "<tab name>", so a re-generate cannot silently pick one.');
    if (args.fixture) throw new ExtractError("--generate needs a real spreadsheet to write to; --fixture is --report only.");

    let rows = result.candidates;
    if (args.carryFrom) {
      const priorGrid = await readNormalizationTab(sheets, stagingPair.spreadsheetId, args.carryFrom);
      const prior = parseSheetGrid(priorGrid);
      const cf = carryForward(rows, prior.rows);
      if (cf.conflicts.length > 0) {
        throw new ExtractError(
          `${cf.conflicts.length} carry-forward conflict(s) — the source changed AND the captain edited the same cell: ` +
          cf.conflicts.map((c) => `${c.key}.${c.column}`).join(", ")
        );
      }
      rows = cf.rows;
      log(`[generate] carried forward ${cf.carried.length} hand-edited field(s) from "${args.carryFrom}", ${cf.orphaned.length} orphaned row(s)`);
    }

    const generatedAt = now().toISOString();
    const { grid: sheetGrid, digest } = sheetGridFor(rows, generatedAt);
    await writeNormalizationTab(sheets, stagingPair.spreadsheetId, args.into, sheetGrid);
    log(`[generate] wrote ${rows.length} row(s) to "${args.into}" in ${stagingPair.spreadsheetId} (digest ${digest})`);
    return { phase: "generate", rows: rows.length, into: args.into, digest };
  }

  return { phase: "report", ...result };
}

async function main() {
  await run(process.argv.slice(2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n[error] ${err.message ?? err}`);
    process.exitCode = 1;
  });
}

module.exports = {
  EXPENSE_TYPE,
  INCOME_TYPE,
  EXPECTED_HEADERS,
  WINDOW_START,
  WINDOW_END,
  RECORDED,
  CATEGORY_MAP066,
  ExtractError,
  SHADOWED_COLUMNS,
  EDITABLE_COLUMNS,
  SHEET_COLUMNS,
  CONTROL_ROW_MARKER,
  APPROVAL_MARKER,
  text,
  rawText,
  parseDateCell,
  parseAmount,
  checkHeaders,
  extract,
  dataDigest,
  controlCellValue,
  parseControlCell,
  sheetGridFor,
  parseSheetGrid,
  carryForward,
  verifyTabIdentity,
  readMigrationGrid,
  tabTitles,
  readNormalizationTab,
  writeNormalizationTab,
  columnLetter,
  parseArgs,
  renderReport,
  run,
};
