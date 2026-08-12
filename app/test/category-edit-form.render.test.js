// Run with: npm test
// Entity 048. The bug was never "the form does not open" — it opened, in normal
// document flow at the top of the page, ~380px above a captain who was scrolled
// down 18 rows, and Chrome's scroll anchoring then held the visible rows still so
// nothing appeared to happen.
//
// jsdom has no layout engine (every getBoundingClientRect is 0x0), so AC-1's
// literal "bounding rect intersects the viewport" cannot be measured here. What
// can be proven is the property that makes it true at any scroll position: the
// form is rendered inside daisyUI's `.modal`, which the stylesheet fixes to the
// viewport. That is asserted against daisyui.css itself, not against the class
// name, so renaming or re-inlining the container fails this file.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { installGlobals, mount } = require("./helpers/dom.js");

const GOV = ["food_beverage_tobacco", "transport_communication", "health"];

// 18 active rows, the captain's real list length (feedback-screenshots/category-003.png).
// cat_007 has a blank icon cell and no gov_category — the two documented edge cases.
const MANY = Array.from({ length: 18 }, (_, i) => {
  const n = i + 1;
  const cat = {
    id: `cat_${String(n).padStart(3, "0")}`,
    name_en: `Category ${n}`,
    name_zh: `分類${n}`,
    icon: "🍕",
    sort_order: n,
    is_active: true,
    gov_category: GOV[i % GOV.length],
  };
  if (n === 7) {
    cat.icon = "";
    delete cat.gov_category;
  }
  return cat;
});

const DAISY_CSS = fs.readFileSync(
  path.join(__dirname, "../node_modules/daisyui/daisyui.css"),
  "utf8"
);

/** The declarations daisyUI ships for a component class, e.g. `.modal`. */
function componentRule(selector) {
  const start = DAISY_CSS.indexOf(`${selector}{@layer`);
  assert.notEqual(start, -1, `${selector} is a daisyUI component class`);
  const end = DAISY_CSS.indexOf("}}}", start);
  return DAISY_CSS.slice(start, end === -1 ? start + 800 : end);
}

function loadCategoriesPage() {
  return require("../.test-build-ui/settings/categories/page.js").default;
}

function editButtons(container) {
  return [...container.querySelectorAll("button")].filter(
    (b) => b.textContent.trim() === "common.edit"
  );
}

function buttonByLabel(container, label) {
  const el = [...container.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === label
  );
  if (!el) throw new Error(`no button labelled ${label}`);
  return el;
}

async function click(el) {
  await React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
}

/**
 * The form's three text inputs, in render order. Queried positionally because
 * jsdom's selector engine silently returns null for an astral-plane emoji in an
 * attribute value, which would make `input[placeholder="📦"]` a false negative.
 */
function formFields(container) {
  const [icon, nameEn, nameZh] = container.querySelectorAll("input");
  return { icon, nameEn, nameZh, gov: container.querySelector("select") };
}

/** React tracks the previous value on the node, so a bare `.value =` is ignored. */
async function type(input, value) {
  const setter = Object.getOwnPropertyDescriptor(
    global.window.HTMLInputElement.prototype,
    "value"
  ).set;
  await React.act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new global.window.Event("input", { bubbles: true }));
  });
}

/** The form's heading, whichever container the form happens to live in. */
function formTitle(container) {
  return [...container.querySelectorAll("h2")].find((h) =>
    /^cat_mgmt\.form_(edit|add)$/.test(h.textContent.trim())
  );
}

function ancestorWithClass(el, cls) {
  for (let n = el; n; n = n.parentElement) {
    if (n.classList && n.classList.contains(cls)) return n;
  }
  return null;
}

/**
 * Assert the open form is anchored to the viewport rather than sitting in page
 * flow. This is the assertion that fails on main.
 */
