// Run with: npm test
// Entity 071, AC-1/AC-2/AC-3/AC-7. Drives the real reportService against the
// fetch stub, so every assertion lands on the summary the Annual page renders
// from — not on a helper re-implemented here. See test/helpers/dom.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const { installGlobals, expense } = require("./helpers/dom.js");

const lib = (name) => require(`../.test-build-ui/lib/${name}.js`);

// Production-shaped live list: cat_NNN ids, `fixed` absent (never set) on all.
const CATEGORIES = [
  { id: "cat_001", name_en: "Eating Out", name_zh: "外食", icon: "🍕", sort_order: 1, is_active: true },
  { id: "cat_003", name_en: "Groceries", name_zh: "食材", icon: "🥕", sort_order: 3, is_active: true },
  { id: "cat_005", name_en: "Travel", name_zh: "旅遊", icon: "✈️", sort_order: 5, is_active: true },
  { id: "cat_008", name_en: "Babies", name_zh: "寶貝", icon: "👶", sort_order: 8, is_active: true },
  { id: "cat_012", name_en: "Tuition", name_zh: "學費", icon: "📚", sort_order: 12, is_active: true },
  { id: "cat_021", name_en: "Mortgage", name_zh: "房貸", icon: "🏡", sort_order: 21, is_active: true },
  { id: "cat_023", name_en: "Insurance", name_zh: "保險", icon: "🛡️", sort_order: 23, is_active: true },
];

const row = (id, category_id, notes, amount, paid_by, date = "2026-05-01") =>
  ({ ...expense(id, category_id, notes), amount, paid_by, date });

const EXPENSES = [
  row("f1", "cat_023", "壽險", 10000, "ijac"),
  row("f2", "insurance", "車險", 5000, "wei"),         // legacy slug -> live cat_023
  row("f3", "cat_023", "#大筆 年繳", 2000, "ijac"),     // keyword in a fixed category
  row("b1", "cat_005", "日本機票 #大筆 x4", 30000, "wei"), // keyword mid-note
  row("b2", "cat_005", "＃大筆", 800, "ijac"),          // full-width hash
  row("l1", "cat_005", "大筆", 1200, "ijac"),           // no hash: not the keyword
  row("l2", "cat_001", "lunch", 300, "wei"),
  row("l3", "cat_777", "orphan", 50, "ijac"),           // resolves to no category
  row("l4", "eating-out", "", 200, "ijac"),
  row("x1", "cat_001", "#大筆", 99999, "ijac", "2025-12-31"), // other year
];

const sum = (xs) => xs.reduce((s, x) => s + x.total, 0);
const sumAmounts = (xs) => xs.reduce((s, x) => s + x.amount, 0);

test("AC-1: Fixed + Big extras + Living equals the year total, for all payers and each payer", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES });
  const { getAnnualSummary } = lib("reportService");

  const all = await getAnnualSummary(2026, "all");
  assert.equal(all.total, 49550);
  assert.equal(all.groups.fixed.total, 17000, "f1 + f2 + f3");
  assert.equal(all.groups.big_extra.total, 30800, "b1 + b2");
  assert.equal(all.groups.living.total, 1750, "l1..l4, including the unresolvable cat_777");

  for (const payer of ["all", "user1", "user2"]) {
    const s = await getAnnualSummary(2026, payer);
    const g = s.groups;
    assert.equal(g.fixed.total + g.big_extra.total + g.living.total, s.total, `groups sum to the total for ${payer}`);
    assert.equal(sum(g.fixed.categories), g.fixed.total, `fixed rows add up for ${payer}`);
    assert.equal(sumAmounts(g.big_extra.expenses), g.big_extra.total, `big-extra lines add up for ${payer}`);
    assert.equal(sum(g.living.categories), g.living.total, `living rows add up for ${payer}`);
  }
  const ijac = await getAnnualSummary(2026, "user1");
  assert.deepEqual(
    [ijac.groups.fixed.total, ijac.groups.big_extra.total, ijac.groups.living.total],
    [12000, 800, 1450],
    "the payer filter applies to every group"
  );
});

