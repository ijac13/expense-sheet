// Run with: npm test  (compiles app/lib/categories.ts to .test-build first)
// Entity 063, AC-2/AC-3/AC-4/AC-6: the last-fetched live category LIST has to
// survive a page load the same way entity 058's LAST_CATEGORY_KEY already does
// for a single id — read/write/overwrite, and never throw when localStorage
// won't cooperate. Pure functions over plain data; localStorage is the only
// environment needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
global.window = dom.window;
global.localStorage = dom.window.localStorage;

const {
  getCachedCategories,
  saveCachedCategories,
  LAST_CATEGORIES_KEY,
} = require("../.test-build/categories.js");

const LIST_A = [
  { id: "cat_001", name_en: "Eating Out", icon: "🍕", sort_order: 1, is_active: true },
  { id: "cat_003", name_en: "Groceries", icon: "🥕", sort_order: 3, is_active: true },
];
const LIST_B = [
  { id: "cat_777", name_en: "Renamed Category", icon: "🆕", sort_order: 1, is_active: true },
];

test.beforeEach(() => global.localStorage.clear());

test("AC-3: nothing cached yields null", () => {
  assert.equal(getCachedCategories(), null);
});

test("AC-2: a saved list comes back verbatim", () => {
  saveCachedCategories(LIST_A);
  assert.deepEqual(getCachedCategories(), LIST_A);
  assert.ok(global.localStorage.getItem(LAST_CATEGORIES_KEY), "really was stored under the key");
});

test("AC-4: saving again overwrites the previous list, it does not merge or append", () => {
  saveCachedCategories(LIST_A);
  saveCachedCategories(LIST_B);
  const cached = getCachedCategories();
  assert.deepEqual(cached, LIST_B);
  assert.equal(cached.length, 1, "LIST_A's entries did not survive alongside LIST_B's");
});

test("a malformed cached value (not JSON) degrades to null rather than throwing", () => {
  global.localStorage.setItem(LAST_CATEGORIES_KEY, "{not json");
  assert.equal(getCachedCategories(), null);
});

test("an empty array cached degrades to null, same as nothing cached", () => {
  global.localStorage.setItem(LAST_CATEGORIES_KEY, "[]");
  assert.equal(getCachedCategories(), null);
});

test("AC-6: a throwing localStorage.getItem degrades getCachedCategories to null, not a thrown error", () => {
  const orig = global.localStorage.getItem;
  global.localStorage.getItem = () => { throw new Error("storage blocked"); };
  try {
    assert.doesNotThrow(() => getCachedCategories());
    assert.equal(getCachedCategories(), null);
  } finally {
    global.localStorage.getItem = orig;
  }
});

test("AC-6: a throwing localStorage.setItem does not throw out of saveCachedCategories", () => {
  const orig = global.localStorage.setItem;
  global.localStorage.setItem = () => { throw new Error("storage blocked"); };
  try {
    assert.doesNotThrow(() => saveCachedCategories(LIST_A));
  } finally {
    global.localStorage.setItem = orig;
  }
});
