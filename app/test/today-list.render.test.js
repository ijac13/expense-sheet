// Run with: npm test
// AC-13. TodayExpenseList was the one surface entity 044 never reached: it looked
// a category up in DEFAULT_CATEGORIES directly, so any row already carrying a live
// `cat_NNN` id missed and rendered the generic Lucide `Package` glyph with the raw
// id as its label. The 054 migration rewrites EVERY stored id to `cat_NNN`, which
// would have made that miss universal. These tests assert on the glyph and the
// label that reach the DOM, not on which helper was called.
//
// Note: the component has no caller today — entity 049 verified it is dead code
// (sole CATEGORY_ICONS consumer, zero imports repo-wide). It is mounted directly
// here, which is also how it would render once wired up.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { CATEGORIES, expense, installGlobals, mount } = require("./helpers/dom.js");

const FALLBACK = "💰";

const loadList = () => require("../.test-build-ui/components/TodayExpenseList.js").default;

// Post-migration rows: every stored id is a live `cat_NNN`, which is exactly the
// state entity 054's script leaves the Expenses tab in.
const MIGRATED = [
  expense("t1", "cat_001", "row-eating-out"),
  expense("t2", "cat_003", "row-groceries"),
  expense("t3", "cat_015", "row-archived"),
  expense("t4", "cat_099", "row-blank-icon"),
  expense("t5", "cat_777", "row-orphan"),
];

// Pre-migration rows, kept working so the fix is safe to land before the run.
const LEGACY = [
  expense("l1", "eating-out", "row-slug"),
  expense("l2", "fuel", "row-slug-archived"),
];

function render(expenses, categories = CATEGORIES) {
  const List = loadList();
  return mount(() => React.createElement(List, { expenses, categories }));
}

/** The <a> row whose notes match `marker`. */
function row(container, marker) {
  const found = [...container.querySelectorAll("a")].find((el) =>
    el.textContent.includes(marker)
  );
  if (!found) throw new Error(`no row containing ${marker}`);
  return found;
}

const iconOf = (container, marker) =>
  row(container, marker).querySelector(".text-xl").textContent;

/** The category label — the first line of the middle column. */
const labelOf = (container, marker) =>
  row(container, marker).querySelector(".text-\\[15px\\]").textContent;

test("AC-13: a migrated row renders the live category name and icon", async () => {
  installGlobals();
  const container = await render(MIGRATED);

  // The falsifier for the whole entity: revert line 24 to
  // `DEFAULT_CATEGORIES.find(c => c.id === exp.category_id)` and both of these
  // flip — the label becomes the raw "cat_001" and the icon becomes <Package/>.
  assert.equal(labelOf(container, "row-eating-out"), "Eating Out");
  assert.equal(iconOf(container, "row-eating-out"), "🍕");
  assert.equal(labelOf(container, "row-groceries"), "Groceries");
  assert.equal(iconOf(container, "row-groceries"), "🥕");

  // No stored id leaks into the DOM as a user-visible label.
  assert.doesNotMatch(container.textContent, /cat_0\d\d/);

  // The Lucide placeholder rendered an <svg>; the live icon is text. An <svg>
  // anywhere in a row means the component fell back to Package again.
  assert.equal(row(container, "row-eating-out").querySelector("svg"), null);

  // 🍜 is DEFAULT_CATEGORIES' baked-in Eating Out icon. Seeing it would mean the
  // icon came from the hardcoded map rather than the sheet, so a Category
  // Management edit could never reach this surface.
  assert.notEqual(iconOf(container, "row-eating-out"), "🍜");
});

test("AC-13: an archived live category still resolves", async () => {
  installGlobals();
  const container = await render(MIGRATED);

  // cat_015 is is_active:false. Resolution takes the UNFILTERED live list, so an
  // archived category still renders its real name and icon rather than a blank.
  assert.equal(labelOf(container, "row-archived"), "Fuel");
  assert.equal(iconOf(container, "row-archived"), "🛢️");
});

test("AC-13: a blank icon cell falls back to the placeholder, never to nothing", async () => {
  installGlobals();
  const container = await render(MIGRATED);

  // The API returns icon:"" for a blank column cell, and "" survives `??` — the
  // `||` guard inside categoryIcon() is what keeps an empty glyph off the screen.
  assert.equal(iconOf(container, "row-blank-icon"), FALLBACK);
  assert.equal(labelOf(container, "row-blank-icon"), "Blank Icon");
});

test("AC-13: an id in neither list degrades to the placeholder and the raw id", async () => {
  installGlobals();
  const container = await render(MIGRATED);

  // AC-7 halts the migration before this can be created, so it only happens if a
  // category is deleted from the sheet afterwards. Matches History's behaviour:
  // show the id rather than an empty row, so the bad data is visible.
  assert.equal(iconOf(container, "row-orphan"), FALLBACK);
  assert.equal(labelOf(container, "row-orphan"), "cat_777");
});

test("AC-13: legacy slugs still bridge, so the fix is safe to land before the run", async () => {
  installGlobals();
  const container = await render(LEGACY);

  // resolveCategory bridges slug -> DEFAULT_CATEGORIES name_en -> live category.
  // The LIVE icon wins (🍕, not the baked-in 🍜) on both the active and the
  // archived case, so rows still carrying slugs are no worse off than before.
  assert.equal(labelOf(container, "row-slug"), "Eating Out");
  assert.equal(iconOf(container, "row-slug"), "🍕");
  assert.equal(labelOf(container, "row-slug-archived"), "Fuel");
  assert.equal(iconOf(container, "row-slug-archived"), "🛢️");
});

test("AC-13: with the category fetch down every row still renders a defined glyph", async () => {
  installGlobals();
  // An empty live list is what a caller holds while GET /api/categories is failing.
  const container = await render([...MIGRATED, ...LEGACY], []);

  // The migration's documented offline cost (spec Edge Cases): a migrated row has
  // no cat_NNN entry in DEFAULT_CATEGORIES to fall back to, so it degrades to the
  // placeholder and the raw id. Recorded here, not fixed — the point is that it
  // degrades rather than crashing or rendering an empty glyph.
  for (const marker of ["row-eating-out", "row-groceries", "row-archived", "row-orphan"]) {
    assert.equal(iconOf(container, marker), FALLBACK, marker);
  }
  // Slug rows keep their baked-in icons, which is the whole point of the fallback.
  assert.equal(iconOf(container, "row-slug"), "🍜");
  assert.equal(iconOf(container, "row-slug-archived"), "⛽");
  assert.ok(container.textContent.includes("row-orphan"), "list rendered, did not blank");
});

test("AC-13: an empty day renders the empty state, not an empty list", async () => {
  installGlobals();
  const container = await render([]);
  assert.match(container.textContent, /No expenses today/);
});
