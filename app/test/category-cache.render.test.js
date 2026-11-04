// Run with: npm test
// Entity 063, AC-2/AC-3/AC-4/AC-5/AC-6, and entity 081 AC-1..AC-4 (which
// replace 063 AC-1). Mounts the real Home page and asserts on what's actually
// on screen: which category list paints first, when Save is enabled, whether the cache is
// kept fresh, and whether a same-value refresh remounts the grid or leaves it
// alone. See test/helpers/dom.js for what the fetch/localStorage stubs emulate.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, CATEGORIES } = require("./helpers/dom.js");

const { DEFAULT_CATEGORIES, LAST_CATEGORIES_KEY } = require("../.test-build/categories.js");

mockAuth();

const loadPage = (path) => require(`../.test-build-ui/${path}`).default;

const buttons = (c) => [...c.querySelectorAll("button")];
const byText = (c, text) => buttons(c).find((b) => b.textContent.includes(text));
const saveButton = (c) => byText(c, "home.save");
const selectedTile = (c) => buttons(c).filter((b) => b.className.includes("ring-primary"));
const statusLine = (c) => c.querySelector('[data-testid="category-status"]');
const tileFor = (c, name) => buttons(c).find((b) => b.textContent.includes(name));

const ACTIVE_FIXTURE = CATEGORIES.filter((c) => c.is_active).map((c) => ({ ...c }));
const CACHED = [
  { id: "cat_501", name_en: "Cached Category", name_zh: "快取類別", icon: "🗂️", sort_order: 1, is_active: true, gov_category: "miscellaneous" },
];
const RENAMED = [
  { id: "cat_777", name_en: "Renamed Category", name_zh: "改名類別", icon: "🆕", sort_order: 1, is_active: true, gov_category: "miscellaneous" },
];

/** Fresh globals, optionally with the category-list cache pre-seeded. */
async function mountHome({ cached, cachedRaw, ...opts } = {}) {
  const g = installGlobals(opts);
  if (cachedRaw !== undefined) global.localStorage.setItem(LAST_CATEGORIES_KEY, cachedRaw);
  else if (cached !== undefined) global.localStorage.setItem(LAST_CATEGORIES_KEY, JSON.stringify(cached));
  const container = await mount(loadPage("page.js"));
  return { ...g, container };
}

async function flush(fn) {
  await React.act(async () => { fn(); });
  await React.act(async () => {});
}

// ---------------------------------------------------------------------------
// AC-2 / AC-3 — first-paint source.
// ---------------------------------------------------------------------------

test("AC-2: a device with a cached live list paints that list first, before the fetch resolves", async () => {
  const { container } = await mountHome({ cached: CACHED, deferCategories: true });
  assert.ok(container.textContent.includes("Cached Category"), "the cached tile is already on screen");
  assert.ok(!container.textContent.includes(DEFAULT_CATEGORIES[0].name_en), "DEFAULT_CATEGORIES did not paint");
});

test("AC-3: a device with no cache still paints DEFAULT_CATEGORIES first, exactly as today", async () => {
  const { container } = await mountHome({ deferCategories: true });
  assert.ok(container.textContent.includes(DEFAULT_CATEGORIES[0].name_en), "DEFAULT_CATEGORIES tiles render non-blank");
  assert.equal(saveButton(container).disabled, true);
});

// ---------------------------------------------------------------------------
// Entity 081 (reverses 063 AC-1) — Save works from a cached list of live ids.
// The backend checks every write's category_id against the live sheet, so a
// cached cat_NNN id can't write a bad category; a slug still can, so a slug
// cache (or no cache) keeps Save off until the live list arrives (entity 058).
// ---------------------------------------------------------------------------

const TWO_CACHED = [
  CACHED[0],
  { id: "cat_502", name_en: "Second Cached", name_zh: "第二快取", icon: "🧺", sort_order: 2, is_active: true, gov_category: "miscellaneous" },
];
const selectedName = (c) => selectedTile(c).map((b) => b.textContent).join("|");
const click = (el) => React.act(async () => { el.dispatchEvent(new global.window.Event("click", { bubbles: true })); });
const key = (c, k) => buttons(c).find((b) => b.textContent === k);

test("081 AC-1: with a cached list of live ids, Save is enabled and a live id selected before the fetch resolves", async () => {
  const { container, releaseCategories } = await mountHome({ cached: CACHED, deferCategories: true });

  assert.equal(saveButton(container).disabled, false, "Save works before the live fetch resolves");
  assert.equal(statusLine(container), null, "no loading line once the cache is usable");
  assert.equal(selectedTile(container).length, 1, "one tile is selected");
  assert.match(selectedName(container), /Cached Category/, "the selected tile is the cached cat_501");

  await flush(releaseCategories);
  assert.equal(saveButton(container).disabled, false, "still enabled after the live list arrives");
});

test("081 AC-2: with no cache, Save stays disabled with the loading line until the fetch resolves", async () => {
  const { container, releaseCategories } = await mountHome({ deferCategories: true });

  assert.equal(saveButton(container).disabled, true);
  assert.match(statusLine(container).textContent, /categories_loading/);

  await flush(releaseCategories);
  assert.equal(saveButton(container).disabled, false, "enables once the live fetch resolves");
});

test("081 AC-2: a cache holding any non-cat_NNN id is treated as no cache — Save waits for live", async () => {
  const slugged = [CACHED[0], { ...DEFAULT_CATEGORIES[0] }];
  const { container, releaseCategories } = await mountHome({ cached: slugged, deferCategories: true });

  assert.equal(saveButton(container).disabled, true, "a slug in the cache keeps Save off");
  assert.match(statusLine(container).textContent, /categories_loading/);

  await flush(releaseCategories);
  assert.equal(saveButton(container).disabled, false);
});

