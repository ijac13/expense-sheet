// Run with: npm run build && node --test test/
// Drives the REAL exported `api` handler against an in-memory Categories tab, so
// the assertions land on the bytes written to the sheet and the JSON returned —
// not on the source. See test/sheetsStub.js for what the stub emulates.
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSheets, loadApi, call } = require("./sheetsStub");

const HEADER_WITH_NOTE = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note"];
// A header row that stops at G, exactly like a production sheet that predates
// entity 043. Since 047, an unnamed column is an UNKNOWN column: never read,
// never written, always preserved.
const HEADER_NO_NOTE = HEADER_WITH_NOTE.slice(0, 7);

const ROWS = [
  // note set
  ["cat_001", "Eating Out", "外食", "🍕", "1", "true", "restaurants_accommodation", "phone bills"],
  // H cell blank
  ["cat_002", "Digital", "數位", "💻", "2", "true", "transport_communication", ""],
  // H cell absent entirely — the row is only 7 wide
  ["cat_003", "Groceries", "食材", "🥕", "3", "true", "food_beverage_tobacco"],
];

const categoriesSheet = (header, rows = ROWS) => makeSheets({ Categories: { header, rows } });

// ---------------------------------------------------------------------------
// Entity 043's note column, on a sheet whose `note` header IS named.
// These are the regression guard for 043 and must keep passing unchanged.
// ---------------------------------------------------------------------------

test("043 AC-2: GET returns a note string for every category, never null/undefined", async () => {
  const { sheets } = categoriesSheet(HEADER_WITH_NOTE);
  const api = loadApi(sheets);

  const { status, body } = await call(api, "GET", "/api/categories");
  assert.equal(status, 200);
  assert.equal(body.length, 3);
  assert.equal(body[0].note, "phone bills");
  // Blank cell and absent cell both land on "", not null and not undefined.
  for (const cat of body) {
    assert.equal(typeof cat.note, "string", `${cat.id} note is a string`);
    assert.notEqual(cat.note, null);
  }
  assert.equal(body[1].note, "");
  assert.equal(body[2].note, "");
});

test("043 AC-3: PATCH note writes the note column and leaves A-G byte-identical", async () => {
  const { grids, sheets } = categoriesSheet(HEADER_WITH_NOTE);
  const api = loadApi(sheets);
  const before = grids.Categories[3].slice(0, 7);

  const { status, body } = await call(api, "PATCH", "/api/categories/cat_003", { note: "生鮮食材，不含外食" });
  assert.equal(status, 200);
  assert.equal(body.note, "生鮮食材，不含外食");
  assert.equal(grids.Categories[3][7], "生鮮食材，不含外食", "the note column holds the new note");
  assert.deepEqual(grids.Categories[3].slice(0, 7), before, "columns A-G untouched");
});

test("043 AC-4: a rename leaves an existing note intact", async () => {
  const { grids, sheets } = categoriesSheet(HEADER_WITH_NOTE);
  const api = loadApi(sheets);

  // A body with no `note` key at all — the shape every rename/reorder/archive sends.
  const { status, body } = await call(api, "PATCH", "/api/categories/cat_001", { name_en: "Dining Out" });
  assert.equal(status, 200);
  assert.equal(grids.Categories[1][1], "Dining Out", "the rename landed");
  assert.equal(grids.Categories[1][7], "phone bills", "the pre-existing note survived");
  assert.equal(body.note, "phone bills");

  // The same must hold for the other whole-row rewrite paths.
  await call(api, "PATCH", "/api/categories/cat_001", { is_active: "false" });
  assert.equal(grids.Categories[1][7], "phone bills", "archive kept the note");
  await call(api, "PATCH", "/api/categories/cat_001", { sort_order: 9 });
  assert.equal(grids.Categories[1][7], "phone bills", "reorder kept the note");
});

