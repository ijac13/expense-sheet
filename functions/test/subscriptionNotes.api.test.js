// Run with: npm test  (npm run build && node --test test/)
// Subscription notes (entity 059), Group A. Assertions land on the cells that
// reach the in-memory sheet and on the JSON returned — never on the source.
// The `notes` header exists on no live Subscriptions tab, so "the code sets the
// field" proves nothing: what matters is that a tab without the header still
// reads 200, that a write creates the header WITHOUT claiming an occupied
// column, and that an unrelated edit leaves a stored note alone.
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSheets, loadApi, call } = require("./sheetsStub");
const { buildColumnMap, hasColumn, rowToSubscription, SUBSCRIPTIONS_SPEC } = require("../lib/sheetSchema");
const { runSubscriptionScheduler } = require("../lib/scheduler");

// The nine columns every live Subscriptions tab has today, and nothing else.
const LEGACY_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];

const SUBS_ROWS = [
  ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true"],
  ["sub-2", "Insurance", "12000", "cat_005", "annual", "3", "6", "wei", "true"],
  // Truncated by Sheets' trailing-blank trimming: 6 cells against a 9-cell header.
  ["sub-3", "Old", "100", "cat_002", "monthly", "1"],
];

const USERS = { header: ["email", "Users"], rows: [["ijac@example.com", "ijac"]] };
const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];

const CATEGORIES = {
  header: ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note"],
  rows: [
    ["cat_002", "Digital", "數位", "💻", "2", "true", "transport_communication", ""],
    ["cat_005", "Insurance", "保險", "🛡️", "5", "true", "insurance_financial", ""],
  ],
};

const fixture = (over = {}) => makeSheets({
  Subscriptions: { header: LEGACY_HEADER, rows: SUBS_ROWS.map((r) => r.slice()) },
  Expenses: { header: EXPENSES_HEADER, rows: [] },
  Categories: CATEGORIES,
  Users: USERS,
  ...over,
});

const headerOf = (f) => f.grids.Subscriptions[0];
const rowOf = (f, id) => f.grids.Subscriptions.slice(1).find((r) => r[0] === id);
/** The cell a field resolves to, looked up through the tab's own header. */
const cellOf = (f, id, field) => rowOf(f, id)[headerOf(f).indexOf(field)] ?? "";

// ---------------------------------------------------------------------------
// AC-A1 / AC-A2 — the column is OPTIONAL, and unset always reads as "".
// ---------------------------------------------------------------------------

test("AC-A1: `notes` is optional, so the nine legacy headers still build a map", () => {
  // Moving "notes" into `required` makes this line throw instead — the failure
  // that would 500 every subscriptions request, every insights request and the
  // daily scheduler the instant the code deployed, before any header existed.
  assert.ok(
    SUBSCRIPTIONS_SPEC.optional.includes("notes"),
    "notes must be declared optional, never required"
  );
  assert.ok(!SUBSCRIPTIONS_SPEC.required.includes("notes"));

  const map = buildColumnMap([LEGACY_HEADER], SUBSCRIPTIONS_SPEC);
  assert.equal(hasColumn(map, "notes"), false);
  assert.equal(hasColumn(map, "is_active"), true, "the required columns still resolve");
});

test("AC-A2: all three unset shapes yield \"\", never null and never undefined", () => {
  // 1. Column absent from the header entirely.
  const legacy = buildColumnMap([LEGACY_HEADER], SUBSCRIPTIONS_SPEC);
  const absent = rowToSubscription(SUBS_ROWS[0], legacy);
  // A `?? null` default would make this null and a bare `cell()` undefined;
  // strict-equal against "" rejects both.
  assert.strictEqual(absent.notes, "");
  assert.equal(typeof absent.notes, "string");

  const withCol = buildColumnMap([[...LEGACY_HEADER, "notes"]], SUBSCRIPTIONS_SPEC);

  // 2. Column present, cell blank.
  assert.strictEqual(rowToSubscription([...SUBS_ROWS[0], ""], withCol).notes, "");

  // 3. Row truncated before the column (Sheets trims trailing blanks).
  assert.strictEqual(rowToSubscription(SUBS_ROWS[2], withCol).notes, "");

  // And a populated cell still reads through.
  assert.equal(rowToSubscription([...SUBS_ROWS[0], "cancel before renewal"], withCol).notes, "cancel before renewal");
});

