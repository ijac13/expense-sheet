// Run with: npm test
// Search on the Subscriptions screen (entity 059, Group C). Mounts the real page
// and drives the real input. Search is client-side over the array the page
// already holds, so the claims that matter are that typing issues NO request,
// that an empty query renders exactly the pre-feature list, and that "nothing
// matched" is never reported as "you own no subscriptions".
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount, SUBSCRIPTIONS } = require("./helpers/dom.js");

mockAuth();

const loadPage = () => require("../.test-build-ui/subscriptions/page.js").default;

const click = (el) =>
  React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

const setValue = (input, value) =>
  React.act(async () => {
    Object.getOwnPropertyDescriptor(global.window.HTMLInputElement.prototype, "value")
      .set.call(input, value);
    input.dispatchEvent(new global.window.Event("input", { bubbles: true }));
  });

const searchInput = (container) => container.querySelector('[data-testid="subscription-search"]');
const clearButton = (container) => container.querySelector('[data-testid="subscription-search-clear"]');
const noResults = (container) => container.querySelector('[data-testid="search-no-results"]');

/** Every subscription name currently rendered as a card, in DOM order. */
const shownNames = (container) =>
  [...container.querySelectorAll("div.card .font-semibold")].map((el) => el.textContent);

/** The section headers on screen: "subscriptions.active" / ".cancelled". */
const sectionHeaders = (container) =>
  [...container.querySelectorAll("section div.uppercase")].map((el) => el.textContent);

/** Type `q` into the search box and hand back the request count taken first. */
async function search(container, g, q) {
  const before = g.requests.length;
  await setValue(searchInput(container), q);
  return before;
}

// ---------------------------------------------------------------------------
// AC-C1 / AC-C2 — when the box exists at all.
// ---------------------------------------------------------------------------

test("AC-C1: the search input renders between the header and the Active section", async () => {
  installGlobals();
  const container = await mount(loadPage());

  const input = searchInput(container);
  assert.ok(input, "the search input is on screen when subscriptions exist");

  // Ordering by the DOM's own comparison rather than by reading the markup.
  const heading = container.querySelector("h1");
  const firstSection = container.querySelector("section");
  assert.ok(
    heading.compareDocumentPosition(input) & global.Node.DOCUMENT_POSITION_FOLLOWING,
    "it comes after the page header"
  );
  assert.ok(
    firstSection.compareDocumentPosition(input) & global.Node.DOCUMENT_POSITION_PRECEDING,
    "and before the Active section"
  );
});

test("AC-C2: with zero subscriptions there is no search input and the empty state is unchanged", async () => {
  installGlobals({ subscriptions: [] });
  const container = await mount(loadPage());

  assert.equal(searchInput(container), null, "searching nothing is not offered");
  assert.equal(noResults(container), null, "and no-results is not the empty state");
  assert.ok(
    container.textContent.includes("subscriptions.empty"),
    "the existing empty message still shows exactly as before"
  );
});

// ---------------------------------------------------------------------------
// AC-C3 — filtering is local. No request leaves the page.
// ---------------------------------------------------------------------------

test("AC-C3: typing filters on each keystroke and issues NO network request", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  const before = g.requests.length;
  assert.ok(before > 0, "the page did load the list once on mount");

  // One character at a time, the way typing actually arrives, with the list
  // narrowing at each step. "n" also matches Disney+ by name and iCloud through
  // its "family plan" note, which is the substring rule doing its job.
  const steps = [
    ["n", ["Netflix", "Disney+", "iCloud"]],
    ["ne", ["Netflix", "Disney+"]],
    ["net", ["Netflix"]],
    ["netf", ["Netflix"]],
  ];
  for (const [q, expected] of steps) {
    await setValue(searchInput(container), q);
    assert.deepEqual(shownNames(container), expected, `after typing "${q}"`);
  }

  // The assertion the AC asks for by name: a count, not an inference.
  assert.equal(g.requests.length, before, `typing issued ${g.requests.slice(before)}`);
  assert.equal(
    g.requests.filter((r) => r === "/api/subscriptions").length,
    1,
    "still exactly one GET /api/subscriptions for the whole session"
  );
});

