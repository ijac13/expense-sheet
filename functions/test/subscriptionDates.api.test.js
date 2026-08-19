// Run with: npm test  (npm run build && node --test test/)
// Subscription start_date / end_date (entity 053). Assertions land on the cells
// that reach the in-memory sheet and on the JSON returned — never on the source.
// The header for these two columns does not exist on the live tabs, so "the code
// sets the field" proves nothing here: what matters is that a legacy nine-column
// tab still reads 200 and that a write creates the header it needs.
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSheets, loadApi, call } = require("./sheetsStub");
const { buildColumnMap, hasColumn, rowToSubscription, SUBSCRIPTIONS_SPEC } = require("../lib/sheetSchema");
const { runSubscriptionScheduler } = require("../lib/scheduler");
const { buildInsightsPrompt } = require("../lib/insights");

// The nine columns every live Subscriptions tab has today, and nothing else.
const LEGACY_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];

// Production-shaped: a captain-authored column the resolver knows nothing about,
// sitting at J, so a write that lands "to the right" has something to land right OF.
const UNKNOWN_HEADER = [...LEGACY_HEADER, "renewal note"];

const SUBS_ROWS = [
  ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true"],
  ["sub-2", "Insurance", "12000", "cat_005", "annual", "3", "6", "wei", "true"],
  // Truncated by Sheets' trailing-blank trimming: 6 cells against a 9-cell header.
  ["sub-3", "Old", "100", "cat_002", "monthly", "1"],
];

const USERS = { header: ["email", "Users"], rows: [["ijac@example.com", "ijac"]] };
const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];

const fixture = (over = {}) => makeSheets({
  Subscriptions: { header: LEGACY_HEADER, rows: SUBS_ROWS.map((r) => r.slice()) },
  Expenses: { header: EXPENSES_HEADER, rows: [] },
  Users: USERS,
  ...over,
});

const headerOf = (f) => f.grids.Subscriptions[0];
const rowOf = (f, id) => f.grids.Subscriptions.slice(1).find((r) => r[0] === id);
/** The cell a field resolves to, looked up through the tab's own header. */
const cellOf = (f, id, field) => rowOf(f, id)[headerOf(f).indexOf(field)] ?? "";

// ---------------------------------------------------------------------------
// AC-1 / AC-2 — the columns are optional, and unset always reads as "".
// ---------------------------------------------------------------------------

test("AC-1: the nine legacy headers build a column map with no error and no end_date", () => {
  // Moving either name into `required` makes this throw instead — which is what
  // would 500 every subscriptions request, every insights request and the daily
  // scheduler the instant the code deployed, before any header was touched.
  const map = buildColumnMap([LEGACY_HEADER], SUBSCRIPTIONS_SPEC);
  assert.equal(hasColumn(map, "end_date"), false);
  assert.equal(hasColumn(map, "start_date"), false);
  assert.equal(hasColumn(map, "is_active"), true, "the required columns still resolve");
});

test("AC-2: all three unset shapes yield \"\", never null and never undefined", () => {
  // 1. Column absent from the header entirely.
  const legacy = buildColumnMap([LEGACY_HEADER], SUBSCRIPTIONS_SPEC);
  const absent = rowToSubscription(SUBS_ROWS[0], legacy);
  // A `?? null` default would make these null and a bare `cell()` undefined;
  // strict-equal against "" rejects both, and `typeof` rejects a stray null.
  assert.strictEqual(absent.start_date, "");
  assert.strictEqual(absent.end_date, "");
  assert.equal(typeof absent.end_date, "string");

  const withCols = buildColumnMap([[...LEGACY_HEADER, "start_date", "end_date"]], SUBSCRIPTIONS_SPEC);

  // 2. Column present, cell blank.
  const blank = rowToSubscription([...SUBS_ROWS[0], "", ""], withCols);
  assert.strictEqual(blank.start_date, "");
  assert.strictEqual(blank.end_date, "");

  // 3. Row truncated before the column (Sheets trims trailing blanks).
  const short = rowToSubscription(SUBS_ROWS[2], withCols);
  assert.strictEqual(short.start_date, "");
  assert.strictEqual(short.end_date, "");

  // And a populated cell still reads through.
  const set = rowToSubscription([...SUBS_ROWS[0], "2025-01-01", "2026-08-19"], withCols);
  assert.equal(set.start_date, "2025-01-01");
  assert.equal(set.end_date, "2026-08-19");
});

