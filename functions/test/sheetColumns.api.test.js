// Run with: npm run build && node --test test/
// Header-name column resolution across Expenses and Subscriptions: reads, writes,
// row insertion, DELETE and migrate-users. Categories is covered in
// categories.api.test.js. Assertions land on the bytes written to the in-memory
// sheet and the JSON returned, never on the source.
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSheets, loadApi, call } = require("./sheetsStub");

// Production-shaped: Expenses carries captain-authored `month` / `amount value`
// columns at I and J that the backend knows nothing about and must never touch.
const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at", "month", "amount value"];
const EXPENSES_ROWS = [
  ["exp-1", "2026-08-01", "250", "cat_001", "ijac", "ijac", "lunch", "2026-08-01T02:00:00.000Z", "2026-08", "250"],
  ["exp-2", "2026-07-30", "1200", "cat_002", "wei", "ijac", "", "2026-07-30T09:00:00.000Z", "2026-07", "1200"],
  ["exp-3", "2026-07-29", "80", "cat_003", "wei", "wei"],
];

const SUBS_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];
const SUBS_ROWS = [
  ["sub-1", "Netflix", "390", "cat_002", "monthly", "15", "", "ijac", "true"],
  ["sub-2", "Insurance", "12000", "cat_005", "annual", "3", "6", "wei", "true"],
  ["sub-3", "Old", "100", "cat_002", "monthly", "1"],
];

const CATEGORIES_HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note"];
const CATEGORIES_ROWS = [
  ["cat_001", "Eating Out", "外食", "🍕", "1", "true", "restaurants_accommodation", "phone bills"],
  ["cat_002", "Digital", "數位", "💻", "2", "true", "transport_communication", ""],
  ["cat_003", "Groceries", "食材", "🥕", "3", "true", "food_beverage_tobacco"],
  ["cat_004", "Archived", "封存", "📦", "4", "false"],
];

// The Users tab is deliberately NOT header-resolved (its live header row is
// `email | Users`, which names none of the fields). It is here only so the
// user-name resolution the write paths call does not blow up.
const USERS = { header: ["email", "Users"], rows: [["ijac@example.com", "ijac"]] };

const fixture = (over = {}) => makeSheets({
  Expenses: { header: EXPENSES_HEADER, rows: EXPENSES_ROWS },
  Subscriptions: { header: SUBS_HEADER, rows: SUBS_ROWS },
  Categories: { header: CATEGORIES_HEADER, rows: CATEGORIES_ROWS },
  Users: USERS,
  ...over,
});

// ---------------------------------------------------------------------------
// AC-7 — the same fixture must produce the same JSON it produced before the
// change. These literals are the VERBATIM output of the pre-change positional
// handler (built from git and diffed byte-for-byte against this build). Any
// drift in a field name, order, type or default breaks the string compare.
// ---------------------------------------------------------------------------

const BEFORE = {
  "/api/categories": '[{"id":"cat_001","name_en":"Eating Out","name_zh":"外食","icon":"🍕","sort_order":1,"is_active":true,"gov_category":"restaurants_accommodation","note":"phone bills"},{"id":"cat_002","name_en":"Digital","name_zh":"數位","icon":"💻","sort_order":2,"is_active":true,"gov_category":"transport_communication","note":""},{"id":"cat_003","name_en":"Groceries","name_zh":"食材","icon":"🥕","sort_order":3,"is_active":true,"gov_category":"food_beverage_tobacco","note":""},{"id":"cat_004","name_en":"Archived","name_zh":"封存","icon":"📦","sort_order":4,"is_active":false,"gov_category":null,"note":""}]',
  "/api": '[{"id":"exp-1","date":"2026-08-01","amount":250,"category_id":"cat_001","paid_by":"ijac","created_by":"ijac","notes":"lunch","created_at":"2026-08-01T02:00:00.000Z"},{"id":"exp-2","date":"2026-07-30","amount":1200,"category_id":"cat_002","paid_by":"wei","created_by":"ijac","notes":"","created_at":"2026-07-30T09:00:00.000Z"},{"id":"exp-3","date":"2026-07-29","amount":80,"category_id":"cat_003","paid_by":"wei","created_by":"wei","notes":"","created_at":""}]',
  // Entity 053 added start_date / end_date to every subscription; entity 059
  // added notes. SUBS_HEADER still carries only the nine legacy columns, so the
  // `""` on all three rows is the deliberate AC-3 shape: a tab carrying none of
  // those three headers reads 200, not 500.
  "/api/subscriptions": '[{"id":"sub-1","name":"Netflix","amount":390,"category_id":"cat_002","frequency":"monthly","due_day":15,"paid_by":"ijac","is_active":true,"start_date":"","end_date":"","notes":""},{"id":"sub-2","name":"Insurance","amount":12000,"category_id":"cat_005","frequency":"annual","due_day":3,"due_month":6,"paid_by":"wei","is_active":true,"start_date":"","end_date":"","notes":""},{"id":"sub-3","name":"Old","amount":100,"category_id":"cat_002","frequency":"monthly","due_day":1,"paid_by":"","is_active":true,"start_date":"","end_date":"","notes":""}]',
};

