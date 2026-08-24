// Run with: npm test
// AC-12. Every consumer already resolves through resolveCategory(), so a stored
// `cat_NNN` should take the direct live-id branch. That is the assumption the
// migration bets the production sheet on, and nothing exercised it end to end:
// the existing render tests are built on a fixture that is mostly legacy slugs,
// which travel the bridge branch instead. These mount the real surfaces against
// a fixture in the state the migration LEAVES the sheet — every id already live —
// and assert no raw id and no placeholder icon reaches the DOM.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const {
  CATEGORIES,
  expense,
  installGlobals,
  mockAuth,
  mount,
  iconForRow,
} = require("./helpers/dom.js");

const FALLBACK = "💰";

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

// The post-migration Expenses tab: 100% live `cat_NNN`, zero slugs. cat_015 is
// archived and cat_099 has a blank icon cell — both survive the migration
// untouched, so both still have to render.
const MIGRATED_EXPENSES = [
  expense("m1", "cat_001", "mig-eating-out"),
  expense("m2", "cat_003", "mig-groceries"),
  expense("m3", "cat_015", "mig-archived"),
  expense("m4", "cat_099", "mig-blank-icon"),
];

// The post-migration Subscriptions tab, same shape.
const MIGRATED_SUBSCRIPTIONS = [
  { id: "sub-1", name: "Netflix", amount: 390, category_id: "cat_001", frequency: "monthly", due_day: 15, paid_by: "Karen", is_active: true, start_date: "2026-03-01", end_date: "" },
  { id: "sub-2", name: "Spotify", amount: 149, category_id: "cat_003", frequency: "monthly", due_day: 1, paid_by: "Karen", is_active: true, start_date: "", end_date: "" },
  { id: "sub-3", name: "iCloud", amount: 30, category_id: "cat_015", frequency: "monthly", due_day: 20, paid_by: "Karen", is_active: false, start_date: "", end_date: "" },
];

const migrated = (extra = {}) =>
  installGlobals({ expenses: MIGRATED_EXPENSES, subscriptions: MIGRATED_SUBSCRIPTIONS, ...extra });

test("AC-12: History renders every migrated row from the live sheet", async () => {
  migrated();
  const container = await mount(loadPage("history/page.js"));

  assert.equal(iconForRow(container, "mig-eating-out"), "🍕");
  assert.equal(iconForRow(container, "mig-groceries"), "🥕");
  // Archived categories are excluded from the picker but must still resolve.
  assert.equal(iconForRow(container, "mig-archived"), "🛢️");
  // A blank icon cell is the one legitimate placeholder — never an empty glyph.
  assert.equal(iconForRow(container, "mig-blank-icon"), FALLBACK);

  // The migration's whole point: not one stored id is visible as text.
  assert.doesNotMatch(container.textContent, /cat_0\d\d/);
  for (const name of ["Eating Out", "Groceries", "Fuel", "Blank Icon"]) {
    assert.ok(container.textContent.includes(name), `${name} rendered`);
  }
});

test("AC-12: the expense edit sheet resolves a migrated id", async () => {
  migrated();
  const container = await mount(loadPage("history/page.js"));

  const row = [...container.querySelectorAll("button")].find((b) =>
    b.textContent.includes("mig-eating-out")
  );
  await React.act(async () => {
    row.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

  // ExpenseEditSheet portals to document.body, outside the mount container.
  const sheet = global.document.body;
  assert.equal(sheet.querySelector(".text-3xl").textContent, "🍕");
  assert.ok(sheet.textContent.includes("Eating Out"), "live name in the sheet");
});

test("AC-12: Subscriptions cards resolve migrated ids", async () => {
  migrated();
  mockAuth();
  const container = await mount(loadPage("subscriptions/page.js"));

  assert.equal(iconForRow(container, "Netflix"), "🍕");
  assert.equal(iconForRow(container, "Spotify"), "🥕");
  // A cancelled subscription on an archived category — the corner where both
  // filters could have hidden the category.
  assert.equal(iconForRow(container, "iCloud"), "🛢️");
  assert.doesNotMatch(container.textContent, /cat_0\d\d/);
});

test("AC-12: the Reports category breakdown names migrated ids", async () => {
  migrated();
  const { getMonthlySummary } = require("../.test-build-ui/lib/reportService.js");
  const summary = await getMonthlySummary(2026, 8);

  const byId = Object.fromEntries(summary.categories.map((c) => [c.category_id, c]));

  // getCatMeta falls back to the raw id for both names when resolution misses, so
  // a name equal to its own id is exactly the failure this AC rules out.
  assert.equal(byId.cat_001.category_name, "Eating Out");
  assert.equal(byId.cat_001.category_name_zh, "外食");
  assert.equal(byId.cat_001.icon, "🍕");
  assert.equal(byId.cat_003.category_name, "Groceries");
  assert.equal(byId.cat_015.category_name, "Fuel");
  assert.equal(byId.cat_015.icon, "🛢️");
  for (const c of summary.categories) {
    assert.notEqual(c.category_name, c.category_id, `${c.category_id} resolved to a name`);
  }
});

test("AC-12: the Reports drill-down lists migrated rows under the live category", async () => {
  migrated();
  const { getExpensesByCategory } = require("../.test-build-ui/lib/reportService.js");
  const rows = await getExpensesByCategory(2026, 8, "cat_001");

  // The drill-down queries by the stored id. Pre-migration this same call with
  // "cat_001" returned nothing, because the rows were filed under "eating-out".
  assert.equal(rows.length, 1);
  assert.equal(rows[0].category_name, "Eating Out");
  assert.equal(rows[0].notes, "mig-eating-out");
});

test("AC-12: a migrated sheet is unchanged by a Category Management rename", async () => {
  const { categories, setCategoryIcon } = migrated();
  const container = await mount(loadPage("history/page.js"));
  assert.equal(iconForRow(container, "mig-eating-out"), "🍕");

  // The rename that used to break the bridge silently. Post-migration the row
  // matches on id, so renaming the category renames the label and nothing else
  // — this is the failure mode the entity exists to eliminate.
  categories.find((c) => c.id === "cat_001").name_en = "Dining Out";
  setCategoryIcon("cat_001", "🥗");
  await React.act(async () => {
    global.window.dispatchEvent(new global.window.Event("popstate"));
  });
  await React.act(async () => {});

  assert.equal(iconForRow(container, "mig-eating-out"), "🥗");
  assert.ok(container.textContent.includes("Dining Out"), "renamed label reached the row");
  assert.doesNotMatch(container.textContent, /cat_0\d\d/);
});

test("AC-12: the fixture is genuinely post-migration", () => {
  // Guards the tests above: if someone reintroduces a slug into the fixture, the
  // assertions would start passing through resolveCategory's bridge branch again
  // and would stop proving anything about the migrated state.
  const live = new Set(CATEGORIES.map((c) => c.id));
  for (const e of MIGRATED_EXPENSES) assert.ok(live.has(e.category_id), e.category_id);
  for (const s of MIGRATED_SUBSCRIPTIONS) assert.ok(live.has(s.category_id), s.category_id);
});
