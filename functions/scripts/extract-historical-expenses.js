/**
 * Entity 061, phase 1 of 2 — read the captain's archive workbook and write a
 * normalization sheet she can read and correct, one row per populated day-amount
 * cell for 2023 and 2024.
 *
 * This script NEVER writes an expense row. The importer does that, from a tab this
 * script produced and the captain then marked `APPROVED`. Two scripts rather than
 * one so her approval sits structurally between extract and import and cannot be
 * bypassed by a flag (AC-14).
 *
 * Usage:
 *   node -r ./scripts/load-local-env.js scripts/extract-historical-expenses.js --report
 *       read-only: band discovery, the whole-band accounting audit, the variance
 *       report. Writes nothing to any spreadsheet.
 *   node -r ./scripts/load-local-env.js scripts/extract-historical-expenses.js \
 *       --generate --into "Migration 2023-2024"
 *   node -r ./scripts/load-local-env.js scripts/extract-historical-expenses.js \
 *       --generate --into "Migration 2023-2024 v2" --carry-from "Migration 2023-2024"
 *
 *   --fixture <path/to/grid.json>   run the whole core against a local grid
 *
 * Read and write are BOTH staging, always, on every run:
 *   - the archive workbook is readable only by the staging service account (the
 *     production one gets 403 on it);
 *   - the normalization tab lives in the staging expense spreadsheet, because
 *     write permission on the captain's personal workbook is unproven and the only
 *     conclusive test would be a write to her data. The archive stays read-only.
 *
 * The source's structure, all of it measured rather than assumed (see the entity's
 * "Source: what is actually there"):
 *   - three year bands stacked vertically, 2024 / 2023 / 2022, each 26 data rows;
 *   - a band's LABEL row is the row whose column A is `收入支出`; its date-header
 *     row is the row above; its data rows are the `非固定支出` rows below;
 *   - columns A-E are row-kind / bucket / sub-category / detail / note;
 *   - from column F, a repeating month-total column followed by that month's day
 *     columns, each day a `品名` (item name) + `金額` (amount) PAIR with the date
 *     on the header row above the `品名` column.
 *
 * The discriminator is the ITEM-NAME column, not the amount column. Keying on the
 * `金額` label — the obvious first design — silently drops three real expense
 * records in column MI, whose label cell is blank. AC-3 and AC-19 exist for that.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  READONLY_SCOPE,
  WRITE_SCOPE,
  ARCHIVE_SPREADSHEET_ID,
  ARCHIVE_TAB,
  resolveTargets,
  sheetsClientFor,
  accountEmail,
} = require("./migration-env");

// ---------------------------------------------------------------------------
// The source's own vocabulary
// ---------------------------------------------------------------------------

const BAND_LABEL_MARKER = "收入支出";
const DATA_ROW_MARKER = "非固定支出";
const ITEM_NAME_LABEL = "品名";
const AMOUNT_LABEL = "金額";

/** Columns A-E: row kind, bucket, sub-category, detail, note. Day columns start at F. */
const META_COLS = 5;
const COL_BUCKET = 1;
const COL_SUB_CATEGORY = 2;
const COL_DETAIL = 3;

const IN_SCOPE_YEARS = [2023, 2024];

const REPORT_DIR = path.resolve(__dirname, "..", "backfill-reports");

/**
 * `(項目大類, 項目分類)` -> category `name_en`.
 *
 * Deliberately a NAME and not a `cat_NNN` id. Staging and production both use
 * `cat_NNN` and they disagree from `cat_023` on — same id, different meaning — so a
 * table of ids rehearsed on staging would file production rows under the wrong
 * categories. The importer resolves the name against the target's own live tab
 * (AC-9). The 17 pairs are byte-identical in all three bands.
 */
const CATEGORY_MAP = new Map(Object.entries({
  "食|食材": "Groceries",
  "食|外食餐廳": "Eating Out",
  "衣|衣服鞋襪": "Clothing",
  "行|加油": "Fuel",
  "行|過路費": "Tolls",
  "行|修車保養": "Car Repair",
  "住|家用品": "Daily Necessities",
  "住|家具設備": "Equipment",
  "住|住家維修": "Equipment",
  "醫療|醫療": "Medical",
  "育|學費": "Tuition",
  "育|進修": "Tuition",
  "育|書、上課": "Tuition",
  "育|教練課": "Sports",
  "樂|旅遊": "Travel",
  "公益|捐款": "Donate",
  "雜項|雜項": "Other",
}));

/** Where an unmapped `(bucket, sub-category)` pair lands, per the `008` precedent. */
const FALLBACK_CATEGORY_NAME = "Other";

// ---------------------------------------------------------------------------
// Normalization sheet shape
// ---------------------------------------------------------------------------

/** Columns the captain may edit by hand. Each has a `gen_` shadow. */
const EDITABLE_COLUMNS = ["date", "amount", "category_name_en", "status", "captain_note"];

/** Shadowed columns: what the extractor last emitted, so a hand edit is detectable. */
const SHADOWED_COLUMNS = ["date", "amount", "category_name_en", "status"];

