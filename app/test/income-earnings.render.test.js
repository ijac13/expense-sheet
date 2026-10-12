// Run with: npm test
// Income & business earnings. Drives the real reportService and the real Home
// and History pages against the fetch stub, so assertions land on the numbers
// Reports renders and on the request bodies that left the page.
// `t()` echoes its key here, so copy is asserted as the key plus a check that
// both locales define it.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, expense } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");

mockAuth();

const lib = (name) => require(`../.test-build-ui/lib/${name}.js`);
const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

const click = (el) =>
  React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
const buttons = (c) => [...c.querySelectorAll("button")];
const byText = (c, text) => buttons(c).find((b) => b.textContent.includes(text));
const key = (c, k) => buttons(c).find((b) => b.textContent === k);

// Production shape after the one-time setup.
const CATEGORIES = [
  { id: "cat_001", name_en: "Eating Out", name_zh: "外食", icon: "🍕", sort_order: 1, is_active: true },
  { id: "cat_015", name_en: "Fuel", name_zh: "加油", icon: "⛽", sort_order: 15, is_active: true },
  { id: "cat_023", name_en: "Tenant", name_zh: "房客支出", icon: "🔧", sort_order: 23, is_active: true, business: "rent" },
  { id: "cat_026", name_en: "Rent paid", name_zh: "房租支出", icon: "🏠", sort_order: 26, is_active: true, business: "rent" },
  { id: "cat_030", name_en: "Salary", name_zh: "薪水", icon: "💼", sort_order: 30, is_active: true, kind: "income" },
  { id: "cat_031", name_en: "Uber", name_zh: "Uber", icon: "🚗", sort_order: 31, is_active: true, kind: "income", business: "uber" },
  { id: "cat_032", name_en: "Rent received", name_zh: "房租收入", icon: "🏠", sort_order: 32, is_active: true, kind: "income", business: "rent" },
  { id: "cat_033", name_en: "Random", name_zh: "雜項收入", icon: "✨", sort_order: 33, is_active: true, kind: "income" },
];

const row = (id, category_id, amount, date, extra = {}) =>
  ({ ...expense(id, category_id, ""), amount, date, paid_by: "ijac", ...extra });
const inc = (id, category_id, amount, date) =>
  ({ id, category_id, amount, date, received_by: "ijac", created_by: "ijac", notes: "", created_at: `${date}T00:00:00.000Z` });

const EXPENSES = [
  row("e1", "cat_001", 31850, "2026-10-03"),                       // Life
  row("e2", "cat_026", 30000, "2026-10-01"),                       // Rent paid: Rent by default
  row("e3", "cat_023", 2450, "2026-10-10"),                        // Tenant: Rent by default
  row("e4", "cat_015", 2400, "2026-10-08", { business: "uber" }),  // fuel for driving
  row("e5", "cat_015", 900, "2026-10-09"),                         // fuel for daily use: Life
  row("a1", "cat_026", 30000, "2026-08-01"),                       // August: the water heater month
  row("a2", "cat_023", 8900, "2026-08-20"),
];
const INCOMES = [
  inc("i1", "cat_030", 85000, "2026-10-05"),
  inc("i2", "cat_031", 12800, "2026-10-10"),
  inc("i3", "cat_032", 38000, "2026-10-01"),
  inc("i4", "cat_033", 6000, "2026-10-11"),
  inc("i5", "cat_032", 37700, "2026-08-01"),
];

// ---------------------------------------------------------------------------
// Reports: business costs leave Life
// ---------------------------------------------------------------------------

test("the monthly total is Life only; Rent and Uber costs sit in their own groups", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES, incomes: INCOMES });
  const { getMonthlySummary } = lib("reportService");
  const s = await getMonthlySummary(2026, 10, "all", new Date(2026, 9, 31));

  assert.equal(s.total, 31850 + 900, "eating out and daily fuel only");
  assert.equal(s.groups.rent.total, 30000 + 2450, "rent paid and tenant");
  assert.equal(s.groups.uber.total, 2400, "Uber fuel");
  assert.equal(s.groups.fixed.total + s.groups.big_extra.total + s.groups.living.total, s.total);
  assert.deepEqual(
    s.groups.rent.categories.map((c) => c.category_id).sort(),
    ["cat_023", "cat_026"]
  );
  assert.deepEqual(s.groups.uber.categories.map((c) => c.category_id), ["cat_015"]);
  assert.ok(!s.groups.living.categories.some((c) => c.category_id === "cat_023"), "Tenant is never Living");
  assert.equal(s.payers.reduce((n, p) => n + p.total, 0), s.total, "By payer counts Life only");
});

