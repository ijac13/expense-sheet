// Run with: npm test
// Entity 071, AC-5/AC-6. Mounts the real Reports page on Annual and reads what
// the captain sees: the three group totals, the group donut, each group's rows,
// where the block sits, and what a tap on a row drills into.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, expense } = require("./helpers/dom.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

const YEAR = new Date().getFullYear();

const CATEGORIES = [
  { id: "cat_001", name_en: "Eating Out", name_zh: "外食", icon: "🍕", sort_order: 1, is_active: true },
  { id: "cat_005", name_en: "Travel", name_zh: "旅遊", icon: "✈️", sort_order: 5, is_active: true },
  { id: "cat_023", name_en: "Insurance", name_zh: "保險", icon: "🛡️", sort_order: 23, is_active: true },
];

const row = (id, category_id, notes, amount) =>
  ({ ...expense(id, category_id, notes), amount, paid_by: "ijac", date: `${YEAR}-01-15` });

const EXPENSES = [
  row("f1", "cat_023", "壽險", 10000),
  row("b1", "cat_005", "日本機票 #大筆", 30000),
  row("l1", "cat_005", "高鐵", 1200),
  row("l2", "cat_001", "lunch", 300),
];

const byText = (c, selector, text) =>
  [...c.querySelectorAll(selector)].find((el) => el.textContent.trim() === text);
const byTestId = (c, id) => c.querySelector(`[data-testid="${id}"]`);
const allByTestId = (c, id) => [...c.querySelectorAll(`[data-testid="${id}"]`)];
const sectionLabels = (c) =>
  [...c.querySelectorAll(".uppercase.tracking-wide")].map((el) => el.textContent.trim());

async function click(el) {
  await React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
  await React.act(async () => {});
}

async function openAnnual(fixture) {
  installGlobals(fixture);
  const page = await mount(loadPage("reports/page.js"));
  await click(byText(page, "button", "reports.annual"));
  return page;
}

test("AC-5: Annual shows three group totals, a 3-segment group donut and each group's rows", async () => {
  const page = await openAnnual({ categories: CATEGORIES, expenses: EXPENSES });
  const block = byTestId(page, "cost-groups");
  assert.ok(block, "the summary block renders");

  assert.equal(byTestId(block, "group-total-fixed").textContent, "NT$10,000");
  assert.equal(byTestId(block, "group-total-big_extra").textContent, "NT$30,000");
  assert.equal(byTestId(block, "group-total-living").textContent, "NT$1,500");

  const donut = byTestId(block, "group-donut");
  assert.equal(donut.querySelectorAll("circle").length, 4, "track + one segment per group");

  const fixedRows = allByTestId(block, "fixed-row").map((r) => r.textContent);
  assert.equal(fixedRows.length, 1);
  assert.match(fixedRows[0], /Insurance.*NT\$10,000/);

  const extras = allByTestId(block, "big-extra-row").map((r) => r.textContent);
  assert.equal(extras.length, 1);
  assert.match(extras[0], /日本機票 #大筆/);
  assert.match(extras[0], /Travel/);
  assert.match(extras[0], /NT\$30,000/);

  const living = allByTestId(block, "living-row").map((r) => r.textContent);
  assert.deepEqual(living.length, 2);
  assert.match(living[0], /Travel.*NT\$1,200/, "Travel's living row excludes the tagged trip");
  assert.match(living[1], /Eating Out.*NT\$300/);
});

test("the block follows the monthly trend and replaces the Donut/Bar chart and By category list", async () => {
  const page = await openAnnual({ categories: CATEGORIES, expenses: EXPENSES });

  assert.deepEqual(sectionLabels(page), [
    "reports.annual_total",
    "reports.monthly_trend",
    "reports.cost_groups",
    "reports.by_payer",
    "reports.insights_title",
  ]);
  assert.equal(byText(page, "button", "reports.donut"), undefined, "no Donut/Bar toggle on Annual");
  assert.equal(byText(page, "button", "reports.bar"), undefined);
  assert.ok(byTestId(page, "group-donut"), "the group donut stays");
  // Every category of the year shows under its group: Travel's living part,
  // Eating Out under living, Insurance under fixed.
  const rows = [...allByTestId(page, "fixed-row"), ...allByTestId(page, "living-row")];
  assert.equal(rows.length, 3);
});

test("AC-5 edge: an empty group shows NT$0 with no rows and no donut segment", async () => {
  const page = await openAnnual({ categories: CATEGORIES, expenses: EXPENSES.filter((e) => e.id !== "b1") });
  const block = byTestId(page, "cost-groups");
  assert.equal(byTestId(block, "group-total-big_extra").textContent, "NT$0");
  assert.equal(allByTestId(block, "big-extra-row").length, 0);
  assert.equal(byTestId(block, "group-donut").querySelectorAll("circle").length, 3, "track + two segments");
});

test("AC-5 edge: a year with no expenses has no summary block", async () => {
  const page = await openAnnual({ categories: CATEGORIES, expenses: [] });
  assert.equal(byTestId(page, "cost-groups"), null);
});

test("AC-6: a living row drills into exactly its own expenses", async () => {
  const page = await openAnnual({ categories: CATEGORIES, expenses: EXPENSES });
  const drillTotal = () => page.querySelector(".text-3xl.font-mono").textContent;

  const travelLiving = allByTestId(page, "living-row").find((r) => r.textContent.includes("Travel"));
  await click(travelLiving);
  assert.equal(drillTotal(), "NT$1,200", "the drill-down total matches the living row");
  assert.ok(page.textContent.includes("高鐵"));
  assert.ok(!page.textContent.includes("日本機票"), "the tagged trip is not in the living drill-down");
});
