// Run with: npm test
// Monthly vs last month and vs the same month last year: the summary's
// day-matched comparisons, then the cost groups card and Comparison card.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, expense } = require("./helpers/dom.js");

mockAuth();

const lib = (name) => require(`../.test-build-ui/lib/${name}.js`);
const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

const CATEGORIES = [
  { id: "cat_001", name_en: "Eating Out", name_zh: "外食", icon: "🍕", sort_order: 1, is_active: true },
  { id: "cat_003", name_en: "Groceries", name_zh: "食材", icon: "🥕", sort_order: 3, is_active: true },
  { id: "cat_005", name_en: "Travel", name_zh: "旅遊", icon: "✈️", sort_order: 5, is_active: true },
  { id: "cat_023", name_en: "Insurance", name_zh: "保險", icon: "🛡️", sort_order: 23, is_active: true },
];

const row = (id, category_id, notes, amount, date) =>
  ({ ...expense(id, category_id, notes), amount, paid_by: "ijac", date });

test("a running month compares against the same days of last month and of last year", async () => {
  installGlobals({
    categories: CATEGORIES,
    expenses: [
      row("a", "cat_001", "", 1000, "2026-10-03"),
      row("s1", "cat_001", "", 400, "2026-09-07"),        // cutoff day counts
      row("s2", "cat_001", "", 700, "2026-09-08"),        // the day after does not
      row("y1", "cat_023", "", 500, "2025-10-01"),
      row("y2", "cat_005", "#大筆", 9000, "2025-10-20"),
    ],
  });
  const { getMonthlySummary } = lib("reportService");
  const s = await getMonthlySummary(2026, 10, "all", new Date(2026, 9, 7));

  const { prev_month, last_year } = s.comparison;
  assert.deepEqual([prev_month.year, prev_month.month, prev_month.through_day], [2026, 9, 7]);
  assert.equal(prev_month.total, 400);
  assert.deepEqual([last_year.year, last_year.month, last_year.through_day], [2025, 10, 7]);
  assert.equal(last_year.total, 500);
  assert.equal(last_year.groups.fixed.total, 500);
  assert.equal(last_year.groups.big_extra.total, 0, "Oct 20 is past the cutoff");
  assert.equal(s.groups.living.total, 1000);
});

test("a finished month compares whole months; January looks back to December", async () => {
  installGlobals({
    categories: CATEGORIES,
    expenses: [
      row("a", "cat_001", "", 100, "2026-01-31"),
      row("d", "cat_001", "", 300, "2025-12-31"),
      row("j", "cat_001", "", 200, "2025-01-31"),
    ],
  });
  const { getMonthlySummary } = lib("reportService");
  const s = await getMonthlySummary(2026, 1, "all", new Date(2026, 9, 7));
  assert.deepEqual([s.comparison.prev_month.year, s.comparison.prev_month.month], [2025, 12]);
  assert.equal(s.comparison.prev_month.through_day, null);
  assert.equal(s.comparison.prev_month.total, 300);
  assert.equal(s.comparison.last_year.total, 200);
});

// --- On the page: the live clock picks the month and cutoff, so every row
// sits on day 1, inside any possible cutoff.
const now = new Date();
const Y = now.getFullYear();
const M = now.getMonth() + 1;
const ym = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
const PREV = M === 1 ? ym(Y - 1, 12) : ym(Y, M - 1);
const PAGE_EXPENSES = [
  row("f", "cat_023", "", 10000, `${ym(Y, M)}-01`),
  row("l", "cat_001", "", 300, `${ym(Y, M)}-01`),
  row("pf", "cat_023", "", 5000, `${PREV}-01`),
  row("yf", "cat_023", "", 8000, `${ym(Y - 1, M)}-01`),
  row("yg", "cat_003", "", 250, `${ym(Y - 1, M)}-01`),   // only last year
];

const byText = (c, selector, text) =>
  [...c.querySelectorAll(selector)].find((el) => el.textContent.trim() === text);
const byTestId = (c, id) => c.querySelector(`[data-testid="${id}"]`);
const allByTestId = (c, id) => [...c.querySelectorAll(`[data-testid="${id}"]`)];

async function click(el) {
  await React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
  await React.act(async () => {});
}

async function openMonthly() {
  installGlobals({ categories: CATEGORIES, expenses: PAGE_EXPENSES });
  return mount(loadPage("reports/page.js"));
}

test("Monthly shows the cost groups card in place of the donut, toggle and By category list", async () => {
  const page = await openMonthly();
  assert.ok(byTestId(page, "cost-groups"));
  assert.equal(byText(page, "button", "reports.donut"), undefined);
  assert.equal(byText(page, ".uppercase.tracking-wide", "reports.by_category"), undefined);
  assert.equal(byTestId(page, "group-total-fixed").textContent, "NT$10,000");
  assert.equal(allByTestId(page, "living-row").length, 1);
});

test("two Compare buttons, one at a time: last month, then the same month last year", async () => {
  const page = await openMonthly();
  const prev = byTestId(page, "compare-prev_month");
  const year = byTestId(page, "compare-last_year");
  assert.equal(prev.textContent, "reports.compare_vs");
  assert.equal(byTestId(page, "group-compare-fixed"), null, "off by default");

  await click(prev);
  assert.match(byTestId(page, "group-compare-fixed").textContent, /NT\$5,000.*▲ 100%/);

  await click(year);
  assert.equal(prev.getAttribute("aria-pressed"), "false", "choosing one turns the other off");
  assert.match(byTestId(page, "group-compare-fixed").textContent, /NT\$8,000.*▲ 25%/);
  const living = allByTestId(page, "living-row");
  assert.equal(living.length, 2);
  assert.match(living[1].textContent, /Groceries.*NT\$0.*NT\$250/);

  await click(year);
  assert.equal(byTestId(page, "group-compare-fixed"), null, "tapping the active one turns it off");
});

test("the Comparison card shows last month and the same month last year", async () => {
  const page = await openMonthly();
  const lines = allByTestId(page, "month-compare-line").map((l) => l.textContent);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /NT\$5,000/);
  assert.match(lines[1], /NT\$8,250/);
});
