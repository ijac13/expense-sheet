// Run with: npm test
// Entity 069, AC-8/AC-9/AC-10. The riskiest mechanism per the spec's Risk
// evidence: invalidation coverage across addExpense/updateExpense/deleteExpense.
// These tests mount real pages (Home, History, Reports) in the SAME process
// after a single installGlobals() call, the way in-app <Link> navigation shares
// JS module state — proving the shared cache actually dedupes across pages
// (AC-9) and that a write on one page is visible on another (AC-8), without
// regressing the page that made the write (AC-10).
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, expense } = require("./helpers/dom.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

const click = (el) =>
  React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

const buttons = (c) => [...c.querySelectorAll("button")];
const key = (c, k) => buttons(c).find((b) => b.textContent === k);
const byText = (c, text) => buttons(c).find((b) => b.textContent.includes(text));
const saveButton = (c) => byText(c, "home.save");

/** Type each digit on the keypad, then press Save. */
async function logExpense(container, digits) {
  for (const d of digits.split("")) await click(key(container, d));
  await click(saveButton(container));
}

function pad(n) { return String(n).padStart(2, "0"); }
const now = new Date();
const YEAR = now.getFullYear();
const MONTH = now.getMonth() + 1;

// ---------------------------------------------------------------------------
// AC-9 — cross-page dedup: one GET /api for the whole Home -> History ->
// Reports trip, once the first has resolved.
// ---------------------------------------------------------------------------

test("AC-9: navigating Home -> History -> Reports within one session issues at most one GET /api (non-categories) request", async () => {
  const g = installGlobals();

  await mount(loadPage("page.js"));
  await mount(loadPage("history/page.js"));
  await mount(loadPage("reports/page.js"));

  const apiGetCount = g.getRequests.filter((r) => r === "/api").length;
  assert.equal(apiGetCount, 1, `expected exactly one GET /api across the trip, got ${apiGetCount} (${JSON.stringify(g.getRequests)})`);
});

// ---------------------------------------------------------------------------
// AC-10 / AC-8 — Home's own list still updates immediately on its own write,
// and that same write is visible from History afterward in the same session.
// ---------------------------------------------------------------------------

test("AC-10: adding an expense from Home immediately updates Home's own logged-today count", async () => {
  installGlobals();
  const home = await mount(loadPage("page.js"));

  assert.ok(!home.textContent.includes("logged_today"), "nothing logged yet before the write");

  await logExpense(home, "911");

  assert.ok(home.textContent.includes("1 home.logged_today"), "Home's own count reflects the write immediately, unaffected by the shared cache");
});

test("AC-8: an expense added from Home is visible from History afterward in the same session", async () => {
  installGlobals();
  const home = await mount(loadPage("page.js"));

  await logExpense(home, "911");

  const history = await mount(loadPage("history/page.js"));
  assert.ok(history.textContent.includes("NT$911"), "the write made on Home reached History without a reload, via cache invalidation");
});

// ---------------------------------------------------------------------------
// AC-8 — a delete on the shared write path (expenseService.deleteExpense,
// exactly what ExpenseEditSheet's handleDelete calls from both History and
// Reports' drill-down) invalidates the cache so a subsequently-computed
// Reports total excludes it.
// ---------------------------------------------------------------------------

test("AC-8: deleting an expense via the shared expenseService write path is excluded from a subsequently-computed Reports total", async () => {
  const TO_DELETE = { ...expense("del-1", "cat_001", "to-delete"), date: `${YEAR}-${pad(MONTH)}-05`, amount: 750 };
  installGlobals({ expenses: [TO_DELETE] });

  const { getMonthlySummary } = require("../.test-build-ui/lib/reportService.js");
  const { deleteExpense } = require("../.test-build-ui/lib/expenseService.js");

  const before = await getMonthlySummary(YEAR, MONTH);
  assert.equal(before.total, 750, "the fixture expense is counted before the delete");

  await deleteExpense("del-1");

  const after = await getMonthlySummary(YEAR, MONTH);
  assert.equal(after.total, 0, "the deleted expense no longer appears in a report computed afterward");
});

test("AC-8: updating an expense via the shared expenseService write path is reflected in a subsequently-computed Reports total", async () => {
  const TO_UPDATE = { ...expense("upd-1", "cat_001", "to-update"), date: `${YEAR}-${pad(MONTH)}-05`, amount: 750 };
  installGlobals({ expenses: [TO_UPDATE] });

  const { getMonthlySummary } = require("../.test-build-ui/lib/reportService.js");
  const { updateExpense } = require("../.test-build-ui/lib/expenseService.js");

  const before = await getMonthlySummary(YEAR, MONTH);
  assert.equal(before.total, 750, "the fixture expense is counted before the update");

  await updateExpense("upd-1", { amount: 1000 });

  const after = await getMonthlySummary(YEAR, MONTH);
  assert.equal(after.total, 1000, "the updated amount is reflected in a report computed afterward, not the stale 750");
});
