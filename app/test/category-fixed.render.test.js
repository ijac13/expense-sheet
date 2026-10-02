// Run with: npm test
// Entity 071, AC-8. Mounts the real Category Management page and drives the
// edit form: the Fixed switch opens on the resolved value (stored switch, else
// the default by name), and a toggled switch reaches the PATCH body.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mount } = require("./helpers/dom.js");

const CATEGORIES = [
  { id: "cat_003", name_en: "Groceries", name_zh: "食材", icon: "🥕", sort_order: 3, is_active: true, gov_category: "food_beverage_tobacco", note: "" },
  { id: "cat_023", name_en: "Insurance", name_zh: "保險", icon: "🛡️", sort_order: 23, is_active: true, gov_category: "insurance_financial", note: "" },
  { id: "cat_021", name_en: "Mortgage", name_zh: "房貸", icon: "🏡", sort_order: 21, is_active: true, gov_category: "housing_utilities", note: "", fixed: false },
];

const loadPage = () => require("../.test-build-ui/settings/categories/page.js").default;

async function click(el) {
  await React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
  await React.act(async () => {});
}

/** The list row for a category, found by its English name. */
function rowFor(container, name) {
  return [...container.querySelectorAll("div.border")].find((el) =>
    [...el.querySelectorAll("span.font-medium")].some((s) => s.textContent === name)
  );
}

async function openEdit(container, name) {
  const edit = [...rowFor(container, name).querySelectorAll("button")].find(
    (b) => b.textContent.trim() === "common.edit"
  );
  await click(edit);
  const toggle = container.querySelector('[data-testid="category-fixed-toggle"]');
  assert.ok(toggle, "the edit form has a Fixed switch");
  return toggle;
}

const button = (c, label) => [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === label);

test("AC-8: the switch opens on the resolved value — default by name, else the stored switch", async () => {
  installGlobals({ categories: CATEGORIES });
  const page = await mount(loadPage());

  assert.equal((await openEdit(page, "Insurance")).checked, true, "blank Insurance defaults on");
  await click(button(page, "common.cancel"));
  assert.equal((await openEdit(page, "Groceries")).checked, false, "blank Groceries defaults off");
  await click(button(page, "common.cancel"));
  assert.equal((await openEdit(page, "Mortgage")).checked, false, "a stored false wins over the name default");
});

test("AC-8: the list shows a Fixed badge on fixed categories only", async () => {
  installGlobals({ categories: CATEGORIES });
  const page = await mount(loadPage());
  const hasBadge = (name) => rowFor(page, name).textContent.includes("cat_mgmt.fixed_badge");

  assert.equal(hasBadge("Insurance"), true);
  assert.equal(hasBadge("Groceries"), false);
  assert.equal(hasBadge("Mortgage"), false);
});

test("AC-8: toggling the switch and saving sends fixed in the PATCH body", async () => {
  const g = installGlobals({ categories: CATEGORIES });
  const page = await mount(loadPage());

  const toggle = await openEdit(page, "Groceries");
  await click(toggle);
  await click(button(page, "common.save"));

  const patch = g.writes.filter((w) => w.method === "PATCH").pop();
  assert.equal(patch.href, "/api/categories/cat_003");
  assert.equal(patch.body.fixed, true);
  assert.ok(rowFor(page, "Groceries").textContent.includes("cat_mgmt.fixed_badge"), "the badge follows the save");

  const off = await openEdit(page, "Insurance");
  await click(off);
  await click(button(page, "common.save"));
  assert.equal(g.writes.filter((w) => w.method === "PATCH").pop().body.fixed, false, "switching a default off is stored");
});

test("AC-8: an edit that leaves the switch alone does not write fixed", async () => {
  const g = installGlobals({ categories: CATEGORIES });
  const page = await mount(loadPage());

  await openEdit(page, "Insurance");
  await click(button(page, "common.save"));
  const patch = g.writes.filter((w) => w.method === "PATCH").pop();
  assert.equal(patch.href, "/api/categories/cat_023");
  assert.equal("fixed" in patch.body, false, "an untouched default stays unset, so it keeps following the name rule");
});