test("an untagged fuel stays Life while a tagged one goes to Uber", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES, incomes: INCOMES });
  const { getExpensesByCategory } = lib("reportService");
  const life = await getExpensesByCategory(2026, 10, "cat_015", "all", "living");
  const biz = await getExpensesByCategory(2026, 10, "cat_015", "all", "uber");
  assert.deepEqual(life.map((e) => e.id), ["e5"]);
  assert.deepEqual(biz.map((e) => e.id), ["e4"]);
});

test("the annual trend and total are Life only too", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES, incomes: INCOMES });
  const { getAnnualSummary } = lib("reportService");
  const a = await getAnnualSummary(2026, "all", new Date(2026, 11, 31));
  assert.equal(a.total, 32750);
  assert.equal(a.monthly_trend[7].total, 0, "August held only Rent costs");
  assert.equal(a.groups.rent.total, 30000 + 2450 + 30000 + 8900);
  assert.equal(a.groups.uber.total, 2400);
});

// ---------------------------------------------------------------------------
// Income & earnings
// ---------------------------------------------------------------------------

test("earnings: cards in income-category order, each business netted, money in = plain income + earnings", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES, incomes: INCOMES });
  const { getEarningsSummary } = lib("reportService");
  const e = await getEarningsSummary(2026, 10);

  assert.deepEqual(
    e.cards.map((c) => (c.type === "business" ? c.business : c.category_id)),
    ["cat_030", "uber", "rent", "cat_033"],
    "Salary, Uber, Rent, Random"
  );
  const rent = e.cards.find((c) => c.business === "rent");
  assert.equal(rent.income_total, 38000);
  assert.equal(rent.costs_total, 32450);
  assert.equal(rent.earnings, 5550);
  const uber = e.cards.find((c) => c.business === "uber");
  assert.equal(uber.earnings, 12800 - 2400);

  assert.equal(e.money_in, 85000 + 10400 + 5550 + 6000);
  assert.equal(e.spending, 32750, "the same Life total Reports shows");
  assert.equal(e.left_over, e.money_in - e.spending);
});

test("earnings: a month with a loss is negative, and the trend shows it", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES, incomes: INCOMES });
  const { getEarningsSummary } = lib("reportService");
  const aug = await getEarningsSummary(2026, 8);
  const rent = aug.cards.find((c) => c.business === "rent");
  assert.equal(rent.earnings, 37700 - 30000 - 8900, "−1,200");

  const oct = await getEarningsSummary(2026, 10);
  const trend = oct.cards.find((c) => c.business === "rent").trend;
  assert.deepEqual(trend.map((p) => p.label), ["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
  assert.equal(trend[3].earnings, -1200);
  assert.equal(trend[5].earnings, 5550);
});

test("earnings for a whole year charts all twelve months", async () => {
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES, incomes: INCOMES });
  const { getEarningsSummary } = lib("reportService");
  const y = await getEarningsSummary(2026, null);
  const rent = y.cards.find((c) => c.business === "rent");
  assert.equal(rent.trend.length, 12);
  assert.equal(rent.earnings, 5550 - 1200);
});

// ---------------------------------------------------------------------------
// Home: Expense / Income and the For row
// ---------------------------------------------------------------------------

async function mountHome(opts = {}) {
  const g = installGlobals({ categories: CATEGORIES, expenses: [], incomes: [], ...opts });
  global.localStorage.clear();
  const container = await mount(loadPage("page.js"));
  return { ...g, container };
}

test("Home starts in Expense mode with only expense categories and Life selected", async () => {
  const { container } = await mountHome();
  assert.ok(byText(container, "Eating Out"));
  assert.ok(!byText(container, "Salary"), "income categories stay off the expense grid");
  const forRow = container.querySelector('[data-testid="for-row"]');
  assert.ok(forRow);
  const pressed = [...forRow.querySelectorAll("button")].find((b) => b.getAttribute("aria-pressed") === "true");
  assert.match(pressed.textContent, /home\.for_life/);
});

test("picking Rent paid fills in Rent, and the expense follows its category's default", async () => {
  const { container, expWrites } = await mountHome();
  await click(byText(container, "Rent paid"));
  const forRow = container.querySelector('[data-testid="for-row"]');
  const pressed = [...forRow.querySelectorAll("button")].find((b) => b.getAttribute("aria-pressed") === "true");
  assert.match(pressed.textContent, /earnings\.business_rent/);
  await click(key(container, "3"));
  await click(byText(container, "home.save"));
  assert.equal(expWrites.length, 1);
  assert.equal(expWrites[0].body.category_id, "cat_026");
  assert.equal(expWrites[0].body.business, "", "matches the default, so nothing extra is stored");
});