function assertFormIsViewportAnchored(container, where) {
  const title = formTitle(container);
  assert.ok(title, `${where}: the form opened at all`);

  const modal = ancestorWithClass(title, "modal");
  assert.ok(
    modal,
    `${where}: the form is inside a .modal container, not in page flow — ` +
      `an inline .card lands wherever the page happens to be scrolled`
  );
  assert.ok(
    modal.classList.contains("modal-open"),
    `${where}: the modal is in its visible state`
  );
  assert.ok(
    ancestorWithClass(title, "modal-box"),
    `${where}: the form content sits in a .modal-box`
  );

  // The class name only means something because of these declarations.
  const modalCss = componentRule(".modal");
  assert.match(modalCss, /position:fixed/, ".modal is fixed to the viewport");
  assert.match(modalCss, /inset:0/, ".modal covers the viewport at any scroll offset");
  assert.match(modalCss, /place-items:center/, ".modal centres its box");
}

test("Edit on any row opens the form anchored to the viewport (AC-1, AC-9)", async () => {
  const { scrolls } = installGlobals({ categories: MANY });
  const container = await mount(loadCategoriesPage());

  const rows = editButtons(container);
  assert.equal(rows.length, 18, "fixture renders 18 editable rows");

  // First, middle and last — the last two are far below a 390x780 fold, which is
  // where the captain always was when the tap appeared to do nothing.
  for (const [label, idx] of [["first row", 0], ["middle row", 8], ["last row", 17]]) {
    await click(editButtons(container)[idx]);
    assertFormIsViewportAnchored(container, label);
    assert.equal(
      formTitle(container).textContent.trim(),
      "cat_mgmt.form_edit",
      `${label}: opened as an edit`
    );
    await click(buttonByLabel(container, "common.cancel"));
  }

  // Being in view must not be achieved by moving the page under the captain.
  assert.deepEqual(scrolls, [], "the page was never scrolled");
});

test("The opened form is pre-filled from the tapped row (AC-2, AC-3, AC-4)", async () => {
  installGlobals({ categories: MANY });
  const container = await mount(loadCategoriesPage());

  await click(editButtons(container)[11]); // cat_012
  const source = MANY[11];

  assert.equal(formTitle(container).textContent.trim(), "cat_mgmt.form_edit", "AC-4");
  const { icon, nameEn, nameZh, gov } = formFields(container);
  assert.equal(icon.value, source.icon);
  assert.equal(nameEn.value, source.name_en);
  assert.equal(nameZh.value, source.name_zh);
  // AC-3: the stored gov_category is the selected option, not merely present.
  assert.equal(gov.value, source.gov_category);
  assert.equal([...gov.options].find((o) => o.selected).value, source.gov_category);
});

test("A row with no gov_category and a blank icon opens on the placeholder (AC-3, edge cases)", async () => {
  installGlobals({ categories: MANY });
  const container = await mount(loadCategoriesPage());

  await click(editButtons(container)[6]); // cat_007: icon "", no gov_category
  assertFormIsViewportAnchored(container, "blank-icon row");

  const { icon, gov } = formFields(container);
  assert.equal(icon.value, "", "empty icon field, not a crash");
  assert.equal(icon.placeholder, "📦", "the 📦 placeholder shows through");

  assert.equal(gov.value, "", "placeholder option is selected");
  assert.equal(gov.options[0].textContent, "cat_mgmt.gov_category_placeholder");
});

test("Editing a second row replaces the form rather than adding one (AC-5)", async () => {
  installGlobals({ categories: MANY });
  const container = await mount(loadCategoriesPage());

  await click(editButtons(container)[2]);
  assert.equal(formFields(container).nameEn.value, "Category 3");

  await click(editButtons(container)[15]);
  assertFormIsViewportAnchored(container, "second edit");
  assert.equal(
    formFields(container).nameEn.value,
    "Category 16",
    "the form switched to row B"
  );
  assert.equal(
    container.querySelectorAll(".modal-box").length,
    1,
    "exactly one form is rendered"
  );
});