test("043 AC-5: POST writes the submitted note, or \"\" when none is submitted", async () => {
  const { grids, sheets } = categoriesSheet(HEADER_WITH_NOTE);
  const api = loadApi(sheets);

  const withNote = await call(api, "POST", "/api/categories", {
    name_en: "Insurance", name_zh: "保險", icon: "🛡️", gov_category: "insurance_financial", note: "壽險與車險",
  });
  assert.equal(withNote.status, 201);
  assert.equal(withNote.body.note, "壽險與車險");
  assert.equal(grids.Categories[grids.Categories.length - 1][7], "壽險與車險");

  const withoutNote = await call(api, "POST", "/api/categories", {
    name_en: "Tax", name_zh: "稅金", icon: "🧾", gov_category: "miscellaneous",
  });
  assert.equal(withoutNote.status, 201);
  assert.equal(withoutNote.body.note, "", "an unsubmitted note is \"\", not undefined");
  assert.equal(grids.Categories[grids.Categories.length - 1][7], "");

  assert.equal(withNote.body.id, "cat_004");
  assert.equal(withoutNote.body.id, "cat_005");
  assert.equal(withNote.body.sort_order, 4);
  assert.equal(withoutNote.body.sort_order, 5);
});

// ---------------------------------------------------------------------------
// 047 AC-5 / AC-6 — an optional column the header does not name.
// This SUPERSEDES 043's positional behaviour: 043 wrote to column H whether or
// not H1 said `note`. Since reads and writes now resolve by header name, an
// unnamed column cannot be addressed, so reads fall back to the empty default
// and writes fail loudly instead of landing in a column by luck.
// ---------------------------------------------------------------------------

test("AC-5: a Categories tab with no note/gov_category header still returns 200 with empty defaults", async () => {
  const { sheets } = categoriesSheet(HEADER_NO_NOTE);
  const api = loadApi(sheets);

  const { status, body } = await call(api, "GET", "/api/categories");
  assert.equal(status, 200, "an absent OPTIONAL header is not an error");
  assert.equal(body.length, 3);
  // cat_001 has "phone bills" sitting in column H, but H1 names nothing, so the
  // column is unknown — reading it would be guessing at position again.
  assert.equal(body[0].note, "", "unnamed column reads as the empty default, not by position");
  assert.equal(body[0].gov_category, "restaurants_accommodation", "named optional columns still read");
});

test("AC-5: a 6-column Categories tab (today's staging) returns 200 with null gov_category", async () => {
  const { sheets } = makeSheets({
    Categories: {
      header: HEADER_WITH_NOTE.slice(0, 6),
      rows: [["cat_001", "Eating Out", "外食", "🍕", "1", "true"]],
    },
  });
  const api = loadApi(sheets);

  const { status, body } = await call(api, "GET", "/api/categories");
  assert.equal(status, 200);
  assert.equal(body[0].gov_category, null, "absent gov_category is null, the pre-existing default");
  assert.equal(body[0].note, "");
  assert.equal(body[0].name_en, "Eating Out");
});

test("AC-6: PATCHing an optional field whose column is absent returns 400 naming the field", async () => {
  const { grids, sheets } = categoriesSheet(HEADER_NO_NOTE);
  const api = loadApi(sheets);
  const before = grids.Categories[3].slice();

  const { status, body } = await call(api, "PATCH", "/api/categories/cat_003", { note: "生鮮食材" });
  assert.equal(status, 400, "the value is refused, not silently discarded");
  assert.match(body.error, /note/, "the error names the field");
  assert.match(body.error, /Categories/, "the error names the tab");
  assert.deepEqual(grids.Categories[3], before, "nothing was written");
});

test("AC-6: POSTing an optional field whose column is absent returns 400, and the row is not appended", async () => {
  const { grids, sheets } = categoriesSheet(HEADER_NO_NOTE);
  const api = loadApi(sheets);
  const rowCount = grids.Categories.length;

  const { status, body } = await call(api, "POST", "/api/categories", { name_en: "Rent", note: "含管理費" });
  assert.equal(status, 400);
  assert.match(body.error, /note/);
  assert.equal(grids.Categories.length, rowCount, "no partial row was appended");

  // Without the unsupported field, the same POST succeeds.
  const ok = await call(api, "POST", "/api/categories", { name_en: "Rent", name_zh: "房租" });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.note, "");
  assert.equal(grids.Categories.length, rowCount + 1);
});

