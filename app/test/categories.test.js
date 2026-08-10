// Run with: npm test  (compiles app/lib/categories.ts to .test-build first)
// Exercises the legacy-slug -> live-category bridge behind every category icon.
// Pure functions over plain data — no DOM, no network.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveCategory,
  resolveCategoryIcon,
  categoryIcon,
  FALLBACK_ICON,
  DEFAULT_CATEGORIES,
} = require("../.test-build/categories.js");

// Production shape: ids are cat_NNN, and the icons deliberately differ from the
// baked-in DEFAULT_CATEGORIES ones so a test can tell which source was used.
const LIVE = [
  { id: "cat_001", name_en: "Eating Out", name_zh: "外食", icon: "🍕", sort_order: 1, is_active: true },
  { id: "cat_003", name_en: "Groceries", name_zh: "食材", icon: "🥕", sort_order: 3, is_active: true },
  { id: "cat_015", name_en: "Fuel", name_zh: "加油", icon: "🛢️", sort_order: 15, is_active: false },
  { id: "cat_099", name_en: "Blank Icon", name_zh: "空白", icon: "", sort_order: 99, is_active: true },
  { id: "insurance", name_en: "Insurance", name_zh: "保險", icon: "🛡️", sort_order: 24, is_active: true },
];

test("AC-10: an id present in the live list resolves to that live category", () => {
  assert.equal(resolveCategory("cat_001", LIVE).id, "cat_001");
  assert.equal(resolveCategoryIcon("cat_001", LIVE), "🍕");
  // A non-cat_NNN live id (entity 042's insurance/tax) takes the same direct path.
  assert.equal(resolveCategoryIcon("insurance", LIVE), "🛡️");
  // Home's chip, Home's and the Edit Expense picker's grid, and Category
  // Management's rows swapped `cat.icon` for `categoryIcon(cat)`. For every
  // category that has an icon that is the identity function, so those surfaces
  // render exactly what they render today.
  for (const c of [...LIVE, ...DEFAULT_CATEGORIES]) {
    if (c.icon) assert.equal(categoryIcon(c), c.icon, c.id);
  }
});

test("AC-1/AC-3/AC-4: a legacy slug bridges to the live category and the LIVE icon wins", () => {
  // 651 production expenses carry `eating-out`, which is in no live category.
  const resolved = resolveCategory("eating-out", LIVE);
  assert.equal(resolved.id, "cat_001");
  // 🍕 is the live icon; 🍜 is the baked-in one. Reading DEFAULT_CATEGORIES
  // instead of bridging through name_en would return 🍜 and fail here — which is
  // exactly the "icon edits never reach these rows" defect.
  assert.equal(resolveCategoryIcon("eating-out", LIVE), "🍕");
  assert.notEqual(resolveCategoryIcon("eating-out", LIVE), "🍜");
  assert.equal(resolveCategoryIcon("groceries", LIVE), "🥕");
});

test("AC-6: an archived category still resolves, by slug and by id", () => {
  // History and the drill-down filter their list to is_active for the picker; the
  // resolver is handed the unfiltered list, so `fuel` must still find cat_015.
  assert.equal(resolveCategoryIcon("fuel", LIVE), "🛢️");
  assert.equal(resolveCategoryIcon("cat_015", LIVE), "🛢️");
  // Passing an is_active-filtered list is the mistake this guards against.
  const activeOnly = LIVE.filter((c) => c.is_active);
  assert.notEqual(resolveCategoryIcon("fuel", activeOnly), "🛢️");
});

test("AC-5: an id in neither the live list nor the slug map falls back, without throwing", () => {
  assert.equal(resolveCategory("cat_777", LIVE), undefined);
  assert.equal(resolveCategoryIcon("cat_777", LIVE), FALLBACK_ICON);
  assert.equal(resolveCategoryIcon("", LIVE), FALLBACK_ICON);
});

test("AC-12: a blank or whitespace icon cell never reaches the DOM as an empty string", () => {
  // functions/src/index.ts:78 returns `icon: row[3] ?? ""` for a blank cell, and
  // "" survives `??` — the guard has to be `||`, not `??`.
  assert.equal(resolveCategoryIcon("cat_099", LIVE), FALLBACK_ICON);
  assert.equal(categoryIcon({ icon: "" }), FALLBACK_ICON);
  assert.equal(categoryIcon({ icon: "   " }), FALLBACK_ICON);
  assert.equal(categoryIcon(undefined), FALLBACK_ICON);
  assert.notEqual(categoryIcon({ icon: "" }), "");
});

test("AC-11: with the live fetch failed, callers pass DEFAULT_CATEGORIES and every id still resolves", () => {
  for (const c of DEFAULT_CATEGORIES) {
    assert.equal(resolveCategoryIcon(c.id, DEFAULT_CATEGORIES), c.icon, `slug ${c.id}`);
  }
  assert.equal(resolveCategoryIcon("cat_001", DEFAULT_CATEGORIES), FALLBACK_ICON);
});

test("the bridge is name_en-keyed, so a live rename detaches the slug rather than mismatching it", () => {
  const renamed = [{ id: "cat_001", name_en: "Dining Out", name_zh: "外食", icon: "🍕", sort_order: 1, is_active: true }];
  // No live category is named "Eating Out" any more, so the slug falls back to its
  // baked-in entry instead of silently attaching to an unrelated category.
  assert.equal(resolveCategory("eating-out", renamed).icon, "🍜");
});
