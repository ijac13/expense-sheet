// Minimal DOM harness for the icon-rendering tests: a jsdom global, a fetch stub
// serving production-shaped fixtures, and a mount helper that flushes effects.
// The app's pages sit behind a Google sign-in that cannot run headlessly, so the
// page components are mounted directly rather than driven through the real app.
const { JSDOM } = require("jsdom");
const React = require("react");
const { act } = require("react");

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  // categories.ts reads bare `localStorage`, and next/link reads bare `self`.
  global.localStorage = dom.window.localStorage;
  global.self = dom.window;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

// Order matters: react-dom decides ONCE, at module-init, whether the native
// `input` event exists, by reading `window`. Required with no DOM global it
// concludes "no" and downgrades onChange to a keydown/selectionchange polyfill —
// so a dispatched `input` event updates the DOM node but never reaches React,
// and a controlled input silently ignores every programmatic edit. Install a DOM
// before the require.
installDom();
const { createRoot } = require("react-dom/client");

// Production shape: live categories are cat_NNN, and every icon here differs from
// the DEFAULT_CATEGORIES one for the same name, so a rendered icon tells you which
// source the component read. cat_015 is archived; cat_099 has a blank icon cell.
// The `note` values cover the three shapes the API can return: a real note, the
// "" a blank column-H cell produces, and — on cat_015 — the key being absent.
const CATEGORIES = [
  { id: "cat_001", name_en: "Eating Out", name_zh: "外食", icon: "🍕", sort_order: 1, is_active: true, gov_category: "restaurants_accommodation", note: "restaurants and takeaway, not groceries" },
  { id: "cat_003", name_en: "Groceries", name_zh: "食材", icon: "🥕", sort_order: 3, is_active: true, gov_category: "food_beverage_tobacco", note: "" },
  { id: "cat_015", name_en: "Fuel", name_zh: "加油", icon: "🛢️", sort_order: 15, is_active: false, gov_category: "transport_communication" },
  { id: "cat_099", name_en: "Blank Icon", name_zh: "空白", icon: "", sort_order: 99, is_active: true, gov_category: "miscellaneous", note: "   " },
];

function expense(id, category_id, notes) {
  return {
    id,
    amount: 100,
    category_id,
    date: "2026-08-01",
    paid_by: "Karen",
    created_by: "Karen",
    notes,
    created_at: "2026-08-01T00:00:00Z",
  };
}

const EXPENSES = [
  expense("e1", "eating-out", "row-legacy-slug"),
  expense("e2", "cat_003", "row-live-id"),
  expense("e3", "fuel", "row-archived"),
  expense("e4", "cat_777", "row-orphan"),
  expense("e5", "cat_099", "row-blank-icon"),
];

// The four date shapes the API can return. Netflix carries a start date, so an
// end date before it can be rejected; Spotify has none, the legacy shape that
// must never block an archive. iCloud is a subscription cancelled before this
// feature existed — end_date "" — which is the state of all 10 live cancelled
// rows; Disney+ is one cancelled since, carrying a real date.
// `notes` covers both shapes on both sides of the Active/Cancelled split: an
// active and a cancelled subscription carrying a real note, and one of each with
// "" — which is what every row reads as until someone writes one (entity 059).
const SUBSCRIPTIONS = [
  { id: "sub-1", name: "Netflix", amount: 390, category_id: "eating-out", frequency: "monthly", due_day: 15, paid_by: "Karen", is_active: true, start_date: "2026-03-01", end_date: "", notes: "" },
  { id: "sub-2", name: "Spotify", amount: 149, category_id: "cat_003", frequency: "monthly", due_day: 1, paid_by: "Karen", is_active: true, start_date: "", end_date: "", notes: "shared with mum" },
  { id: "sub-3", name: "iCloud", amount: 30, category_id: "fuel", frequency: "monthly", due_day: 20, paid_by: "Karen", is_active: false, start_date: "", end_date: "", notes: "family plan" },
  { id: "sub-4", name: "Disney+", amount: 270, category_id: "cat_003", frequency: "monthly", due_day: 8, paid_by: "Karen", is_active: false, start_date: "2025-01-15", end_date: "2026-06-30", notes: "" },
];