for (const [path, expected] of Object.entries(BEFORE)) {
  test(`AC-7: GET ${path} returns byte-identical JSON to the pre-change handler`, async () => {
    const { sheets } = fixture();
    const { status, body } = await call(loadApi(sheets), "GET", path);
    assert.equal(status, 200);
    assert.equal(JSON.stringify(body), expected);
  });
}

// ---------------------------------------------------------------------------
// AC-8 / AC-9 — reordered columns and short rows.
// ---------------------------------------------------------------------------

const swapCols = (a, b) => (r) => {
  const c = r.slice();
  const width = Math.max(a, b) + 1;
  while (c.length < width) c.push("");
  [c[a], c[b]] = [c[b], c[a]];
  return c;
};

test("AC-8: swapping frequency and due_day leaves every subscription field reading the same", async () => {
  const swap = swapCols(4, 5); // frequency <-> due_day, the AC-15 staging swap
  const { sheets } = fixture({
    Subscriptions: { header: swap(SUBS_HEADER), rows: SUBS_ROWS.map(swap) },
  });

  const { status, body } = await call(loadApi(sheets), "GET", "/api/subscriptions");
  assert.equal(status, 200);
  assert.equal(JSON.stringify(body), BEFORE["/api/subscriptions"], "the swap is invisible in the response");
  assert.equal(body[0].frequency, "monthly", "frequency is still the word");
  assert.equal(body[0].due_day, 15, "due_day is still the number");
});

test("AC-8: swapping paid_by and created_by leaves every expense field reading the same", async () => {
  const swap = swapCols(4, 5);
  const { sheets } = fixture({
    Expenses: { header: swap(EXPENSES_HEADER), rows: EXPENSES_ROWS.map(swap) },
  });

  const { body } = await call(loadApi(sheets), "GET", "/api");
  assert.equal(JSON.stringify(body), BEFORE["/api"]);
});

test("AC-9: an expense row shorter than the header reads as empty defaults", async () => {
  const { sheets } = fixture();
  const { body } = await call(loadApi(sheets), "GET", "/api");
  // exp-3 is 6 cells wide against a 10-cell header.
  assert.equal(body[2].id, "exp-3");
  assert.equal(body[2].notes, "", "an absent cell is the empty default, not a shifted neighbour");
  assert.equal(body[2].created_at, "");
  assert.equal(body[2].created_by, "wei", "the cells that DO exist still read correctly");
});

// ---------------------------------------------------------------------------
// AC-10 / AC-11 — writes land under their own header and preserve unknown columns.
// ---------------------------------------------------------------------------

test("AC-10 + AC-11: PATCHing an expense writes by header and leaves month / amount value untouched", async () => {
  const { grids, sheets } = fixture();
  const api = loadApi(sheets);

  const { status, body } = await call(api, "PATCH", "/api", { id: "exp-1", amount: 999, notes: "dinner" });
  assert.equal(status, 200);
  assert.equal(body.amount, 999);

  const row = grids.Expenses[1];
  assert.equal(row[2], "999", "amount landed in the amount column");
  assert.equal(row[6], "dinner", "notes landed in the notes column");
  assert.equal(row[8], "2026-08", "the captain's `month` column (I) is unchanged");
  assert.equal(row[9], "250", "the captain's `amount value` column (J) is unchanged");
  assert.equal(row[7], "2026-08-01T02:00:00.000Z", "created_at was carried forward, not blanked");
});

