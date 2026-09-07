// Generates functions/test/fixtures/house-mortgage.json.
//
// Entity 062 — a SYNTHETIC House-tab `D5:J255` read, reproducing the live
// schedule's structure (one row per month, column D the date, column J the
// payment) with INVENTED numbers (AC-11: nothing from the captain's mortgage
// schedule is committed to this repository).
//
// Entity 064 widened this to `D5:K255` and appended 2023/2024 sections AFTER the
// original 2022 section, so every 2022-scoped row index and assertion is
// untouched: 2023 adds column K (`先還本金`) populated on its 03-15 row, the
// live schedule's one prepayment in this window; 2024 adds a row-125-shape
// duplicate-date row (D populated, J and K both blank) immediately ahead of its
// 11-15 row.
//
// Regenerate with: node functions/test/fixtures/generate-house-mortgage-fixture.js
const fs = require("fs");
const path = require("path");

const serial = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
};

const OUT = path.join(__dirname, "house-mortgage.json");

// Row shape: [D (date serial), E, F, G, H, I, J (amount), K (prepayment, usually
// blank)]. E-I are invented filler, structurally present the way the live
// schedule's rate/principal columns are, but never read by extractMortgageRows.
const monthlyRow = (iso, amount, prepay = "") => [serial(iso), 0.01, 0.005, 0.015, 100, 900000, amount, prepay];

const rows = [];

// Two schedule-padding rows ahead of 2022 (D, J and K all blank) — reproduces the
// live D1:D4 shape where the range holds header/prelude rows before row 5.
rows.push(["", "", "", "", "", "", "", ""]);
rows.push(["", "", "", "", "", "", "", ""]);

// 2022's twelve regular monthly payments — invented amounts, none on a
// schedule prepayment date (the live schedule genuinely has none in 2022 either).
const MONTHS_2022 = [
  ["2022-01-15", 31000], ["2022-02-15", 31000], ["2022-03-15", 31200],
  ["2022-04-15", 31200], ["2022-05-15", 31400], ["2022-06-15", 31600],
  ["2022-07-15", 31600], ["2022-08-15", 31800], ["2022-09-15", 32000],
  ["2022-10-15", 32000], ["2022-11-15", 32200], ["2022-12-15", 32400],
];
for (const [iso, amount] of MONTHS_2022) rows.push(monthlyRow(iso, amount));

// 2023's twelve regular monthly payments. The 03-15 row also carries a
// column-K prepayment — the live schedule's one populated K cell across the
// entire 2023-2024 window (AC-3), sized here to be unmistakably larger than a
// single month's regular payment, same shape the ideation described.
const MONTHS_2023 = [
  ["2023-01-15", 33000], ["2023-02-15", 33000], ["2023-03-15", 33200, 240000],
  ["2023-04-15", 33200], ["2023-05-15", 33400], ["2023-06-15", 33600],
  ["2023-07-15", 33600], ["2023-08-15", 33800], ["2023-09-15", 34000],
  ["2023-10-15", 34000], ["2023-11-15", 34200], ["2023-12-15", 34400],
];
for (const [iso, amount, prepay] of MONTHS_2023) rows.push(monthlyRow(iso, amount, prepay ?? ""));

// 2024's twelve regular monthly payments. Ahead of 11-15, a row-125-shape
// duplicate: a populated date with BOTH J and K blank — the live schedule's own
// duplicate-date artifact (AC-7) — contributes zero rows and must not abort.
const MONTHS_2024_BEFORE_GAP = [
  ["2024-01-15", 34600], ["2024-02-15", 34600], ["2024-03-15", 34800],
  ["2024-04-15", 34800], ["2024-05-15", 35000], ["2024-06-15", 35200],
  ["2024-07-15", 35200], ["2024-08-15", 35400], ["2024-09-15", 35600],
  ["2024-10-15", 35600],
];
for (const [iso, amount] of MONTHS_2024_BEFORE_GAP) rows.push(monthlyRow(iso, amount));
rows.push([serial("2024-11-15"), "", "", "", "", "", "", ""]); // row-125 shape: date only
rows.push(monthlyRow("2024-11-15", 35800));
rows.push(monthlyRow("2024-12-15", 36000));

// Trailing schedule padding, same shape as the two leading rows.
rows.push(["", "", "", "", "", "", "", ""]);
rows.push(["", "", "", "", "", "", "", ""]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      _comment: [
        "Entities 062/064 — a SYNTHETIC House tab D5:K255 read (AC-11: invented",
        "numbers only). rows[0] is sheet row 5. Two leading and two trailing rows",
        "are schedule padding (D, J and K all blank), reproducing the live tab's",
        "D1:D4 prelude / trailing rows.",
        "2022: twelve regular monthly payments, column D the date, column J the",
        "amount, none on a prepayment date (matching the live schedule).",
        "2023: twelve regular monthly payments; 03-15 ALSO carries a column-K",
        "prepayment — the live schedule's one populated K cell in this window.",
        "2024: twelve regular monthly payments, plus a row-125-shape duplicate",
        "immediately ahead of 11-15 (D populated, J and K both blank) — schedule",
        "padding wearing a real date, contributing zero rows.",
      ].join("\n"),
      rows,
    },
    null,
    2
  ) + "\n",
  "utf8"
);
console.log(`wrote ${OUT}: ${rows.length} rows`);
