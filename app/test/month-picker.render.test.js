// Run with: npm test
// The Reports month picker (entity 068) — a new sibling of DatePickerModal
// (app/app/components/MonthPickerModal.tsx), reusing its chrome and mechanisms
// for a 12-month grid instead of a day grid. Mounts the real component and the
// real Reports page and asserts on what reaches the DOM.

// Asia/Taipei is UTC+8 — kept consistent with date-picker.render.test.js so the
// year-list range assertions read off the same local "now".
process.env.TZ = "Asia/Taipei";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");

// Same react-i18next stub as date-picker.render.test.js: `t` echoes its key, so a
// hardcoded English label would render as prose and fail the AC-9 assertions.
const i18nState = { language: "en" };
{
  const id = require.resolve("react-i18next");
  require.cache[id] = {
    id,
    filename: id,
    loaded: true,
    exports: {
      useTranslation: () => ({ t: (k) => k, i18n: i18nState }),
      initReactI18next: { type: "3rdParty", init() {} },
      I18nextProvider: ({ children }) => children,
    },
  };
}

const { installGlobals, mount } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");

const loadPicker = () => require("../.test-build-ui/components/MonthPickerModal.js").default;
const loadReports = () => require("../.test-build-ui/reports/page.js").default;

// ─── Interaction helpers ─────────────────────────────────────────────────────

const click = (el) => {
  assert.ok(el, "tried to click an element that is not in the DOM");
  return React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
};

/** Like click(), plus a second empty act() to flush a fetch chain the click
 *  kicked off (the pattern test/category-cache.render.test.js's flush() and
 *  helpers/dom.js's mount() both use for the same reason). */
const clickAndFlush = async (el) => {
  await click(el);
  await React.act(async () => {});
};