// A healthy scheduler: a run recorded minutes ago. `stale` comes from the API,
// never from the page, so the page cannot disagree with the backend about it.
const SCHEDULER_OK = {
  last_run_at: "2026-08-18T01:00:00.000Z",
  due_count: 2,
  created_count: 2,
  skipped_count: 0,
  error: "",
  stale: false,
};

/**
 * @param {{offline?: boolean, failWrites?: boolean, categories?: object[],
 *          schedulerStatus?: object|null}} opts
 *   offline simulates GET /api/categories failing.
 *   failWrites simulates POST/PATCH /api/categories failing while GET still works.
 *   categories overrides the default fixture (a long list, for the
 *   below-the-fold cases).
 *   schedulerStatus is the GET /api/scheduler-status body; null makes that
 *   endpoint fail, the shape an un-deployed or broken scheduler produces.
 *   deferCategories holds GET /api/categories open until releaseCategories() is
 *   called — the sub-second window before the live list resolves, which is
 *   otherwise unobservable because mount() flushes it away.
 */
function installGlobals({ offline = false, failWrites = false, categories: fixture = CATEGORIES, schedulerStatus = SCHEDULER_OK, subscriptions: subFixture = SUBSCRIPTIONS, failSubscriptionWrites = false, expenses: expFixture = EXPENSES, deferCategories = false } = {}) {
  const dom = installDom();

  // Mutable so a test can fail the categories fetch, then let a retry succeed
  // without remounting — the recovery-without-reload case.
  let categoriesOffline = offline;
  const setOffline = (v) => { categoriesOffline = v; };

  let release = null;
  const gate = deferCategories ? new Promise((r) => { release = r; }) : null;
  const releaseCategories = () => release?.();

  // jsdom implements neither API, so these records are the only way to observe a
  // page trying to move the viewport. A fix that keeps the captain's place must
  // leave `scrolls` empty.
  const scrolls = [];
  dom.window.HTMLElement.prototype.scrollIntoView = function (options) {
    scrolls.push({ api: "scrollIntoView", target: this, options });
  };
  dom.window.scrollTo = (...args) => scrolls.push({ api: "scrollTo", args });

  const requests = [];
  // A per-run copy so a test can edit an icon mid-run, the way Category
  // Management would, and re-observe without rebuilding anything.
  const categories = fixture.map((c) => ({ ...c }));
  const setCategoryIcon = (id, icon) => {
    categories.find((c) => c.id === id).icon = icon;
  };

  // Bodies of the category writes the page issued, so a test can assert on what
  // was actually sent rather than only on what came back.
  const writes = [];
  const subscriptions = subFixture.map((s) => ({ ...s }));
  const subWrites = [];
  const expWrites = [];

  global.fetch = async (url, init = {}) => {
    const href = String(url);
    const method = init.method ?? "GET";
    requests.push(href);

    if (href === "/api/categories" && method === "GET") {
      if (gate) await gate;
      if (categoriesOffline) return { ok: false, status: 503, statusText: "Service Unavailable" };
      // Fresh objects per request, as JSON parsing would give — returning the same
      // array reference would let React bail out of the re-render.
      return { ok: true, status: 200, json: async () => categories.map((c) => ({ ...c })) };
    }
    if (href.startsWith("/api/categories") && (method === "POST" || method === "PATCH")) {
      const body = JSON.parse(init.body);
      writes.push({ method, href, body });
      if (failWrites) return { ok: false, status: 503, statusText: "Service Unavailable" };
      if (method === "POST") {
        const created = {
          id: `cat_${String(categories.length + 100)}`,
          sort_order: categories.length + 1,
          is_active: true,
          note: "",
          ...body,
        };
        categories.push(created);
        return { ok: true, status: 201, json: async () => ({ ...created }) };
      }
      const target = categories.find((c) => c.id === href.split("/").pop());
      Object.assign(target, body);
      return { ok: true, status: 200, json: async () => ({ ...target }) };
    }
    if (href === "/api/scheduler-status") {
      if (!schedulerStatus) return { ok: false, status: 503, statusText: "Service Unavailable" };
      return { ok: true, status: 200, json: async () => ({ ...schedulerStatus }) };
    }
    if (href === "/api/subscriptions") {
      if (method === "GET") {
        return { ok: true, status: 200, json: async () => subscriptions.map((s) => ({ ...s })) };
      }
      // Bodies of the subscription writes the page issued, so a test can assert
      // on what was actually SENT — the date shown in the modal rather than the
      // date the page could have recomputed at submit time.
      const body = JSON.parse(init.body);
      subWrites.push({ method, body });
      if (failSubscriptionWrites) return { ok: false, status: 503, statusText: "Service Unavailable" };
      if (method === "POST") {
        const created = { id: `sub-${subscriptions.length + 100}`, is_active: true, ...body };
        subscriptions.push(created);
        return { ok: true, status: 201, json: async () => ({ ...created }) };
      }
      const target = subscriptions.find((s) => s.id === body.id);
      Object.assign(target, body);
      return { ok: true, status: 200, json: async () => ({ ...target }) };
    }
    // addExpense POSTs to bare "/api". Recorded rather than served by the
    // fall-through, so a test can assert on the category_id that was actually
    // SENT — the whole question this entity turns on.
    if (href === "/api" && method !== "GET") {
      const body = JSON.parse(init.body);
      expWrites.push({ method, body });
      return { ok: true, status: 201, json: async () => ({ id: `exp-${expWrites.length}`, created_at: "2026-08-24T00:00:00.000Z", ...body }) };
    }
    return { ok: true, status: 200, json: async () => expFixture.map((e) => ({ ...e })) };
  };
  mockApiClient();
  return { dom, requests, writes, categories, setCategoryIcon, scrolls, subscriptions, subWrites, expWrites, setOffline, releaseCategories };
}