test("AC-10 + AC-11: PATCHing on a SWAPPED expenses sheet writes by header, not by letter", async () => {
  const swap = swapCols(2, 6); // amount <-> notes
  const { grids, sheets } = fixture({
    Expenses: { header: swap(EXPENSES_HEADER), rows: EXPENSES_ROWS.map(swap) },
  });
  const api = loadApi(sheets);

  const { status } = await call(api, "PATCH", "/api", { id: "exp-1", amount: 999 });
  assert.equal(status, 200);

  const row = grids.Expenses[1];
  assert.equal(row[6], "999", "amount followed its header to column G");
  assert.equal(row[2], "lunch", "the notes cell now at column C was not overwritten");
  assert.equal(row[8], "2026-08", "unknown columns still preserved");
});

test("AC-10 + AC-11: PATCHing a subscription writes amount by header and leaves swapped columns alone", async () => {
  const swap = swapCols(4, 5); // frequency <-> due_day
  const { grids, sheets } = fixture({
    Subscriptions: { header: swap(SUBS_HEADER), rows: SUBS_ROWS.map(swap) },
  });
  const api = loadApi(sheets);

  const before = grids.Subscriptions[1].slice();
  const { status, body } = await call(api, "PATCH", "/api/subscriptions", { id: "sub-1", amount: 450 });
  assert.equal(status, 200);
  assert.equal(body.amount, 450);
  assert.equal(body.frequency, "monthly");
  assert.equal(body.due_day, 15);

  const row = grids.Subscriptions[1];
  assert.equal(row[2], "450");
  assert.equal(row[4], before[4], "the swapped frequency/due_day cells are untouched");
  assert.equal(row[5], before[5]);
});

test("AC-11: the write RANGE spans the row's real width, not the known field count", async () => {
  const { grids, requests, sheets } = fixture();
  const api = loadApi(sheets);

  await call(api, "PATCH", "/api", { id: "exp-2", notes: "edited" });
  // A range that stops at H is what let a column past the known fields drift out
  // of view in the first place.
  assert.ok(requests.includes("UPDATE Expenses!A3:J3"), `expected a full-width write, got: ${requests.join(", ")}`);
  assert.equal(grids.Expenses[2].length, 10, "the 10-column row stayed 10 columns wide");
});

// ---------------------------------------------------------------------------
// AC-12 — inserted rows.
// ---------------------------------------------------------------------------

test("AC-12: a new expense lands under each named header and leaves unknown columns blank", async () => {
  const { grids, sheets } = fixture();
  const api = loadApi(sheets);

  const { status, body } = await call(api, "POST", "/api", {
    date: "2026-08-13", amount: 42, category_id: "cat_001", paid_by: "ijac", created_by: "ijac", notes: "coffee",
  });
  assert.equal(status, 201);

  const row = grids.Expenses[1]; // inserted directly under the header
  assert.equal(row[1], "2026-08-13");
  assert.equal(row[2], "42");
  assert.equal(row[6], "coffee");
  assert.equal(row[0], body.id);
  assert.equal(row[8], "", "`month` is blank, not carrying created_at spilled over");
  assert.equal(row[9], "", "`amount value` is blank");
  assert.equal(grids.Expenses[2][0], "exp-1", "the previous top row was pushed down, not overwritten");
});

test("AC-12: a new expense on a swapped sheet still lands under its own headers", async () => {
  const swap = swapCols(1, 6); // date <-> notes
  const { grids, sheets } = fixture({
    Expenses: { header: swap(EXPENSES_HEADER), rows: EXPENSES_ROWS.map(swap) },
  });
  const api = loadApi(sheets);

  await call(api, "POST", "/api", { date: "2026-08-13", amount: 42, notes: "coffee", category_id: "cat_001" });
  const row = grids.Expenses[1];
  assert.equal(row[6], "2026-08-13", "date followed its header to column G");
  assert.equal(row[1], "coffee", "notes followed its header to column B");
});

