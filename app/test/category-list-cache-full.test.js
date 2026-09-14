// Run with: npm test  (compiles app/lib/categories.ts to .test-build first)
// Entity 069, AC-3/AC-4: History's full (active + archived) category cache is
// the same last-known-good pattern entity 063 shipped for the active-only one
// (test/category-list-cache.test.js), keyed separately so the two never
// collide. Pure functions over plain data; localStorage is the only
// environment needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
global.window = dom.window;
global.localStorage = dom.window.localStorage;

const {
  getCachedCategoriesFull,
  saveCachedCategoriesFull,
  LAST_CATEGORIES_FULL_KEY,
} = require("../.test-build/categories.js");

const LIST_A = [
  { id: "cat_001", name_en: "Eating Out", icon: "🍕", sort_order: 1, is_active: true },
  { id: "cat_015", name_en: "Fuel", icon: "🛢️", sort_order: 15, is_active: false },
];
const LIST_B = [
  { id: "cat_777", name_en: "Renamed Category", icon: "🆕", sort_order: 1, is_active: true },
];

test.beforeEach(() => global.localStorage.clear());

test("AC-3: nothing cached yields null", () => {
  assert.equal(getCachedCategoriesFull(), null);
});

test("AC-3: a saved list comes back verbatim, archived entries included", () => {
  saveCachedCategoriesFull(LIST_A);
  assert.deepEqual(getCachedCategoriesFull(), LIST_A);
  assert.ok(global.localStorage.getItem(LAST_CATEGORIES_FULL_KEY), "really was stored under the key");
});

test("AC-3: saving again overwrites the previous list, it does not merge or append", () => {
  saveCachedCategoriesFull(LIST_A);
  saveCachedCategoriesFull(LIST_B);
  const cached = getCachedCategoriesFull();
  assert.deepEqual(cached, LIST_B);
  assert.equal(cached.length, 1, "LIST_A's entries did not survive alongside LIST_B's");
});

test("the full-list cache is independent of the active-only cache's key", () => {
  const { LAST_CATEGORIES_KEY } = require("../.test-build/categories.js");
  assert.notEqual(LAST_CATEGORIES_FULL_KEY, LAST_CATEGORIES_KEY);
});

test("a malformed cached value (not JSON) degrades to null rather than throwing", () => {
  global.localStorage.setItem(LAST_CATEGORIES_FULL_KEY, "{not json");
  assert.equal(getCachedCategoriesFull(), null);
});

test("an empty array cached degrades to null, same as nothing cached", () => {
  global.localStorage.setItem(LAST_CATEGORIES_FULL_KEY, "[]");
  assert.equal(getCachedCategoriesFull(), null);
});

test("AC-4: a throwing localStorage.getItem degrades getCachedCategoriesFull to null, not a thrown error", () => {
  const orig = global.localStorage.getItem;
  global.localStorage.getItem = () => { throw new Error("storage blocked"); };
  try {
    assert.doesNotThrow(() => getCachedCategoriesFull());
    assert.equal(getCachedCategoriesFull(), null);
  } finally {
    global.localStorage.getItem = orig;
  }
});

test("AC-4: a throwing localStorage.setItem does not throw out of saveCachedCategoriesFull", () => {
  const orig = global.localStorage.setItem;
  global.localStorage.setItem = () => { throw new Error("storage blocked"); };
  try {
    assert.doesNotThrow(() => saveCachedCategoriesFull(LIST_A));
  } finally {
    global.localStorage.setItem = orig;
  }
});