/**
 * Replace the API client with one that calls `global.fetch` directly. The real
 * apiFetch mints a Firebase ID token from `getFirebaseAuth().currentUser`, which
 * is null headlessly — every service call would throw NotSignedInError instead of
 * reaching the fetch stub above. What the real helper puts on the wire is covered
 * by test/api-auth.test.js, which exercises it against a stubbed firebase module.
 */
function mockApiClient() {
  const id = require.resolve("../../.test-build-ui/lib/apiClient.js");
  class NotSignedInError extends Error {}
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: {
      apiFetch: (input, init) => global.fetch(input, init),
      NotSignedInError,
    },
  };
}

/**
 * Replace the auth module with a signed-in stub. Subscriptions calls `useAuth`
 * only to attribute `paid_by`; the real provider needs Firebase credentials and a
 * Google popup, neither of which exists headlessly.
 */
function mockAuth() {
  const id = require.resolve("../../.test-build-ui/lib/authContext.js");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: {
      useAuth: () => ({
        user: { email: "test@example.com" },
        loading: false,
        resolvedUserId: "user1",
        unauthorizedEmail: false,
        signIn() {},
        signOut() {},
        hasReauthed: false,
        setHasReauthed() {},
      }),
      AuthProvider: ({ children }) => children,
    },
  };
}

async function mount(Component) {
  const container = global.document.createElement("div");
  global.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(React.createElement(Component));
  });
  // Second flush: the category fetch resolves in a microtask after the first.
  await act(async () => {});
  return container;
}

/** The row whose notes/name match `marker`, then its icon span. */
function iconForRow(container, marker) {
  const row = [...container.querySelectorAll("button, div.card")].find(
    (el) => el.textContent.includes(marker)
  );
  if (!row) throw new Error(`no row containing ${marker}`);
  const icon = row.querySelector(".text-xl");
  if (!icon) throw new Error(`no icon span in row ${marker}`);
  return icon.textContent;
}

module.exports = { CATEGORIES, EXPENSES, SUBSCRIPTIONS, SCHEDULER_OK, expense, installGlobals, mockAuth, mount, iconForRow };