// ---------------------------------------------------------------------------
// AC-C4 / AC-C5 / AC-C7 / AC-C11 — what matches what.
// ---------------------------------------------------------------------------

test("AC-C4: matching is case-insensitive substring, not prefix-only and not fuzzy", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  for (const q of ["net", "NET", "Net"]) {
    await search(container, g, q);
    assert.deepEqual(shownNames(container), ["Netflix"], `"${q}" matches by prefix, any case`);
  }

  // Mid-string: a prefix-only implementation (startsWith) fails here.
  await search(container, g, "flix");
  assert.deepEqual(shownNames(container), ["Netflix"], "matching is substring, not prefix");

  // Fuzzy matching would return Netflix for this; plain substring must not.
  await search(container, g, "ntflx");
  assert.deepEqual(shownNames(container), [], "no fuzzy or typo tolerance");
});

test("AC-C5: matching tests notes as well as names", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  // iCloud's fixture note is "family plan"; no subscription is NAMED family.
  assert.ok(!SUBSCRIPTIONS.some((s) => s.name.toLowerCase().includes("family")), "fixture check");
  await search(container, g, "family");
  assert.deepEqual(shownNames(container), ["iCloud"], "found by its note, not its name");

  // And a name-only match still works, so notes did not replace name matching.
  await search(container, g, "spotify");
  assert.deepEqual(shownNames(container), ["Spotify"]);
});

test("AC-C7: leading and trailing whitespace is trimmed before matching", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  await search(container, g, "  net  ");
  assert.deepEqual(shownNames(container), ["Netflix"], "the untrimmed query would match nothing");
});

test("AC-C11: a Chinese query matches a Chinese name", async () => {
  const g = installGlobals({
    subscriptions: [
      { id: "sub-1", name: "電子報訂閱", amount: 100, category_id: "cat_003", frequency: "monthly", due_day: 1, paid_by: "Karen", is_active: true, start_date: "", end_date: "", notes: "" },
      { id: "sub-2", name: "Netflix", amount: 390, category_id: "cat_003", frequency: "monthly", due_day: 15, paid_by: "Karen", is_active: true, start_date: "", end_date: "", notes: "" },
    ],
  });
  const container = await mount(loadPage());

  // toLowerCase() is a no-op on Chinese; a normalisation step that stripped or
  // transliterated non-Latin characters would return nothing here.
  await search(container, g, "電子報");
  assert.deepEqual(shownNames(container), ["電子報訂閱"]);

  await search(container, g, "訂閱");
  assert.deepEqual(shownNames(container), ["電子報訂閱"], "matches mid-string too");
});

test("AC-C5/AC-C11: a Chinese query matches a Chinese NOTE", async () => {
  const g = installGlobals({
    subscriptions: [
      { id: "sub-1", name: "Netflix", amount: 390, category_id: "cat_003", frequency: "monthly", due_day: 15, paid_by: "Karen", is_active: true, start_date: "", end_date: "", notes: "與家人共用" },
      { id: "sub-2", name: "Spotify", amount: 149, category_id: "cat_003", frequency: "monthly", due_day: 1, paid_by: "Karen", is_active: true, start_date: "", end_date: "", notes: "" },
    ],
  });
  const container = await mount(loadPage());

  await search(container, g, "家人");
  assert.deepEqual(shownNames(container), ["Netflix"]);
});

// ---------------------------------------------------------------------------
// AC-C6 / AC-C10 — an empty query is the pre-feature screen.
// ---------------------------------------------------------------------------

test("AC-C6: an empty query renders both sections, every subscription, same order", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  // The baseline: what the screen shows before anything is typed.
  const baselineNames = shownNames(container);
  const baselineHeaders = sectionHeaders(container);
  assert.deepEqual(baselineNames, ["Spotify", "Netflix", "Disney+", "iCloud"], "newest-first within each section");
  assert.deepEqual(baselineHeaders, ["subscriptions.active", "subscriptions.cancelled"]);

  await search(container, g, "net");
  assert.deepEqual(shownNames(container), ["Netflix"], "the filter did apply");

  await search(container, g, "");
  assert.deepEqual(shownNames(container), baselineNames, "back to the full list, same order");
  assert.deepEqual(sectionHeaders(container), baselineHeaders, "and both headers are back");
  assert.equal(noResults(container), null);
});

