// Run with: npm test
// Annual vs last year: the summary's matching-days comparison and monthly
// trend, then the Compare button and the enlarged trend chart on the real page.
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

test("a running year compares against last year's Jan 1 to today's date, inclusive", async () => {
  installGlobals({
    categories: CATEGORIES,
    expenses: [
      row("a", "cat_001", "", 1000, "2026-02-01"),
      row("p1", "cat_001", "", 400, "2025-03-01"),
      row("p2", "cat_023", "", 500, "2025-10-07"),          // cutoff day counts
      row("p3", "cat_001", "", 700, "2025-10-08"),          // the day after does not
      row("p4", "cat_005", "#大筆", 9000, "2025-12-31"),
    ],
  });
  const { getAnnualSummary } = lib("reportService");
  const s = await getAnnualSummary(2026, "all", new Date(2026, 9, 7));

  assert.equal(s.comparison.year, 2025);
  assert.equal(s.comparison.through, "10-07");
  assert.equal(s.comparison.total, 900);
  assert.equal(s.comparison.groups.fixed.total, 500);
  assert.equal(s.comparison.groups.living.total, 400);
  assert.equal(s.comparison.groups.big_extra.total, 0, "Dec 31 is past the cutoff");

  // The trend shows last year's full months, cut or not.
  assert.equal(s.monthly_trend[9].prev_total, 1200, "Oct 2025: both days");
  assert.equal(s.monthly_trend[11].prev_total, 9000);
  assert.equal(s.monthly_trend[1].total, 1000);
  assert.equal(s.monthly_trend[1].prev_total, 0);
});

test("a finished year compares full year against full year", async () => {
  installGlobals({
    categories: CATEGORIES,
    expenses: [
      row("a", "cat_001", "", 100, "2025-06-01"),
      row("p", "cat_001", "", 300, "2024-12-31"),
    ],
  });
  const { getAnnualSummary } = lib("reportService");
  const s = await getAnnualSummary(2025, "all", new Date(2026, 9, 7));
  assert.equal(s.comparison.year, 2024);
  assert.equal(s.comparison.through, null);
  assert.equal(s.comparison.total, 300);
});

// --- On the page: the live clock decides the cutoff, so last year's rows sit
// on Jan 10, before any possible today.
const YEAR = new Date().getFullYear();
const PAGE_EXPENSES = [
  row("f", "cat_023", "", 10000, `${YEAR}-01-05`),
  row("l", "cat_001", "", 300, `${YEAR}-01-05`),
  row("pf", "cat_023", "", 8000, `${YEAR - 1}-01-10`),
  row("pl", "cat_001", "", 600, `${YEAR - 1}-01-10`),
  row("pg", "cat_003", "", 250, `${YEAR - 1}-01-10`),   // only last year
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

async function openAnnual() {
  installGlobals({ categories: CATEGORIES, expenses: PAGE_EXPENSES });
  // The enlarged chart has a fixed size, so Recharts draws and animates its
  // bars; jsdom has no animation frames.
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  const page = await mount(loadPage("reports/page.js"));
  await click(byText(page, "button", "reports.annual"));
  return page;
}

test("Compare shows last year's amounts and deltas, and lists categories gone this year", async () => {
  const page = await openAnnual();
  const toggle = byTestId(page, "compare-toggle");
  assert.equal(toggle.textContent, "reports.compare_partial");
  assert.equal(byTestId(page, "group-compare-fixed"), null, "off by default");
  assert.equal(allByTestId(page, "living-row").length, 1);

  await click(toggle);
  assert.equal(toggle.getAttribute("aria-pressed"), "true");
  assert.match(byTestId(page, "group-compare-fixed").textContent, /NT\$8,000.*▲ 25%/);
  assert.match(byTestId(page, "group-compare-living").textContent, /NT\$850.*▼ 65%/);
  assert.match(byTestId(page, "total-compare").textContent, /NT\$8,850.*NT\$10,300/);

  const living = allByTestId(page, "living-row");
  assert.equal(living.length, 2);
  assert.match(living[0].textContent, /Eating Out.*NT\$300.*NT\$600.*▼ 50%/);
  assert.match(living[1].textContent, /Groceries.*NT\$0.*NT\$250.*▼ 100%/);
  assert.ok(living[1].disabled, "nothing to drill into this year");

  await click(toggle);
  assert.equal(byTestId(page, "group-compare-fixed"), null);
  assert.equal(allByTestId(page, "living-row").length, 1);
});

test("the trend's enlarge icon opens a full-screen chart that closes", async () => {
  const page = await openAnnual();
  assert.equal(byTestId(page, "trend-fullscreen"), null);
  await click(byTestId(page, "trend-enlarge"));
  const full = byTestId(page, "trend-fullscreen");
  assert.ok(full);
  assert.equal(byTestId(full, "trend-picked").textContent, "reports.trend_tap_hint");
  await click(full.querySelector('button[aria-label="reports.close"]'));
  assert.equal(byTestId(page, "trend-fullscreen"), null);
});