// ---------------------------------------------------------------------------
// AC-A3 — a legacy tab still answers 200, carrying the field.
// ---------------------------------------------------------------------------

test("AC-A3: GET against a tab with no notes header is 200 and carries notes as \"\"", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "GET", "/api/subscriptions");
  assert.equal(status, 200, "a legacy header must not 500");
  assert.equal(body.length, 3);
  for (const sub of body) {
    assert.strictEqual(sub.notes, "", sub.id);
  }
  assert.deepEqual(headerOf(f), LEGACY_HEADER, "a READ never creates a header");
});

test("AC-A3: a pre-existing notes column surfaces its stored text on every row", async () => {
  const f = fixture({
    Subscriptions: {
      header: [...LEGACY_HEADER, "notes"],
      rows: [
        ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "shared with mum"],
        ["sub-2", "Insurance", "12000", "cat_005", "annual", "3", "6", "wei", "true"],
      ],
    },
  });
  const { status, body } = await call(loadApi(f.sheets), "GET", "/api/subscriptions");
  assert.equal(status, 200);
  assert.equal(body.find((s) => s.id === "sub-1").notes, "shared with mum");
  assert.strictEqual(body.find((s) => s.id === "sub-2").notes, "", "a short row is not undefined");
});

// ---------------------------------------------------------------------------
// AC-A4 / AC-A8 — creating a subscription stores its note and creates the column.
// ---------------------------------------------------------------------------

const NEW_SUB = {
  name: "Disney+", amount: 270, category_id: "cat_002",
  frequency: "monthly", due_day: 8, paid_by: "ijac", start_date: "2026-08-01",
};

test("AC-A4/AC-A8: POST writes the submitted note, creates the header, and returns it", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "POST", "/api/subscriptions", {
    ...NEW_SUB, notes: "cancel before renewal",
  });
  assert.equal(status, 201, JSON.stringify(body));

  // AC-A8: the POST handler asked for the column, so the first subscription
  // added after deploy creates it. Dropping "notes" from that field list makes
  // buildWriteRow throw a 400 here instead.
  assert.ok(headerOf(f).includes("notes"), `no notes header was created: ${headerOf(f)}`);
  assert.equal(cellOf(f, body.id, "notes"), "cancel before renewal", "the cell holds the exact text");
  assert.equal(body.notes, "cancel before renewal", "and the 201 body carries it back");
});

test("AC-A4: a POST with no notes key stores \"\", not \"undefined\"", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "POST", "/api/subscriptions", NEW_SUB);
  assert.equal(status, 201, JSON.stringify(body));
  // `String(body.notes)` without the ?? "" would write the literal "undefined".
  assert.strictEqual(cellOf(f, body.id, "notes"), "", "the cell is empty");
  assert.strictEqual(body.notes, "");
});

// ---------------------------------------------------------------------------
// AC-A5 / AC-A6 / AC-A9 — patching a note, and surviving an unrelated edit.
// ---------------------------------------------------------------------------

test("AC-A5/AC-A9: a notes-only PATCH writes that cell and leaves every other one alone", async () => {
  // A captain-authored column the resolver knows nothing about, so "every other
  // cell" includes one that is in no spec.
  const f = fixture({
    Subscriptions: {
      header: [...LEGACY_HEADER, "renewal note"],
      rows: [
        ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "renews in June"],
        ["sub-2", "Insurance", "12000", "cat_005", "annual", "3", "6", "wei", "true", "auto-renews"],
      ],
    },
  });
  const before = f.grids.Subscriptions.map((r) => r.slice());

  const { status, body } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", notes: "shared with mum",
  });
  // AC-A9: without "notes" in the patchable-field list, `updates` is empty and
  // the note never reaches buildWriteRow — this reads 200 with an unchanged cell.
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(cellOf(f, "sub-1", "notes"), "shared with mum");
  assert.equal(body.notes, "shared with mum");

  // Every other cell of the patched row, byte for byte.
  const row = rowOf(f, "sub-1");
  for (let i = 0; i < before[1].length; i++) {
    assert.equal(row[i], before[1][i], `cell ${i} of the patched row changed`);
  }
  assert.equal(row[9], "renews in June", "the unknown column's cell survived");
  assert.deepEqual(f.grids.Subscriptions[2], before[2], "the untouched row is byte-identical");
});

