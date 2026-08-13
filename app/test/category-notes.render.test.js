// Run with: npm test
// Category notes (entity 043). Mounts the real Home and Category Management
// components and asserts on what reaches the DOM and on the request bodies that
// leave the page — not on which helper was called.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, CATEGORIES } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");

const EATING_OUT_NOTE = CATEGORIES[0].note; // "restaurants and takeaway, not groceries"

// Home calls useAuth to attribute paid_by; the real provider needs Firebase and a
// Google popup. Stub it before any page module captures the real one.
mockAuth();

function loadPage(path) {
  return require(`../.test-build-ui/${path}`).default;
}

const click = (el) =>
  React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

/** Home's header block — the note has to live inside this, not in an overlay.
 *  Scoped to a direct child of <main>, since the Save button is .bg-primary too. */
const header = (container) => container.querySelector("main > .bg-primary");

/** The header's direct children, which is where "its own line" is decided. */
const headerLines = (container) => [...header(container).children];

const noteLine = (container, text) =>
  headerLines(container).find((el) => el.textContent === text);

const tile = (container, label) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent.includes(label));

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

test("AC-14: the selected category's note renders on its own line under the name", async () => {
  installGlobals();
  const container = await mount(loadPage("page.js"));

  const line = noteLine(container, EATING_OUT_NOTE);
  assert.ok(line, "a header child holds exactly the note text");

  // "Its own line": it is a separate element from the row carrying the name, and
  // it sits between that row and the amount — not appended into the name row.
  const lines = headerLines(container);
  const nameRow = lines.find((el) => el.textContent.includes("Eating Out"));
  const amount = lines.find((el) => el.className.includes("text-5xl"));
  assert.notEqual(nameRow, line, "the note is not inside the name row");
  assert.ok(lines.indexOf(line) > lines.indexOf(nameRow), "note comes after the name");
  assert.ok(lines.indexOf(line) < lines.indexOf(amount), "note comes before the amount");

  // On load `categoryId` is the DEFAULT_CATEGORIES slug `eating-out`, which no
  // live cat_NNN category has as its id. Nothing has been tapped, so the note
  // above resolved through the slug bridge — otherwise the feature would show
  // nothing at all until the captain first tapped a tile.
  assert.equal(global.window.localStorage.getItem("expense_last_category_id"), null);
});

test("AC-15: a category with no note renders no note element at all", async () => {
  installGlobals();
  const container = await mount(loadPage("page.js"));
  const withNote = headerLines(container).length;

  // cat_003 (Groceries) carries note: "" — the blank-column-H shape.
  await click(tile(container, "Groceries"));
  const withoutNote = headerLines(container).length;

  assert.equal(withoutNote, withNote - 1, "the note element is gone, not blanked");
  assert.ok(
    !headerLines(container).some((el) => el.textContent === ""),
    "no empty element left behind to occupy vertical space"
  );

  // cat_099 carries a whitespace-only note, which must behave exactly as unset.
  await click(tile(container, "Blank Icon"));
  assert.equal(headerLines(container).length, withoutNote, "whitespace-only note renders nothing");
});

test("AC-16: switching categories swaps the note with no reload", async () => {
  installGlobals();
  const container = await mount(loadPage("page.js"));
  assert.ok(noteLine(container, EATING_OUT_NOTE));

  await click(tile(container, "Groceries"));
  assert.equal(noteLine(container, EATING_OUT_NOTE), undefined, "A's note is gone");

  await click(tile(container, "Eating Out"));
  assert.ok(noteLine(container, EATING_OUT_NOTE), "B->A restores the note");
});

test("AC-17: the note sits in the header and obstructs nothing", async () => {
  installGlobals();
  const container = await mount(loadPage("page.js"));
  const line = noteLine(container, EATING_OUT_NOTE);

  // In the header block, in normal flow — not absolute, fixed, or portaled.
  assert.ok(header(container).contains(line));
  assert.ok(!/absolute|fixed|z-\d/.test(line.className), `in-flow, got "${line.className}"`);
  // A portal (the shape the spec rejected) would land as a sibling of the mount
  // container, the way ExpenseEditSheet's does.
  assert.equal(global.document.body.children.length, 1, "nothing portaled to body");

  // The surfaces it must not cover are all still rendered alongside it.
  assert.ok(container.querySelector(".grid-cols-4"), "category grid present");
  assert.equal([...container.querySelectorAll("button")].filter((b) => b.textContent === "7").length, 1, "keypad present");
  assert.ok([...container.querySelectorAll("button")].some((b) => b.textContent.includes("home.save")), "save button present");
  assert.ok(container.textContent.includes("home.today"), "date stepper present");
});

