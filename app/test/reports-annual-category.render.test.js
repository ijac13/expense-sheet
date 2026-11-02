// Run with: npm test
// Entity 080. Reports > Annual > tap a category: the category's year month by
// month (header, category-only trend chart, one row per month, newest first),
// a month opens its expenses, Back goes month -> month list -> Annual.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, expense } = require("./helpers/dom.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

// The page reads today's date, so today is pinned to 2 November 2026: a bare
// `new Date()` returns it, everything else (Date.now, timers) stays real.
const RealDate = Date;
const PINNED = new RealDate(2026, 10, 2, 12).getTime();
global.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [PINNED])); }
  static now() { return RealDate.now(); }
};

const CATEGORIES = [
  { id: "cat_002", name_en: "Daily Necessity", name_zh: "日用品", icon: "🧴", sort_order: 2, is_active: true },
];

const row = (id, notes, amount, date, extra = {}) =>
  ({ ...expense(id, "cat_002", notes), amount, paid_by: "ijac", date, ...extra });

// The spec's fixture: four October items, an October #大筆 and an October
// Rent-tagged item, two in September, one in August paid by wei, last October.
const EXPENSES = [
  row("o1", "oct-tissue", 100, "2026-10-03"),
  row("o2", "oct-soap", 200, "2026-10-08"),
  row("o3", "oct-detergent", 300, "2026-10-15"),
  row("o4", "oct-towels", 400, "2026-10-28"),
  row("ob", "oct-sofa #大筆", 9000, "2026-10-20"),
  row("or", "oct-flat-supplies", 5000, "2026-10-21", { business: "rent" }),
  row("s1", "sep-tissue", 150, "2026-09-04"),
  row("s2", "sep-soap", 250, "2026-09-19"),
  row("a1", "aug-wei", 700, "2026-08-11", { paid_by: "wei" }),
  row("p1", "last-oct", 600, "2025-10-10"),
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

async function openAnnual(fixture = EXPENSES) {
  const env = installGlobals({ categories: CATEGORIES, expenses: fixture });
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(RealDate.now()), 0);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  const page = await mount(loadPage("reports/page.js"));
  await click(byText(page, "button", "reports.annual"));
  return { page, env };
}

const groupRow = (page, group) => allByTestId(page, `${group}-row`).find((r) => r.textContent.includes("Daily Necessity"));
const monthRows = (page) => allByTestId(page, "category-month-row");
// "Oct|NT$1,000|4" — month, amount, count ("" when the month is empty).
const monthLine = (r) => {
  const amount = r.querySelector(".font-mono").textContent;
  const count = r.textContent.match(/(\d+) reports\.transactions/)?.[1] ?? "";
  return `${r.firstChild.textContent}|${amount}|${count}`;
};
const monthSum = (page) =>
  monthRows(page).reduce((s, r) => s + Number(r.querySelector(".font-mono").textContent.replace(/[^\d]/g, "")), 0);
const backButton = (page) => byText(page, "button", "← reports.back");
const scope = (page, label) => byText(byTestId(page, "scope-toggle"), "button", label);

test("AC-1/AC-2: a Living row opens one row per month, newest first, adding up to the row", async () => {
  const { page } = await openAnnual();
  const living = groupRow(page, "living");
  assert.match(living.textContent, /NT\$2,100/, "the Living row leaves out the #大筆 and Rent items");
  await click(living);

  assert.deepEqual(monthRows(page).map(monthLine), [
    "Nov|NT$0|",
    "Oct|NT$1,000|4",
    "Sep|NT$400|2",
    "Aug|NT$700|1",
    "Jul|NT$0|", "Jun|NT$0|", "May|NT$0|", "Apr|NT$0|", "Mar|NT$0|", "Feb|NT$0|", "Jan|NT$0|",
  ]);
  assert.ok(!page.textContent.includes("oct-tissue"), "no individual expense is listed");
  assert.equal(byTestId(page, "cost-groups"), null, "the Annual page is gone");

  assert.equal(monthSum(page), 2100, "not 16,100, the category's raw year total");
  assert.equal(byTestId(page, "category-year-total").textContent, "NT$2,100");
  assert.match(page.textContent, /7 reports\.transactions/);
});

test("AC-3: the category chart shows this category only, this year beside last year", async () => {
  const { page } = await openAnnual();
  await click(groupRow(page, "living"));

  await click(byTestId(page, "trend-enlarge"));
  await React.act(() => new Promise((r) => setTimeout(r, 50)));
  const full = byTestId(page, "trend-fullscreen");
  const bars = () => full.querySelectorAll(".recharts-bar-rectangle path");
  assert.ok(bars().length > 0, "bars are drawn");
  const out = {};
  for (let i = 0; i < bars().length; i++) {
    await click(bars()[i]);
    const text = byTestId(full, "trend-picked").textContent;
    out[text.slice(0, 3)] = text;
  }
  assert.equal(out.Oct, "Oct · 2025 NT$600 · 2026 NT$1,000");
  assert.equal(out.Aug, "Aug · 2025 NT$0 · 2026 NT$700");
  assert.equal(out.Sep, "Sep · 2025 NT$0 · 2026 NT$400");
});