test("AC-A6: an unrelated PATCH leaves a stored note unchanged", async () => {
  const f = fixture({
    Subscriptions: {
      header: [...LEGACY_HEADER, "notes"],
      rows: [["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "shared with mum"]],
    },
  });

  // A rename and an amount change, carrying no notes key at all. A handler that
  // wrote String(undefined) or "" for every allowlisted field would blank this.
  const { status } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", name: "Netflix Premium", amount: 450,
  });
  assert.equal(status, 200);
  assert.equal(cellOf(f, "sub-1", "notes"), "shared with mum", "the note survived an unrelated edit");
  assert.equal(cellOf(f, "sub-1", "name"), "Netflix Premium", "the rename itself still happened");

  // And an archive, the other edit the captain performs on a subscription.
  await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", is_active: false, end_date: "2026-08-19",
  });
  assert.equal(cellOf(f, "sub-1", "notes"), "shared with mum", "the note survived the archive too");
});

test("AC-A6: a note can be cleared on purpose", async () => {
  const f = fixture({
    Subscriptions: {
      header: [...LEGACY_HEADER, "notes"],
      rows: [["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "shared with mum"]],
    },
  });
  // The distinction AC-A6 turns on: an OMITTED note carries forward, an
  // explicitly empty one erases. Both must be reachable.
  const { status, body } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", { id: "sub-1", notes: "" });
  assert.equal(status, 200);
  assert.strictEqual(cellOf(f, "sub-1", "notes"), "");
  assert.strictEqual(body.notes, "");
});

// ---------------------------------------------------------------------------
// AC-A7 — the entity 053 guard. Placement comes from the widest OCCUPIED row.
// ---------------------------------------------------------------------------

test("AC-A7: a column with data under a BLANK trailing header is not claimed or overwritten", async () => {
  // The shape row 1's length cannot see. Sheets trims trailing blanks, so a
  // nine-cell header row means J1 and K1 are genuinely empty while a data row
  // below carries real tenth and eleventh columns. Production has exactly this
  // shape: CATEGORIES_SPEC records `note` data under a blank H1. Placing the new
  // header by row 1's length claims J, destroys the cell under it, and makes
  // every other row's J cell read back as a note.
  const f = fixture({
    Subscriptions: {
      header: LEGACY_HEADER, // nine cells — J1 and K1 are blank
      rows: [
        ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true"],
        ["sub-2", "Insurance", "12000", "cat_005", "annual", "3", "6", "wei", "true"],
        ["sub-3", "Old", "100", "cat_002", "monthly", "1"],
        // Row 5 of the sheet: eleven cells, two of them under blank headers.
        ["sub-4", "HBO", "200", "cat_002", "monthly", "3", "", "ijac", "true", "KEEP-J", "KEEP-K"],
      ],
    },
  });
  const before = f.grids.Subscriptions.map((r) => r.slice());
  assert.equal(before[4].length, 11, "fixture check: row 5 occupies eleven columns");
  assert.equal(before[0].length, 9, "fixture check: row 1 declares nine headers");

  const { status } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", notes: "cancel before renewal",
  });
  assert.equal(status, 200);

  const header = headerOf(f);
  assert.notEqual(header[9], "notes", "J1 is blank but its column holds data — it must not be claimed");
  assert.notEqual(header[10], "notes", "K1 likewise");
  assert.equal(header[9] ?? "", "", "J1 is still blank");
  assert.equal(header[10] ?? "", "", "K1 is still blank");
  assert.equal(header[11], "notes", "the new header landed past the widest occupied row, at index 11 (column L)");

  // The data under the blank headers is untouched, on the patched row and on
  // every other row.
  assert.equal(rowOf(f, "sub-4")[9], "KEEP-J", "the blank-headed cells survived");
  assert.equal(rowOf(f, "sub-4")[10], "KEEP-K");
  for (let r = 2; r < before.length; r++) {
    assert.deepEqual(f.grids.Subscriptions[r], before[r], `row ${r + 1} is byte-identical`);
  }
  assert.equal(cellOf(f, "sub-1", "notes"), "cancel before renewal", "the note itself was still written");

  // The downstream half of the same bug: a claimed column makes the OTHER rows'
  // pre-existing cells read back as notes through the resolver.
  const { body } = await call(loadApi(f.sheets), "GET", "/api/subscriptions");
  assert.strictEqual(body.find((s) => s.id === "sub-4").notes, "", "sub-4 never had a note");
  assert.equal(body.find((s) => s.id === "sub-1").notes, "cancel before renewal");
});

