// Run with: npm test
// Entity 063, AC-1/AC-2/AC-3/AC-4/AC-5/AC-6. Mounts the real Home page and
// asserts on what's actually on screen: which category list paints first,
// whether Save is correctly gated while that happens, whether the cache is
// kept fresh, and whether a same-value refresh remounts the grid or leaves it
// alone. See test/helpers/dom.js for what the fetch/localStorage stubs emulate.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, CATEGORIES } = require("./helpers/dom.js");

const { DEFAULT_CATEGORIES, LAST_CATEGORIES_KEY } = require("../.test-build/categories.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

const buttons = (c) => [...c.querySelectorAll("button")];
const byText = (c, text) => buttons(c).find((b) => b.textContent.includes(text));
const saveButton = (c) => byText(c, "home.save");
const selectedTile = (c) => buttons(c).filter((b) => b.className.includes("ring-primary"));
const statusLine = (c) => c.querySelector('[data-testid="category-status"]');
const tileFor = (c, name) => buttons(c).find((b) => b.textContent.includes(name));

const ACTIVE_FIXTURE = CATEGORIES.filter((c) => c.is_active).map((c) => ({ ...c }));
const CACHED = [
  { id: "cat_501", name_en: "Cached Category", name_zh: "快取類別", icon: "🗂️", sort_order: 1, is_active: true, gov_category: "miscellaneous" },
];
const RENAMED = [
  { id: "cat_777", name_en: "Renamed Category", name_zh: "改名類別", icon: "🆕", sort_order: 1, is_active: true, gov_category: "miscellaneous" },
];

/** Fresh globals, optionally with the category-list cache pre-seeded. */
async function mountHome({ cached, cachedRaw, ...opts } = {}) {
  const g = installGlobals(opts);
  if (cachedRaw !== undefined) global.localStorage.setItem(LAST_CATEGORIES_KEY, cachedRaw);
  else if (cached !== undefined) global.localStorage.setItem(LAST_CATEGORIES_KEY, JSON.stringify(cached));
  const container = await mount(loadPage("page.js"));
  return { ...g, container };
}

async function flush(fn) {
  await React.act(async () => { fn(); });
  await React.act(async () => {});
}

// ---------------------------------------------------------------------------
// AC-2 / AC-3 — first-paint source.
// ---------------------------------------------------------------------------

test("AC-2: a device with a cached live list paints that list first, before the fetch resolves", async () => {
  const { container } = await mountHome({ cached: CACHED, deferCategories: true });
  assert.ok(container.textContent.includes("Cached Category"), "the cached tile is already on screen");
  assert.ok(!container.textContent.includes(DEFAULT_CATEGORIES[0].name_en), "DEFAULT_CATEGORIES did not paint");
});

test("AC-3: a device with no cache still paints DEFAULT_CATEGORIES first, exactly as today", async () => {
  const { container } = await mountHome({ deferCategories: true });
  assert.ok(container.textContent.includes(DEFAULT_CATEGORIES[0].name_en), "DEFAULT_CATEGORIES tiles render non-blank");
  assert.equal(saveButton(container).disabled, true);
});

// ---------------------------------------------------------------------------
// AC-1 — Save stays correctly gated regardless of first-paint source.
// ---------------------------------------------------------------------------

test("AC-1: Save stays disabled until the live fetch resolves, even when the grid painted from a cache", async () => {
  const { container, releaseCategories } = await mountHome({ cached: CACHED, deferCategories: true });

  assert.equal(saveButton(container).disabled, true, "disabled while categoriesReady is still false");
  assert.match(statusLine(container).textContent, /categories_loading/);
  assert.equal(selectedTile(container).length, 0, "nothing is committed to as selected yet");

  await flush(releaseCategories);

  assert.equal(saveButton(container).disabled, false, "enables once the live fetch actually resolves");
  assert.equal(selectedTile(container).length, 1, "a live id is selected, not a cached/placeholder one");
});

// ---------------------------------------------------------------------------
// AC-4 — the cache is kept fresh, not stuck on the first-ever snapshot.
// ---------------------------------------------------------------------------

test("AC-4: the cache is overwritten after every successful fetch, not just the first", async () => {
  await mountHome();
  const afterFirst = JSON.parse(global.localStorage.getItem(LAST_CATEGORIES_KEY));
  assert.ok(afterFirst.some((c) => c.name_en === "Eating Out"), "first fetch's response was cached");

  await mountHome({ cachedRaw: global.localStorage.getItem(LAST_CATEGORIES_KEY), categories: RENAMED });
  const afterSecond = JSON.parse(global.localStorage.getItem(LAST_CATEGORIES_KEY));
  assert.equal(afterSecond.length, 1);
  assert.equal(afterSecond[0].name_en, "Renamed Category");
  assert.ok(!afterSecond.some((c) => c.name_en === "Eating Out"), "overwritten, not stuck on the first-ever snapshot");
});

// ---------------------------------------------------------------------------
// AC-5 — a same-value refresh does not remount the grid.
// ---------------------------------------------------------------------------

test("AC-5: when the fetch resolves to the same list already cached, no tile remounts", async () => {
  const { container, releaseCategories } = await mountHome({ cached: ACTIVE_FIXTURE, deferCategories: true });

  const before1 = tileFor(container, "Eating Out");
  const before2 = tileFor(container, "Groceries");
  assert.ok(before1 && before2, "cached tiles are on screen before the fetch resolves");

  await flush(releaseCategories);

  const after1 = tileFor(container, "Eating Out");
  const after2 = tileFor(container, "Groceries");
  assert.equal(before1, after1, "same DOM node — no unmount/remount for an unchanged category");
  assert.equal(before2, after2, "same DOM node — no unmount/remount for an unchanged category");
});

// ---------------------------------------------------------------------------
// AC-6 — a throwing category-list cache degrades cleanly.
// ---------------------------------------------------------------------------

test("AC-6: a throwing category-list cache degrades to DEFAULT_CATEGORIES first paint and never throws", async () => {
  const g = installGlobals({ deferCategories: true });
  const realGetItem = global.localStorage.getItem.bind(global.localStorage);
  const realSetItem = global.localStorage.setItem.bind(global.localStorage);
  // Only the NEW cache key throws — LAST_CATEGORY_KEY (the single last-used id,
  // entity 058) keeps working, so this isolates the new mechanism's own fallback
  // rather than tripping over an unrelated storage key.
  global.localStorage.getItem = (k) => { if (k === LAST_CATEGORIES_KEY) throw new Error("blocked"); return realGetItem(k); };
  global.localStorage.setItem = (k, v) => { if (k === LAST_CATEGORIES_KEY) throw new Error("blocked"); return realSetItem(k, v); };

  // No try/catch here: a page that crashes on a throwing cache would reject
  // this await and fail the test, exactly like an unhandled error reaching the
  // real browser would fail the real page.
  const container = await mount(loadPage("page.js"));

  assert.ok(container.textContent.includes(DEFAULT_CATEGORIES[0].name_en), "fell back to DEFAULT_CATEGORIES, not a blank/crashed page");
  assert.equal(saveButton(container).disabled, true);

  await flush(g.releaseCategories);

  assert.equal(saveButton(container).disabled, false, "the fetch itself still resolved and Save enabled normally");
  assert.equal(selectedTile(container).length, 1, "a live category ended up selected despite the throwing cache");
});
