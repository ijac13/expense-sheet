// Generates functions/test/fixtures/house-mortgage.json.
//
// Entity 062 — a SYNTHETIC House-tab `D5:J255` read, reproducing the live
// schedule's structure (one row per month, column D the date, column J the
// payment) with INVENTED numbers (AC-11: nothing from the captain's mortgage
// schedule is committed to this repository).
//
// Regenerate with: node functions/test/fixtures/generate-house-mortgage-fixture.js
const fs = require("fs");
const path = require("path");

const serial = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
};

const OUT = path.join(__dirname, "house-mortgage.json");

// Row shape: [D (date serial), E, F, G, H, I, J (amount)]. E-I are invented
// filler, structurally present the way the live schedule's rate/principal
// columns are, but never read by extractMortgageRows.
const monthlyRow = (iso, amount) => [serial(iso), 0.01, 0.005, 0.015, 100, 900000, amount];

const rows = [];

// Two schedule-padding rows ahead of 2022 (both D and J blank) — reproduces the
// live D1:D4 shape where the range holds header/prelude rows before row 5.
rows.push(["", "", "", "", "", "", ""]);
rows.push(["", "", "", "", "", "", ""]);

// 2022's twelve regular monthly payments — invented amounts, none on a
// schedule prepayment date (the live schedule genuinely has none in 2022 either).
const MONTHS_2022 = [
  ["2022-01-15", 31000], ["2022-02-15", 31000], ["2022-03-15", 31200],
  ["2022-04-15", 31200], ["2022-05-15", 31400], ["2022-06-15", 31600],
  ["2022-07-15", 31600], ["2022-08-15", 31800], ["2022-09-15", 32000],
  ["2022-10-15", 32000], ["2022-11-15", 32200], ["2022-12-15", 32400],
];
for (const [iso, amount] of MONTHS_2022) rows.push(monthlyRow(iso, amount));

// Trailing schedule padding, same shape as the two leading rows.
rows.push(["", "", "", "", "", "", ""]);
rows.push(["", "", "", "", "", "", ""]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      _comment: [
        "Entity 062 — a SYNTHETIC House tab D5:J255 read (AC-11: invented numbers only).",
        "rows[0] is sheet row 5. Two leading and two trailing rows are schedule padding",
        "(both D and J blank), reproducing the live tab's D1:D4 prelude / trailing rows.",
        "The twelve populated rows are 2022's regular monthly payments — column D the",
        "payment date, column J the payment amount — with none on a schedule prepayment",
        "date, matching the live schedule (which has none in 2022 either).",
      ].join("\n"),
      rows,
    },
    null,
    2
  ) + "\n",
  "utf8"
);
console.log(`wrote ${OUT}: ${rows.length} rows`);
