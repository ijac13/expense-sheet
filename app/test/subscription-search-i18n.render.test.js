// Run with: npm test
// Entity 059, the half of AC-C8 / AC-C13 / AC-B9 that the other render tests
// cannot reach. Everywhere else no I18nextProvider is mounted, so t() echoes its
// key — which proves a string came from a key, but proves nothing about what the
// captain actually reads. Here i18next is initialised with the REAL locale files
// and the real page is mounted on top of it, so the assertions land on the
// rendered sentence in both languages, including the query interpolated into it.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");

mockAuth();

const i18n = require("i18next");
const { initReactI18next } = require("react-i18next");

// Mirrors app/lib/i18n.ts. react-i18next falls back to this global instance when
// no provider is mounted, so initialising it is all the page needs to render
// real translations.
i18n.use(initReactI18next).init({
  resources: { en: { common: EN }, zh: { common: ZH } },
  lng: "en",
  fallbackLng: "zh",
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

const loadPage = () => require("../.test-build-ui/subscriptions/page.js").default;

const setValue = (input, value) =>
  React.act(async () => {
    Object.getOwnPropertyDescriptor(global.window.HTMLInputElement.prototype, "value")
      .set.call(input, value);
    input.dispatchEvent(new global.window.Event("input", { bubbles: true }));
  });

const searchInput = (container) => container.querySelector('[data-testid="subscription-search"]');
const noResults = (container) => container.querySelector('[data-testid="search-no-results"]');

const setLanguage = (lng) => React.act(async () => { await i18n.changeLanguage(lng); });

test("AC-C8: the no-results message the captain reads contains the query she typed", async () => {
  await setLanguage("en");
  installGlobals();
  const container = await mount(loadPage());

  await setValue(searchInput(container), "hulu");

  const text = noResults(container).textContent;
  // The claim the key-echo tests cannot make: the query reaches the sentence.
  // A message rendered without its interpolation argument fails here, and so
  // does a locale string that dropped {{query}}.
  assert.ok(text.includes("hulu"), `the query is missing from the message: ${text}`);
  assert.equal(text, 'No subscriptions match "hulu".');
  assert.ok(!text.includes("{{query}}"), "the placeholder was substituted, not printed");

  // And it is still not the owns-nothing message, now checked against the real
  // English sentence rather than against a key.
  assert.ok(!container.textContent.includes(EN.subscriptions.empty));
});

test("AC-C8/AC-C13: the same message renders in Chinese, still carrying the query", async () => {
  await setLanguage("zh");
  installGlobals();
  const container = await mount(loadPage());

  await setValue(searchInput(container), "hulu");

  const text = noResults(container).textContent;
  assert.equal(text, "沒有符合「hulu」的訂閱。");
  assert.ok(text.includes("hulu"), "the query survives interpolation in zh too");
  // The captain's own language is zh, so an untranslated fallback here is the
  // failure that would actually reach her.
  assert.ok(!text.includes("No subscriptions"), "not the English fallback");
});

test("AC-C13: the search placeholder renders translated in both languages", async () => {
  await setLanguage("en");
  installGlobals();
  const en = await mount(loadPage());
  assert.equal(searchInput(en).placeholder, "Search subscriptions");

  await setLanguage("zh");
  const zh = await mount(loadPage());
  assert.equal(searchInput(zh).placeholder, "搜尋訂閱");
});

test("AC-B9: the Notes label renders translated in both languages", async () => {
  const openAdd = (container) =>
    React.act(async () => {
      [...container.querySelectorAll("button")]
        .find((b) => b.className.includes("btn-primary"))
        .dispatchEvent(new global.window.Event("click", { bubbles: true }));
    });
  const labelOf = (container) => {
    const textarea = container.querySelector('[data-testid="add-notes"]');
    return textarea.parentElement.querySelector("label").textContent;
  };

  await setLanguage("en");
  installGlobals();
  const en = await mount(loadPage());
  await openAdd(en);
  assert.equal(labelOf(en), "Notes");

  await setLanguage("zh");
  installGlobals();
  const zh = await mount(loadPage());
  await openAdd(zh);
  assert.equal(labelOf(zh), "備註");
});
