// Generates functions/test/fixtures/historical-bands.json.
//
// AC-11: every figure, item name and detail label below is INVENTED. Nothing from
// the captain's workbook is reproduced — only its structure.
const fs = require("fs");
const path = require("path");

const serial = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
};

// Regenerate with: node functions/test/fixtures/generate-historical-bands.js
// The committed JSON is the fixture the suite reads; this script is how the date
// serials in it were computed, kept so a later change to the fixture's shape does
// not mean hand-editing serials.
const OUT = path.join(__dirname, "historical-bands.json");

// Column plan, 0-indexed. Two months instead of twelve; three data rows instead of
// twenty-six. Every structural quirk the live tab actually has is present.
//
//  0-4  A-E   row kind | bucket | sub-category | detail | note
//    5  F     January month-total          label: the number 1, header: 01-01
//    6  G     01-01 item name              label 品名
//    7  H     01-01 amount                 label 金額
//    8  I     01-02 item name
//    9  J     01-02 amount                 holds a TEXT-STORED amount
//   10  K     01-03 item name
//   11  L     01-03 amount                 label BLANK — the column-MI shape
//   12  M     01-04 item name
//   13  N     01-04 amount
//   14  O     01-04 item name AGAIN        duplicated date, both columns empty
//   15  P     01-04 amount again
//   16  Q     February month-total         label: the number 2, header: 02-01
//   17  R     02-01 item name
//   18  S     02-01 amount
//   19  T     02-02 item name              NO amount column: T+1 is a dated 品名
//   20  U     02-03 item name              holds a NUMERIC item name
//   21  V     02-03 amount
const WIDTH = 22;

const pad = (row) => {
  const out = row.slice();
  while (out.length < WIDTH) out.push("");
  return out;
};

function headerRow(year) {
  const r = new Array(WIDTH).fill("");
  r[5] = serial(`${year}-01-01`);
  r[6] = serial(`${year}-01-01`);
  r[8] = serial(`${year}-01-02`);
  r[10] = serial(`${year}-01-03`);
  r[12] = serial(`${year}-01-04`);
  r[14] = serial(`${year}-01-04`); // the duplicated-December shape
  r[16] = serial(`${year}-02-01`);
  r[17] = serial(`${year}-02-01`);
  r[19] = serial(`${year}-02-02`);
  r[20] = serial(`${year}-02-03`);
  return r;
}

function labelRow() {
  const r = new Array(WIDTH).fill("");
  r[0] = "收入支出";
  r[1] = "項目大類";
  r[2] = "項目分類";
  r[3] = "細項說明";
  r[4] = "備註";
  r[5] = 1;
  r[6] = "品名";
  r[7] = "金額";
  r[8] = "品名";
  r[9] = "金額";
  r[10] = "品名";
  r[11] = ""; // blank label — the MI defect's shape
  r[12] = "品名";
  r[13] = "金額";
  r[14] = "品名";
  r[15] = "金額";
  r[16] = 2;
  r[17] = "品名";
  r[18] = "金額";
  r[19] = "品名";
  r[20] = "品名";
  r[21] = "金額";
  return r;
}

// Columns A-C are byte-identical in all three bands, exactly as the live tab's are:
// a band-boundary slip produces rows that are well-formed and correctly categorised
// and wrong only in their year. Rows 2 and 3 share a taxonomy pair and differ only
// in the free-text detail column, so the row key cannot be the taxonomy.
const TAXONOMY = [
  ["非固定支出", "食", "食材", "", "Daily"],
  ["非固定支出", "住", "家具設備", "unit-alpha", "Daily"],
  ["非固定支出", "住", "家具設備", "unit-beta", "Daily"],
];

/**
 * `cells` maps a column index to its value for each of the three data rows.
 * Month-total cells are filled in from the day sums unless overridden, so the
 * fixture is self-consistent except where it is deliberately not.
 */
function dataRows({ cells, februaryTotalOverrides }) {
  const rows = TAXONOMY.map((meta) => pad(meta));
  for (const [col, values] of Object.entries(cells)) {
    values.forEach((v, i) => {
      if (v !== null) rows[i][Number(col)] = v;
    });
  }
  const janDayCols = [7, 9, 11, 13, 15];
  const febDayCols = [18, 21];
  const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));
  rows.forEach((row, i) => {
    row[5] = janDayCols.reduce((n, c) => n + num(row[c]), 0);
    row[16] = februaryTotalOverrides?.[i] ?? febDayCols.reduce((n, c) => n + num(row[c]), 0);
  });
  return rows;
}

const BANDS = {
  2024: dataRows({
    cells: {
      6: [7, "", ""],           // a NUMERIC item name
      7: [100, "", ""],
      9: ["250", "", ""],       // amount stored as TEXT
      11: [310, 70, 15],        // the blank-label amount column, holding real data
      13: ["", 80, ""],
      18: [400, 90, ""],
      20: [900, "", ""],        // 02-03's item name; a naive next-column rule reads it as 02-02's amount
      21: [500, "", 25],
    },
    // Row 3's February total disagrees with its own day cells (999 vs 25), the
    // source's ~12% self-disagreement in miniature. It must be REPORTED, never gate.
    februaryTotalOverrides: [null, null, 999],
  }),
  2023: dataRows({
    cells: {
      7: [11, "", ""],
      9: ["22", "33", ""],      // two more text-stored amounts
      11: ["", 44, 55],
      13: [66, "", ""],
      18: [77, "", 88],
      21: ["", 99, ""],
    },
  }),
  // 2022 carries data, so a positional band selector would silently import it.
  2022: dataRows({
    cells: {
      7: [1000, "", ""],
      11: [2000, 3000, ""],
      18: [4000, "", 5000],
      21: [6000, "", ""],
    },
  }),
};

const grid = [];
for (const year of [2024, 2023, 2022]) {
  grid.push(headerRow(year));
  grid.push(labelRow());
  for (const row of BANDS[year]) grid.push(row);
  grid.push(new Array(WIDTH).fill(""));
}
grid.pop(); // no trailing blank row

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      _comment: [
        "Entity 061 — a SYNTHETIC three-band grid reproducing the archive workbook's",
        "structure with invented numbers (AC-11: no real figure, item name or detail",
        "label from the captain's workbook is committed to this repository).",
        "",
        "Row 1 is 2024's date-header row, row 2 its column-label row, rows 3-5 its data.",
        "Then 2023 at rows 7-11 and 2022 at rows 13-17. Columns A-C are byte-identical",
        "in all three bands, as the live tab's are.",
        "",
        "Structural quirks reproduced, each one measured on the live source:",
        "  column L  amount column with a BLANK label holding real data (the MI defect)",
        "  column J  amount stored as TEXT rather than as a number",
        "  column T  a day with NO amount column: the next column is a dated 品名",
        "  column O  a duplicated date on an empty column pair (December 2024's shape)",
        "  column U  a numeric ITEM NAME, which the accounting must not count as an amount",
        "  row 5     a February month-total that disagrees with its own day cells",
        "  band 2022 out of scope, and carrying data, so a positional selector shows",
      ].join("\n"),
      rows: grid,
    },
    null,
    2
  ) + "\n",
  "utf8"
);
console.log(`wrote ${OUT}: ${grid.length} rows x ${WIDTH} cols`);
