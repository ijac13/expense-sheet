// Run with: npm test
// Entity 069, AC-5/AC-6/AC-7. Mounts the real Reports page and steps between
// months, asserting on real network-request counts and the actual rendered
// total — not on which helper was called. See test/helpers/dom.js for the
// request-counting and deferExpenses gate this test relies on.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, expense } = require("./helpers/dom.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

function pad(n) { return String(n).padStart(2, "0"); }

const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth() + 1; // 1-12
const PREV_MONTH = MONTH === 1 ? 12 : MONTH - 1;
const PREV_YEAR = MONTH === 1 ? YEAR - 1 : YEAR;

const CURRENT_MONTH_EXPENSES = [
  { ...expense("r1", "cat_001", "row-current-a"), date: `${YEAR}-${pad(MONTH)}-01`, amount: 100 },
  { ...expense("r2", "cat_001", "row-current-b"), date: `${YEAR}-${pad(MONTH)}-16`, amount: 200 },
];

const PREV_MONTH_EXPENSES = [
  { ...expense("r3", "cat_001", "row-prev"), date: `${PREV_YEAR}-${pad(PREV_MONTH)}-10`, amount: 500 },
];

const EXPENSES = [...CURRENT_MONTH_EXPENSES, ...PREV_MONTH_EXPENSES];
const CURRENT_TOTAL = 300; // 100 + 200
const PREV_TOTAL = 500;

async function flush(fn) {
  await React.act(async () => { fn(); });
  await React.act(async () => {});
}

function navButtons(container) {
  return [...container.querySelectorAll("button")].filter(
    (b) => b.classList.contains("btn-ghost") && b.classList.contains("btn-sm")
  );
}
const prevMonthButton = (c) => navButtons(c)[0];

function totalText(container) {
  const el = container.querySelector(".text-\\[40px\\]");
  return el ? el.textContent : null;
}
const spinner = (c) => c.querySelector(".loading-spinner");

// ---------------------------------------------------------------------------
// AC-7 (first fetch) — the spinner IS expected on a genuine first session fetch.
// ---------------------------------------------------------------------------

test("AC-7: the full-page spinner appears for the genuine first fetch of a session, and clears once it resolves", async () => {
  const g = installGlobals({ expenses: EXPENSES, deferExpenses: true });

  const container = await mount(loadPage("reports/page.js"));
  assert.ok(spinner(container), "spinner shown while the first-ever fetch is still in flight");

  await flush(g.releaseExpenses);

  assert.equal(spinner(container), null, "spinner cleared once the fetch resolved");
  assert.equal(totalText(container), `NT$${CURRENT_TOTAL}`, "the resolved fetch renders the real total");
});

// ---------------------------------------------------------------------------
// AC-5 / AC-6 / AC-7 (step) — a month step reuses the cache: no new request,
// no spinner, and a distinct, correct total for the new period.
// ---------------------------------------------------------------------------

test("AC-5/AC-6/AC-7: stepping to the previous month issues no new request, shows no spinner, and displays that month's own distinct total", async () => {
  const g = installGlobals({ expenses: EXPENSES });
  const page = await mount(loadPage("reports/page.js"));

  assert.equal(totalText(page), `NT$${CURRENT_TOTAL}`, "first month's total resolved from the real fetch");
  const requestCountBeforeStep = g.getRequests.length;
  assert.ok(requestCountBeforeStep > 0, "the first fetch really did issue requests");

  await flush(() => prevMonthButton(page).dispatchEvent(new global.window.Event("click", { bubbles: true })));

  assert.equal(g.getRequests.length, requestCountBeforeStep, "stepping issued no new GET /api or GET /api/categories request");
  assert.equal(spinner(page), null, "no spinner on a cache-served step");
  assert.equal(totalText(page), `NT$${PREV_TOTAL}`, "the previous month's own distinct total is shown");
  assert.notEqual(`NT$${PREV_TOTAL}`, `NT$${CURRENT_TOTAL}`, "sanity: the two fixture totals really do differ");
});
