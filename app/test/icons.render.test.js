// Run with: npm test
// Mounts the real page components against production-shaped fixtures and asserts
// on the icon that actually reaches the DOM — the ACs are about rendered output,
// not about which helper was called.
const test = require("node:test");
const assert = require("node:assert/strict");
const { installGlobals, mockAuth, mount, iconForRow } = require("./helpers/dom.js");

const FALLBACK = "💰";

function loadPage(path) {
  return require(`../.test-build-ui/${path}`).default;
}

test("History rows resolve every id shape (AC-1, AC-3, AC-5, AC-6, AC-12)", async () => {
  installGlobals();
  const container = await mount(loadPage("history/page.js"));

  // AC-1 + AC-3: a legacy slug (`eating-out`, 651 production expenses) renders the
  // LIVE category's icon byte-for-byte, not the generic placeholder and not the
  // baked-in 🍜 that a DEFAULT_CATEGORIES fallback would produce.
  assert.equal(iconForRow(container, "row-legacy-slug"), "🍕");
  assert.notEqual(iconForRow(container, "row-legacy-slug"), FALLBACK);
  assert.notEqual(iconForRow(container, "row-legacy-slug"), "🍜");

  // AC-6: cat_015 is is_active:false, so it is absent from the picker list — the
  // row must still show its real icon.
  assert.equal(iconForRow(container, "row-archived"), "🛢️");

  // An id already in the live list is unaffected.
  assert.equal(iconForRow(container, "row-live-id"), "🥕");

  // AC-5: an id in neither the live list nor the slug map.
  assert.equal(iconForRow(container, "row-orphan"), FALLBACK);

  // AC-12: the API returns icon:"" for a blank cell; "" must never render as nothing.
  assert.equal(iconForRow(container, "row-blank-icon"), FALLBACK);
  assert.notEqual(iconForRow(container, "row-blank-icon"), "");
});

test("History renders a defined glyph on every row with the category API down (AC-11)", async () => {
  installGlobals({ offline: true });
  const container = await mount(loadPage("history/page.js"));

  // DEFAULT_CATEGORIES is the fallback list, so the slug rows resolve to their
  // baked-in icons; nothing blanks and nothing throws.
  assert.equal(iconForRow(container, "row-legacy-slug"), "🍜");
  assert.equal(iconForRow(container, "row-archived"), "⛽");
  for (const marker of ["row-live-id", "row-orphan", "row-blank-icon"]) {
    assert.equal(iconForRow(container, marker), FALLBACK, marker);
  }
  assert.ok(container.textContent.includes("row-orphan"), "page rendered, did not blank");
});

test("The expense detail sheet shows the same resolved icon as the row (AC-2)", async () => {
  installGlobals();
  const React = require("react");
  const container = await mount(loadPage("history/page.js"));

  const row = [...container.querySelectorAll("button")].find((b) =>
    b.textContent.includes("row-legacy-slug")
  );
  await React.act(async () => {
    row.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

  // ExpenseEditSheet portals to document.body, outside the mount container.
  const sheetIcon = global.document.body.querySelector(".text-3xl");
  assert.equal(sheetIcon.textContent, "🍕");
  assert.notEqual(sheetIcon.textContent, "💰");

  // The archived case reaches the sheet too.
  const archived = [...container.querySelectorAll("button")].find((b) =>
    b.textContent.includes("row-archived")
  );
  await React.act(async () => {
    archived.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
  assert.equal(global.document.body.querySelector(".text-3xl").textContent, "🛢️");
});

test("A Category Management icon edit reaches History with no rebuild or deploy (AC-4)", async () => {
  const { setCategoryIcon } = installGlobals();
  const React = require("react");
  const container = await mount(loadPage("history/page.js"));
  assert.equal(iconForRow(container, "row-legacy-slug"), "🍕");

  // The captain edits Eating Out's icon, then returns to History. `popstate` is
  // the return-by-back-gesture path History already re-fetches on (entity 044).
  setCategoryIcon("cat_001", "🥗");
  await React.act(async () => {
    global.window.dispatchEvent(new global.window.Event("popstate"));
  });
  await React.act(async () => {});

  // The row carries `eating-out`, an id the edited category does not have — this
  // is the whole point of the bridge: the edit still lands.
  assert.equal(iconForRow(container, "row-legacy-slug"), "🥗");
});

test("Subscriptions cards resolve live and both pickers list live categories (AC-7, AC-8, AC-9)", async () => {
  const { requests } = installGlobals();
  mockAuth();
  const container = await mount(loadPage("subscriptions/page.js"));

  // AC-7: the page issues the request at all — it never did before.
  assert.ok(requests.includes("/api/categories"), "Subscriptions fetched /api/categories");

  // AC-7 + AC-8: the card icon is the live one. 🍜 here would mean the card is
  // still reading DEFAULT_CATEGORIES, so a Category Management edit could not reach it.
  assert.equal(iconForRow(container, "Netflix"), "🍕");
  assert.equal(iconForRow(container, "Spotify"), "🥕");
  // A cancelled card on an archived category (AC-6's shape, cancelled section).
  assert.equal(iconForRow(container, "iCloud"), "🛢️");

  // AC-9: the add modal's <select> offers the live active categories, including
  // cat_NNN ids that appear in no DEFAULT_CATEGORIES entry.
  const addButton = [...container.querySelectorAll("button")].find((b) =>
    b.className.includes("btn-primary")
  );
  await require("react").act(async () => {
    addButton.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
  const addOptions = [...container.querySelectorAll("select option")];
  const addValues = addOptions.map((o) => o.value);
  assert.deepEqual(addValues, ["cat_001", "cat_003", "cat_099"], "live active ids, archived excluded");
  assert.ok(addOptions[0].textContent.startsWith("🍕"), "option label uses the live icon");
  // AC-12 on the picker: the blank-icon category is labelled, not blank.
  assert.ok(addOptions[2].textContent.startsWith(FALLBACK), "blank icon cell falls back in the picker");
  // The selected value has to be one of the offered options, or adding a
  // subscription would submit a category the captain never saw.
  const addSelect = container.querySelector("select");
  assert.ok(addValues.includes(addSelect.value), `select value ${addSelect.value} is offered`);
});

test("Subscriptions edit modal keeps the stored id while showing the live category (AC-9)", async () => {
  installGlobals();
  mockAuth();
  const container = await mount(loadPage("subscriptions/page.js"));
  const React = require("react");

  const netflixCard = [...container.querySelectorAll("div.card")].find((c) =>
    c.textContent.includes("Netflix")
  );
  // Labels render as raw i18n keys — I18nextProvider lives in the app layout,
  // which is not part of the mounted tree. Icons are unaffected.
  const editButton = [...netflixCard.querySelectorAll("button")].find((b) =>
    /edit|編輯/i.test(b.textContent)
  );
  await React.act(async () => {
    editButton.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

  const select = container.querySelector("select");
  const options = [...select.querySelectorAll("option")];
  // Netflix is stored on the legacy slug `eating-out`. The select must show it as
  // the live "Eating Out" with the live icon...
  assert.equal(options[0].textContent.trim(), "🍕 Eating Out");
  // ...while keeping the stored id as the value, so saving an amount-only edit
  // cannot silently rewrite category_id to cat_001.
  assert.equal(select.value, "eating-out");
  // AC-9: every live active category is still selectable alongside it.
  const values = options.map((o) => o.value);
  for (const id of ["cat_001", "cat_003", "cat_099"]) {
    assert.ok(values.includes(id), `${id} selectable`);
  }
});