const pressEscape = () =>
  React.act(async () => {
    global.document.dispatchEvent(
      new global.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
  });

const $ = (sel) => global.document.querySelector(sel);
const $$ = (sel) => [...global.document.querySelectorAll(sel)];

const pad2 = (n) => String(n).padStart(2, "0");

const picker = () => $('[data-testid="month-picker"]');
const title = () => $('[data-testid="month-picker-title"]');
const monthCell = (year, month) => $(`[data-testid="month-cell-${year}-${pad2(month)}"]`);
const monthCells = () => $$('[data-testid^="month-cell-"]').filter((el) => el.tagName === "BUTTON");
const yearCells = () => $$('[data-testid^="month-picker-year-"]').filter((el) => el.tagName === "BUTTON");
const selectedCells = () => $$('[aria-selected="true"]');
const prev = () => $('[data-testid="month-picker-prev"]');
const next = () => $('[data-testid="month-picker-next"]');

/** Run `fn` with the clock frozen, so "local current year" is a fixed value. */
async function atClock(nowMs, fn) {
  mock.timers.enable({ apis: ["Date"], now: nowMs });
  try {
    return await fn();
  } finally {
    mock.timers.reset();
  }
}

/** 00:30 on 19 August 2026 in Taipei — 16:30 on the 18th in UTC. Matches the
 *  constant of the same name in date-picker.render.test.js. */
const AUG_19 = Date.parse("2026-08-18T16:30:00Z");

// ─── Standalone picker harness ───────────────────────────────────────────────

/** A minimal host: owns year/month and the open flag, exactly as Reports does,
 *  so "picking closes it" and "dismissing leaves year/month alone" are
 *  observable. */
function makeHost(initialYear, initialMonth) {
  const state = { year: initialYear, month: initialMonth, picks: [], closes: 0 };
  function Host() {
    const [yr, setYr] = React.useState(initialYear);
    const [mo, setMo] = React.useState(initialMonth);
    const [open, setOpen] = React.useState(true);
    state.year = yr;
    state.month = mo;
    return open
      ? React.createElement(loadPicker(), {
          year: yr,
          month: mo,
          onPick: (y, m) => {
            state.picks.push({ year: y, month: m });
            setYr(y);
            setMo(m);
          },
          onClose: () => {
            state.closes += 1;
            setOpen(false);
          },
        })
      : null;
  }
  return { state, Host };
}

/** Mount the picker alone on a fresh DOM. Returns the harness state + globals. */
async function mountPicker(year, month) {
  const g = installGlobals();
  const { state, Host } = makeHost(year, month);
  await mount(Host);
  return { state, ...g };
}

// ═════════════════════════════════════════════════════════════════════════════
// The standalone component
// ═════════════════════════════════════════════════════════════════════════════

test("AC-1: MonthPickerModal renders a 12-cell month grid scoped to the given year", async () => {
  await mountPicker(2026, 6);

  assert.ok(picker(), "root exists");
  for (let m = 1; m <= 12; m++) {
    assert.ok(monthCell(2026, m), `month ${m} is missing`);
  }
  assert.equal(monthCell(2027, 1), null, "no cell for a different year");
  assert.equal(monthCells().length, 12, "exactly 12 cells, no 13th");
});

test("AC-2: selecting a month fires onPick exactly once with numbers, then closes", async () => {
  const { state } = await mountPicker(2026, 1);

  await click(monthCell(2026, 7));

  assert.equal(state.picks.length, 1, "exactly one call");
  const { year: pickedYear, month: pickedMonth } = state.picks[0];
  assert.equal(typeof pickedYear, "number");
  assert.equal(typeof pickedMonth, "number");
  assert.equal(pickedYear, 2026);
  assert.equal(pickedMonth, 7);
  assert.equal(picker(), null, "the picker is gone");
});

test("AC-3: opening with a given year/month highlights exactly that cell as selected", async () => {
  await mountPicker(2026, 3);

  assert.equal(monthCell(2026, 3).getAttribute("aria-selected"), "true");
  assert.equal(selectedCells().length, 1, "exactly one cell is selected");
  assert.equal(selectedCells()[0], monthCell(2026, 3));
});

test("AC-4: prev/next step the visible year by exactly one, grid always showing all 12 months", async () => {
  await mountPicker(2026, 5);

  await click(next());
  assert.equal(title().textContent, "2027");
  for (let m = 1; m <= 12; m++) assert.ok(monthCell(2027, m), `2027-${pad2(m)} missing`);
  assert.equal(monthCell(2026, 5), null, "no stale cell left from the prior year");

  await click(prev());
  await click(prev());
  assert.equal(title().textContent, "2025");
});

test("AC-5: the title opens a year list; picking a year returns to the month grid without picking or closing", async () => {
  await atClock(AUG_19, async () => {
    const { state } = await mountPicker(2026, 5);

    await click(title());
    assert.ok($('[data-testid="month-picker-year-view"]'));
    assert.ok($('[data-testid="month-picker-year-2006"]'), "20 years back");
    assert.ok($('[data-testid="month-picker-year-2031"]'), "5 years forward");
    assert.equal($('[data-testid="month-picker-year-2005"]'), null, "and no further back");
    assert.equal($('[data-testid="month-picker-year-2032"]'), null, "and no further forward");
    assert.equal(yearCells().length, 26, "26 entries inclusive");
    assert.equal(
      $('[data-testid="month-picker-year-2026"]').getAttribute("aria-selected"),
      "true",
      "the visible (cursor) year is marked"
    );

    await click($('[data-testid="month-picker-year-2020"]'));

    assert.equal($('[data-testid="month-picker-year-view"]'), null, "the year view is gone");
    assert.equal(title().textContent, "2020");
    assert.ok(monthCell(2020, 1), "the month grid is back, for the picked year");
    assert.equal(state.picks.length, 0, "onPick has not fired");
    assert.equal(state.closes, 0);
    assert.ok(picker(), "the picker is still open");
  });
});

test("AC-6: dismissing without picking never calls onPick, and year/month stay unchanged", async () => {
  // Backdrop
  let h = await mountPicker(2026, 3);
  await click(picker());
  assert.equal(h.state.closes, 1);
  assert.equal(h.state.picks.length, 0);
  assert.equal(h.state.year, 2026);
  assert.equal(h.state.month, 3);
  assert.equal(picker(), null);

  // Close button
  h = await mountPicker(2026, 3);
  await click($('[data-testid="month-picker-close"]'));
  assert.equal(h.state.closes, 1);
  assert.equal(h.state.picks.length, 0);
  assert.equal(h.state.year, 2026);
  assert.equal(h.state.month, 3);

  // Escape
  h = await mountPicker(2026, 3);
  await pressEscape();
  assert.equal(h.state.closes, 1);
  assert.equal(h.state.picks.length, 0);
  assert.equal(h.state.year, 2026);
  assert.equal(h.state.month, 3);
  assert.equal(picker(), null);
});

// ═════════════════════════════════════════════════════════════════════════════
// i18n
// ═════════════════════════════════════════════════════════════════════════════

test("AC-9: previous_year/next_year exist in both locales, zh genuinely translated", async () => {
  await mountPicker(2026, 3);

  // t() echoes its key here, so a hardcoded English label would render as prose.
  assert.equal(prev().getAttribute("aria-label"), "picker.previous_year");
  assert.equal(next().getAttribute("aria-label"), "picker.next_year");

  for (const key of ["previous_year", "next_year"]) {
    assert.equal(typeof EN.picker[key], "string", `en ${key}`);
    assert.equal(typeof ZH.picker[key], "string", `zh ${key}`);
    assert.notEqual(EN.picker[key], ZH.picker[key], `zh ${key} is translated, not copied`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Reports integration
// ═════════════════════════════════════════════════════════════════════════════

const reportsMonthButton = (c) => c.querySelector('[data-testid="reports-month-button"]');
const reportsChevrons = (c) =>
  [...reportsMonthButton(c).parentElement.querySelectorAll("button")].filter(
    (b) => b.dataset.testid !== "reports-month-button"
  );
const periodButton = (c, key) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === `reports.${key}`);
/** Annual's year label is the only bare 4-digit span once Monthly's own label
 *  became a button (AC-7) — Monthly isn't rendered while period is annual. */
const annualYearLabel = (c) => [...c.querySelectorAll("span")].find((s) => /^\d{4}$/.test(s.textContent.trim()));

test("AC-7: Reports' month label is a real button; picking a month updates the period and rebases the chevrons", async () => {
  await atClock(AUG_19, async () => {
    installGlobals();
    const container = await mount(loadReports());

    const button = reportsMonthButton(container);
    assert.ok(button, "the month button exists");
    assert.equal(button.tagName, "BUTTON", "a real control, not a span");

    await click(button);
    assert.ok(picker(), "the picker opened");

    await click(title());
    await click($('[data-testid="month-picker-year-2023"]'));
    await clickAndFlush(monthCell(2023, 3));

    assert.equal(picker(), null, "picking closed the picker");
    const pickedLabel = reportsMonthButton(container).textContent;
    assert.ok(pickedLabel.includes("March"), pickedLabel);
    assert.ok(pickedLabel.includes("2023"), pickedLabel);

    const [, rightChevron] = reportsChevrons(container);
    await clickAndFlush(rightChevron);

    const afterChevron = reportsMonthButton(container).textContent;
    assert.ok(afterChevron.includes("April"), afterChevron);
    assert.ok(afterChevron.includes("2023"), afterChevron);
  });
});

test("AC-8: Annual view has no month-picker control, and its year stepping still works", async () => {
  await atClock(AUG_19, async () => {
    installGlobals();
    const container = await mount(loadReports());

    await clickAndFlush(periodButton(container, "annual"));

    assert.equal(reportsMonthButton(container), null, "no month button on Annual");
    assert.equal(picker(), null, "nothing opened the month picker from Annual");

    // The Annual block sits behind `!loading`, so each step's fetch unmounts and
    // remounts it — a chevron reference captured before a click goes stale.
    // Re-query fresh immediately before each click.
    const chevrons = (c) => [...annualYearLabel(c).parentElement.querySelectorAll("button")];

    const initial = Number(annualYearLabel(container).textContent);

    await clickAndFlush(chevrons(container)[1]);
    assert.equal(Number(annualYearLabel(container).textContent), initial + 1, "stepped forward by exactly one year");

    await clickAndFlush(chevrons(container)[0]);
    await clickAndFlush(chevrons(container)[0]);
    assert.equal(Number(annualYearLabel(container).textContent), initial - 1, "stepped back by exactly one year");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// AC-11 — registration
// ═════════════════════════════════════════════════════════════════════════════

test("AC-11: month-picker.render.test.js is registered in package.json's test script", () => {
  const pkg = require("../package.json");
  assert.ok(
    pkg.scripts.test.includes("month-picker.render.test.js"),
    "the new render test is in the explicit file list, or it silently never runs"
  );
  assert.ok(
    fs.existsSync(path.join(__dirname, "../.test-build-ui/components/MonthPickerModal.js")),
    "compiled transitively via reports/page.tsx's import, same as DatePickerModal.js"
  );
});
