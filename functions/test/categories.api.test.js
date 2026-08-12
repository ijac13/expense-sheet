// Run with: npm run build && node --test test/
// Drives the REAL exported `api` handler against an in-memory Categories tab, so
// the assertions land on the bytes written to the sheet and the JSON returned —
// not on the source. The stub emulates the two Sheets behaviours the note column
// depends on: A1 range addressing, and trailing-blank trimming (a row whose H
// cell is empty comes back SHORT, which is why the code cannot index blindly).
const test = require("node:test");
const assert = require("node:assert/strict");

const COL = (letter) => letter.charCodeAt(0) - 65;

function parseRange(range) {
  const [, a1] = range.split("!");
  const [from, to] = a1.split(":");
  const m = (s) => {
    const g = /^([A-Z]+)(\d+)?$/.exec(s);
    return { col: COL(g[1]), row: g[2] ? Number(g[2]) : null };
  };
  return { from: m(from), to: m(to) };
}

/** A Categories tab. `header` is written as-is, so a 7-cell header leaves H1 blank. */
function makeSheet(header, rows) {
  const grid = [header.slice(), ...rows.map((r) => r.slice())];
  const requests = [];

  const sheets = {
    spreadsheets: {
      values: {
        get: async ({ range }) => {
          requests.push(`GET ${range}`);
          const { from, to } = parseRange(range);
          const first = (from.row ?? 1) - 1;
          const last = to.row ? to.row - 1 : grid.length - 1;
          const values = grid.slice(first, last + 1).map((row) => {
            const cells = [];
            for (let c = from.col; c <= to.col; c++) cells.push(row[c] ?? "");
            // Sheets omits trailing empty cells rather than padding them.
            while (cells.length && cells[cells.length - 1] === "") cells.pop();
            return cells;
          });
          return { data: { values } };
        },
        update: async ({ range, requestBody }) => {
          requests.push(`UPDATE ${range}`);
          const { from, to } = parseRange(range);
          // Sheets 400s on "tried writing to column X" rather than silently
          // widening the range. Without this, a write range one column short of
          // the payload would look like it worked.
          const width = to.col - from.col + 1;
          if (requestBody.values[0].length > width) {
            throw new Error(`Requested writing within range ${range}, but tried writing ${requestBody.values[0].length} columns`);
          }
          const rowIdx = (from.row ?? 1) - 1;
          while (grid.length <= rowIdx) grid.push([]);
          requestBody.values[0].forEach((v, i) => {
            grid[rowIdx][from.col + i] = v;
          });
          return {};
        },
        append: async ({ range, requestBody }) => {
          requests.push(`APPEND ${range}`);
          grid.push(requestBody.values[0].slice());
          return {};
        },
      },
    },
  };

  return { grid, requests, sheets };
}

/** Install the stub, then load the compiled handler on top of it. */
function loadApi(sheets) {
  const id = require.resolve("googleapis");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: { google: { auth: { getClient: async () => ({}) }, sheets: () => sheets } },
  };
  process.env.SPREADSHEET_ID = "sheet-under-test";
  delete require.cache[require.resolve("../lib/index.js")];
  return require("../lib/index.js").api;
}

function call(api, method, path, body) {
  return new Promise((resolve) => {
    const res = {
      set() {},
      status(code) {
        this.code = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.code, body: payload });
        return this;
      },
      send(payload) {
        resolve({ status: this.code, body: payload });
        return this;
      },
    };
    api({ method, path, body }, res);
  });
}

const HEADER_WITH_NOTE = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note"];
// AC-6's sheet: the header row stops at G, exactly like a production sheet that
// predates this feature. The header-write guard only fires when A1 !== "id", so
// H1 can never self-populate — the feature has to work without it.
const HEADER_NO_NOTE = HEADER_WITH_NOTE.slice(0, 7);

const ROWS = [
  // note set
  ["cat_001", "Eating Out", "外食", "🍕", "1", "true", "restaurants_accommodation", "phone bills"],
  // H cell blank
  ["cat_002", "Digital", "數位", "💻", "2", "true", "transport_communication", ""],
  // H cell absent entirely — the row is only 7 wide
  ["cat_003", "Groceries", "食材", "🥕", "3", "true", "food_beverage_tobacco"],
];

