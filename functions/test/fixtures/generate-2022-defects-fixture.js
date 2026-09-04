// Generates functions/test/fixtures/historical-2022-defects.json.
//
// Entity 062 — a SYNTHETIC single-band 2022-shape grid reproducing the three
// live source-shape defects found at spec, with INVENTED numbers (AC-11). A
// dedicated fixture rather than an extension of `historical-bands.json`: that
// fixture's header/label rows are shared across all three years, and these
// defects are 2022-specific column shapes that would otherwise have to be
// smuggled into 2023/2024's rows too.
const fs = require("fs");
const path = require("path");

const serial = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
};

const OUT = path.join(__dirname, "historical-2022-defects.json");

// Column plan, 0-indexed, one band only:
//  0-4  A-E   row kind | bucket | sub-category | detail | note
//    5  F     month-total          label: 1, header: 2022-01-01
//    6  G     day1 (01-01) item name        label 品名
//    7  H     day1 (01-01) amount           label 金額
//    8  I     day2 (01-02) item name        label 品名
//    9  J     day2 (01-02) amount           label 金額
//   10  K     the NO shape: a second 金額 column for day2, no header date of its own
//   11  L     day3 (01-03) item name        label 品名
//   12  M     day3 (01-03) amount           label 金額
//   13  N     the ZI/ZJ shape: item name headered EARLIER than day3 — out of sequence
//   14  O     that day's amount             label 金額
//   15  P     the August shape: item-name header BLANK
//   16  Q     that day's amount, header carries the date instead
const WIDTH = 17;

const pad = (row) => {
  const out = row.slice();
  while (out.length < WIDTH) out.push("");
  return out;
};

const header = new Array(WIDTH).fill("");
header[5] = serial("2022-01-01");
header[6] = serial("2022-01-01");
header[8] = serial("2022-01-02");
// column 10 (K, the NO shape): deliberately NO header date of its own.
header[11] = serial("2022-01-03");
// column 13 (N, the ZI/ZJ shape): a well-formed date, but EARLIER than 01-03's,
// positioned structurally after it — out of the band's own chronological order.
header[13] = serial("2022-01-02");
// column 15 (P, the August shape): deliberately BLANK — the date sits on Q instead.
header[16] = serial("2022-01-05");

const label = new Array(WIDTH).fill("");
label[0] = "收入支出";
label[1] = "項目大類";
label[2] = "項目分類";
label[3] = "細項說明";
label[4] = "備註";
label[5] = 1;
label[6] = "品名";
label[7] = "金額";
label[8] = "品名";
label[9] = "金額";
label[10] = "金額"; // the NO shape: labelled 金額, not preceded by its own 品名
label[11] = "品名";
label[12] = "金額";
label[13] = "品名";
label[14] = "金額";
label[15] = "品名"; // the August shape: 品名 label, but a BLANK header
label[16] = "金額";

// One data row. Amounts are all invented (AC-11).
const dataRow = pad([
  "非固定支出", "食", "食材", "unit-2022", "Daily",
  0, // month-total, filled in below
  "", 100, // day1
  "", 50, // day2
  25, // the NO shape's second amount for day2
  "", 10, // day3
  "", 5, // the ZI/ZJ-shape column's amount
  "", 8, // the August-shape column's amount
]);
dataRow[5] = 100 + 50 + 10 + 5 + 8; // month-total: does not include the NO extra, same as the live workbook's own blind spot

const grid = [header, label, dataRow];

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      _comment: [
        "Entity 062 — a SYNTHETIC single 2022 band reproducing the three live",
        "source-shape defects found at spec (AC-11: invented numbers only).",
        "Row 1 is the date-header row, row 2 the label row, row 3 the one data row.",
        "",
        "column K (index 10)  the NO shape: a second 金額 column for day 01-02, no",
        "                     header date of its own — a second same-day amount.",
        "column N (index 13)  the ZI/ZJ shape: item-name column headered 2022-01-02,",
        "                     positioned immediately after 01-03's column — a",
        "                     well-formed date, out of the band's chronological order.",
        "column P (index 15)  the August shape: item-name header BLANK; its amount",
        "                     column (Q) carries the date (2022-01-05) instead.",
      ].join("\n"),
      rows: grid,
    },
    null,
    2
  ) + "\n",
  "utf8"
);
console.log(`wrote ${OUT}: ${grid.length} rows x ${WIDTH} cols`);