// ---------------------------------------------------------------------------
// AC-3 — a legacy tab still answers 200.
// ---------------------------------------------------------------------------

test("AC-3: GET against a tab with neither header is 200 and carries both fields as \"\"", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "GET", "/api/subscriptions");
  assert.equal(status, 200, "a legacy header must not 500");
  assert.equal(body.length, 3);
  for (const sub of body) {
    assert.strictEqual(sub.start_date, "", sub.id);
    assert.strictEqual(sub.end_date, "", sub.id);
  }
  assert.deepEqual(headerOf(f), LEGACY_HEADER, "a READ never creates a header");
});

// ---------------------------------------------------------------------------
// AC-4 / AC-5 — a write creates the missing headers, to the right of everything.
// ---------------------------------------------------------------------------

test("AC-4: archiving against a nine-column tab appends the headers and writes the date", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", is_active: false, end_date: "2026-08-19",
  });
  // Before this entity, buildWriteRow raised a 400 here: "no column with that
  // header exists". A 400 is the failure this test exists to catch.
  assert.equal(status, 200, JSON.stringify(body));

  // Only the header the write actually needed: `start_date` was not part of this
  // PATCH, so no column is invented for it.
  assert.equal(headerOf(f)[9], "end_date", "J1 reads end_date");
  assert.equal(headerOf(f).length, 10, "exactly one header was appended");
  const row = rowOf(f, "sub-1");
  assert.equal(row[9], "2026-08-19", "the subscription's J cell reads the date");
  assert.equal(row[8], "false", "the archive itself still happened");
  assert.equal(body.end_date, "2026-08-19");
});

test("AC-5: appending the headers preserves an unknown column's header and every data cell", async () => {
  const f = fixture({
    Subscriptions: {
      header: UNKNOWN_HEADER,
      rows: [
        ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "renews in June"],
        ["sub-2", "Insurance", "12000", "cat_005", "annual", "3", "6", "wei", "true", "auto-renews"],
      ],
    },
  });
  const before = f.grids.Subscriptions.map((r) => r.slice());

  const { status } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", is_active: false, end_date: "2026-08-19",
  });
  assert.equal(status, 200);

  const header = headerOf(f);
  assert.equal(header[9], "renewal note", "the captain's header is byte-identical and still at J");
  assert.equal(header[10], "end_date", "the new header landed to its RIGHT, never on top of it");
  assert.equal(rowOf(f, "sub-1")[9], "renews in June", "the patched row's unknown cell survived");
  assert.equal(cellOf(f, "sub-1", "end_date"), "2026-08-19");
  assert.deepEqual(f.grids.Subscriptions[2], before[2], "the untouched row is byte-identical");
});

// ---------------------------------------------------------------------------
// AC-6 — the allowlist, and an unrelated PATCH leaving the dates alone.
// ---------------------------------------------------------------------------

test("AC-6: an unrelated PATCH leaves a stored end_date unchanged", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);

  await call(api, "PATCH", "/api/subscriptions", { id: "sub-1", is_active: false, end_date: "2026-07-01" });
  assert.equal(cellOf(f, "sub-1", "end_date"), "2026-07-01");

  // Omitting a field from `updates` carries its cell forward. A handler that
  // wrote String(undefined) or "" for every allowlisted field would blank this.
  const { status, body } = await call(api, "PATCH", "/api/subscriptions", { id: "sub-1", amount: 500 });
  assert.equal(status, 200);
  assert.equal(cellOf(f, "sub-1", "amount"), "500", "the edit landed");
  assert.equal(cellOf(f, "sub-1", "end_date"), "2026-07-01", "the end date was not blanked by an unrelated edit");
  assert.equal(body.end_date, "2026-07-01");
});

test("AC-6: start_date is patchable in its own right", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-2", start_date: "2024-06-03",
  });
  assert.equal(status, 200);
  assert.equal(cellOf(f, "sub-2", "start_date"), "2024-06-03");
  assert.equal(body.start_date, "2024-06-03");
});

// ---------------------------------------------------------------------------
// AC-12 — the server rejects end < start independently of the modal.
// ---------------------------------------------------------------------------

