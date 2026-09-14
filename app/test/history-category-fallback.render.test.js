// Run with: npm test
// Entity 069, AC-1/AC-2/AC-3/AC-4. Mounts the real History page and asserts on
// what's actually on screen before and after History's own categories fetch
// resolves — the `cat_003` incident this entity exists to close. See
// test/helpers/dom.js for what the fetch/localStorage stubs emulate, and
// test/category-cache.render.test.js for the identical pattern Home's
// active-only cache already established (entity 063).
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, expense, CATEGORIES } = require("./helpers/dom.js");

const { DEFAULT_CATEGORIES, LAST_CATEGORIES_FULL_KEY } = require("../.test-build/categories.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

// cat_003 (Groceries) is active in the default fixture; seed the full cache
// with it plus an ARCHIVED category, since History must resolve both.
const FULL_FIXTURE = CATEGORIES.map((c) => ({ ...c }));

// One expense on a live-only id (the cat_003 incident) and one on the archived
// live id (fuel/cat_015 in the default fixture is archived) — the row markers
// this file's assertions key off of.
const EXPENSES = [
  expense("h1", "cat_003", "row-live-groceries"),
  expense("h2", "cat_015", "row-archived-fuel"),
];

/** Fresh globals, optionally with the full-category-list cache pre-seeded. */
async function mountHistory({ cachedFull, cachedFullRaw, expenses = EXPENSES, ...opts } = {}) {
  const g = installGlobals({ expenses, ...opts });
  if (cachedFullRaw !== undefined) global.localStorage.setItem(LAST_CATEGORIES_FULL_KEY, cachedFullRaw);
  else if (cachedFull !== undefined) global.localStorage.setItem(LAST_CATEGORIES_FULL_KEY, JSON.stringify(cachedFull));
  const container = await mount(loadPage("history/page.js"));
  return { ...g, container };
}

async function flush(fn) {
  await React.act(async () => { fn(); });
  await React.act(async () => {});
}

/** The row whose text matches `marker`, then its label text. */
function labelFor(container, marker) {
  const row = [...container.querySelectorAll("button")].find((el) => el.textContent.includes(marker));
  if (!row) throw new Error(`no row containing ${marker}`);
  return row.querySelector(".text-\\[15px\\]").textContent;
}

// ---------------------------------------------------------------------------
// AC-1 — a cached full list resolves a live id before this load's own fetch.
// ---------------------------------------------------------------------------

test("AC-1: a device with a cached full category list resolves cat_003 to its name before the categories fetch resolves", async () => {
  const { container } = await mountHistory({ cachedFull: FULL_FIXTURE, deferCategories: true });

  assert.equal(labelFor(container, "row-live-groceries"), "Groceries", "resolved from the cache, not the raw id");
  assert.ok(!container.textContent.includes("cat_003"), "the raw id never reached the DOM");
});

test("AC-1: the cached full list also resolves an ARCHIVED category before the fetch resolves", async () => {
  const { container } = await mountHistory({ cachedFull: FULL_FIXTURE, deferCategories: true });

  assert.equal(labelFor(container, "row-archived-fuel"), "Fuel", "archived categories are in the full-list cache too");
});

// ---------------------------------------------------------------------------
// AC-2 — no cache yet degrades to today's documented fallback, never a crash.
// ---------------------------------------------------------------------------

test("AC-2: a device with no cached full list degrades to the raw-id fallback, not a blank page or a thrown error", async () => {
  // No try/catch: a page that crashes on a missing cache would reject this
  // mount and fail the test, exactly like a real unhandled error would.
  const { container } = await mountHistory({ deferCategories: true });

  assert.equal(labelFor(container, "row-live-groceries"), "cat_003", "same documented fallback as before this entity");
  assert.ok(container.textContent.includes("row-live-groceries"), "list rendered, did not blank");
});

// ---------------------------------------------------------------------------
// AC-3 — the cache is overwritten after every successful fetch.
// ---------------------------------------------------------------------------

test("AC-3: the cache is overwritten after every successful fetch, so a category added since the last cache write resolves on the next mount", async () => {
  const NEW_CAT = { id: "cat_555", name_en: "New Category", name_zh: "新類別", icon: "🆕", sort_order: 50, is_active: true };
  const SECOND_FIXTURE = [...FULL_FIXTURE, NEW_CAT];
  const expensesWithNew = [...EXPENSES, expense("h3", "cat_555", "row-new-category")];

  // First mount: fetch resolves without cat_555, caching FULL_FIXTURE.
  await mountHistory({ expenses: EXPENSES, categories: FULL_FIXTURE });
  const afterFirst = JSON.parse(global.localStorage.getItem(LAST_CATEGORIES_FULL_KEY));
  assert.ok(!afterFirst.some((c) => c.id === "cat_555"), "cat_555 wasn't live yet on the first fetch");

  // Second mount reuses the cache written by the first, then fetches the
  // updated list (as a real second session would).
  const { container } = await mountHistory({
    expenses: expensesWithNew,
    categories: SECOND_FIXTURE,
    cachedFullRaw: global.localStorage.getItem(LAST_CATEGORIES_FULL_KEY),
    deferCategories: true,
  });
  // Pre-resolution: cat_555 isn't in the cache yet, so it falls back to the raw id.
  assert.equal(labelFor(container, "row-new-category"), "cat_555");
});

// ---------------------------------------------------------------------------
// AC-4 — a throwing localStorage degrades cleanly, both read and write.
// ---------------------------------------------------------------------------

test("AC-4: a throwing full-category-list cache degrades to the raw-id fallback and never throws", async () => {
  const g = installGlobals({ expenses: EXPENSES, deferCategories: true });
  const realGetItem = global.localStorage.getItem.bind(global.localStorage);
  const realSetItem = global.localStorage.setItem.bind(global.localStorage);
  // Only the new full-list key throws — every other localStorage key (the
  // active-only cache, the last-used-id key) keeps working, isolating this
  // mechanism's own fallback.
  global.localStorage.getItem = (k) => { if (k === LAST_CATEGORIES_FULL_KEY) throw new Error("blocked"); return realGetItem(k); };
  global.localStorage.setItem = (k, v) => { if (k === LAST_CATEGORIES_FULL_KEY) throw new Error("blocked"); return realSetItem(k, v); };

  const container = await mount(loadPage("history/page.js"));

  assert.equal(labelFor(container, "row-live-groceries"), "cat_003", "fell back to the raw-id fallback, not a blank/crashed page");

  await flush(g.releaseCategories);

  assert.equal(labelFor(container, "row-live-groceries"), "Groceries", "the fetch itself still resolved and re-rendered correctly");
});