const SHEET_COLUMNS = [
  "key",
  "year",
  "date",
  "date_source",
  "bucket",
  "sub_category",
  "detail",
  "item_name",
  "amount",
  "category_name_en",
  "status",
  "captain_note",
  ...SHADOWED_COLUMNS.map((c) => `gen_${c}`),
];

const CONTROL_ROW_MARKER = "STATUS";
const APPROVAL_MARKER = "APPROVED";

class ExtractError extends Error {}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

function text(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA". Same function `sheetSchema.columnLetter` is. */
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

/**
 * A day-header date, as ISO, or null.
 *
 * Live reads come back as Sheets serials under `UNFORMATTED_VALUE`; the committed
 * fixtures use the same serials, so the fixture exercises the same branch the live
 * run does. An ISO string is accepted too, for a hand-written fixture.
 */
function parseHeaderDate(v) {
  if (typeof v === "number" && v > 30000 && v < 60000) {
    const ms = Math.round(v) * 86400000 + Date.UTC(1899, 11, 30);
    const iso = new Date(ms).toISOString().slice(0, 10);
    return iso;
  }
  const s = text(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

/**
 * Whether a cell holds a number, INCLUDING one stored as text.
 *
 * `typeof v === "number"` is the trap this exists to avoid: 10 cells in 2024 and 47
 * in 2023 store their amount as a digit string, and a typeof check drops all 57
 * silently — no error, no warning, 57 expense records simply absent.
 */
function isNumericish(v) {
  if (typeof v === "number") return Number.isFinite(v);
  const s = text(v);
  if (s === "") return false;
  return Number.isFinite(Number(s));
}

/**
 * The amount a cell holds. Parses text-stored digits; NEVER quietly returns 0.
 *
 * A value that does not parse aborts the run naming the source cell, rather than
 * becoming a zero-amount expense row nobody would notice.
 */
function parseAmount(v, ref) {
  const s = text(v);
  const n = Number(s);
  if (s === "" || !Number.isFinite(n)) {
    throw new ExtractError(
      `${ref}: amount ${JSON.stringify(v)} does not parse as a number. ` +
      `Refusing to guess — a dropped or zeroed amount is invisible in every total.`
    );
  }
  return n;
}

function cellAt(grid, row1Based, colIndex) {
  return grid[row1Based - 1]?.[colIndex];
}

function rowAt(grid, row1Based) {
  return grid[row1Based - 1] ?? [];
}

// ---------------------------------------------------------------------------
// Band discovery (AC-4a)
// ---------------------------------------------------------------------------

/**
 * The bands, discovered from column A's own structure. No row-range constant
 * exists here, which is the point: 2022 sits in this tab with columns A-C
 * byte-identical to 2023's and 2024's, so a hard-coded range that slipped would
 * produce well-formed, correctly-categorised rows attributed to the wrong year —
 * invisible to every check except a date check.
 */
function discoverBands(grid) {
  const bands = [];
  for (let row = 1; row <= grid.length; row++) {
    if (text(cellAt(grid, row, 0)) !== BAND_LABEL_MARKER) continue;
    if (row < 2) {
      throw new ExtractError(
        `Band label row ${row} has no row above it to carry the day-header dates.`
      );
    }
    let dataRow = row + 1;
    while (text(cellAt(grid, dataRow, 0)) === DATA_ROW_MARKER) dataRow++;
    const lastDataRow = dataRow - 1;
    if (lastDataRow < row + 1) {
      throw new ExtractError(
        `Band label row ${row} is followed by no "${DATA_ROW_MARKER}" data rows.`
      );
    }
    bands.push({
      labelRow: row,
      dateHeaderRow: row - 1,
      firstDataRow: row + 1,
      lastDataRow,
    });
  }
  if (bands.length === 0) {
    throw new ExtractError(
      `No band found: no row's column A is "${BAND_LABEL_MARKER}". The source's shape changed.`
    );
  }
  return bands;
}

/**
 * The single year a band's date-header row agrees on.
 *
 * Measured on the live tab: header rows 1 / 31 / 61 give exactly one year each —
 * 2024 / 2023 / 2022 — with no cross-year contamination. More than one year in a
 * header row means the source's shape changed, and guessing a band's year is how a
 * 2022 row reaches the app looking correct.
 */
function bandYear(grid, band) {
  const header = rowAt(grid, band.dateHeaderRow);
  const years = new Set();
  for (let c = META_COLS; c < header.length; c++) {
    const iso = parseHeaderDate(header[c]);
    if (iso) years.add(Number(iso.slice(0, 4)));
  }
  if (years.size === 0) {
    throw new ExtractError(
      `Band at label row ${band.labelRow}: no date found in header row ${band.dateHeaderRow}.`
    );
  }
  if (years.size > 1) {
    throw new ExtractError(
      `Band at label row ${band.labelRow}: header row ${band.dateHeaderRow} carries ` +
      `${years.size} distinct years (${[...years].sort().join(", ")}). Refusing to pick one.`
    );
  }
  return [...years][0];
}

// ---------------------------------------------------------------------------
// Column classification (AC-3)
// ---------------------------------------------------------------------------

/**
 * Classifies every column from F onward as exactly one of: a day item-name column,
 * a day amount column, a month-total column, or unclassified.
 *
 * The rule, corrected after an audit found the obvious one dropping real data:
 *
 *   a day item-name column is one whose LABEL is `品名` AND whose HEADER carries a
 *   date. Its amount column is the NEXT column whatever its label says.
 *
 * Three edge cases the live tab actually contains:
 *   - column `MI` is June 16's amount column in both bands with a BLANK label. The
 *     `金額`-label rule drops its 3 real amounts silently. Here it is claimed,
 *     because "next column, whatever its label" reaches it.
 *   - 2023-07-03 has NO amount column: the next column is already 07-04's dated
 *     `品名`. A naive "next column" rule would read 07-04's item name as 07-03's
 *     amount, so a day whose next column is itself a dated `品名` gets none.
 *   - an amount column whose label is neither `金額` nor blank aborts the run. That
 *     is a shape this parser does not understand, and continuing would mean
 *     guessing.
 */
function classifyColumns(grid, band) {
  const labels = rowAt(grid, band.labelRow);
  const header = rowAt(grid, band.dateHeaderRow);
  let maxCol = Math.max(labels.length, header.length);
  for (let r = band.firstDataRow; r <= band.lastDataRow; r++) {
    maxCol = Math.max(maxCol, rowAt(grid, r).length);
  }

  const label = (c) => text(labels[c]);
  const isItemNameColumn = (c) => label(c) === ITEM_NAME_LABEL;
  const isDatedItemNameColumn = (c) => isItemNameColumn(c) && parseHeaderDate(header[c]) !== null;

  const days = [];
  const kinds = new Map();
  const claim = (c, kind) => {
    const prior = kinds.get(c);
    if (prior && prior !== kind) {
      throw new ExtractError(
        `Column ${columnLetter(c)} classifies as both ${prior} and ${kind}. ` +
        `A double-claimed column would be counted twice in the accounting.`
      );
    }
    kinds.set(c, kind);
  };

  for (let c = META_COLS; c < maxCol; c++) {
    if (!isItemNameColumn(c)) continue;
    const iso = parseHeaderDate(header[c]);
    const next = c + 1;

    let amountCol = null;
    let skipReason = null;
    if (next >= maxCol) {
      skipReason = "no column follows it";
    } else if (isDatedItemNameColumn(next)) {
      // The 2023-07-03 shape. Borrowing this column would read the NEXT day's item
      // name as this day's amount.
      skipReason = `the next column ${columnLetter(next)} is itself a dated ${ITEM_NAME_LABEL} column`;
    } else {
      const nextLabel = label(next);
      if (nextLabel !== AMOUNT_LABEL && nextLabel !== "") {
        throw new ExtractError(
          `Column ${columnLetter(next)} is the amount column for ` +
          `${iso ?? `the undated ${ITEM_NAME_LABEL} column ${columnLetter(c)}`} but its label is ` +
          `${JSON.stringify(nextLabel)} — expected "${AMOUNT_LABEL}" or blank. ` +
          `Refusing to parse a column shape this script does not recognise.`
        );
      }
      amountCol = next;
    }

    claim(c, "day-item-name");
    if (amountCol !== null) claim(amountCol, "day-amount");
    days.push({ nameCol: c, amountCol, iso, skipReason });
  }

  // A month-total column carries a date on the header row too — that is why the
  // date alone cannot discriminate — but its label is a number, not `品名`.
  const monthTotalCols = [];
  for (let c = META_COLS; c < maxCol; c++) {
    if (kinds.has(c)) continue;
    if (parseHeaderDate(header[c]) === null) continue;
    if (label(c) === ITEM_NAME_LABEL) continue;
    monthTotalCols.push(c);
    claim(c, "month-total");
  }

  const unclassifiedCols = [];
  for (let c = META_COLS; c < maxCol; c++) if (!kinds.has(c)) unclassifiedCols.push(c);

  return { maxCol, labels, header, days, monthTotalCols, unclassifiedCols, kinds };
}

// ---------------------------------------------------------------------------
// Whole-band accounting (AC-19)
// ---------------------------------------------------------------------------

/**
 * Every numeric cell in the band's columns from F onward is a day amount, a day
 * item name, or a month total — and an unaccounted one ABORTS.
 *
 * This is the only assertion in the set that checks we did not MISS something.
 * Every other criterion checks that what we took is correct, and a silent drop is
 * invisible to all of them: the totals reconcile, the categories resolve, the dates
 * are valid, and three records are simply not there. Column `MI` survived two probe
 * rounds of this entity precisely because nothing counted the residue.
 *
 * Live figures it reproduces: 2024 = 775 + 5 + 312 = 1,092; 2023 = 895 + 11 + 312 =
 * 1,218; unaccounted 0 in both.
 */
function accountForBand(grid, band, classification) {
  const { maxCol, days, monthTotalCols } = classification;

  const countOver = (cols) => {
    let n = 0;
    for (const c of cols) {
      for (let r = band.firstDataRow; r <= band.lastDataRow; r++) {
        if (isNumericish(cellAt(grid, r, c))) n++;
      }
    }
    return n;
  };

  const allCols = [];
  for (let c = META_COLS; c < maxCol; c++) allCols.push(c);

  const dayAmount = countOver(days.filter((d) => d.amountCol !== null).map((d) => d.amountCol));
  const dayItemName = countOver(days.map((d) => d.nameCol));
  const monthTotal = countOver(monthTotalCols);
  const total = countOver(allCols);

  const residueColumns = classification.unclassifiedCols
    .map((c) => ({ column: columnLetter(c), index: c, cells: countOver([c]), label: text(classification.labels[c]) }))
    .filter((x) => x.cells > 0);

  const accounted = dayAmount + dayItemName + monthTotal;
  if (residueColumns.length > 0 || accounted !== total) {
    throw new ExtractError(
      `Band ${band.year ?? `at label row ${band.labelRow}`}: whole-band accounting failed. ` +
      `${dayAmount} day-amount + ${dayItemName} day-item-name + ${monthTotal} month-total = ` +
      `${accounted}, but the band holds ${total} numeric cells from column ` +
      `${columnLetter(META_COLS)} onward — ${total - accounted} unaccounted. ` +
      (residueColumns.length > 0
        ? `Unclassified columns holding data: ` +
          residueColumns.map((x) => `${x.column} (${x.cells} cells, label ${JSON.stringify(x.label)})`).join(", ") + ". "
        : "") +
      `Refusing to emit a partial extraction — a silently dropped column is invisible ` +
      `to every other check.`
    );
  }

  return { dayAmount, dayItemName, monthTotal, total, unaccounted: total - accounted, residueColumns };
}

// ---------------------------------------------------------------------------
// Row emission
// ---------------------------------------------------------------------------

function mapCategory(bucket, subCategory) {
  return CATEGORY_MAP.get(`${bucket}|${subCategory}`) ?? FALLBACK_CATEGORY_NAME;
}

/**
 * One row per populated day-amount cell, keyed by the source cell's own
 * coordinates.
 *
 * `key` is `{year}-r{sourceRow}-c{amountColumnLetter}` and it is load-bearing three
 * times over: AC-2's join from the app back to the approved sheet, AC-16's
 * carry-forward of the captain's hand corrections across a re-generate, and AC-10's
 * provenance. It cannot be the taxonomy pair instead — rows 8/9 and 19-26 of every
 * band repeat `住/家具設備` and `住/住家維修`, distinguished only by the free-text
 * detail column.
 */
function emitBandRows(grid, band, classification) {
  const rows = [];
  const year = band.year;

  const dated = classification.days.filter((d) => d.iso !== null && d.amountCol !== null);
  const undated = classification.days.filter((d) => d.iso === null && d.amountCol !== null);

  for (let r = band.firstDataRow; r <= band.lastDataRow; r++) {
    const bucket = text(cellAt(grid, r, COL_BUCKET));
    const subCategory = text(cellAt(grid, r, COL_SUB_CATEGORY));
    const detail = text(cellAt(grid, r, COL_DETAIL));

    const emit = (day, status) => {
      const raw = cellAt(grid, r, day.amountCol);
      if (text(raw) === "") return;
      const ref = `${ARCHIVE_TAB}!${columnLetter(day.amountCol)}${r}`;
      const amount = parseAmount(raw, ref);

      // AC-4b: the row's OWN date must sit inside its band's declared year. The
      // second of three independent enforcement points, and the only one that
      // catches a band whose header row disagrees with its own day columns.
      if (status === "include" && !day.iso.startsWith(`${year}-`)) {
        throw new ExtractError(
          `${ref}: day column ${columnLetter(day.nameCol)} is dated ${day.iso}, outside ` +
          `band year ${year}. A row attributed to the wrong year is well-formed and ` +
          `correctly categorised — nothing downstream would look wrong.`
        );
      }

      rows.push({
        key: `${year}-r${r}-c${columnLetter(day.amountCol)}`,
        year: String(year),
        date: status === "undated" ? "" : day.iso,
        date_source: status === "undated" ? "missing" : "header",
        bucket,
        sub_category: subCategory,
        detail,
        item_name: text(cellAt(grid, r, day.nameCol)),
        amount: String(amount),
        category_name_en: mapCategory(bucket, subCategory),
        status,
        captain_note: "",
      });
    };

    for (const day of dated) emit(day, "include");
    // The undated guard. On today's source it marks nothing — every one of the
    // 1,670 importable rows carries a real date read from its own column header.
    // It stays because it is what makes the captain's option-A ruling survive a
    // source that changes: an undated cell becomes an EXCLUDED, REPORTED row rather
    // than a dropped one or a row wearing a date the source never carried.
    for (const day of undated) emit(day, "undated");
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Variance report (AC-15)
// ---------------------------------------------------------------------------

/**
 * The workbook's own month-total cells against the sum of their own day cells.
 *
 * Reported, never gating. The workbook disagrees with itself on ~12% of these, so a
 * threshold here would break the pipeline on the captain's spreadsheet rather than
 * on our defect — which is exactly what made the original AC-2 unfalsifiable. The
 * exit code is independent of everything below.
 */
function varianceForBand(grid, band, classification) {
  const { days, monthTotalCols, maxCol } = classification;
  const boundaries = [...monthTotalCols].sort((a, b) => a - b);
  const months = [];

  boundaries.forEach((totalCol, i) => {
    const nextBoundary = boundaries[i + 1] ?? maxCol;
    const segmentDays = days.filter(
      (d) => d.nameCol > totalCol && d.nameCol < nextBoundary && d.amountCol !== null && d.iso
    );
    const monthKey = segmentDays.length > 0
      ? segmentDays[0].iso.slice(0, 7)
      : parseHeaderDate(classification.header[totalCol])?.slice(0, 7) ?? null;

    let workbookTotal = 0;
    let daySum = 0;
    const rowMismatches = [];
    for (let r = band.firstDataRow; r <= band.lastDataRow; r++) {
      const totalCell = cellAt(grid, r, totalCol);
      const rowTotal = isNumericish(totalCell) ? Number(text(totalCell)) : null;
      let rowDaySum = 0;
      for (const d of segmentDays) {
        const v = cellAt(grid, r, d.amountCol);
        if (isNumericish(v)) rowDaySum += Number(text(v));
      }
      if (rowTotal !== null) workbookTotal += rowTotal;
      daySum += rowDaySum;
      if (rowTotal !== null && rowTotal !== 0) {
        const pct = Math.abs(rowTotal - rowDaySum) / Math.abs(rowTotal);
        if (pct > 0.01) {
          rowMismatches.push({ row: r, pctOff: Number((pct * 100).toFixed(2)) });
        }
      }
    }

    months.push({
      month: monthKey,
      totalColumn: columnLetter(totalCol),
      dayColumns: segmentDays.length,
      workbookTotal,
      daySum,
      difference: workbookTotal - daySum,
      rowMismatchCount: rowMismatches.length,
      rowMismatches,
    });
  });

  return months;
}

function renderVarianceReport(bandsVariance, generatedAt) {
  const lines = [
    "# 061 — the source workbook against its own month totals",
    "",
    `- generated: ${generatedAt}`,
    "- **This report gates nothing.** The extractor's exit code does not depend on a",
    "  single figure below. The workbook disagrees with itself on about 12% of these",
    "  cells, so a threshold here would fail on the spreadsheet rather than on the",
    "  parser. It is here so the captain can see the disagreements and settle the ones",
    "  she cares about in the normalization sheet before anything is imported.",
    "- `workbook total` is the sum of that month's own month-total column over the",
    "  band's 26 data rows. `day sum` is the sum of that month's day-amount cells.",
    "  They should agree; where they do not, the source is inconsistent with itself.",
    "",
  ];

  for (const band of bandsVariance) {
    lines.push(`## ${band.year}`, "");
    lines.push("| month | total col | day cols | workbook total | day sum | difference | rows >1% off |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const m of band.months) {
      lines.push(
        `| ${m.month ?? "(unknown)"} | ${m.totalColumn} | ${m.dayColumns} | ${m.workbookTotal} | ` +
        `${m.daySum} | ${m.difference} | ${m.rowMismatchCount} |`
      );
    }
    const covered = band.months.filter((m) => m.month).length;
    lines.push("", `- month-total columns found: ${band.months.length} (${covered} with a resolved month)`, "");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Extraction over a whole grid
// ---------------------------------------------------------------------------

/**
 * The full extraction: discover bands, label each by year, select the in-scope
 * years, classify columns, audit the accounting, emit rows, measure the variance.
 *
 * Bands are selected BY YEAR, never by position. A positional selector ("take the
 * first three bands", "take bands 0 and 1") is the falsifier AC-4a names: 2022 sits
 * in this tab and its columns A-C are byte-identical to the years in scope.
 */
function extract(grid, { years = IN_SCOPE_YEARS } = {}) {
  const discovered = discoverBands(grid).map((band) => ({ ...band, year: bandYear(grid, band) }));

  const seen = new Map();
  for (const band of discovered) {
    if (seen.has(band.year)) {
      throw new ExtractError(
        `Two bands both label themselves ${band.year} (label rows ${seen.get(band.year).labelRow} ` +
        `and ${band.labelRow}). Refusing to guess which one is the year's data.`
      );
    }
    seen.set(band.year, band);
  }

  const missing = years.filter((y) => !seen.has(y));
  if (missing.length > 0) {
    throw new ExtractError(
      `No band labelled ${missing.join(", ")} in the source. Bands found: ` +
      `${discovered.map((b) => `${b.year} (rows ${b.firstDataRow}-${b.lastDataRow})`).join(", ")}.`
    );
  }

  const bands = [];
  const rows = [];
  const bandsVariance = [];

  for (const year of [...years].sort()) {
    const band = seen.get(year);
    const classification = classifyColumns(grid, band);
    const accounting = accountForBand(grid, band, classification);
    const bandRows = emitBandRows(grid, band, classification);
    rows.push(...bandRows);
    bandsVariance.push({ year, months: varianceForBand(grid, band, classification) });
    bands.push({
      year,
      labelRow: band.labelRow,
      dateHeaderRow: band.dateHeaderRow,
      firstDataRow: band.firstDataRow,
      lastDataRow: band.lastDataRow,
      dayColumns: classification.days.length,
      dayColumnsWithoutAmount: classification.days.filter((d) => d.amountCol === null).length,
      monthTotalColumns: classification.monthTotalCols.length,
      unclassifiedColumns: classification.unclassifiedCols.length,
      accounting,
      distinctDates: new Set(bandRows.filter((r) => r.date).map((r) => r.date)).size,
      rows: bandRows.length,
      undatedRows: bandRows.filter((r) => r.status === "undated").length,
    });
  }

  const skippedBands = discovered
    .filter((b) => !years.includes(b.year))
    .map((b) => ({ year: b.year, firstDataRow: b.firstDataRow, lastDataRow: b.lastDataRow }));

  return { bands, skippedBands, rows, variance: bandsVariance };
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

/**
 * A digest over the extractor-emitted data block, stamped into `C1`.
 *
 * The captain's later edits do NOT change it — it identifies the generation, which
 * is what AC-18's rehearsal receipt needs: a receipt names the sheet AND the
 * generation it rehearsed, so a stale receipt cannot let production import a sheet
 * that was never rehearsed.
 */
function dataDigest(rows) {
  const canonical = rows.map((r) => SHEET_COLUMNS.slice(0, 12).map((c) => r[c] ?? "").join("")).join("\n");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 32);
}

function controlCellValue(generatedAt, digest) {
  return `generated=${generatedAt} digest=${digest}`;
}

function parseControlCell(value) {
  const s = text(value);
  const gen = /generated=(\S+)/.exec(s);
  const dig = /digest=([0-9a-f]+)/.exec(s);
  return { generatedAt: gen?.[1] ?? null, digest: dig?.[1] ?? null };
}

// ---------------------------------------------------------------------------
// Normalization sheet: grid <-> rows
// ---------------------------------------------------------------------------

function sheetGridFor(rows, generatedAt) {
  const digest = dataDigest(rows);
  const control = [CONTROL_ROW_MARKER, "", controlCellValue(generatedAt, digest)];
  while (control.length < SHEET_COLUMNS.length) control.push("");
  const header = SHEET_COLUMNS.slice();
  // A `gen_x` shadow defaults to this run's own `x`. It is what makes a later hand
  // edit DETECTABLE: the carry-forward compares her value against the shadow, so a
  // sheet written without shadows would read every value as unedited and silently
  // discard her whole manual pass on the next re-generate.
  const body = rows.map((r) =>
    SHEET_COLUMNS.map((c) => {
      if (c.startsWith("gen_")) return String(r[c] ?? r[c.slice(4)] ?? "");
      return String(r[c] ?? "");
    })
  );
  return { grid: [control, header, ...body], digest };
}

/** Parses a normalization tab back into rows, keyed by the header row's own names. */
function parseSheetGrid(grid) {
  const control = grid[0] ?? [];
  const header = (grid[1] ?? []).map((c) => text(c));
  if (header.length === 0) {
    throw new ExtractError("Normalization tab has no header row in row 2.");
  }
  const index = new Map(header.map((name, i) => [name, i]));
  for (const required of ["key", ...SHADOWED_COLUMNS]) {
    if (!index.has(required)) {
      throw new ExtractError(
        `Normalization tab is missing the "${required}" column. Found: ${header.join(", ")}.`
      );
    }
  }
  const rows = [];
  for (let i = 2; i < grid.length; i++) {
    const raw = grid[i] ?? [];
    const key = text(raw[index.get("key")]);
    if (key === "") continue;
    const row = {};
    for (const [name, at] of index) row[name] = text(raw[at]);
    rows.push(row);
  }
  return {
    control: {
      marker: text(control[0]),
      approval: text(control[1]),
      ...parseControlCell(control[2]),
    },
    header,
    rows,
  };
}

// ---------------------------------------------------------------------------
// Carry-forward (AC-16)
// ---------------------------------------------------------------------------

/**
 * Carries the captain's hand corrections from an existing tab into a fresh
 * extraction, matched on `key` — the source cell's own coordinates — and NEVER on
 * row position. Insert or drop one row and a positional match lands every
 * subsequent edit on the wrong expense.
 *
 * The mechanism is never-overwrite, not merge-in-place. `--generate` refuses to
 * write over an existing tab, so if this carry-forward is itself buggy the previous
 * tab still holds every correction and recovery is re-running the merge rather than
 * re-doing her manual pass. An in-place merge that goes wrong has already destroyed
 * the thing it was preserving.
 */
function carryForward(freshRows, priorRows) {
  const priorByKey = new Map(priorRows.map((r) => [r.key, r]));
  const conflicts = [];
  const carried = [];
  const merged = freshRows.map((fresh) => {
    const prior = priorByKey.get(fresh.key);
    if (!prior) return { ...fresh };

    const out = { ...fresh };
    // Pin THIS run's extraction as the shadow before her values land on top, or the
    // next re-generate would compare her carried value against itself and conclude
    // she never edited anything.
    for (const col of SHADOWED_COLUMNS) out[`gen_${col}`] = fresh[col] ?? "";

    for (const col of EDITABLE_COLUMNS) {
      const priorValue = prior[col] ?? "";
      const priorGenerated = SHADOWED_COLUMNS.includes(col) ? (prior[`gen_${col}`] ?? "") : "";
      const captainEdited = SHADOWED_COLUMNS.includes(col)
        ? priorValue !== priorGenerated
        : priorValue !== "";
      if (!captainEdited) continue;

      // The one case where carrying forward and re-extracting genuinely disagree:
      // the source cell changed AND she had edited the same column. Neither answer
      // is safe to pick for her, so the run stops and lists the keys.
      if (SHADOWED_COLUMNS.includes(col) && priorGenerated !== (fresh[col] ?? "")) {
        conflicts.push({
          key: fresh.key,
          column: col,
          captainValue: priorValue,
          previouslyGenerated: priorGenerated,
          nowGenerated: fresh[col] ?? "",
        });
        continue;
      }

      out[col] = priorValue;
      if (col === "date") out.date_source = "captain";
      carried.push({ key: fresh.key, column: col });
    }
    return out;
  });

  // A key that vanished from the source is NOT dropped. Her correction cannot
  // disappear because a source cell went blank; it arrives as `orphaned` and is
  // reported by count.
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

/** Sparse grid: index i holds sheet row i+1, or a hole where the row was not read. */
async function readSourceGrid(sheets) {
  const colA = await sheets.spreadsheets.values.get({
    spreadsheetId: ARCHIVE_SPREADSHEET_ID,
    range: `'${ARCHIVE_TAB}'!A:A`,
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const columnA = colA.data.values ?? [];

  const markerRows = [];
  columnA.forEach((row, i) => {
    if (text(row?.[0]) === BAND_LABEL_MARKER) markerRows.push(i + 1);
  });

  const grid = columnA.map((row) => [text(row?.[0]) === "" ? "" : row[0]]);

  // Per band, read the date-header row, the label row and the data rows in full.
  // Reading the whole 1,061 x 749 tab would be ~794k cells for the ~80 rows that
  // matter.
  const ranges = [];
  const spans = [];
  for (const labelRow of markerRows) {
    let dataRow = labelRow + 1;
    while (text(columnA[dataRow - 1]?.[0]) === DATA_ROW_MARKER) dataRow++;
    const lastDataRow = dataRow - 1;
    spans.push({ labelRow, lastDataRow });
    ranges.push(`'${ARCHIVE_TAB}'!${labelRow - 1}:${labelRow - 1}`);
    ranges.push(`'${ARCHIVE_TAB}'!${labelRow}:${labelRow}`);
    ranges.push(`'${ARCHIVE_TAB}'!${labelRow + 1}:${lastDataRow}`);
  }

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: ARCHIVE_SPREADSHEET_ID,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const put = (row1Based, values) => {
    while (grid.length < row1Based) grid.push([]);
    grid[row1Based - 1] = values;
  };

  spans.forEach((span, i) => {
    const headerVals = res.data.valueRanges[i * 3].values?.[0] ?? [];
    const labelVals = res.data.valueRanges[i * 3 + 1].values?.[0] ?? [];
    const dataVals = res.data.valueRanges[i * 3 + 2].values ?? [];
    put(span.labelRow - 1, headerVals);
    put(span.labelRow, labelVals);
    dataVals.forEach((vals, j) => put(span.labelRow + 1 + j, vals));
  });

  return grid;
}

async function tabTitles(sheets, spreadsheetId) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  return (meta.data.sheets ?? []).map((s) => s.properties?.title).filter(Boolean);
}

async function readTabGrid(sheets, spreadsheetId, tab) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A:${columnLetter(SHEET_COLUMNS.length - 1)}`,
  });
  return res.data.values ?? [];
}

const SHEET_WRITE_BATCH = 400;

async function writeNormalizationTab(sheets, spreadsheetId, tab, grid) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: tab } } }] },
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
      // RAW, not USER_ENTERED: a note or a detail label beginning "=" must stay
      // text rather than becoming a formula.
      valueInputOption: "RAW",
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
    varianceReport: value("--variance-report"),
  };
}

function summarise(result, log) {
  for (const band of result.bands) {
    log(
      `[band] ${band.year}: rows ${band.firstDataRow}-${band.lastDataRow}, ` +
      `${band.dayColumns} day columns (${band.dayColumnsWithoutAmount} with no amount column), ` +
      `${band.monthTotalColumns} month-total columns`
    );
    const a = band.accounting;
    log(
      `[band] ${band.year}: accounting ${a.dayAmount} day-amount + ${a.dayItemName} day-item-name + ` +
      `${a.monthTotal} month-total = ${a.dayAmount + a.dayItemName + a.monthTotal} of ${a.total} ` +
      `numeric cells; UNACCOUNTED ${a.unaccounted}`
    );
    log(
      `[band] ${band.year}: emitted ${band.rows} rows, ${band.distinctDates} distinct dates, ` +
      `${band.undatedRows} undated`
    );
  }
  for (const b of result.skippedBands) {
    log(`[band] ${b.year}: OUT OF SCOPE (rows ${b.firstDataRow}-${b.lastDataRow}) — read only to find the boundary`);
  }
  log(`[extract] ${result.rows.length} rows total across ${result.bands.length} in-scope bands`);
}

async function run(argv, { log = console.log, env = process.env, sheetsFor = sheetsClientFor } = {}) {
  const args = parseArgs(argv);
  if (args.report === args.generate) {
    throw new ExtractError("Pass exactly one of --report or --generate.");
  }
  if (args.generate && !args.into) {
    throw new ExtractError(
      '--generate needs --into "<tab name>". There is no default: the tab name is what ' +
      'the importer is later told to read, and a defaulted one is a tab nobody named.'
    );
  }

  const generatedAt = new Date().toISOString();

  // The extractor is staging in BOTH directions on every run — it never takes a
  // target, because there is nothing here a target could vary.
  const targets = resolveTargets({ target: "staging", env });

  let grid;
  if (args.fixture) {
    const raw = JSON.parse(fs.readFileSync(args.fixture, "utf8"));
    grid = Array.isArray(raw) ? raw : raw.rows;
    log(`[extract] fixture ${args.fixture}: ${grid.length} rows`);
  } else {
    const readSheets = await sheetsFor(targets.read, READONLY_SCOPE);
    log(`[extract] source ${ARCHIVE_SPREADSHEET_ID} tab "${ARCHIVE_TAB}" as ${accountEmail(targets.read)} (read-only scope)`);
    grid = await readSourceGrid(readSheets);
  }

  const result = extract(grid);
  summarise(result, log);

  const variancePath = args.varianceReport
    ?? path.join(REPORT_DIR, `061-source-variance-${generatedAt.slice(0, 10)}.md`);
  fs.mkdirSync(path.dirname(variancePath), { recursive: true });
  fs.writeFileSync(variancePath, renderVarianceReport(result.variance, generatedAt), "utf8");
  const totalMismatches = result.variance.reduce(
    (n, b) => n + b.months.reduce((m, x) => m + x.rowMismatchCount, 0), 0
  );
  log(`[variance] ${totalMismatches} row-month cells disagree with their own day cells by >1% — reported, gates nothing`);
  log(`[variance] written to ${variancePath}`);

  if (args.report) {
    log("[extract] --report: nothing written to any spreadsheet.");
    return { ...result, generatedAt, variancePath, wrote: null };
  }

  const writeSheets = await sheetsFor(targets.read, WRITE_SCOPE);
  const existing = await tabTitles(writeSheets, targets.read.spreadsheetId);

  // Step 1 of the survive-a-re-generate mechanism: never overwrite. This is what
  // makes a buggy carry-forward recoverable rather than destructive.
  if (existing.includes(args.into)) {
    throw new ExtractError(
      `Tab "${args.into}" already exists in ${targets.read.spreadsheetId}. Refusing to write over it — ` +
      `it may hold the captain's hand corrections. To re-generate, pass a new ` +
      `--into name and --carry-from "${args.into}".`
    );
  }

  let rows = result.rows;
  let carry = null;
  if (args.carryFrom) {
    if (!existing.includes(args.carryFrom)) {
      throw new ExtractError(`--carry-from tab "${args.carryFrom}" does not exist in ${targets.read.spreadsheetId}.`);
    }
    const priorGrid = await readTabGrid(writeSheets, targets.read.spreadsheetId, args.carryFrom);
    const prior = parseSheetGrid(priorGrid);
    carry = carryForward(result.rows, prior.rows);
    if (carry.conflicts.length > 0) {
      throw new ExtractError(
        `${carry.conflicts.length} correction(s) cannot be reconciled: the source cell changed AND ` +
        `the captain had edited the same column. Nothing was written. Decide per key:\n` +
        carry.conflicts
          .map((c) => `  ${c.key} ${c.column}: hers ${JSON.stringify(c.captainValue)}, was ` +
            `${JSON.stringify(c.previouslyGenerated)}, now ${JSON.stringify(c.nowGenerated)}`)
          .join("\n")
      );
    }
    rows = carry.rows;
    log(
      `[carry] ${carry.carried.length} hand correction(s) carried from "${args.carryFrom}" by key, ` +
      `${carry.orphaned.length} key(s) carried as orphaned`
    );
  }

  const { grid: sheetGrid, digest } = sheetGridFor(rows, generatedAt);
  await writeNormalizationTab(writeSheets, targets.read.spreadsheetId, args.into, sheetGrid);

  log(`[generate] tab "${args.into}" written to ${targets.read.spreadsheetId}: ${rows.length} data rows`);
  log(`[generate] C1 = ${controlCellValue(generatedAt, digest)}`);
  log(`[generate] B1 is BLANK. The import refuses to run until the captain types ${APPROVAL_MARKER} there.`);

  return { ...result, rows, generatedAt, digest, variancePath, carry, wrote: args.into };
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
  BAND_LABEL_MARKER,
  DATA_ROW_MARKER,
  ITEM_NAME_LABEL,
  AMOUNT_LABEL,
  META_COLS,
  IN_SCOPE_YEARS,
  CATEGORY_MAP,
  FALLBACK_CATEGORY_NAME,
  SHEET_COLUMNS,
  EDITABLE_COLUMNS,
  SHADOWED_COLUMNS,
  CONTROL_ROW_MARKER,
  APPROVAL_MARKER,
  REPORT_DIR,
  ExtractError,
  text,
  columnLetter,
  parseHeaderDate,
  isNumericish,
  parseAmount,
  discoverBands,
  bandYear,
  classifyColumns,
  accountForBand,
  mapCategory,
  emitBandRows,
  varianceForBand,
  renderVarianceReport,
  extract,
  dataDigest,
  controlCellValue,
  parseControlCell,
  sheetGridFor,
  parseSheetGrid,
  carryForward,
  readSourceGrid,
  readTabGrid,
  tabTitles,
  writeNormalizationTab,
  parseArgs,
  run,
};
