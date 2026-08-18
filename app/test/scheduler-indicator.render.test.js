// Run with: npm test
// The captain-visible auto-add indicator on the Subscriptions screen (entity 050,
// AC-11). Mounts the real page and asserts on what reaches the DOM — the whole
// point of this line is that a stopped scheduler becomes visible without reading
// the spreadsheet, so "the component has the code" is not the claim under test.
const test = require("node:test");
const assert = require("node:assert/strict");
const { installGlobals, mockAuth, mount, SCHEDULER_OK } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");

mockAuth();

const loadPage = () => require("../.test-build-ui/subscriptions/page.js").default;

const indicator = (container) => container.querySelector('[data-testid="auto-add-status"]');
const title = (container) => container.querySelector("h1");

test("AC-11: a healthy scheduler shows one line under the title with when it last ran", async () => {
  installGlobals();
  const container = await mount(loadPage());

  const line = indicator(container);
  assert.ok(line, "the indicator rendered");
  assert.ok(line.textContent.includes("subscriptions.auto_add_last_ran"), line.textContent);

  // The timestamp itself, not just the label — a line reading only "last ran"
  // would answer nothing.
  const day = new Date(SCHEDULER_OK.last_run_at).toLocaleString("en-US", { month: "short", day: "numeric" });
  assert.ok(line.textContent.includes(day), `"${line.textContent}" names ${day}`);

  // "Under the title": same parent as the h1, and after it in document order.
  assert.equal(line.parentElement, title(container).parentElement);
  assert.ok(title(container).compareDocumentPosition(line) & 4, "follows the title");

  // Exactly one line, and it is not the warning style.
  assert.equal(container.querySelectorAll('[data-testid="auto-add-status"]').length, 1);
  assert.ok(!line.className.includes("text-warning"), line.className);
});

test("AC-11: a stale scheduler warns that auto-add has not run, and still dates the last run", async () => {
  installGlobals({ schedulerStatus: { ...SCHEDULER_OK, stale: true } });
  const container = await mount(loadPage());

  const line = indicator(container);
  assert.ok(line.textContent.includes("subscriptions.auto_add_not_running"), line.textContent);
  assert.ok(line.className.includes("text-warning"), `warning style, got "${line.className}"`);
  // Still dated, so "broken since when?" is answerable from the screen.
  assert.ok(line.textContent.includes("subscriptions.auto_add_last_ran"), line.textContent);
});

test("AC-11: a scheduler that has never run warns with no date", async () => {
  installGlobals({ schedulerStatus: { last_run_at: null, due_count: 0, created_count: 0, skipped_count: 0, error: "", stale: true } });
  const container = await mount(loadPage());

  const line = indicator(container);
  assert.equal(line.textContent, "subscriptions.auto_add_not_running", "no dangling separator or empty date");
  assert.ok(line.className.includes("text-warning"));
});

test("AC-11: an unreachable status endpoint warns rather than claiming healthy", async () => {
  installGlobals({ schedulerStatus: null });
  const container = await mount(loadPage());

  const line = indicator(container);
  assert.ok(line.textContent.includes("subscriptions.auto_add_not_running"), line.textContent);
  assert.ok(line.className.includes("text-warning"));
  // The rest of the screen is unaffected — a status failure must not blank the list.
  assert.ok(container.textContent.includes("Netflix"));
});

test("AC-11: both strings come from translation keys present in en and zh", async () => {
  installGlobals();
  const container = await mount(loadPage());

  // No I18nextProvider is mounted, so t() echoes its key. A hardcoded English
  // string in the component would render as prose and fail this.
  assert.ok(indicator(container).textContent.includes("subscriptions.auto_add_last_ran"));

  for (const key of ["auto_add_last_ran", "auto_add_not_running"]) {
    assert.equal(typeof EN.subscriptions[key], "string", `en ${key}`);
    assert.equal(typeof ZH.subscriptions[key], "string", `zh ${key}`);
    assert.notEqual(EN.subscriptions[key], ZH.subscriptions[key], `zh ${key} is translated, not copied`);
  }
});

test("AC-11: the indicator does not disturb the existing header controls", async () => {
  const { requests } = installGlobals();
  const container = await mount(loadPage());

  assert.ok(requests.includes("/api/scheduler-status"), "the page asked the API");
  // The Add button is still the first btn-primary, which the icons tests locate it by.
  const firstPrimary = [...container.querySelectorAll("button")].find((b) => b.className.includes("btn-primary"));
  assert.ok(firstPrimary.textContent.includes("subscriptions.add"), firstPrimary.textContent);
  assert.equal(container.querySelectorAll("h1").length, 1);
});
