// Run with: npm test
// Entity 070, AC-1/AC-2/AC-3a. Mounts the real Reports page and reads the order
// the section blocks render in, by document order of their labels. The Annual
// view must show the monthly trend right under the year total; the Monthly view
// must keep today's order with no trend block.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, expense } = require("./helpers/dom.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

// Current-month data, so the Monthly view renders its blocks rather than its
// empty state, and the Annual view has a non-empty year.
const now = new Date();
const THIS_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const EXPENSES = [{ ...expense("o1", "cat_001", "row-order"), date: `${THIS_MONTH}-01`, amount: 100 }];

// Section labels share the `uppercase tracking-wide` styling; the t() stub
// renders keys, so the text is the i18n key.
const sectionLabels = (c) =>
  [...c.querySelectorAll(".uppercase.tracking-wide")].map((el) => el.textContent.trim());

const byText = (c, selector, text) =>
  [...c.querySelectorAll(selector)].find((el) => el.textContent.trim() === text);

const precedes = (a, b) =>
  Boolean(a.compareDocumentPosition(b) & global.window.Node.DOCUMENT_POSITION_FOLLOWING);

async function openAnnual(container) {
  const annualButton = byText(container, "button", "reports.annual");
  assert.ok(annualButton, "the Annual period toggle is rendered");
  await React.act(async () => {
    annualButton.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
  await React.act(async () => {});
}

test("AC-1/AC-2: Annual shows year picker, total, monthly trend, cost groups, by payer, insights — in that order", async () => {
  installGlobals({ expenses: EXPENSES });
  const page = await mount(loadPage("reports/page.js"));
  await openAnnual(page);

  assert.deepEqual(sectionLabels(page), [
    "reports.annual_total",
    "reports.monthly_trend",
    "reports.cost_groups",
    "reports.by_payer",
    "reports.insights_title",
  ]);

  const year = byText(page, "span.font-semibold", String(now.getFullYear()));
  const total = byText(page, ".uppercase.tracking-wide", "reports.annual_total");
  assert.ok(year, "year picker label is rendered");
  assert.ok(precedes(year, total), "year picker comes before the year total");
});

test("AC-3a: Monthly shows total, cost groups, by payer, comparison, insights — and no monthly trend", async () => {
  installGlobals({ expenses: EXPENSES });
  const page = await mount(loadPage("reports/page.js"));

  assert.deepEqual(sectionLabels(page), [
    "reports.total_spending",
    "reports.cost_groups",
    "reports.by_payer",
    "reports.comparison",
    "reports.insights_title",
  ]);
});