test("AC-2: blank switch defaults to fixed by name for Insurance/Babies/Mortgage/Tuition only", () => {
  installGlobals();
  const { isFixedCategory } = lib("categories");
  const byName = (n) => CATEGORIES.find((c) => c.name_en === n);

  for (const n of ["Insurance", "Babies", "Mortgage", "Tuition"]) {
    assert.equal(isFixedCategory(byName(n)), true, `${n} defaults to fixed`);
    assert.equal(isFixedCategory({ ...byName(n), fixed: null }), true, `${n} with a null cell defaults to fixed`);
  }
  for (const n of ["Eating Out", "Groceries", "Travel"]) {
    assert.equal(isFixedCategory(byName(n)), false, `${n} defaults to not fixed`);
  }
  assert.equal(isFixedCategory({ ...byName("Groceries"), fixed: true }), true, "a stored true wins");
  assert.equal(isFixedCategory({ ...byName("Insurance"), fixed: false }), false, "a stored false wins over the default");
  assert.equal(isFixedCategory(undefined), false, "an unresolvable category is not fixed");
});

test("AC-2: the stored switch drives grouping, and a legacy slug follows its live category's switch", async () => {
  const categories = CATEGORIES.map((c) =>
    c.id === "cat_003" ? { ...c, fixed: true } : c.id === "cat_023" ? { ...c, fixed: false } : c
  );
  installGlobals({
    categories,
    expenses: [
      row("g1", "cat_003", "veg", 400, "ijac"),
      row("i1", "insurance", "legacy slug", 700, "ijac"),
      row("i2", "cat_023", "live id", 900, "ijac"),
    ],
  });
  const { getAnnualSummary } = lib("reportService");

  const { groups } = await getAnnualSummary(2026, "all");
  assert.equal(groups.fixed.total, 400, "Groceries switched on counts as Fixed");
  assert.deepEqual(groups.fixed.categories.map((c) => c.category_id), ["cat_003"]);
  assert.equal(groups.living.total, 1600, "Insurance switched off moves to Living — slug and live id alike");
});

test("AC-3: keyword rule — anywhere in a non-fixed note, either hash; fixed category wins", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES });
  const { getAnnualSummary } = lib("reportService");

  const { groups } = await getAnnualSummary(2026, "all");
  assert.deepEqual(
    groups.big_extra.expenses.map((e) => e.id).sort(),
    ["b1", "b2"],
    "\"日本機票 #大筆 x4\" and \"＃大筆\" in Travel are big extras; \"大筆\" without a hash is not"
  );
  // f3 carries the keyword but sits in Insurance: its 2000 stays in Fixed.
  assert.equal(groups.fixed.categories.find((c) => c.category_id === "cat_023").total, 12000);
  const travelLiving = groups.living.categories.find((c) => c.category_id === "cat_005");
  assert.equal(travelLiving.total, 1200, "Travel's living amount excludes its big extras");
  assert.equal(groups.big_extra.expenses[0].id, "b1", "big extras are listed largest first");
  assert.equal(groups.big_extra.expenses[0].notes, "日本機票 #大筆 x4");
  assert.equal(groups.big_extra.expenses[0].category_name, "Travel");
});

test("AC-6 (service): the living drill-down lists exactly the expenses behind the living row", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES });
  const { getExpensesByCategory } = lib("reportService");

  const living = await getExpensesByCategory(2026, null, "cat_005", "all", "living");
  assert.deepEqual(living.map((e) => e.id), ["l1"]);
  const unfiltered = await getExpensesByCategory(2026, null, "cat_005", "all");
  assert.deepEqual(unfiltered.map((e) => e.id).sort(), ["b1", "b2", "l1"], "no group = today's drill-down");
});

test("AC-7: saving a category's switch is reflected on the next Annual load, without a reload", async () => {
  const g = installGlobals({ categories: CATEGORIES, expenses: [row("g1", "cat_003", "veg", 400, "ijac")] });
  const { getAnnualSummary } = lib("reportService");
  const { updateCategory } = lib("categoryService");
  const categoryGets = () => g.getRequests.filter((h) => h === "/api/categories").length;

  const before = await getAnnualSummary(2026, "all");
  assert.equal(before.groups.living.total, 400);
  await getAnnualSummary(2026, "all");
  const fetchesBeforeSave = categoryGets();

  await updateCategory("cat_003", { fixed: true });
  const after = await getAnnualSummary(2026, "all");
  assert.equal(categoryGets(), fetchesBeforeSave + 1, "the save cleared the session cache, so categories were refetched");
  assert.equal(after.groups.fixed.total, 400, "Groceries moved to Fixed");
  assert.equal(after.groups.living.total, 0);
});