test("AC-18: tapping a category still selects and persists it", async () => {
  installGlobals();
  const container = await mount(loadPage("page.js"));

  await click(tile(container, "Groceries"));

  // Selection moved: the picker marks exactly one tile selected, and it is this one.
  const selected = [...container.querySelectorAll("button")].filter((b) => b.className.includes("ring-primary"));
  assert.equal(selected.length, 1);
  assert.ok(selected[0].textContent.includes("Groceries"));
  // ...and saveLastCategory wrote it through.
  assert.equal(global.window.localStorage.getItem("expense_last_category_id"), "cat_003");
});

test("AC-19: with the category API down, no note renders for any category", async () => {
  installGlobals({ offline: true });
  const container = await mount(loadPage("page.js"));

  // DEFAULT_CATEGORIES is the fallback and carries no notes at all.
  assert.equal(noteLine(container, EATING_OUT_NOTE), undefined, "no stale note");
  assert.ok(container.textContent.includes("Eating Out"), "page rendered, did not blank");

  const baseline = headerLines(container).length;
  for (const label of ["Groceries", "Digital", "Other"]) {
    await click(tile(container, label));
    assert.equal(headerLines(container).length, baseline, `${label}: no note line`);
  }
  // Nothing invented a note from anywhere.
  assert.ok(!container.textContent.includes(EATING_OUT_NOTE));
});

// ---------------------------------------------------------------------------
// Category Management
// ---------------------------------------------------------------------------

/** The Note input, found through its label so form restructuring cannot silently pass. */
function noteInput(container) {
  const label = [...container.querySelectorAll("label")].find(
    (l) => l.textContent.trim() === "cat_mgmt.note_label"
  );
  if (!label) throw new Error("no Note label in the form");
  return label.parentElement.querySelector("input");
}

function inputByPlaceholder(container, placeholder) {
  return container.querySelector(`input[placeholder="${placeholder}"]`);
}

const setValue = (input, value) =>
  React.act(async () => {
    const setter = Object.getOwnPropertyDescriptor(global.window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new global.window.Event("input", { bubbles: true }));
  });

const buttonByText = (container, text) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent.trim() === text);

async function openEditFor(container, name) {
  const row = [...container.querySelectorAll("div")].find(
    (d) => d.className.includes("border-base-300") && d.textContent.includes(name)
  );
  await click([...row.querySelectorAll("button")].find((b) => b.textContent.includes("common.edit")));
}

test("AC-7: the edit form pre-fills the note, and shows empty for a category without one", async () => {
  installGlobals();
  const container = await mount(loadPage("settings/categories/page.js"));

  await openEditFor(container, "Eating Out");
  assert.equal(noteInput(container).value, EATING_OUT_NOTE);

  await click(buttonByText(container, "common.cancel"));
  await openEditFor(container, "Groceries");
  assert.equal(noteInput(container).value, "", "no note -> empty field, not the previous category's note");
});

test("AC-8: an empty note saves clean, while the required fields still block", async () => {
  const { writes } = installGlobals();
  const container = await mount(loadPage("settings/categories/page.js"));

  await openEditFor(container, "Eating Out");
  await setValue(noteInput(container), "");
  await click(buttonByText(container, "common.save"));

  // The form closed (no validation error path) and the PATCH went out with "".
  // Scoped to <p>, since every required label carries a .text-error asterisk.
  assert.equal(container.querySelector("p.text-error"), null, "no validation error");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].body.note, "");

  // Contrast: name_en empty still blocks, so AC-8 is about the note specifically.
  await openEditFor(container, "Eating Out");
  await setValue(inputByPlaceholder(container, "e.g. Eating Out"), "");
  await click(buttonByText(container, "common.save"));
  assert.equal(container.querySelector("p.text-error").textContent, "cat_mgmt.error_en_required");
  assert.equal(writes.length, 1, "no second request was sent");
});