test("AC-12: a new subscription lands under each named header", async () => {
  const swap = swapCols(4, 5);
  const { grids, sheets } = fixture({
    Subscriptions: { header: swap(SUBS_HEADER), rows: SUBS_ROWS.map(swap) },
  });
  const api = loadApi(sheets);

  const { status } = await call(api, "POST", "/api/subscriptions", {
    name: "Spotify", amount: 149, category_id: "cat_002", frequency: "monthly", due_day: 20, paid_by: "ijac",
  });
  assert.equal(status, 201);

  const row = grids.Subscriptions[1];
  assert.equal(row[1], "Spotify");
  assert.equal(row[5], "monthly", "frequency followed its header to column F");
  assert.equal(row[4], "20", "due_day followed its header to column E");
});

test("AC-12: row insertion never rewrites the header row, even when A1 is not `id`", async () => {
  // The old header guard fired whenever A1 !== "id" and stamped its own field
  // order over row 1 — destroying a reordered header instead of reading it.
  const move = (r) => [r[1], r[2], r[0], ...r.slice(3)];
  const { grids, requests, sheets } = fixture({
    Expenses: { header: move(EXPENSES_HEADER), rows: EXPENSES_ROWS.map(move) },
  });
  const api = loadApi(sheets);
  const headerBefore = grids.Expenses[0].slice();

  await call(api, "POST", "/api", { amount: 10, category_id: "cat_001" });
  assert.deepEqual(grids.Expenses[0], headerBefore, "the captain's column order survived the insert");
  assert.equal(requests.filter((r) => /^UPDATE Expenses!A1/.test(r)).length, 0, "no write targeted row 1");
  // Header is [date, amount, id, ...] here.
  assert.equal(grids.Expenses[1][1], "10", "amount still landed under its own header");
  assert.match(grids.Expenses[1][2], /^exp-/, "the generated id landed in the moved id column");
});

// ---------------------------------------------------------------------------
// AC-13 — DELETE resolves the id column from the header.
// ---------------------------------------------------------------------------

test("AC-13: DELETE finds the row by the resolved id column, not by assuming column A", async () => {
  // Move `id` from A to C so any A-column assumption deletes the wrong row.
  const move = (r) => {
    const c = r.slice();
    while (c.length < 10) c.push("");
    return [c[1], c[2], c[0], ...c.slice(3)];
  };
  const { grids, requests, sheets } = fixture({
    Expenses: { header: move(EXPENSES_HEADER), rows: EXPENSES_ROWS.map(move) },
  });
  const api = loadApi(sheets);
  assert.equal(grids.Expenses[0][2], "id", "fixture check: id is in column C");

  const { status, body } = await call(api, "DELETE", "/api", { id: "exp-2" });
  assert.equal(status, 200);
  assert.deepEqual(body, { deleted: true });

  assert.ok(requests.includes("GET Expenses!C:C"), `the id column was read by name, got: ${requests.join(", ")}`);
  assert.equal(grids.Expenses.length, 3, "one data row was removed");
  assert.deepEqual(grids.Expenses.slice(1).map((r) => r[2]), ["exp-1", "exp-3"], "the RIGHT row was removed");
});

test("AC-13: DELETE of an unknown id is a 404 and removes nothing", async () => {
  const { grids, sheets } = fixture();
  const api = loadApi(sheets);

  const { status } = await call(api, "DELETE", "/api", { id: "exp-nope" });
  assert.equal(status, 404);
  assert.equal(grids.Expenses.length, 4);
});

// ---------------------------------------------------------------------------
// AC-14 — migrate-users resolves paid_by / created_by by header name.
// ---------------------------------------------------------------------------

