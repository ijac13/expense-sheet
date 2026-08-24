// Run with: npm test  (compiles app/lib/categories.ts to .test-build first)
// Entity 058, AC-1 and AC-3..AC-5: the last-used category has to survive a page
// load, and the fallback when it cannot must be a LIVE id rather than a slug.
// Pure functions over plain data; localStorage is the only environment needed.
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
global.window = dom.window;
global.localStorage = dom.window.localStorage;

const {
  getDefaultCategory,
  pickCategoryId,
  saveLastCategory,
  LAST_CATEGORY_KEY,
  DEFAULT_CATEGORIES,
} = require("../.test-build/categories.js");

// Production shape. cat_015 is archived, so it is in the tab but not in the
// ACTIVE list a picker is handed.
const LIVE = [
  { id: "cat_001", name_en: "Eating Out", icon: "🍕", sort_order: 1, is_active: true },
  { id: "cat_003", name_en: "Groceries", icon: "🥕", sort_order: 3, is_active: true },
  { id: "cat_015", name_en: "Fuel", icon: "🛢️", sort_order: 15, is_active: false },
];
const ACTIVE = LIVE.filter((c) => c.is_active);
const LIVE_ID = /^cat_\d+$/;
const SLUGS = new Set(DEFAULT_CATEGORIES.map((c) => c.id));

test.beforeEach(() => global.localStorage.clear());

test("AC-1: a stored live cat_NNN id is returned verbatim", () => {
  saveLastCategory("cat_003");
  // The whole defect in one line: the old DEFAULT_CATEGORIES.find guard rejected
  // this exact value and returned the `eating-out` slug instead, so the captain's
  // choice was written to localStorage and thrown away on the very next load.
  assert.equal(getDefaultCategory(), "cat_003");
  assert.notEqual(getDefaultCategory(), "eating-out");
  assert.equal(global.localStorage.getItem(LAST_CATEGORY_KEY), "cat_003", "and it really was stored");
});

test("AC-1: nothing stored yields \"\", never a slug to fall back on", () => {
  // Returning DEFAULT_CATEGORIES[0].id here is what seeded `eating-out` into
  // every fresh page load. "" is not submittable, which is the point.
  assert.equal(getDefaultCategory(), "");
  assert.ok(!SLUGS.has(getDefaultCategory()));
});

test("AC-1: the guard is gone entirely — a stored slug also comes back verbatim", () => {
  // getDefaultCategory validates nothing by design; only pickCategoryId, which
  // can see the live list, is allowed to reject a stored value.
  saveLastCategory("eating-out");
  assert.equal(getDefaultCategory(), "eating-out");
});

test("AC-3: with nothing stored, the pick is the first ACTIVE live category", () => {
  const picked = pickCategoryId("", ACTIVE);
  assert.equal(picked, "cat_001");
  assert.match(picked, LIVE_ID);
  assert.ok(!SLUGS.has(picked), "never a DEFAULT_CATEGORIES slug");
});

test("AC-3: a stored live id that is still active is kept, not reset", () => {
  // The other half of AC-3: the fallback must not fire when it should not.
  assert.equal(pickCategoryId("cat_003", ACTIVE), "cat_003");
});

test("AC-4: an id deleted from the tab falls back to a live id", () => {
  const picked = pickCategoryId("cat_777", ACTIVE);
  assert.equal(picked, "cat_001");
  assert.match(picked, LIVE_ID);
});

test("AC-4: a legacy slug falls back to a live id rather than being kept", () => {
  // Every device that used the app before this fix has a slug in localStorage.
  const picked = pickCategoryId("eating-out", ACTIVE);
  assert.notEqual(picked, "eating-out");
  assert.match(picked, LIVE_ID);
});

test("AC-5: an id that is in the tab but is_active:false falls back", () => {
  // cat_015 exists, so resolveCategory still renders it on historical rows — but
  // the picker draws no tile for it, so a selection sitting on it would highlight
  // nothing. Passing the ACTIVE list is what makes this fall back.
  assert.equal(pickCategoryId("cat_015", ACTIVE), "cat_001");
  // Handed the UNFILTERED list it would be kept — the mistake this guards.
  assert.equal(pickCategoryId("cat_015", LIVE), "cat_015");
});

test("an empty live list yields \"\" rather than reaching for a slug", () => {
  // The degraded state. "" keeps confirm disabled; a slug here would restore the
  // exact silent-bad-write path this entity removes.
  assert.equal(pickCategoryId("", []), "");
  assert.equal(pickCategoryId("eating-out", []), "");
});