test("AC-C6: a whitespace-only query renders the full list, not an empty one", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  const baseline = shownNames(container);

  await search(container, g, "   ");
  assert.deepEqual(shownNames(container), baseline, "spaces are not a query");
  assert.equal(noResults(container), null, "and this is not a no-results state");
});

test("AC-C10: a clear control appears with a non-empty query and restores the full list", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  const baseline = shownNames(container);

  assert.equal(clearButton(container), null, "no clear control on an empty query");

  await search(container, g, "net");
  const clear = clearButton(container);
  assert.ok(clear, "the clear control appeared");

  await click(clear);
  assert.equal(searchInput(container).value, "", "the query was emptied");
  assert.deepEqual(shownNames(container), baseline, "and the full list is back");
  assert.equal(clearButton(container), null, "the control retired with the query");
});

// ---------------------------------------------------------------------------
// AC-C8 / AC-C9 — no results, and the two sections filtering independently.
// ---------------------------------------------------------------------------

test("AC-C8: a query matching nothing shows a distinct message, never the empty state", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  await search(container, g, "zzzz");

  assert.deepEqual(shownNames(container), [], "no cards");
  assert.ok(noResults(container), "a dedicated no-results message is rendered");
  // The distinction the AC turns on: "nothing matched" must never be reported as
  // "you own no subscriptions" to a captain who owns four.
  assert.ok(
    !container.textContent.includes("subscriptions.empty"),
    "the owns-nothing empty state is NOT rendered"
  );
  // The search box survives, so there is a way back to the list.
  assert.ok(searchInput(container), "the search input is still on screen");
  assert.ok(clearButton(container), "and so is the clear control");
});

test("AC-C9: the sections filter independently and an emptied section renders no header", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  // "family" is iCloud's note, and iCloud is cancelled.
  await search(container, g, "family");
  assert.deepEqual(shownNames(container), ["iCloud"]);
  assert.deepEqual(sectionHeaders(container), ["subscriptions.cancelled"], "no Active header at all");

  // And the mirror case: a query matching only an active subscription.
  await search(container, g, "spotify");
  assert.deepEqual(shownNames(container), ["Spotify"]);
  assert.deepEqual(sectionHeaders(container), ["subscriptions.active"], "no Cancelled header at all");
});

// ---------------------------------------------------------------------------
// AC-C12 — the query is not persisted.
// ---------------------------------------------------------------------------

test("AC-C12: the query is written nowhere and a remount starts empty", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  const before = { ...global.localStorage };
  await search(container, g, "netflix");

  assert.deepEqual({ ...global.localStorage }, before, "nothing was written to localStorage");
  assert.equal(global.window.location.search, "", "and nothing went into the URL");

  // A remount is what a reload does to this component: fresh state, full list.
  const remounted = await mount(loadPage());
  assert.equal(searchInput(remounted).value, "", "the box starts empty");
  assert.deepEqual(shownNames(remounted), ["Spotify", "Netflix", "Disney+", "iCloud"]);
});

// ---------------------------------------------------------------------------
// AC-C13 / AC-D2 — the placeholder is a key, and the header is not filtered.
// ---------------------------------------------------------------------------

test("AC-C13: the placeholder and clear label render from translation keys", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  // No I18nextProvider is mounted, so t() echoes its key. Hardcoded English
  // would render as prose and fail these.
  assert.equal(searchInput(container).placeholder, "subscriptions.search_placeholder");

  await search(container, g, "net");
  assert.equal(clearButton(container).getAttribute("aria-label"), "subscriptions.search_clear");
  assert.equal(
    (await search(container, g, "zzzz"), noResults(container).textContent.trim()),
    "subscriptions.search_no_results",
    "the no-results message is a key too"
  );
});

test("AC-D2: the scheduler status line is unaffected by the search query", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  const line = () => container.querySelector('[data-testid="auto-add-status"]');
  assert.ok(line(), "the status line is on screen before typing");
  const before = line().textContent;

  // Even a query that hides every card must not touch the header.
  await search(container, g, "zzzz");
  assert.ok(line(), "filtering the list never hides the scheduler line");
  assert.equal(line().textContent, before, "and never changes what it says");
});