test("choosing Life on Tenant stores an explicit life override", async () => {
  const { container, expWrites } = await mountHome();
  await click(byText(container, "Tenant"));
  const forRow = container.querySelector('[data-testid="for-row"]');
  await click([...forRow.querySelectorAll("button")].find((b) => b.textContent.includes("home.for_life")));
  await click(key(container, "5"));
  await click(byText(container, "home.save"));
  assert.equal(expWrites[0].body.business, "life");

  const { businessOf } = lib("categories");
  assert.equal(businessOf({ category_id: "cat_023", business: "life" }, CATEGORIES), "", "counts as Life");
  assert.equal(businessOf({ category_id: "cat_023", business: "" }, CATEGORIES), "rent", "blank follows the default");
});

test("the For row offers Life, Uber, Rent in that order", async () => {
  const { container } = await mountHome();
  const labels = [...container.querySelectorAll('[data-testid="for-row"] button')].map((b) => b.textContent);
  assert.deepEqual(labels.map((l) => l.replace(/^\S+ /, "")), ["home.for_life", "earnings.business_uber", "earnings.business_rent"]);
});

test("tapping Uber on fuel posts the fuel tagged uber", async () => {
  const { container, expWrites } = await mountHome();
  await click(byText(container, "Fuel"));
  const forRow = container.querySelector('[data-testid="for-row"]');
  await click([...forRow.querySelectorAll("button")].find((b) => b.textContent.includes("earnings.business_uber")));
  await click(key(container, "7"));
  await click(byText(container, "home.save"));
  assert.equal(expWrites[0].body.category_id, "cat_015");
  assert.equal(expWrites[0].body.business, "uber");
});

test("Income mode shows income categories in order, hides the For row, and saves to /api/income", async () => {
  const { container, incWrites, expWrites } = await mountHome();
  const mode = container.querySelector('[data-testid="entry-mode"]');
  await click([...mode.querySelectorAll("button")].find((b) => b.textContent === "home.mode_income"));

  assert.ok(!container.querySelector('[data-testid="for-row"]'), "no For row for income");
  // Each tile is [icon box, label]; the label is its last child.
  const tiles = buttons(container).filter((b) => b.querySelector(".text-2xl")).map((b) => b.lastElementChild.textContent);
  assert.deepEqual(tiles, ["Salary", "Uber", "Rent received", "Random"]);

  await click(key(container, "9"));
  await click(byText(container, "home.save_income"));
  assert.equal(expWrites.length, 0, "nothing was written as an expense");
  assert.equal(incWrites.length, 1);
  assert.equal(incWrites[0].body.category_id, "cat_030");
  assert.equal(incWrites[0].body.amount, 9);
});

// ---------------------------------------------------------------------------
// History: income rows show, but are not summed as spending
// ---------------------------------------------------------------------------

test("History lists income with a +, tags business expenses, and day totals stay spending only", async () => {
  installGlobals({
    categories: CATEGORIES,
    expenses: [row("h1", "cat_023", 850, "2026-10-10"), row("h2", "cat_001", 300, "2026-10-10")],
    incomes: [inc("h3", "cat_031", 3200, "2026-10-10")],
  });
  const container = await mount(loadPage("history/page.js"));
  await React.act(async () => {});

  assert.match(container.textContent, /\+NT\$3,200/);
  assert.ok(container.querySelector('[data-testid="row-business"]'), "the Tenant row shows its Rent tag");
  assert.match(container.textContent, /NT\$1,150/, "the day total is 850 + 300, without the Uber income");
});

// ---------------------------------------------------------------------------
// Copy exists in both locales
// ---------------------------------------------------------------------------

test("every new label is defined in English and Chinese", () => {
  const keys = [
    "home.mode_expense", "home.mode_income", "home.for", "home.for_life", "home.save_income",
    "history.received_by", "history.kind_all", "history.kind_expense", "history.kind_income",
    "reports.life_only", "reports.include_business", "reports.group_rent", "reports.group_uber",
    "earnings.title", "earnings.money_in", "earnings.spending", "earnings.left_over", "earnings.money_in_hint",
    "earnings.business_rent", "earnings.business_uber", "earnings.earnings_rent", "earnings.earnings_uber",
    "earnings.costs", "earnings.load_failed", "earnings.empty",
    "cat_mgmt.kind_label", "cat_mgmt.business_label", "cat_mgmt.business_hint",
  ];
  const get = (o, k) => k.split(".").reduce((x, p) => x?.[p], o);
  for (const k of keys) {
    assert.ok(get(EN, k), `en ${k}`);
    assert.ok(get(ZH, k), `zh ${k}`);
  }
});

