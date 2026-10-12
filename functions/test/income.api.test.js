// Run with: npm test  (npm run build && node --test test/)
// Income & business earnings. Assertions land on the cells that reach the
// in-memory sheet and on the JSON returned. No live sheet has an Income tab, a
// `business` column on Expenses, or `kind`/`business` on Categories, so every
// test starts from that shape and checks the first write creates what it needs.
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSheets, loadApi, call } = require("./sheetsStub");
const { expenseBusiness } = require("../lib/sheetSchema");
const { runSubscriptionScheduler } = require("../lib/scheduler");

const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at"];
const SUBS_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];
const USERS = { header: ["email", "Users"], rows: [["ijac@example.com", "ijac"]] };

// Categories after the one-time setup: kind and business columns present.
const CATEGORIES = {
  header: ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note", "fixed", "kind", "business"],
  rows: [
    ["cat_001", "Eating Out", "外食", "🍜", "1", "true", "restaurants_accommodation", "", "", "", ""],
    ["cat_015", "Fuel", "加油", "⛽", "15", "true", "transport_communication", "", "", "", ""],
    ["cat_023", "Tenant", "房客支出", "🔧", "23", "true", "housing_utilities", "", "", "", "rent"],
    ["cat_030", "Salary", "薪水", "💼", "30", "true", "", "", "", "income", ""],
    ["cat_031", "Rent received", "房租收入", "🏠", "31", "true", "", "", "", "income", "rent"],
  ],
};

const fixture = (over = {}) => makeSheets({
  Expenses: { header: EXPENSES_HEADER, rows: [
    ["exp-1", "2026-10-01", "850", "cat_023", "ijac", "ijac", "water", "2026-10-01T01:00:00.000Z"],
  ] },
  Subscriptions: { header: SUBS_HEADER, rows: [] },
  Categories: CATEGORIES,
  Users: USERS,
  ...over,
});

const income = { date: "2026-10-05", amount: 85000, category_id: "cat_030", received_by: "ijac", created_by: "ijac", notes: "Oct" };

// ---------------------------------------------------------------------------
// Income tab
// ---------------------------------------------------------------------------

test("GET /api/income before any income exists is an empty list, and creates no tab", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "GET", "/api/income");
  assert.equal(status, 200);
  assert.deepEqual(body, []);
  assert.equal(f.grids.Income, undefined, "a read must not create the tab");
});

test("the first POST /api/income creates the Income tab with its header and writes the row", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  const { status, body } = await call(api, "POST", "/api/income", income);
  assert.equal(status, 201);
  assert.deepEqual(f.grids.Income[0], ["id", "date", "amount", "category_id", "received_by", "created_by", "notes", "created_at"]);
  assert.equal(f.grids.Income.length, 2);
  assert.match(body.id, /^inc-/);
  assert.equal(body.received_by, "ijac");
  assert.equal(body.amount, 85000);

  const list = await call(api, "GET", "/api/income");
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].category_id, "cat_030");
});

test("POST /api/income with an unknown category is a 400 and creates no tab", async () => {
  const f = fixture();
  const { status } = await call(loadApi(f.sheets), "POST", "/api/income", { ...income, category_id: "cat_999" });
  assert.equal(status, 400);
  assert.equal(f.grids.Income, undefined);
});

test("PATCH and DELETE /api/income edit and remove one row", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  const { body: created } = await call(api, "POST", "/api/income", income);

  const patched = await call(api, "PATCH", "/api/income", { id: created.id, amount: 90000, notes: "raise" });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.amount, 90000);
  assert.equal(patched.body.notes, "raise");
  assert.equal(patched.body.created_at, created.created_at, "created_at is not patchable");

  assert.equal((await call(api, "PATCH", "/api/income", { id: "inc-nope", amount: 1 })).status, 404);

  const deleted = await call(api, "DELETE", "/api/income", { id: created.id });
  assert.equal(deleted.status, 200);
  assert.equal(f.grids.Income.length, 1, "only the header is left");
});

// ---------------------------------------------------------------------------
// Business tag on expenses
// ---------------------------------------------------------------------------

test("an expense tagged uber creates the business column and stores the tag", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  const { status, body } = await call(api, "POST", "/api", {
    date: "2026-10-10", amount: 1200, category_id: "cat_015", paid_by: "ijac", created_by: "ijac", notes: "", business: "uber",
  });
  assert.equal(status, 201);
  assert.equal(body.business, "uber");
  const header = f.grids.Expenses[0];
  assert.equal(header[8], "business", "the new column lands right after the last occupied one");
  assert.equal(f.grids.Expenses[1][8], "uber");
});