test("081 AC-3: saving from the cache before the fetch resolves posts a cached cat_NNN id, never a slug", async () => {
  const { container, expWrites } = await mountHome({ cached: TWO_CACHED, deferCategories: true });

  await click(key(container, "4"));
  await click(saveButton(container));

  assert.equal(expWrites.length, 1, "the expense POST left the page while the categories fetch was still pending");
  const sent = expWrites[0].body.category_id;
  assert.match(sent, /^cat_\d+$/);
  assert.ok(TWO_CACHED.some((c) => c.id === sent), `${sent} is one of the cached ids`);
  assert.ok(!DEFAULT_CATEGORIES.some((c) => c.id === sent), "not a DEFAULT_CATEGORIES slug");
});

test("081 AC-4: a still-present selection survives the live refresh", async () => {
  const live = [...ACTIVE_FIXTURE, { ...TWO_CACHED[1] }];
  const { container, releaseCategories } = await mountHome({ cached: TWO_CACHED, categories: live, deferCategories: true });

  await click(tileFor(container, "Second Cached"));
  assert.match(selectedName(container), /Second Cached/);

  await flush(releaseCategories);
  assert.match(selectedName(container), /Second Cached/, "cat_502 is still in the live list, so it stays selected");
});

test("081 AC-4: a selection that vanished from the live list is replaced by a live id", async () => {
  const { container, releaseCategories, expWrites } = await mountHome({ cached: TWO_CACHED, deferCategories: true });

  await click(tileFor(container, "Second Cached"));
  await flush(releaseCategories);

  assert.equal(selectedTile(container).length, 1);
  assert.doesNotMatch(selectedName(container), /Second Cached/, "the vanished cat_502 is no longer selected");
  await click(key(container, "4"));
  await click(saveButton(container));
  const sent = expWrites[0].body.category_id;
  assert.ok(ACTIVE_FIXTURE.some((c) => c.id === sent), `${sent} is a live id from the refreshed list`);
});

// ---------------------------------------------------------------------------
// AC-4 — the cache is kept fresh, not stuck on the first-ever snapshot.
// ---------------------------------------------------------------------------

test("AC-4: the cache is overwritten after every successful fetch, not just the first", async () => {
  await mountHome();
  const afterFirst = JSON.parse(global.localStorage.getItem(LAST_CATEGORIES_KEY));
  assert.ok(afterFirst.some((c) => c.name_en === "Eating Out"), "first fetch's response was cached");

  await mountHome({ cachedRaw: global.localStorage.getItem(LAST_CATEGORIES_KEY), categories: RENAMED });
  const afterSecond = JSON.parse(global.localStorage.getItem(LAST_CATEGORIES_KEY));
  assert.equal(afterSecond.length, 1);
  assert.equal(afterSecond[0].name_en, "Renamed Category");
  assert.ok(!afterSecond.some((c) => c.name_en === "Eating Out"), "overwritten, not stuck on the first-ever snapshot");
});

// ---------------------------------------------------------------------------
// AC-5 — a same-value refresh does not remount the grid.
// ---------------------------------------------------------------------------

test("AC-5: when the fetch resolves to the same list already cached, no tile remounts", async () => {
  const { container, releaseCategories } = await mountHome({ cached: ACTIVE_FIXTURE, deferCategories: true });

  const before1 = tileFor(container, "Eating Out");
  const before2 = tileFor(container, "Groceries");
  assert.ok(before1 && before2, "cached tiles are on screen before the fetch resolves");

  await flush(releaseCategories);

  const after1 = tileFor(container, "Eating Out");
  const after2 = tileFor(container, "Groceries");
  assert.equal(before1, after1, "same DOM node — no unmount/remount for an unchanged category");
  assert.equal(before2, after2, "same DOM node — no unmount/remount for an unchanged category");
});

// ---------------------------------------------------------------------------
// AC-6 — a throwing category-list cache degrades cleanly.
// ---------------------------------------------------------------------------

test("AC-6: a throwing category-list cache degrades to DEFAULT_CATEGORIES first paint and never throws", async () => {
  const g = installGlobals({ deferCategories: true });
  const realGetItem = global.localStorage.getItem.bind(global.localStorage);
  const realSetItem = global.localStorage.setItem.bind(global.localStorage);
  // Only the NEW cache key throws — LAST_CATEGORY_KEY (the single last-used id,
  // entity 058) keeps working, so this isolates the new mechanism's own fallback
  // rather than tripping over an unrelated storage key.
  global.localStorage.getItem = (k) => { if (k === LAST_CATEGORIES_KEY) throw new Error("blocked"); return realGetItem(k); };
  global.localStorage.setItem = (k, v) => { if (k === LAST_CATEGORIES_KEY) throw new Error("blocked"); return realSetItem(k, v); };

  // No try/catch here: a page that crashes on a throwing cache would reject
  // this await and fail the test, exactly like an unhandled error reaching the
  // real browser would fail the real page.
  const container = await mount(loadPage("page.js"));

  assert.ok(container.textContent.includes(DEFAULT_CATEGORIES[0].name_en), "fell back to DEFAULT_CATEGORIES, not a blank/crashed page");
  assert.equal(saveButton(container).disabled, true);

  await flush(g.releaseCategories);

  assert.equal(saveButton(container).disabled, false, "the fetch itself still resolved and Save enabled normally");
  assert.equal(selectedTile(container).length, 1, "a live category ended up selected despite the throwing cache");
});