test("AC-12: an end_date earlier than the stored start_date is a 400 naming both dates", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  await call(api, "PATCH", "/api/subscriptions", { id: "sub-1", start_date: "2026-03-01" });
  const before = f.grids.Subscriptions.map((r) => r.slice());

  const { status, body } = await call(api, "PATCH", "/api/subscriptions", {
    id: "sub-1", is_active: false, end_date: "2026-02-28",
  });
  assert.equal(status, 400);
  assert.match(body.error, /2026-02-28/);
  assert.match(body.error, /2026-03-01/);
  assert.deepEqual(f.grids.Subscriptions, before, "the sheet is byte-identical after the rejection");
});

test("AC-12: an end_date equal to the start date is allowed", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  await call(api, "PATCH", "/api/subscriptions", { id: "sub-1", start_date: "2026-03-01" });

  // Started and cancelled the same day is real; the guard is strictly-earlier.
  const { status } = await call(api, "PATCH", "/api/subscriptions", {
    id: "sub-1", is_active: false, end_date: "2026-03-01",
  });
  assert.equal(status, 200);
  assert.equal(cellOf(f, "sub-1", "end_date"), "2026-03-01");
});

test("AC-12: a legacy row with no start date accepts any end date", async () => {
  const f = fixture();
  // sub-1 has no start_date cell at all. A missing start date must never block
  // recording an end date — that is every one of today's rows.
  const { status } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", is_active: false, end_date: "2020-01-01",
  });
  assert.equal(status, 200);
  assert.equal(cellOf(f, "sub-1", "end_date"), "2020-01-01");
});

test("AC-12: a locale-formatted hand-typed start date skips the guard rather than 400ing", async () => {
  // readTab sets no valueRenderOption, so a cell the captain enters as a real
  // Sheets date comes back as `2026/3/1`. Comparing that as a string would make
  // every end date in 2026 look earlier and reject a legitimate archive.
  const f = fixture({
    Subscriptions: {
      header: [...LEGACY_HEADER, "start_date", "end_date"],
      rows: [["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "2026/3/1", ""]],
    },
  });
  const { status } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", is_active: false, end_date: "2026-02-28",
  });
  assert.equal(status, 200, "a non-ISO stored value is the sheet's business, not a 400");
  assert.equal(cellOf(f, "sub-1", "end_date"), "2026-02-28");
});

test("AC-12: a start_date arriving in the same PATCH is what the end date is compared against", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", start_date: "2026-05-01", end_date: "2026-04-30", is_active: false,
  });
  assert.equal(status, 400, JSON.stringify(body));
  assert.deepEqual(headerOf(f), LEGACY_HEADER, "a rejected write creates no headers either");
});

// ---------------------------------------------------------------------------
// AC-14 / AC-15 / AC-16 — creation, and the end date staying "" for an active sub.
// ---------------------------------------------------------------------------

test("AC-14: a created subscription stores the submitted start_date and an empty end_date", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "POST", "/api/subscriptions", {
    name: "Spotify", amount: 149, category_id: "cat_002", frequency: "monthly",
    due_day: 20, paid_by: "ijac", start_date: "2026-08-19",
  });
  assert.equal(status, 201);
  assert.strictEqual(body.end_date, "", "the 201 body carries an empty end_date");
  assert.equal(body.start_date, "2026-08-19");

  const row = f.grids.Subscriptions[1]; // inserted directly under the header
  assert.equal(row[1], "Spotify");
  assert.equal(row[9], "2026-08-19", "start_date landed under its own header");
  assert.strictEqual(row[10] ?? "", "", "the end_date cell is empty");
});

test("AC-15: an omitted start_date stores \"\" rather than a server-side today", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "POST", "/api/subscriptions", {
    name: "Spotify", amount: 149, category_id: "cat_002", frequency: "monthly", due_day: 20, paid_by: "ijac",
  });
  assert.equal(status, 201);
  // "Today" is decided in the browser, the only side that knows the captain's
  // local date. A server default would silently disagree with the form.
  assert.strictEqual(body.start_date, "");
  assert.strictEqual(f.grids.Subscriptions[1][9] ?? "", "");
});

