// Run with: npm test  (npm run build && node --test test/)
// Entity 058, AC-9..AC-13: every write path validates category_id against the
// LIVE Categories tab, read per request. Assertions land on the status code and
// on the in-memory sheet being byte-identical after a rejection — "wrote nothing"
// is the half of the claim a status code alone does not prove.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { makeSheets, loadApi, call } = require("./sheetsStub");

const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];
const EXPENSES_ROWS = [
  ["exp-1", "2026-08-01", "250", "cat_001", "ijac", "ijac", "lunch", "2026-08-01T02:00:00.000Z"],
];

const SUBS_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];
const SUBS_ROWS = [
  ["sub-1", "Netflix", "390", "cat_001", "monthly", "15", "", "ijac", "true"],
];

const CATEGORIES_HEADER = ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note"];
const CATEGORIES_ROWS = [
  ["cat_001", "Eating Out", "外食", "🍕", "1", "true", "restaurants_accommodation", ""],
  ["cat_003", "Groceries", "食材", "🥕", "3", "true", "food_beverage_tobacco", ""],
  // Archived: present in the tab, is_active false. AC-11 turns on this row.
  ["cat_015", "Fuel", "加油", "🛢️", "15", "false", "transport_communication", ""],
  // A captain-authored id in neither cat_NNN shape nor DEFAULT_CATEGORIES.
  // Accepting it is what proves the valid set comes from the SHEET (AC-13).
  ["zz_custom", "Custom", "自訂", "🎯", "20", "true", "miscellaneous", ""],
];

const USERS = { header: ["email", "Users"], rows: [["ijac@example.com", "ijac"]] };

const fixture = (over = {}) => makeSheets({
  Expenses: { header: EXPENSES_HEADER, rows: EXPENSES_ROWS.map((r) => r.slice()) },
  Subscriptions: { header: SUBS_HEADER, rows: SUBS_ROWS.map((r) => r.slice()) },
  Categories: { header: CATEGORIES_HEADER, rows: CATEGORIES_ROWS.map((r) => r.slice()) },
  Users: USERS,
  ...over,
});

const snapshot = (f) => JSON.stringify({ e: f.grids.Expenses, s: f.grids.Subscriptions, c: f.grids.Categories });

const validExpense = { date: "2026-08-24", amount: 42, paid_by: "ijac", created_by: "ijac", notes: "" };
const validSub = { name: "Spotify", amount: 149, frequency: "monthly", due_day: 20, paid_by: "ijac" };

// ---------------------------------------------------------------------------
// AC-9 / AC-10 — an id absent from the tab is a 400 on all four endpoints, and
// nothing is written.
// ---------------------------------------------------------------------------

test("AC-9: POST /api/expenses with a legacy slug is 400 and writes no row", async () => {
  const f = fixture();
  const before = snapshot(f);

  const { status, body } = await call(loadApi(f.sheets), "POST", "/api", {
    ...validExpense, category_id: "eating-out",
  });

  assert.equal(status, 400);
  assert.match(body.error, /eating-out/, "the error names the rejected value");
  assert.equal(snapshot(f), before, "the sheet is byte-identical after the rejection");
  assert.equal(f.grids.Expenses.length, 2, "still just the header and the one pre-existing row");
});

test("AC-9: a valid live id on the same endpoint is 201 — the 400 is not blanket", async () => {
  const f = fixture();
  const { status } = await call(loadApi(f.sheets), "POST", "/api", {
    ...validExpense, category_id: "cat_003",
  });
  assert.equal(status, 201);
  assert.equal(f.grids.Expenses[1][3], "cat_003", "and it landed in the category_id column");
});

test("AC-10: PATCH /api/expenses with an absent id is 400 and changes nothing", async () => {
  const f = fixture();
  const before = snapshot(f);

  const { status, body } = await call(loadApi(f.sheets), "PATCH", "/api", {
    id: "exp-1", category_id: "cat_777",
  });

  assert.equal(status, 400);
  assert.match(body.error, /cat_777/);
  assert.equal(snapshot(f), before);
});

test("AC-10: POST /api/subscriptions with an absent id is 400 and creates no row or header", async () => {
  const f = fixture();
  const before = snapshot(f);

  const { status, body } = await call(loadApi(f.sheets), "POST", "/api/subscriptions", {
    ...validSub, category_id: "eating-out",
  });

  assert.equal(status, 400);
  assert.match(body.error, /eating-out/);
  // ensureSubscriptionColumns writes start_date/end_date headers on this path, so
  // validating after it would leave the sheet altered by a "rejected" request.
  assert.equal(snapshot(f), before, "not even a header was appended");
  assert.deepEqual(f.grids.Subscriptions[0], SUBS_HEADER);
});

test("AC-10: PATCH /api/subscriptions with an absent id is 400 and changes nothing", async () => {
  const f = fixture();
  const before = snapshot(f);

  const { status, body } = await call(loadApi(f.sheets), "PATCH", "/api/subscriptions", {
    id: "sub-1", category_id: "groceries",
  });

  assert.equal(status, 400);
  assert.match(body.error, /groceries/);
  assert.equal(snapshot(f), before);
});

test("AC-10: a PATCH that omits category_id is untouched by the guard", async () => {
  // The stored cell carries forward, so an unrelated edit to a row filed under a
  // since-deleted category must not be blocked.
  const f = fixture();
  const { status } = await call(loadApi(f.sheets), "PATCH", "/api", { id: "exp-1", amount: 999 });
  assert.equal(status, 200);
  assert.equal(f.grids.Expenses[1][2], "999");
  assert.equal(f.grids.Expenses[1][3], "cat_001", "the category cell is unchanged");
});