test("an old backend answering /api/income with expenses shows no income at all", async () => {
  // The old API falls through to GET all expenses for any path it does not know.
  installGlobals({ categories: CATEGORIES, expenses: EXPENSES, incomes: EXPENSES });
  const { getSharedIncomes } = lib("incomes");
  assert.deepEqual(await getSharedIncomes(), []);
});

// ---------------------------------------------------------------------------
// Reports: the Income & earnings row sits under the total and shows 結餘 only
// ---------------------------------------------------------------------------

test("Reports puts the Income & earnings row right under the total, showing only what is left over", async () => {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  installGlobals({
    categories: CATEGORIES,
    expenses: [row("r1", "cat_001", 1000, today), row("r2", "cat_026", 30000, today)],
    incomes: [inc("r3", "cat_030", 5000, today), inc("r4", "cat_032", 38000, today)],
  });
  const container = await mount(loadPage("reports/page.js"));
  await React.act(async () => {});
  await React.act(async () => {});

  const link = container.querySelector('[data-testid="earnings-link"]');
  assert.ok(link, "the row is on the page");
  assert.ok(
    link.previousElementSibling.querySelector('[data-testid="scope-toggle"]'),
    "it follows the total spending card directly"
  );
  // Money in 5,000 + Rent earnings 8,000 = 13,000, less Life spending 1,000.
  assert.equal(link.querySelector('[data-testid="earnings-left-over"]').textContent, "+NT$12,000");
  assert.ok(!/earnings\.money_in/.test(link.textContent), "no breakdown on the row itself");
});

// ---------------------------------------------------------------------------
// Subscriptions: a For choice, carried to the expenses the logger creates
// ---------------------------------------------------------------------------

test("a subscription on Fuel can be set to Uber, and income categories show no For choice", async () => {
  const g = installGlobals({ categories: CATEGORIES, subscriptions: [] });
  const container = await mount(loadPage("subscriptions/page.js"));
  await click([...container.querySelectorAll("button")].find((b) => b.className.includes("btn-primary")));
  const modal = container.querySelector(".modal-open");

  const setValue = (el, value, event = "input") => React.act(async () => {
    const proto = el.tagName === "SELECT" ? global.window.HTMLSelectElement.prototype : global.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new global.window.Event(event, { bubbles: true }));
  });
  const categorySelect = [...modal.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "cat_015"));

  await setValue(categorySelect, "cat_030", "change");
  assert.ok(!modal.querySelector('[data-testid="add-sub-for"]'), "Salary is income: no For");

  await setValue(categorySelect, "cat_015", "change");
  const forPicker = modal.querySelector('[data-testid="add-sub-for"]');
  assert.ok(forPicker);
  await click([...forPicker.querySelectorAll("button")].find((b) => b.textContent.includes("earnings.business_uber")));

  await setValue(modal.querySelector('input[placeholder="e.g. Netflix"]'), "Car wash plan");
  await setValue(modal.querySelector('input[type="number"]'), "750");
  await click([...modal.querySelectorAll("button")].find((b) => b.textContent.trim() === "subscriptions.add"));

  assert.equal(g.subWrites.length, 1);
  assert.equal(g.subWrites[0].body.category_id, "cat_015");
  assert.equal(g.subWrites[0].body.business, "uber");
});

test("History's Uber and Rent filters show that business's income and costs, totalled as the net", async () => {
  installGlobals({
    categories: CATEGORIES,
    expenses: [
      row("k1", "cat_023", 850, "2026-10-10"),                        // Tenant: Rent
      row("k2", "cat_015", 1200, "2026-10-10", { business: "uber" }), // Uber fuel
      row("k3", "cat_001", 300, "2026-10-10"),                        // Life
    ],
    incomes: [inc("k4", "cat_032", 38000, "2026-10-10"), inc("k5", "cat_031", 3200, "2026-10-10")],
  });
  const container = await mount(loadPage("history/page.js"));
  await React.act(async () => {});
  const chips = [...container.querySelectorAll('[data-testid="kind-filter"] button')];
  assert.deepEqual(chips.map((b) => b.textContent.replace(/^\S+ /, "")), [
    "history.kind_all", "history.kind_expense", "history.kind_income", "earnings.business_uber", "earnings.business_rent",
  ]);

  await click(chips.find((b) => b.textContent.includes("business_rent")));
  assert.match(container.textContent, /\+NT\$38,000/);
  assert.match(container.textContent, /NT\$850/);
  assert.doesNotMatch(container.textContent, /NT\$1,200|NT\$300/, "no Uber or Life rows");
  assert.equal(container.querySelector('[data-testid="month-total"]').textContent, "+NT$37,150");

  await click(chips.find((b) => b.textContent.includes("business_uber")));
  assert.equal(container.querySelector('[data-testid="month-total"]').textContent, "+NT$2,000");
});