test("Add Category still opens an empty add form in view (AC-6)", async () => {
  const { scrolls } = installGlobals({ categories: MANY });
  const container = await mount(loadCategoriesPage());

  await click(buttonByLabel(container, "cat_mgmt.add"));
  assertFormIsViewportAnchored(container, "add");
  assert.equal(formTitle(container).textContent.trim(), "cat_mgmt.form_add");
  assert.equal(formFields(container).nameEn.value, "");
  assert.equal(formFields(container).gov.value, "");
  assert.deepEqual(scrolls, [], "opening the add form scrolls nothing");
});

test("Cancel and Save leave the captain exactly where they were (AC-7, AC-8)", async () => {
  const { scrolls, requests } = installGlobals({ categories: MANY });
  const container = await mount(loadCategoriesPage());

  // AC-7: cancel from a below-the-fold row.
  await click(editButtons(container)[16]);
  await click(buttonByLabel(container, "common.cancel"));
  assert.equal(formTitle(container), undefined, "the form closed");
  assert.ok(container.textContent.includes("Category 17"), "the edited row is still on the page");
  assert.deepEqual(scrolls, [], "cancel did not move the page");

  // AC-8: save from a below-the-fold row.
  await click(editButtons(container)[16]);
  await type(formFields(container).nameEn, "Category 17 renamed");
  await click(buttonByLabel(container, "common.save"));
  await React.act(async () => {});

  assert.equal(formTitle(container), undefined, "the form closed on save");
  // The typed edit reached the row that was tapped — the modal's fields are live,
  // and the save targeted row 17 rather than whichever row happened to be on screen.
  assert.ok(container.textContent.includes("Category 17 renamed"), "the edited row is on the page");
  assert.ok(requests.includes("/api/categories/cat_017"), "saved the tapped row");

  const toast = container.querySelector(".toast");
  assert.ok(toast, "the success toast rendered");
  assert.ok(toast.textContent.includes("cat_mgmt.save_success"));
  assert.deepEqual(scrolls, [], "save did not move the page");
});

test("A form taller than the viewport stays reachable and clears the staging banner (edge cases)", () => {
  // StagingBanner is `fixed top-0 ... h-6`, so the top 1.5rem of the viewport is
  // covered on staging. `.modal-middle` caps the box at 100vh - 5em and centres
  // it, leaving 2.5em (~40px) above — more than the banner's 24px. The default
  // `.modal-box` cap of 100vh would park a tall form's title underneath it.
  const middle = componentRule(".modal-middle");
  assert.match(middle, /place-items:center/);
  assert.match(middle, /max-height:calc\(100vh - 5em\)/);

  const box = componentRule(".modal-box");
  assert.match(box, /overflow-y:auto/, "a tall form scrolls inside the box");

  const banner = fs.readFileSync(
    path.join(__dirname, "../app/components/StagingBanner.tsx"),
    "utf8"
  );
  assert.match(banner, /h-6/, "the banner is still 1.5rem tall");
  assert.match(banner, /z-50/, "and below .modal's z-index of 999");
  assert.match(componentRule(".modal"), /z-index:999/);
});

test("Short lists, archive-from-form and a dead category API still behave (edge cases)", async () => {
  const { scrolls } = installGlobals({ categories: MANY.slice(0, 2) });
  let container = await mount(loadCategoriesPage());

  // A list shorter than the viewport: the form was already visible, so the fix
  // must not introduce a jump.
  await click(editButtons(container)[1]);
  assertFormIsViewportAnchored(container, "short list");
  assert.deepEqual(scrolls, [], "no scroll on an already-visible form");

  // Archive from inside the open form closes it and leaves the list usable.
  await click(buttonByLabel(container, "cat_mgmt.archive"));
  await React.act(async () => {});
  assert.equal(formTitle(container), undefined, "archiving closed the form");
  assert.equal(editButtons(container).length, 1, "the remaining row is still editable");
  assert.deepEqual(scrolls, [], "archiving did not move the page");

  // Category API down: no rows, no Edit buttons, page still renders.
  installGlobals({ offline: true });
  container = await mount(loadCategoriesPage());
  assert.equal(editButtons(container).length, 0);
  assert.ok(container.textContent.includes("cat_mgmt.title"), "the page rendered");
});