// ---------------------------------------------------------------------------
// AC-11 — inactive is ACCEPTED. This is the distinction the guard turns on.
// ---------------------------------------------------------------------------

test("AC-11: an is_active:false category is accepted on all four endpoints", async () => {
  for (const [method, path, body] of [
    ["POST", "/api", { ...validExpense, category_id: "cat_015" }],
    ["PATCH", "/api", { id: "exp-1", category_id: "cat_015" }],
    ["POST", "/api/subscriptions", { ...validSub, category_id: "cat_015" }],
    ["PATCH", "/api/subscriptions", { id: "sub-1", category_id: "cat_015" }],
  ]) {
    const f = fixture();
    const res = await call(loadApi(f.sheets), method, path, body);
    assert.ok(res.status === 200 || res.status === 201, `${method} ${path}: ${res.status} ${JSON.stringify(res.body)}`);
  }
});

test("AC-11: archived is accepted while absent is rejected — the same request otherwise", async () => {
  // Both ids are missing from the ACTIVE set; only one is missing from the TAB.
  // A guard written against is_active instead of presence fails exactly here.
  const archived = fixture();
  const absent = fixture();
  const a = await call(loadApi(archived.sheets), "POST", "/api", { ...validExpense, category_id: "cat_015" });
  const b = await call(loadApi(absent.sheets), "POST", "/api", { ...validExpense, category_id: "cat_016" });

  assert.equal(a.status, 201, "archived: editable");
  assert.equal(b.status, 400, "absent: rejected");
  assert.equal(archived.grids.Expenses.length, 3);
  assert.equal(absent.grids.Expenses.length, 2);
});

// ---------------------------------------------------------------------------
// AC-12 — blank and missing.
// ---------------------------------------------------------------------------

test("AC-12: a blank or missing category_id is 400 on both POSTs", async () => {
  for (const [path, base] of [["/api", validExpense], ["/api/subscriptions", validSub]]) {
    for (const value of [undefined, "", "   ", null]) {
      const f = fixture();
      const before = snapshot(f);
      const body = { ...base };
      if (value !== undefined) body.category_id = value;

      const res = await call(loadApi(f.sheets), "POST", path, body);
      assert.equal(res.status, 400, `${path} with ${JSON.stringify(value)}`);
      assert.match(res.body.error, /category_id/);
      assert.equal(snapshot(f), before, `${path} with ${JSON.stringify(value)} wrote nothing`);
    }
  }
});

// ---------------------------------------------------------------------------
// AC-13 — the valid set is the sheet, with no slug bridge and no baked-in list.
// ---------------------------------------------------------------------------

test("AC-13: an id that exists ONLY in the sheet is accepted", async () => {
  // `zz_custom` is in no cat_NNN pattern and in no DEFAULT_CATEGORIES table. Any
  // hardcoded allowlist or id-shape regex rejects it; reading the tab accepts it.
  const f = fixture();
  const { status } = await call(loadApi(f.sheets), "POST", "/api", {
    ...validExpense, category_id: "zz_custom",
  });
  assert.equal(status, 201);
  assert.equal(f.grids.Expenses[1][3], "zz_custom");
});

test("AC-13: the server does NOT bridge a slug through name_en", async () => {
  // "Eating Out" is present in the tab as cat_001, so a name_en bridge — the
  // client's resolveCategory behaviour — would accept `eating-out` and store it,
  // reintroducing the slug the migration removed. It must 400 instead.
  const f = fixture();
  const { status } = await call(loadApi(f.sheets), "POST", "/api", {
    ...validExpense, category_id: "eating-out",
  });
  assert.equal(status, 400);
  assert.ok(!JSON.stringify(f.grids.Expenses).includes("eating-out"));
});

test("AC-13: a category added to the sheet mid-session is accepted with no redeploy", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  assert.equal((await call(api, "POST", "/api", { ...validExpense, category_id: "cat_099" })).status, 400);

  // The captain adds it in Category Management. Same process, same code.
  f.grids.Categories.push(["cat_099", "New", "新", "🆕", "21", "true", "miscellaneous", ""]);

  assert.equal((await call(api, "POST", "/api", { ...validExpense, category_id: "cat_099" })).status, 201);
});

test("AC-13: no DEFAULT_CATEGORIES slug literal exists anywhere under functions/src", async () => {
  const dir = path.join(__dirname, "..", "src");
  const slugs = [
    "eating-out", "daily-necessities", "groceries", "medical", "travel", "transportation",
    "digital", "babies", "clothing", "sports", "gifts", "tuition", "tolls", "equipment",
    "fuel", "entertainment", "rent", "shopping", "car-repair", "donate", "mortgage",
    "insurance", "tax",
  ];
  // Comments are stripped first: a slug NAMED in prose explains the rule, while a
  // slug the code can compare against is the second source of truth AC-13 bans.
  const stripComments = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  const scanned = [];
  for (const file of fs.readdirSync(dir)) {
    const code = stripComments(fs.readFileSync(path.join(dir, file), "utf8"));
    scanned.push(file);
    for (const slug of slugs) {
      for (const quote of ['"', "'", "`"]) {
        assert.ok(
          !code.includes(`${quote}${slug}${quote}`),
          `${file} carries the slug literal ${quote}${slug}${quote}`
        );
      }
    }
  }
  assert.ok(scanned.includes("index.ts"), `the scan really read the source: ${scanned.join(", ")}`);
});