// ---------------------------------------------------------------------------
// AC-A10 — a note is text, never a formula.
// ---------------------------------------------------------------------------

test("AC-A10: a note starting =, +, - or @ round-trips as literal text", async () => {
  for (const note of ["=SUM(A1:A9)", "+2 seats added in June", "-50% promo until June", "@family plan"]) {
    const f = fixture();
    const { status, body } = await call(loadApi(f.sheets), "POST", "/api/subscriptions", { ...NEW_SUB, notes: note });
    assert.equal(status, 201, JSON.stringify(body));
    assert.equal(cellOf(f, body.id, "notes"), note, "the cell holds the characters that were sent");

    const read = await call(loadApi(f.sheets), "GET", "/api/subscriptions");
    assert.equal(read.body.find((s) => s.id === body.id).notes, note, "and GET returns them unchanged");

    // The stub cannot evaluate a formula, so the round-trip above would pass
    // under USER_ENTERED too. This is the assertion that fails if a future
    // change stops telling Sheets to store the text literally.
    for (const w of f.valueWrites) {
      assert.equal(w.valueInputOption, "RAW", `${w.range} was not written RAW`);
    }
  }
});

// ---------------------------------------------------------------------------
// AC-D3 — a subscription's own note never reaches the expenses it generates.
// ---------------------------------------------------------------------------

test("AC-D3: the scheduler still writes the subscription NAME into the created expense's notes", async () => {
  const f = fixture({
    Subscriptions: {
      header: [...LEGACY_HEADER, "notes"],
      rows: [
        // Due on the 15th, carrying a note of its own — the leak this guards.
        ["sub-1", "Netflix", "380", "cat_002", "monthly", "15", "", "ijac", "true", "cancel before renewal"],
      ],
    },
  });

  // 01:00 Asia/Taipei on the 15th — the hour the schedule fires.
  await runSubscriptionScheduler(f.sheets, "sheet-under-test", Date.parse("2026-08-15T01:00:00+08:00"));

  const expenses = f.grids.Expenses.slice(1);
  assert.equal(expenses.length, 1, "the due subscription generated its expense row");
  const notesCol = f.grids.Expenses[0].indexOf("notes");
  assert.equal(expenses[0][notesCol], "Netflix", "the expense is labelled with the subscription's NAME");
  assert.notEqual(expenses[0][notesCol], "cancel before renewal", "never with the subscription's own note");
});

// ---------------------------------------------------------------------------
// AC-D4 — every other rowToSubscription caller still answers 200.
// ---------------------------------------------------------------------------

test("AC-D4: /api/insights still answers against a tab with no notes header", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "POST", "/api/insights", {
    year: 2026, month: 8,
  });
  // The claim is narrow and deliberate: adding `notes` to the spec must not turn
  // this into a 500 from buildColumnMap. A 200 or a 4xx both prove the schema
  // read survived; only a schema throw shows up as 500.
  assert.notEqual(status, 500, `insights 500ed after notes joined the spec: ${JSON.stringify(body)}`);
});