test("AC-9: the note input caps at 120 characters", async () => {
  installGlobals();
  const container = await mount(loadPage("settings/categories/page.js"));
  await openEditFor(container, "Eating Out");

  const input = noteInput(container);
  assert.equal(input.maxLength, 120, "native cap for typed input");

  // A paste of 200 characters — jsdom does not enforce maxLength on a
  // programmatic set, so this proves the component itself rejects the overflow.
  await setValue(input, "x".repeat(200));
  assert.equal(input.value.length, 120);
  assert.equal(input.value, "x".repeat(120));
});

test("AC-10: a whitespace-only note is stored as an empty string", async () => {
  const { writes, categories } = installGlobals();
  const container = await mount(loadPage("settings/categories/page.js"));

  await openEditFor(container, "Eating Out");
  await setValue(noteInput(container), "   \n  \t ");
  await click(buttonByText(container, "common.save"));

  assert.equal(writes[0].body.note, "", "trimmed before it left the page");
  assert.equal(categories.find((c) => c.id === "cat_001").note, "");

  // Indistinguishable from never having set one: re-opening shows an empty field.
  await openEditFor(container, "Eating Out");
  assert.equal(noteInput(container).value, "");
});

test("AC-11: the add form carries the note through to the created category", async () => {
  const { writes, categories } = installGlobals();
  const container = await mount(loadPage("settings/categories/page.js"));

  await click(buttonByText(container, "cat_mgmt.add"));
  await setValue(inputByPlaceholder(container, "e.g. Eating Out"), "Insurance");
  await setValue(inputByPlaceholder(container, "e.g. 外食"), "保險");
  await React.act(async () => {
    const select = container.querySelector("select");
    const setter = Object.getOwnPropertyDescriptor(global.window.HTMLSelectElement.prototype, "value").set;
    setter.call(select, "insurance_financial");
    select.dispatchEvent(new global.window.Event("change", { bubbles: true }));
  });
  await setValue(noteInput(container), "壽險與車險，不含健保");
  await click(buttonByText(container, "common.save"));

  assert.equal(writes[0].method, "POST");
  assert.equal(writes[0].body.note, "壽險與車險，不含健保");
  // Present on the category the API returned, not only on the optimistic placeholder.
  const created = categories.find((c) => c.name_en === "Insurance");
  assert.equal(created.note, "壽險與車險，不含健保");
  assert.ok(created.id.startsWith("cat_"), "the API-assigned id replaced the placeholder");
});

test("AC-12: the note label comes from a translation key present in both locales", async () => {
  installGlobals();
  const container = await mount(loadPage("settings/categories/page.js"));
  await openEditFor(container, "Eating Out");

  // No I18nextProvider is mounted, so `t()` echoes its key. A hardcoded "Note"
  // in the component would render as "Note" and fail here.
  const label = [...container.querySelectorAll("label")].find(
    (l) => l.textContent.trim() === "cat_mgmt.note_label"
  );
  assert.ok(label, "label rendered through t(), not as a literal string");

  assert.equal(typeof EN.cat_mgmt.note_label, "string");
  assert.equal(typeof ZH.cat_mgmt.note_label, "string");
  assert.notEqual(EN.cat_mgmt.note_label, ZH.cat_mgmt.note_label, "zh is translated, not copied");
});

test("AC-13: a failed note save rolls back to the pre-edit note and surfaces the error", async () => {
  installGlobals({ failWrites: true });
  const container = await mount(loadPage("settings/categories/page.js"));

  await openEditFor(container, "Eating Out");
  await setValue(noteInput(container), "this edit is going to fail");
  await click(buttonByText(container, "common.save"));
  await React.act(async () => {});

  const toast = container.querySelector(".alert-error");
  assert.ok(toast, "the existing error toast fired");
  assert.ok(toast.textContent.includes("503"), `toast names the failure, got "${toast.textContent}"`);

  // The list reverted: re-opening the form shows the note as it was before.
  await openEditFor(container, "Eating Out");
  assert.equal(noteInput(container).value, EATING_OUT_NOTE, "rolled back to the pre-edit note");
});
