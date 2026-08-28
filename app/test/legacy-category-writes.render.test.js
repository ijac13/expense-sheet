// Run with: npm test
// Entity 058, AC-2 / AC-6 / AC-7 / AC-8 / AC-14 / AC-15 / AC-16. Mounts the real
// Home and Subscriptions pages and asserts on the category_id in the POST BODY
// that left the page — the only thing that decides what lands in the sheet.
// `t()` echoes its key here (no i18n resources are loaded in the test build), so
// visible copy is asserted as the key plus a check that both locales define it.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, CATEGORIES } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");
const { DEFAULT_CATEGORIES } = require("../.test-build/categories.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

const click = (el) =>
  React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

const setInput = (el, value) =>
  React.act(async () => {
    const setter = Object.getOwnPropertyDescriptor(global.window.HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new global.window.Event("input", { bubbles: true }));
  });

const buttons = (c) => [...c.querySelectorAll("button")];
const byText = (c, text) => buttons(c).find((b) => b.textContent.includes(text));
const key = (c, k) => buttons(c).find((b) => b.textContent === k);
const saveButton = (c) => byText(c, "home.save");
const selectedTile = (c) => buttons(c).filter((b) => b.className.includes("ring-primary"));
const statusLine = (c) => c.querySelector('[data-testid="category-status"]');

const SLUGS = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
const LIVE_ACTIVE = CATEGORIES.filter((c) => c.is_active).map((c) => c.id);
const KEY = "expense_last_category_id";

/** Fresh globals with a value already in localStorage, then mount Home. */
async function mountHome({ stored, ...opts } = {}) {
  const g = installGlobals(opts);
  if (stored !== undefined) global.localStorage.setItem(KEY, stored);
  const container = await mount(loadPage("page.js"));
  return { ...g, container };
}

/** A page reload: a brand-new document, with localStorage carried across. */
async function reloadHome(opts = {}) {
  return mountHome({ stored: global.localStorage.getItem(KEY) ?? undefined, ...opts });
}

/** Type an amount on the keypad and press Save. */
async function logExpense(container, digits = "4") {
  await click(key(container, digits));
  await click(saveButton(container));
}

// ---------------------------------------------------------------------------
// AC-6 / AC-8 — no slug leaves the client.
// ---------------------------------------------------------------------------

test("AC-6: the touch-nothing-but-the-keypad path posts a LIVE category_id", async () => {
  // The primary regression path and the fastest route through the app: fresh
  // load, type an amount, confirm. Before this entity `categoryId` was still the
  // `eating-out` seed here, because the live list arriving never reconciled it.
  const { container, expWrites } = await mountHome();

  await logExpense(container);

  assert.equal(expWrites.length, 1, "exactly one expense POST left the page");
  const sent = expWrites[0].body.category_id;
  assert.equal(sent, "cat_001");
  assert.ok(LIVE_ACTIVE.includes(sent), `${sent} is in the live Categories tab`);
  assert.ok(!SLUGS.has(sent), "not a DEFAULT_CATEGORIES slug");
  assert.notEqual(sent, "eating-out");
});

test("AC-8: a slug left in localStorage by an older build never reaches the POST", async () => {
  // Every device that used the app before this fix has exactly this stored.
  const { container, expWrites } = await mountHome({ stored: "eating-out" });

  assert.equal(selectedTile(container).length, 1, "a live tile is highlighted, not nothing");
  await logExpense(container);

  assert.notEqual(expWrites[0].body.category_id, "eating-out");
  assert.ok(LIVE_ACTIVE.includes(expWrites[0].body.category_id));
});

test("AC-4: a stored id deleted from the tab posts a live id, not the dead one", async () => {
  const { container, expWrites } = await mountHome({ stored: "cat_777" });
  await logExpense(container);
  assert.equal(expWrites[0].body.category_id, "cat_001");
});

test("AC-5: a stored id that was archived posts the first ACTIVE live id", async () => {
  // cat_015 is is_active:false in the fixture. It stays valid server-side (AC-11)
  // but the picker renders no tile for it, so the selection has to move.
  const { container, expWrites } = await mountHome({ stored: "cat_015" });
  await logExpense(container);
  assert.equal(expWrites[0].body.category_id, "cat_001");
  assert.equal(selectedTile(container).length, 1);
});

// ---------------------------------------------------------------------------
// AC-2 — the picked category survives a reload.
// ---------------------------------------------------------------------------

test("AC-2: a live category picked before a reload is still picked after it", async () => {
  const first = await mountHome();
  await click(byText(first.container, "Groceries"));
  assert.equal(global.localStorage.getItem(KEY), "cat_003", "the pick was persisted");

  // A genuinely new document — the state the old guard threw the value away in.
  const { container, expWrites } = await reloadHome();

  const selected = selectedTile(container);
  assert.equal(selected.length, 1);
  assert.ok(selected[0].textContent.includes("Groceries"), "the same tile is highlighted");
  assert.ok(container.querySelector("main > .bg-primary").textContent.includes("Groceries"), "the header names it");

  await logExpense(container);
  assert.equal(expWrites[0].body.category_id, "cat_003", "and it is what gets posted");
});

// ---------------------------------------------------------------------------
// AC-14 / AC-16 — degraded state on Home.
// ---------------------------------------------------------------------------

test("AC-14: with the categories fetch still in flight, Save is dead and says why", async () => {
  // The first-use-ever window. The picker still DRAWS DEFAULT_CATEGORIES so the
  // screen is not blank — the spec's "display fallback yes, write fallback no".
  const { container, expWrites } = await mountHome({ deferCategories: true });

  assert.equal(saveButton(container).disabled, true);
  assert.ok(statusLine(container), "a visible line explains the disabled Save");
  assert.match(statusLine(container).textContent, /categories_loading/);
  assert.equal(selectedTile(container).length, 0, "nothing is committed to as selected");
  assert.ok(container.textContent.includes("Eating Out"), "placeholder tiles still render");

  await logExpense(container);
  assert.equal(expWrites.length, 0, "no POST was issued in that state");
});

test("AC-14: with the categories fetch failed, Save is dead and says the list is unavailable", async () => {
  const { container, expWrites } = await mountHome({ offline: true });

  assert.equal(saveButton(container).disabled, true);
  assert.match(statusLine(container).textContent, /categories_unavailable/);

  await logExpense(container);
  assert.equal(expWrites.length, 0, "the silent slug write is now a visible block");
});

test("AC-16: retrying after a failed load re-enables Save with a live id, no reload", async () => {
  const { container, expWrites, setOffline } = await mountHome({ offline: true });
  assert.equal(saveButton(container).disabled, true);

  setOffline(false);
  await click(container.querySelector('[data-testid="category-retry"]'));

  assert.equal(saveButton(container).disabled, false, "same document, Save is alive again");
  assert.equal(statusLine(container), null, "the message is gone");
  assert.equal(selectedTile(container).length, 1, "a live category is selected");

  await logExpense(container);
  assert.equal(expWrites.length, 1);
  assert.ok(LIVE_ACTIVE.includes(expWrites[0].body.category_id));
});

test("AC-14: a failed load does not persist a placeholder slug as the last-used id", async () => {
  // Tapping a placeholder tile must not overwrite the captain's real preference
  // with a slug that the next load would then have to throw away.
  const { container } = await mountHome({ stored: "cat_003", offline: true });
  await click(byText(container, "Digital"));
  assert.equal(global.localStorage.getItem(KEY), "cat_003", "the stored live id survived");
});

// ---------------------------------------------------------------------------
// AC-7 / AC-15 — subscriptions.
// ---------------------------------------------------------------------------

// Production shape after entity 054: every stored category_id is already live.
const LIVE_SUBS = [
  { id: "sub-1", name: "Netflix", amount: 390, category_id: "cat_001", frequency: "monthly", due_day: 15, paid_by: "Karen", is_active: true, start_date: "2026-03-01", end_date: "", notes: "" },
];

const mountSubs = async (opts = {}) => {
  const g = installGlobals({ subscriptions: LIVE_SUBS, ...opts });
  return { ...g, container: await mount(loadPage("subscriptions/page.js")) };
};

test("AC-7: adding a subscription sends a live category_id", async () => {
  const { container, subWrites } = await mountSubs();

  await click(byText(container, "subscriptions.add"));
  // Scoped to the open modal: the page itself carries a search input (entity
  // 059), so an unscoped positional lookup types into the filter box instead.
  const inputs = [...container.querySelectorAll(".modal-open input")];
  await setInput(inputs[0], "Spotify");
  await setInput(inputs[1], "149");
  await click([...container.querySelectorAll(".modal-action button")].pop());

  assert.equal(subWrites.length, 1);
  assert.equal(subWrites[0].method, "POST");
  const sent = subWrites[0].body.category_id;
  assert.ok(LIVE_ACTIVE.includes(sent), `${sent} is live`);
  assert.ok(!SLUGS.has(sent), "entity 049's fix still holds — no slug default");
});

test("AC-7: editing a subscription sends a live category_id", async () => {
  const { container, subWrites } = await mountSubs();

  await click(byText(container, "common.edit"));
  await click([...container.querySelectorAll(".modal-action button")].pop());

  assert.equal(subWrites.length, 1);
  assert.equal(subWrites[0].method, "PATCH");
  assert.equal(subWrites[0].body.category_id, "cat_001", "the stored live id is carried through unchanged");
});

test("AC-15: with the categories fetch failed, the add modal blocks and says why", async () => {
  const { container, subWrites } = await mountSubs({ offline: true });

  await click(byText(container, "subscriptions.add"));
  // Scoped to the open modal: the page itself carries a search input (entity
  // 059), so an unscoped positional lookup types into the filter box instead.
  const inputs = [...container.querySelectorAll(".modal-open input")];
  await setInput(inputs[0], "Spotify");
  await setInput(inputs[1], "149");

  const submit = [...container.querySelectorAll(".modal-action button")].pop();
  assert.equal(submit.disabled, true);
  assert.match(statusLine(container).textContent, /categories_unavailable/);

  await click(submit);
  assert.equal(subWrites.length, 0, "no slug was written in place of a real category");
});

test("AC-15: with the categories fetch failed, the edit modal blocks and says why", async () => {
  const { container, subWrites } = await mountSubs({ offline: true });

  await click(byText(container, "common.edit"));
  const submit = [...container.querySelectorAll(".modal-action button")].pop();
  assert.equal(submit.disabled, true);
  assert.match(statusLine(container).textContent, /categories_unavailable/);

  await click(submit);
  assert.equal(subWrites.length, 0);
});

test("AC-15: the subscription add form no longer carries a slug default at all", async () => {
  // Guards the module-level constants the spec named (page.tsx:53 and :114).
  // A reintroduced DEFAULT_CATEGORIES[0].id would show one category and submit
  // another the moment the live fetch is slow.
  const { container } = await mountSubs({ deferCategories: true });
  await click(byText(container, "subscriptions.add"));
  const select = container.querySelector("select");
  assert.ok(select, "the add modal opened");
  assert.equal([...container.querySelectorAll(".modal-action button")].pop().disabled, true);
});

// ---------------------------------------------------------------------------
// Copy exists in both locales.
// ---------------------------------------------------------------------------

test("the degraded-state copy is defined and translated in both locales", () => {
  for (const k of ["categories_loading", "categories_unavailable", "retry"]) {
    assert.equal(typeof EN.common[k], "string", `en ${k}`);
    assert.equal(typeof ZH.common[k], "string", `zh ${k}`);
    assert.notEqual(EN.common[k], ZH.common[k], `zh ${k} is translated, not copied`);
  }
});