test("AC-4: a month opens its own expenses for the group; Back goes month -> list -> Annual", async () => {
  const { page } = await openAnnual();
  await click(groupRow(page, "living"));
  await click(monthRows(page).find((r) => r.textContent.startsWith("Oct")));

  assert.equal(byTestId(page, "drill-total").textContent, "NT$1,000");
  assert.equal(page.querySelectorAll(".card-body").length, 4, "the #大筆 and Rent items stay out");
  assert.ok(page.textContent.includes("Oct 2026"));
  assert.ok(page.textContent.includes("oct-tissue"));
  assert.ok(!page.textContent.includes("oct-sofa"));

  await click(backButton(page));
  assert.equal(monthRows(page).length, 11, "back on the month list");
  assert.equal(byTestId(page, "cost-groups"), null);

  await click(backButton(page));
  assert.ok(byTestId(page, "cost-groups"), "back on Annual");
  assert.equal(monthRows(page).length, 0);
});

test("AC-5: the Living row's months ignore the toggle; the Rent row holds only the Rent-tagged item", async () => {
  const { page } = await openAnnual();
  await click(groupRow(page, "living"));
  const lifeOnly = monthRows(page).map(monthLine);
  await click(backButton(page));

  await click(scope(page, "reports.include_business"));
  await click(groupRow(page, "living"));
  assert.deepEqual(monthRows(page).map(monthLine), lifeOnly, "same months with business costs included");
  await click(backButton(page));

  const rent = groupRow(page, "rent");
  assert.match(rent.textContent, /NT\$5,000/);
  await click(rent);
  const withSpend = monthRows(page).filter((r) => !r.disabled).map(monthLine);
  assert.deepEqual(withSpend, ["Oct|NT$5,000|1"]);
  await click(monthRows(page).find((r) => r.textContent.startsWith("Oct")));
  assert.equal(byTestId(page, "drill-total").textContent, "NT$5,000");
  assert.ok(page.textContent.includes("oct-flat-supplies"));
});

test("AC-6: with only ijac selected, wei's August is NT$0 and cannot be tapped", async () => {
  const { page } = await openAnnual();
  const select = page.querySelector("select");
  await React.act(async () => {
    select.value = "user1";
    select.dispatchEvent(new global.window.Event("change", { bubbles: true }));
  });
  await React.act(async () => {});
  await click(groupRow(page, "living"));

  const aug = monthRows(page).find((r) => r.textContent.startsWith("Aug"));
  assert.equal(monthLine(aug), "Aug|NT$0|");
  assert.ok(aug.disabled);
  assert.equal(monthSum(page), 1400);
});

test("AC-7: a past year lists all 12 months, only the ones with spending tappable", async () => {
  const { page } = await openAnnual();
  const yearLabel = byText(page, "span", "2026");
  await click(yearLabel.parentElement.querySelector("button"));
  assert.ok(byText(page, "span", "2025"), "stepped to last year");
  await click(groupRow(page, "living"));

  const rows = monthRows(page);
  assert.deepEqual(rows.map((r) => r.firstChild.textContent),
    ["Dec", "Nov", "Oct", "Sep", "Aug", "Jul", "Jun", "May", "Apr", "Mar", "Feb", "Jan"]);
  assert.deepEqual(rows.filter((r) => !r.disabled).map(monthLine), ["Oct|NT$600|1"]);
});

test("edge: a month dated ahead of today is listed, so the months still add up", async () => {
  const { page } = await openAnnual([...EXPENSES, row("d1", "dec-ahead", 80, "2026-12-01")]);
  await click(groupRow(page, "living"));
  assert.equal(monthLine(monthRows(page)[0]), "Dec|NT$80|1");
  assert.equal(monthSum(page), 2180);
});

test("edge: an edit inside a month shows in the month list after Back", async () => {
  const { page, env } = await openAnnual();
  await click(groupRow(page, "living"));
  await click(monthRows(page).find((r) => r.textContent.startsWith("Oct")));
  // Delete stands in for any write: the month list must reread, not reuse.
  env.expenses.splice(env.expenses.findIndex((e) => e.id === "o4"), 1);
  require("../.test-build-ui/lib/expensesCache.js").invalidateExpensesCache();
  await click(backButton(page));
  assert.equal(monthLine(monthRows(page).find((r) => r.textContent.startsWith("Oct"))), "Oct|NT$600|3");
});