test("AC-11: a PATCH preserves data sitting under an unnamed header", async () => {
  const { grids, sheets } = categoriesSheet(HEADER_NO_NOTE);
  const api = loadApi(sheets);

  const { status } = await call(api, "PATCH", "/api/categories/cat_001", { name_en: "Dining Out" });
  assert.equal(status, 200);
  assert.equal(grids.Categories[1][1], "Dining Out", "the rename landed");
  assert.equal(grids.Categories[1][7], "phone bills", "the unnamed column's data was carried forward untouched");
  assert.equal(grids.Categories[0].length, 7, "the header row was never widened or relabelled");
});

// ---------------------------------------------------------------------------
// 047 — production-shaped Categories: blank H1, `udpate` (a typo) at I.
// ---------------------------------------------------------------------------

const PROD_HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "", "udpate"];
const PROD_ROWS = [
  ["cat_001", "Eating Out", "外食", "🍕", "1", "true", "restaurants_accommodation", "phone bills", "2026-01-04"],
  ["cat_002", "Digital", "數位", "💻", "2", "true", "transport_communication", "", "2026-02-11"],
];

test("AC-11: a PATCH on a production-shaped row leaves the `udpate` column untouched", async () => {
  const { grids, sheets } = makeSheets({ Categories: { header: PROD_HEADER, rows: PROD_ROWS } });
  const api = loadApi(sheets);

  const { status, body } = await call(api, "PATCH", "/api/categories/cat_001", { sort_order: 5 });
  assert.equal(status, 200);
  assert.equal(body.sort_order, 5);
  assert.equal(grids.Categories[1][4], "5", "sort_order landed in its own column");
  assert.equal(grids.Categories[1][8], "2026-01-04", "the `udpate` column the backend knows nothing about survived");
  assert.equal(grids.Categories[1][7], "phone bills", "the blank-header column survived too");
  assert.equal(grids.Categories[0][8], "udpate", "a near-miss header was never fuzzy-matched onto a real field");
});

test("AC-12: an appended row leaves unknown columns blank rather than shifting values into them", async () => {
  const { grids, sheets } = makeSheets({ Categories: { header: PROD_HEADER, rows: PROD_ROWS } });
  const api = loadApi(sheets);

  const { status } = await call(api, "POST", "/api/categories", {
    name_en: "Insurance", name_zh: "保險", icon: "🛡️", gov_category: "insurance_financial",
  });
  assert.equal(status, 201);

  const appended = grids.Categories[grids.Categories.length - 1];
  assert.equal(appended[1], "Insurance");
  assert.equal(appended[6], "insurance_financial", "gov_category went to its own column, not the next free slot");
  assert.equal(appended[7], "", "the blank-header column is blank, not carrying name/icon spillover");
  assert.equal(appended[8], "", "the `udpate` column is blank");
});

// ---------------------------------------------------------------------------
// 047 AC-8 — reordered columns.
// ---------------------------------------------------------------------------

test("AC-8: swapping two columns changes nothing about the values each field returns", async () => {
  const before = await (async () => {
    const { sheets } = categoriesSheet(HEADER_WITH_NOTE);
    return (await call(loadApi(sheets), "GET", "/api/categories")).body;
  })();

  // Swap icon (D) and sort_order (E) in both the header and every data row.
  const swap = (r) => {
    const c = r.slice();
    [c[3], c[4]] = [c[4], c[3]];
    return c;
  };
  const { sheets } = categoriesSheet(swap(HEADER_WITH_NOTE), ROWS.map(swap));
  const after = (await call(loadApi(sheets), "GET", "/api/categories")).body;

  assert.deepEqual(after, before, "the swap is invisible in the API response");
  assert.equal(after[0].icon, "🍕");
  assert.equal(after[0].sort_order, 1);
});