test("AC-16: an active subscription's end_date stays \"\" through creation, an edit, and a scheduler run", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);

  await call(api, "POST", "/api/subscriptions", {
    name: "Spotify", amount: 149, category_id: "cat_002", frequency: "monthly",
    due_day: 15, paid_by: "ijac", start_date: "2026-08-01",
  });
  const created = f.grids.Subscriptions[1][0];
  const endCell = () => cellOf(f, created, "end_date");
  assert.strictEqual(endCell(), "", "after creation");

  for (const patch of [{ name: "Spotify Duo" }, { amount: 199 }, { category_id: "cat_003" }, { due_day: 20 }, { due_month: 6 }]) {
    const { status } = await call(api, "PATCH", "/api/subscriptions", { id: created, ...patch });
    assert.equal(status, 200);
    assert.strictEqual(endCell(), "", `after editing ${Object.keys(patch)[0]}`);
  }

  // due_day is 20 by now, so 01:00 Taipei on the 20th is a due date.
  await runSubscriptionScheduler(f.sheets, "sheet-under-test", Date.parse("2026-09-20T01:00:00+08:00"));
  assert.equal(f.grids.Expenses.length, 2, "the scheduler did fire — otherwise this proves nothing");
  assert.strictEqual(endCell(), "", "after a scheduler run");
});

// ---------------------------------------------------------------------------
// AC-22 — the scheduler is untouched.
// ---------------------------------------------------------------------------

test("AC-22: an ACTIVE subscription with a past end_date still generates its expense row", async () => {
  // If end-date filtering were slipped in, this row would be skipped. That is
  // entity 050's scope and explicitly excluded here.
  const withDates = {
    Subscriptions: {
      header: [...LEGACY_HEADER, "start_date", "end_date"],
      rows: [["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "2024-01-01", "2025-01-01"]],
    },
  };
  const dated = fixture(withDates);
  await runSubscriptionScheduler(dated.sheets, "sheet-under-test", Date.parse("2026-08-15T01:00:00+08:00"));

  // Byte-identical to what the same subscription produces with no date columns
  // at all: the scheduler neither reads nor writes them.
  const undated = fixture({
    Subscriptions: {
      header: LEGACY_HEADER,
      rows: [["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true"]],
    },
  });
  await runSubscriptionScheduler(undated.sheets, "sheet-under-test", Date.parse("2026-08-15T01:00:00+08:00"));

  assert.equal(dated.grids.Expenses.length, 2, "the dated fixture generated its row");
  assert.deepEqual(dated.grids.Expenses[1], undated.grids.Expenses[1]);
  assert.equal(dated.grids.Expenses[1][0], "exp-auto-sub-1-2026-08-15");

  // And the subscription row itself is untouched by the run.
  assert.deepEqual(
    dated.grids.Subscriptions[1],
    ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "2024-01-01", "2025-01-01"]
  );
});

// ---------------------------------------------------------------------------
// AC-23 — the insights prompt is byte-identical.
// ---------------------------------------------------------------------------

test("AC-23: the insights prompt is byte-identical to the one built without the new fields", () => {
  const map = buildColumnMap([[...LEGACY_HEADER, "start_date", "end_date"]], SUBSCRIPTIONS_SPEC);
  const subscriptions = [
    ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "2024-01-01", "2026-08-19"],
    ["sub-2", "Insurance", "12000", "cat_005", "annual", "3", "6", "wei", "true", "2023-06-03", ""],
  ].map((r) => rowToSubscription(r, map));

  assert.equal(subscriptions[0].start_date, "2024-01-01", "fixture check: the fields ARE populated");

  const expenses = [
    { date: "2026-08-01", amount: 250, category_id: "cat_001" },
    { date: "2026-07-02", amount: 900, category_id: "cat_002" },
    { date: "2026-06-02", amount: 400, category_id: "cat_002" },
    { date: "2026-05-02", amount: 400, category_id: "cat_003" },
  ];
  const input = { expenses, period: { type: "monthly", year: 2026, month: 8 }, nowMs: Date.parse("2026-08-19T01:00:00Z") };

  const withFields = buildInsightsPrompt({ ...input, subscriptions });
  // "Today's" payload: the same subscriptions with the two fields stripped, which
  // is exactly what rowToSubscription returned before this entity.
  const stripped = subscriptions.map(({ start_date, end_date, ...rest }) => rest);
  const withoutFields = buildInsightsPrompt({ ...input, subscriptions: stripped });

  assert.equal(withFields.kind, "prompt", "fixture check: a real prompt was built");
  assert.equal(withFields.prompt, withoutFields.prompt);
  // Belt and braces: neither field name nor either date value reached the model.
  for (const needle of ["start_date", "end_date", "2024-01-01", "2026-08-19", "2023-06-03"]) {
    assert.ok(!withFields.prompt.includes(needle), `"${needle}" leaked into the prompt`);
  }
});