test("an untagged expense on a sheet without the column creates nothing new", async () => {
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "POST", "/api", {
    date: "2026-10-10", amount: 300, category_id: "cat_001", paid_by: "ijac", created_by: "ijac", notes: "",
  });
  assert.equal(status, 201);
  assert.equal(body.business, "");
  assert.equal(f.grids.Expenses[0].length, 8);
});

test("a business value outside the list is a 400 and writes nothing", async () => {
  const f = fixture();
  const before = JSON.stringify(f.grids);
  const { status } = await call(loadApi(f.sheets), "POST", "/api", {
    date: "2026-10-10", amount: 300, category_id: "cat_001", paid_by: "ijac", created_by: "ijac", business: "taxi",
  });
  assert.equal(status, 400);
  assert.equal(JSON.stringify(f.grids), before);
});

test("PATCH can tag an existing expense, and clear it back to Life", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  const tagged = await call(api, "PATCH", "/api", { id: "exp-1", business: "uber" });
  assert.equal(tagged.status, 200);
  assert.equal(tagged.body.business, "uber");
  const cleared = await call(api, "PATCH", "/api", { id: "exp-1", business: "" });
  assert.equal(cleared.body.business, "");
});

test("expenseBusiness: the expense's own tag wins, else its category's default", () => {
  const defaults = new Map([["cat_023", "rent"], ["cat_015", ""]]);
  assert.equal(expenseBusiness({ category_id: "cat_023" }, defaults), "rent", "past Tenant rows count as Rent");
  assert.equal(expenseBusiness({ category_id: "cat_015" }, defaults), "", "fuel defaults to Life");
  assert.equal(expenseBusiness({ category_id: "cat_015", business: "uber" }, defaults), "uber");
  assert.equal(expenseBusiness({ category_id: "cat_023", business: "uber" }, defaults), "uber", "a tag overrides the default");
});

// ---------------------------------------------------------------------------
// Categories kind / business
// ---------------------------------------------------------------------------

test("a category saved as income with a business creates both columns on a sheet that has neither", async () => {
  const f = fixture({
    Categories: {
      header: ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category", "note"],
      rows: [["cat_001", "Eating Out", "外食", "🍜", "1", "true", "restaurants_accommodation", ""]],
    },
  });
  const { status, body } = await call(loadApi(f.sheets), "POST", "/api/categories", {
    name_en: "Uber", name_zh: "Uber", icon: "🚗", kind: "income", business: "uber",
  });
  assert.equal(status, 201);
  assert.equal(body.kind, "income");
  assert.equal(body.business, "uber");
  assert.deepEqual(f.grids.Categories[0].slice(8), ["kind", "business"]);
});

// ---------------------------------------------------------------------------
// Income subscriptions
// ---------------------------------------------------------------------------

test("a subscription in an income category is logged to the Income tab, not Expenses", async () => {
  const f = fixture({
    Subscriptions: { header: SUBS_HEADER, rows: [
      ["sub-sal", "Salary", "85000", "cat_030", "monthly", "5", "", "ijac", "true"],
      ["sub-net", "Netflix", "390", "cat_001", "monthly", "5", "", "ijac", "true"],
    ] },
  });
  const now = Date.parse("2026-10-05T01:00:00+08:00");
  const result = await runSubscriptionScheduler(f.sheets, "sheet-under-test", now);
  assert.equal(result.created_count, 2);

  const incomeRows = f.grids.Income.slice(1);
  assert.equal(incomeRows.length, 1);
  assert.equal(incomeRows[0][0], "inc-auto-sub-sal-2026-10-05");
  assert.equal(incomeRows[0][4], "ijac", "received_by comes from the subscription's paid_by");

  const expenseIds = f.grids.Expenses.slice(1).map((r) => r[0]);
  assert.ok(expenseIds.includes("exp-auto-sub-net-2026-10-05"));
  assert.ok(!expenseIds.some((id) => id.includes("sub-sal")), "salary is never an expense");

  // A second run the same day writes nothing more.
  const again = await runSubscriptionScheduler(f.sheets, "sheet-under-test", now);
  assert.equal(again.created_count, 0);
  assert.equal(again.skipped_count, 2);
});

// ---------------------------------------------------------------------------
// One-time setup script
// ---------------------------------------------------------------------------