for (const [label, header] of [["H1 labelled", HEADER_WITH_NOTE], ["H1 unlabelled (AC-6)", HEADER_NO_NOTE]]) {
  test(`AC-2 (${label}): GET returns a note string for every category, never null/undefined`, async () => {
    const { sheets } = makeSheet(header, ROWS);
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

  test(`AC-3 (${label}): PATCH note writes column H and leaves A-G byte-identical`, async () => {
    const { grid, sheets } = makeSheet(header, ROWS);
    const api = loadApi(sheets);
    const before = grid[3].slice(0, 7);

    const { status, body } = await call(api, "PATCH", "/api/categories/cat_003", { note: "生鮮食材，不含外食" });
    assert.equal(status, 200);
    assert.equal(body.note, "生鮮食材，不含外食");
    assert.equal(grid[3][7], "生鮮食材，不含外食", "column H holds the new note");
    assert.deepEqual(grid[3].slice(0, 7), before, "columns A-G untouched");
  });

  test(`AC-4 (${label}): a rename leaves an existing note intact`, async () => {
    const { grid, sheets } = makeSheet(header, ROWS);
    const api = loadApi(sheets);

    // A body with no `note` key at all — the shape every rename/reorder/archive sends.
    const { status, body } = await call(api, "PATCH", "/api/categories/cat_001", { name_en: "Dining Out" });
    assert.equal(status, 200);
    assert.equal(grid[1][1], "Dining Out", "the rename landed");
    assert.equal(grid[1][7], "phone bills", "the pre-existing note survived");
    assert.equal(body.note, "phone bills");

    // The same must hold for the other whole-row rewrite paths.
    await call(api, "PATCH", "/api/categories/cat_001", { is_active: "false" });
    assert.equal(grid[1][7], "phone bills", "archive kept the note");
    await call(api, "PATCH", "/api/categories/cat_001", { sort_order: 9 });
    assert.equal(grid[1][7], "phone bills", "reorder kept the note");
  });

  test(`AC-5 (${label}): POST writes the submitted note, or "" when none is submitted`, async () => {
    const { grid, sheets } = makeSheet(header, ROWS);
    const api = loadApi(sheets);

    const withNote = await call(api, "POST", "/api/categories", {
      name_en: "Insurance", name_zh: "保險", icon: "🛡️", gov_category: "insurance_financial", note: "壽險與車險",
    });
    assert.equal(withNote.status, 201);
    assert.equal(withNote.body.note, "壽險與車險");
    assert.equal(grid[grid.length - 1][7], "壽險與車險");

    const withoutNote = await call(api, "POST", "/api/categories", {
      name_en: "Tax", name_zh: "稅金", icon: "🧾", gov_category: "miscellaneous",
    });
    assert.equal(withoutNote.status, 201);
    assert.equal(withoutNote.body.note, "", "an unsubmitted note is \"\", not undefined");
    assert.equal(grid[grid.length - 1][7], "");

    // The new ids must still be computed correctly now that the POST pre-read
    // widened from A:F to A:H.
    assert.equal(withNote.body.id, "cat_004");
    assert.equal(withoutNote.body.id, "cat_005");
    assert.equal(withNote.body.sort_order, 4);
    assert.equal(withoutNote.body.sort_order, 5);
  });
}

test("AC-6: the whole round-trip works on a sheet whose H1 is blank, and never labels it", async () => {
  const { grid, sheets } = makeSheet(HEADER_NO_NOTE, ROWS);
  const api = loadApi(sheets);

  await call(api, "PATCH", "/api/categories/cat_002", { note: "手機、網路、訂閱" });
  await call(api, "POST", "/api/categories", { name_en: "Rent", name_zh: "房租", note: "含管理費" });
  const { body } = await call(api, "GET", "/api/categories");

  assert.equal(body.find((c) => c.id === "cat_002").note, "手機、網路、訂閱");
  assert.equal(body.find((c) => c.name_en === "Rent").note, "含管理費");
  // The point of the AC: H1 is STILL blank. Reads and writes are positional, so
  // labelling the header is cosmetic and was never a precondition.
  assert.equal(grid[0][7] ?? "", "", "H1 was never written");
  assert.equal(grid[0].length, 7);
});