test("AC-14: migrate-users resolves paid_by / created_by by header, not by r[4] / r[5] / r[7]", async () => {
  // Swap paid_by away from index 4 with a column migrate-users must NOT touch.
  // Swapping paid_by with created_by would not discriminate: both fields run
  // through the same resolver, so a positional reader gets the right answer by
  // luck. Swapping with `notes` makes a positional reader corrupt the notes.
  const swapExp = swapCols(4, 6); // paid_by <-> notes
  const swapSub = swapCols(7, 1); // paid_by <-> name
  const { grids, sheets } = fixture({
    Expenses: {
      header: swapExp(EXPENSES_HEADER),
      rows: [
        // [id, date, amount, category_id, notes, created_by, paid_by, created_at, month, amount value]
        ["exp-1", "2026-08-01", "250", "cat_001", "lunch", "user1", "user2", "2026-08-01T02:00:00.000Z", "2026-08", "250"],
      ],
    },
    Subscriptions: {
      header: swapSub(SUBS_HEADER),
      // [id, paid_by, amount, category_id, frequency, due_day, due_month, name, is_active]
      rows: [["sub-1", "user2", "390", "cat_002", "monthly", "15", "", "Netflix", "true"]],
    },
  });
  const api = loadApi(sheets);

  const { status, body } = await call(api, "POST", "/api/migrate-users", {});
  assert.equal(status, 200);
  assert.deepEqual(body, { expensesFixed: 1, subscriptionsFixed: 1 });

  const exp = grids.Expenses[1];
  assert.equal(exp[6], "wei", "paid_by (user2) resolved in the column its header names, now G");
  assert.equal(exp[5], "ijac", "created_by (user1) resolved in column F");
  assert.equal(exp[4], "lunch", "the notes cell sitting at index 4 was NOT treated as paid_by");
  assert.equal(exp[8], "2026-08", "the unknown `month` column survived the migration write");
  assert.equal(exp[9], "250");

  const sub = grids.Subscriptions[1];
  assert.equal(sub[1], "wei", "subscription paid_by resolved by header, not r[7] by luck");
  assert.equal(sub[7], "Netflix", "the name cell sitting at index 7 was NOT treated as paid_by");
});

// ---------------------------------------------------------------------------
// The insights path reads both tabs behind its own try/catch, which turns any
// throw into a generic 503 "data_error". A schema problem has to escape that.
// ---------------------------------------------------------------------------

test("insights resolves both tabs' columns and returns normally", async () => {
  const { sheets } = fixture();
  // An empty period short-circuits before the Anthropic call, so this asserts
  // the two readTab calls and the response shape without needing a key or the
  // clock. Column resolution on expense reads is covered by AC-7 / AC-8.
  const { status, body } = await call(loadApi(sheets), "POST", "/api/insights", { period: "annual", year: 2020 });
  assert.equal(status, 200, "a well-formed sheet must not surface as a 503");
  assert.equal(body.insufficient_data, true);
  assert.deepEqual(body.period, { type: "annual", year: 2020 });
});

test("insights surfaces a schema error as a 500 naming the field, not a generic 503", async () => {
  const renamed = EXPENSES_HEADER.map((h) => (h === "amount" ? "cost" : h));
  const { sheets } = fixture({ Expenses: { header: renamed, rows: EXPENSES_ROWS } });

  const { status, body } = await call(loadApi(sheets), "POST", "/api/insights", { period: "monthly", year: 2026, month: 8 });
  assert.equal(status, 500, "a fixable schema problem must not be reported as an opaque data_error");
  assert.equal(body.error_code, undefined);
  assert.match(body.error, /Expenses/);
  assert.match(body.error, /amount/);
});

// ---------------------------------------------------------------------------
// AC-4 — required headers, on the other two tabs.
// ---------------------------------------------------------------------------

test("AC-4: renaming `notes` on Expenses 500s naming the tab and field, rather than blanking notes", async () => {
  const renamed = EXPENSES_HEADER.map((h) => (h === "notes" ? "note_text" : h));
  const { sheets } = fixture({ Expenses: { header: renamed, rows: EXPENSES_ROWS } });

  const { status, body } = await call(loadApi(sheets), "GET", "/api");
  assert.equal(status, 500, "a renamed required header is loud, not a 200 with blank notes");
  assert.match(body.error, /Expenses/);
  assert.match(body.error, /notes/);
});

test("AC-4: a missing required Subscriptions header 500s naming the field", async () => {
  const { sheets } = fixture({
    Subscriptions: { header: SUBS_HEADER.filter((h) => h !== "due_month"), rows: [] },
  });

  const { status, body } = await call(loadApi(sheets), "GET", "/api/subscriptions");
  assert.equal(status, 500);
  assert.match(body.error, /Subscriptions/);
  assert.match(body.error, /due_month/);
});

test("AC-3: a duplicated Expenses header 500s rather than picking one", async () => {
  const { sheets } = fixture({
    Expenses: { header: [...EXPENSES_HEADER, "amount"], rows: EXPENSES_ROWS },
  });

  const { status, body } = await call(loadApi(sheets), "GET", "/api");
  assert.equal(status, 500);
  assert.match(body.error, /duplicate/i);
  assert.match(body.error, /amount/);
});