test("apply-income-categories: adds headers, tags Tenant, appends five categories, and a rerun does nothing", async () => {
  const { run } = require("../scripts/apply-income-categories");
  // Production's shape today: `note` data under a blank H1, no kind/business.
  const f = makeSheets({
    Categories: {
      header: ["id", "name_en", "name_zh", "icon", "sort_order", "is_active", "gov_category"],
      rows: [
        ["cat_001", "Eating Out", "外食", "🍜", "1", "true", "restaurants_accommodation", "a note"],
        ["cat_023", "Tenant", "房客支出", "🔧", "23", "true", "housing_utilities"],
      ],
    },
  });
  const env = { SPREADSHEET_ID_STAGING: "sheet-under-test", GOOGLE_SERVICE_ACCOUNT_KEY_STAGING: "{}" };
  const opts = { log: () => {}, env, sheetsFor: async () => f.sheets };

  await run(["--target", "staging", "--apply"], opts);
  const [header, ...rows] = f.grids.Categories;
  assert.deepEqual(header.slice(8, 10), ["kind", "business"], "past the note data in H, never over it");
  assert.equal(rows[0][7], "a note", "the unnamed note column is untouched");
  assert.equal(rows[1][9], "rent", "Tenant fills in rent");
  assert.deepEqual(rows.slice(2).map((r) => [r[0], r[1], r[8], r[9]]), [
    ["cat_024", "Rent paid", "expense", "rent"],
    ["cat_025", "Salary", "income", ""],
    ["cat_026", "Uber", "income", "uber"],
    ["cat_027", "Rent received", "income", "rent"],
    ["cat_028", "Random", "income", ""],
  ]);

  const before = JSON.stringify(f.grids);
  await run(["--target", "staging", "--apply"], opts);
  assert.equal(JSON.stringify(f.grids), before, "a second apply writes nothing");
});

// ---------------------------------------------------------------------------
// Subscriptions carry a For tag onto the expenses they log
// ---------------------------------------------------------------------------

test("a subscription tagged uber stores the tag, and its logged expense carries it", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  const created = await call(api, "POST", "/api/subscriptions", {
    name: "Car wash plan", amount: 750, category_id: "cat_015", frequency: "monthly", due_day: 12,
    paid_by: "ijac", start_date: "2026-10-01", notes: "", business: "uber",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.business, "uber");

  await runSubscriptionScheduler(f.sheets, "sheet-under-test", Date.parse("2026-10-12T01:00:00+08:00"));
  const header = f.grids.Expenses[0];
  const logged = f.grids.Expenses.find((r) => String(r[0]).startsWith(`exp-auto-${created.body.id}`));
  assert.ok(logged, "the expense was logged");
  assert.equal(logged[header.indexOf("business")], "uber");
});

test("an untagged subscription creates no business column on either tab", async () => {
  const f = fixture();
  const api = loadApi(f.sheets);
  const created = await call(api, "POST", "/api/subscriptions", {
    name: "Netflix", amount: 390, category_id: "cat_001", frequency: "monthly", due_day: 12, paid_by: "ijac", start_date: "2026-10-01",
  });
  assert.equal(created.body.business, "");
  await runSubscriptionScheduler(f.sheets, "sheet-under-test", Date.parse("2026-10-12T01:00:00+08:00"));
  assert.ok(!f.grids.Subscriptions[0].includes("business"));
  assert.ok(!f.grids.Expenses[0].includes("business"));
});

test("PATCH can change a subscription's tag, and rejects an unknown one", async () => {
  const f = fixture({ Subscriptions: { header: SUBS_HEADER, rows: [["sub-x", "Gas", "900", "cat_015", "monthly", "3", "", "ijac", "true"]] } });
  const api = loadApi(f.sheets);
  assert.equal((await call(api, "PATCH", "/api/subscriptions", { id: "sub-x", business: "taxi" })).status, 400);
  const ok = await call(api, "PATCH", "/api/subscriptions", { id: "sub-x", business: "uber" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.business, "uber");
});

test("an explicit life tag on a Rent-default category counts as Life", async () => {
  const defaults = new Map([["cat_023", "rent"]]);
  assert.equal(expenseBusiness({ category_id: "cat_023", business: "life" }, defaults), "");
  const f = fixture();
  const { status, body } = await call(loadApi(f.sheets), "PATCH", "/api", { id: "exp-1", business: "life" });
  assert.equal(status, 200);
  assert.equal(body.business, "life");
});