test("AC-10: a PATCH on a swapped sheet writes to the column its header names", async () => {
  const swap = (r) => {
    const c = r.slice();
    [c[3], c[4]] = [c[4], c[3]];
    return c;
  };
  const { grids, sheets } = categoriesSheet(swap(HEADER_WITH_NOTE), ROWS.map(swap));
  const api = loadApi(sheets);

  const { status } = await call(api, "PATCH", "/api/categories/cat_001", { icon: "🍔" });
  assert.equal(status, 200);
  // icon now lives in column E (index 4), sort_order in D (index 3).
  assert.equal(grids.Categories[1][4], "🍔", "icon landed under the icon header, not column D");
  assert.equal(grids.Categories[1][3], "1", "sort_order's cell was not overwritten");
});

// ---------------------------------------------------------------------------
// 047 AC-3 / AC-4 and the empty-tab edge case — header rows the code refuses.
// ---------------------------------------------------------------------------

test("AC-4: a missing REQUIRED header is a 500 naming the tab and the field", async () => {
  const { sheets } = makeSheets({
    Categories: {
      header: ["id", "name_en", "name_zh", "icon", "sort_order"], // is_active removed
      rows: [["cat_001", "Eating Out", "外食", "🍕", "1"]],
    },
  });

  const { status, body } = await call(loadApi(sheets), "GET", "/api/categories");
  assert.equal(status, 500, "a missing required header is an error, not blank data");
  assert.match(body.error, /Categories/);
  assert.match(body.error, /is_active/);
});

test("AC-4: a RENAMED required header reads as missing rather than silently blanking", async () => {
  const { sheets } = makeSheets({
    Categories: {
      header: ["id", "label_en", "name_zh", "icon", "sort_order", "is_active"], // name_en renamed
      rows: [["cat_001", "Eating Out", "外食", "🍕", "1", "true"]],
    },
  });

  const { status, body } = await call(loadApi(sheets), "GET", "/api/categories");
  assert.equal(status, 500);
  assert.match(body.error, /name_en/);
});

test("AC-3: a duplicated header is a 500 naming the tab and the duplicate — it does not pick one", async () => {
  const { sheets } = makeSheets({
    Categories: {
      header: ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "name_en"],
      rows: [["cat_001", "Eating Out", "外食", "🍕", "1", "true", "Dining"]],
    },
  });

  const { status, body } = await call(loadApi(sheets), "GET", "/api/categories");
  assert.equal(status, 500);
  assert.match(body.error, /Categories/);
  assert.match(body.error, /duplicate/i);
  assert.match(body.error, /name_en/);
});

test("AC-2: header matching ignores case and surrounding whitespace", async () => {
  const { grids, sheets } = makeSheets({
    Categories: {
      header: ["ID", " Name_EN", "name_zh ", "icon", "sort_order", "is_active", "gov_category", " NOTE "],
      rows: [["cat_001", "Eating Out", "外食", "🍕", "1", "true", "restaurants_accommodation", "phone bills"]],
    },
  });
  const api = loadApi(sheets);

  const { status, body } = await call(api, "GET", "/api/categories");
  assert.equal(status, 200);
  assert.equal(body[0].name_en, "Eating Out");
  assert.equal(body[0].note, "phone bills");

  await call(api, "PATCH", "/api/categories/cat_001", { note: "updated" });
  assert.equal(grids.Categories[1][7], "updated", "the loosely-spelled header still resolves for writes");
});

test("edge case: an empty tab is a 500 naming the tab, not row 1 treated as data", async () => {
  const { sheets } = makeSheets({ Categories: { header: [], rows: [] } });

  const { status, body } = await call(loadApi(sheets), "GET", "/api/categories");
  assert.equal(status, 500);
  assert.match(body.error, /Categories/);
  assert.match(body.error, /header row/i);
});

test("AC-9: a row shorter than the header reads as empty defaults, not shifted values", async () => {
  const { sheets } = makeSheets({
    Categories: {
      header: HEADER_WITH_NOTE,
      rows: [["cat_007", "Sparse"]], // 2 cells against an 8-cell header
    },
  });

  const { status, body } = await call(loadApi(sheets), "GET", "/api/categories");
  assert.equal(status, 200);
  assert.deepEqual(body[0], {
    id: "cat_007",
    name_en: "Sparse",
    name_zh: "",
    icon: "",
    sort_order: 0,
    is_active: true,
    gov_category: null,
    note: "",
  });
});
