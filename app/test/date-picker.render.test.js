// Run with: npm test
// The shared calendar date picker (entity 046). Mounts the real component and the
// real pages and asserts on what reaches the DOM and on the request bodies that
// LEAVE the page — never on which helper was called.
//
// Two defects drive most of these tests, both measured rather than assumed:
// `new Date(2026,2,7).toISOString()` is 2026-03-06 in Taipei, and
// `new Date(2026,0,31).setMonth(+1)` is 3 March. Every timezone and stepping
// assertion below is chosen so the buggy implementation produces a DIFFERENT
// string, not merely a different code path.

// Asia/Taipei is UTC+8, where the whole 00:00–07:59 window is the failure this
// entity must avoid. Set before any module captures the zone.
process.env.TZ = "Asia/Taipei";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");

// The picker reads `i18n.language` to choose a locale. No I18nextProvider can be
// mounted here, so stub the module: `t` echoes its key (the convention the rest
// of the suite already relies on) and the language is flippable for AC-24.
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

const { installGlobals, mockAuth, mount } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");

mockAuth();

const loadPicker = () => require("../.test-build-ui/components/DatePickerModal.js").default;
const loadHome = () => require("../.test-build-ui/page.js").default;
const loadHistory = () => require("../.test-build-ui/history/page.js").default;
const loadDrillDown = () => require("../.test-build-ui/reports/DrillDown.js").default;

// ─── Interaction helpers ─────────────────────────────────────────────────────

const click = (el) => {
  assert.ok(el, "tried to click an element that is not in the DOM");
  return React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });
};

const pressEscape = () =>
  React.act(async () => {
    global.document.dispatchEvent(
      new global.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
  });

/** The picker portals to document.body, so queries run against the document. */
const $ = (sel) => global.document.querySelector(sel);
const $$ = (sel) => [...global.document.querySelectorAll(sel)];

const picker = () => $('[data-testid="date-picker"]');
const title = () => $('[data-testid="picker-title"]');
const dayCell = (iso) => $(`[data-testid="day-${iso}"]`);
const dayCells = () => $$('[data-testid^="day-"]').filter((el) => el.tagName === "BUTTON");
// `[data-testid^="year-"]` also matches the year-view container, so keep buttons.
const yearCells = () => $$('[data-testid^="year-"]').filter((el) => el.tagName === "BUTTON");
const selectedCells = () => $$('[aria-selected="true"]');
const prev = () => $('[data-testid="picker-prev"]');
const next = () => $('[data-testid="picker-next"]');

/** The day button showing this number — found by its LABEL, not by its testid, so
 *  a cell whose id was built with toISOString() is still located and caught. */
const dayLabelled = (n) => dayCells().find((el) => el.textContent.trim() === String(n));

/** Run `fn` with the clock frozen, so "today" is a fixed string. */
async function atClock(nowMs, fn) {
  mock.timers.enable({ apis: ["Date"], now: nowMs });
  try {
    return await fn();
  } finally {
    mock.timers.reset();
  }
}

/** 00:30 on 19 August in Taipei — 16:30 on the 18th in UTC. */
const AUG_19 = Date.parse("2026-08-18T16:30:00Z");
/** 00:30 on 1 SEPTEMBER in Taipei — 31 August in UTC. Straddles a month
 *  boundary, so a UTC-derived default disagrees about the title too. */
const SEP_01 = Date.parse("2026-08-31T16:30:00Z");
/** Midday on 15 January 2026, local. */
const JAN_15 = Date.parse("2026-01-15T04:00:00Z");
/** Midday on 15 March 2026, local. */
const MAR_15 = Date.parse("2026-03-15T04:00:00Z");

// ─── Standalone picker harness ───────────────────────────────────────────────

/** A minimal host: owns the value and the open flag, exactly as the real four
 *  entry points do, so "picking closes it" and "dismissing leaves the value
 *  alone" are observable. */
function makeHost(initial = "") {
  const state = { value: initial, picks: [], closes: 0 };
  function Host() {
    const [value, setValue] = React.useState(initial);
    const [open, setOpen] = React.useState(true);
    state.value = value;
    return open
      ? React.createElement(loadPicker(), {
          value,
          onPick: (iso) => {
            state.picks.push(iso);
            setValue(iso);
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
async function mountPicker(initial = "") {
  const g = installGlobals();
  const { state, Host } = makeHost(initial);
  await mount(Host);
  return { state, ...g };
}

// ─── Page helpers ────────────────────────────────────────────────────────────

/** Wrap the installed fetch so expense writes (POST/PATCH to /api) are recorded
 *  with their bodies. helpers/dom.js records category and subscription writes
 *  only, and AC-17/AC-20 assert on the expense request that LEAVES the page. */
function installWithExpenseWrites(opts) {
  const g = installGlobals(opts);
  const inner = global.fetch;
  const expenseWrites = [];
  global.fetch = async (url, init = {}) => {
    const href = String(url);
    const method = init.method ?? "GET";
    if (href === "/api" && (method === "POST" || method === "PATCH")) {
      const body = JSON.parse(init.body);
      expenseWrites.push({ method, body });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: body.id ?? "new-1", created_at: "2026-08-01T00:00:00Z", ...body }),
      };
    }
    return inner(url, init);
  };
  return { ...g, expenseWrites };
}

const homeDateButton = (c) => c.querySelector('[data-testid="home-date-button"]');
const homeChevrons = (c) =>
  [...homeDateButton(c).parentElement.querySelectorAll("button")].filter(
    (b) => b.dataset.testid !== "home-date-button"
  );
const keypadKey = (c, label) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
const homeSaveButton = (c) =>
  [...c.querySelectorAll("button")].find((b) => b.className.includes("col-span-2"));

const historyFilterButton = (c) =>
  [...c.querySelectorAll("button")].find((b) => b.className.includes("relative p-2 rounded-full"));
const bodyButtonByText = (text) =>
  $$("button").find((b) => b.textContent.trim() === text);

/** Open History's filter sheet and switch it to the custom range. */
async function openCustomRange(container) {
  await click(historyFilterButton(container));
  await click(bodyButtonByText("history.custom"));
}

/** Open an expense row's edit sheet and put it into edit mode. */
async function openEditMode(rowButton) {
  await click(rowButton);
  await click($('[title="history.edit_title"]'));
}

const editDateButton = () => $('[data-testid="edit-date-button"]');
const editSaveButton = () => bodyButtonByText("history.save_changes");
const historyRow = (container, marker) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent.includes(marker));

// ═════════════════════════════════════════════════════════════════════════════
// The shared component
// ═════════════════════════════════════════════════════════════════════════════

/** Everything about the grid that a second, independent implementation would be
 *  unlikely to reproduce byte-for-byte. */
function geometry() {
  const grid = $('[data-testid="day-grid"]');
  return {
    cells: grid.children.length,
    blanks: $$('[data-testid="day-blank"]').length,
    firstCell: dayCells()[0].dataset.testid,
    lastCell: dayCells()[dayCells().length - 1].dataset.testid,
    weekdays: $$('[data-testid^="weekday-"]').map((el) => el.textContent),
    title: title().textContent,
  };
}

test("AC-1: all three entry points render one identical grid for the same month", async () => {
  await atClock(AUG_19, async () => {
    // Home — the date state is today, so the picker opens on August 2026.
    installWithExpenseWrites();
    const home = await mount(loadHome());
    await click(homeDateButton(home));
    const fromHome = geometry();

    // History's custom-range From — value is "", so it opens on the local month.
    installWithExpenseWrites();
    const history = await mount(loadHistory());
    await openCustomRange(history);
    await click($('[data-testid="filter-date-from"]'));
    const fromFilter = geometry();

    // The edit sheet, reached from History — the fixture expense is 2026-08-01.
    installWithExpenseWrites();
    const history2 = await mount(loadHistory());
    await openEditMode(historyRow(history2, "row-live-id"));
    await click(editDateButton());
    const fromSheet = geometry();

    assert.equal(fromHome.title, "August 2026", "fixture check: all three land on the same month");
    assert.deepEqual(fromFilter, fromHome, "the History filter grid matches Home's");
    assert.deepEqual(fromSheet, fromHome, "the edit sheet grid matches Home's");
    // A screen that grew its own grid would differ in at least one of these.
    assert.equal(fromHome.cells, 31 + fromHome.blanks);
    assert.deepEqual(fromHome.weekdays, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });
});

test("AC-2: onPick receives a plain ISO string, never a Date", async () => {
  const { state } = await mountPicker("2026-03-07");
  await click(dayCell("2026-03-14"));

  assert.equal(state.picks.length, 1);
  const arg = state.picks[0];
  assert.equal(typeof arg, "string", `got ${Object.prototype.toString.call(arg)}`);
  assert.match(arg, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!(arg instanceof global.window.Date), "not a Date");
});

test("AC-3: picking from inside the History filter sheet leaves that sheet open", async () => {
  await atClock(JAN_15, async () => {
    installWithExpenseWrites();
    const container = await mount(loadHistory());
    await openCustomRange(container);
    await click($('[data-testid="filter-date-from"]'));

    await click(dayCell("2026-01-09"));

    // The user-visible requirement: the sheet the picker was opened from is
    // still there afterwards. Measured caveat — the FilterSheet's inner panel
    // already carries onClick={e => e.stopPropagation()}, so this case survives
    // even without the picker's own guard. The next test is the one that pins
    // the picker's guard.
    assert.ok($('[data-testid="filter-date-from"]'), "the filter sheet is still in the DOM");
    assert.ok(bodyButtonByText("common.apply"), "and still usable");
    assert.equal(picker(), null, "the picker itself closed");
    assert.equal(
      $('[data-testid="filter-date-from"]').textContent.trim(),
      "2026-01-09",
      "onPick fired and wrote the date"
    );
  });
});

test("AC-3: the picker stops its own clicks reaching an UNGUARDED host wrapper", async () => {
  installGlobals();
  const hostClicks = [];
  function UnguardedHost() {
    const [open, setOpen] = React.useState(true);
    // The bare shape of both sheet wrappers — onClick={onClose} — with no inner
    // panel guard in between. React propagates the portalled picker's clicks up
    // to here through the React tree (measured), so this is where the picker's
    // own stopPropagation is the only thing standing between a day tap and the
    // host closing underneath it.
    return React.createElement(
      "div",
      { onClick: () => hostClicks.push("host onClose") },
      open
        ? React.createElement(loadPicker(), {
            value: "2026-03-07",
            onPick: () => {},
            onClose: () => setOpen(false),
          })
        : null
    );
  }
  await mount(UnguardedHost);

  await click(dayCell("2026-03-14"));
  assert.deepEqual(hostClicks, [], "a day tap did not reach the host");

  await mount(UnguardedHost);
  await click(prev());
  await click(title());
  assert.deepEqual(hostClicks, [], "nor did navigating or opening the year view");
});

test("AC-3: dismissing the picker by backdrop also leaves the host sheet open", async () => {
  await atClock(JAN_15, async () => {
    installWithExpenseWrites();
    const container = await mount(loadHistory());
    await openCustomRange(container);
    await click($('[data-testid="filter-date-from"]'));

    await click(picker());

    assert.equal(picker(), null, "the picker closed");
    assert.ok($('[data-testid="filter-date-from"]'), "the filter sheet survived the backdrop tap");
    assert.ok(bodyButtonByText("common.apply"));
  });
});

test("AC-4: navigating and picking issues no network request", async () => {
  const { state, requests } = await mountPicker("2026-03-07");
  const before = requests.length;

  await click(next());
  await click(prev());
  await click(prev());
  await click(title());
  await click($('[data-testid="year-2024"]'));
  await click(dayLabelled(5));

  assert.equal(state.picks.length, 1, "the interactions actually happened");
  assert.equal(
    requests.length,
    before,
    `the picker is pure UI, got ${JSON.stringify(requests.slice(before))}`
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// Month grid
// ═════════════════════════════════════════════════════════════════════════════

test("AC-5: opening with a value shows that month with that day the only selection", async () => {
  await mountPicker("2026-03-07");

  assert.equal(title().textContent, "March 2026");
  assert.equal(dayCell("2026-03-07").getAttribute("aria-selected"), "true");
  assert.equal(selectedCells().length, 1, "exactly one cell is selected");
  assert.equal(selectedCells()[0].dataset.testid, "day-2026-03-07");
});

test("AC-6: the grid holds every day of the month and no more", async () => {
  await mountPicker("2026-03-07");

  for (let d = 1; d <= 31; d++) {
    assert.ok(dayCell(`2026-03-${String(d).padStart(2, "0")}`), `day ${d} is missing`);
  }
  assert.equal(dayCell("2026-03-32"), null, "no 32nd of March");
  assert.equal(dayCells().length, 31);
});

test("AC-6: the first of the month sits in its real weekday column", async () => {
  const { state } = await mountPicker("2026-03-07");

  // 1 March 2026 is a Sunday (getDay() === 0) — measured, not assumed.
  assert.equal(new Date(2026, 2, 1).getDay(), 0, "fixture check");
  const grid = $('[data-testid="day-grid"]');
  assert.equal(dayCell("2026-03-01").dataset.col, "0");
  assert.equal([...grid.children].indexOf(dayCell("2026-03-01")), 0, "no leading blanks");

  // April 2026 opens on a WEDNESDAY, so a component that ignored the weekday and
  // always started at column 0 would pass the March case and fail this one.
  await click(next());
  assert.equal(new Date(2026, 3, 1).getDay(), 3, "fixture check");
  assert.equal(dayCell("2026-04-01").dataset.col, "3");
  assert.equal($$('[data-testid="day-blank"]').length, 3);
  assert.equal([...$('[data-testid="day-grid"]').children].indexOf(dayCell("2026-04-01")), 3);
  assert.equal(state.picks.length, 0);
});

test("AC-6: leap Februaries render 29 days and common ones do not", async () => {
  await mountPicker("2028-02-10");
  assert.ok(dayCell("2028-02-29"), "2028 is a leap year");
  assert.equal(dayCell("2028-02-30"), null);
  assert.equal(dayCells().length, 29);

  await mountPicker("2027-02-10");
  assert.equal(dayCell("2027-02-29"), null, "2027 is not a leap year");
  assert.equal(dayCells().length, 28);
});

test("AC-7: left and right step exactly one month, across the year boundary", async () => {
  await mountPicker("2026-01-15");

  await click(prev());
  assert.equal(title().textContent, "December 2025");
  assert.ok(dayCell("2025-12-15"));

  await click(next());
  await click(next());
  assert.equal(title().textContent, "February 2026");
});

test("AC-7: stepping forward from the 31st does not skip a month", async () => {
  // The falsifying case, measured: new Date(2026,0,31).setMonth(+1) is 3 March.
  const probe = new Date(2026, 0, 31);
  probe.setMonth(probe.getMonth() + 1);
  assert.equal(probe.getMonth(), 2, "fixture check: setMonth lands in March");

  await mountPicker("2026-01-31");
  await click(next());

  assert.equal(title().textContent, "February 2026", "a setMonth implementation reads March 2026");
  assert.ok(dayCell("2026-02-28"));
  assert.equal(dayCell("2026-02-29"), null, "2026 is not a leap year");
});

test("AC-8: navigating months changes nothing but the view", async () => {
  const { state } = await mountPicker("2026-03-07");

  for (let i = 0; i < 3; i++) await click(next());
  for (let i = 0; i < 3; i++) await click(prev());

  assert.equal(title().textContent, "March 2026", "back where it started");
  assert.equal(selectedCells().length, 1);
  assert.equal(selectedCells()[0].dataset.testid, "day-2026-03-07");
  assert.equal(state.picks.length, 0, "onPick was never called");
  assert.equal(state.value, "2026-03-07", "the value is untouched");
});

// ═════════════════════════════════════════════════════════════════════════════
// Year view
// ═════════════════════════════════════════════════════════════════════════════

test("AC-9: tapping the title switches to a year list and hides the day grid", async () => {
  await mountPicker("2026-03-07");

  await click(title());

  assert.ok($('[data-testid="year-view"]'));
  assert.equal(dayCells().length, 0, "no day cells remain");
  assert.equal($('[data-testid="day-grid"]'), null);
});

test("AC-10: the year list spans the local current year -20 to +5, visible year selected", async () => {
  await atClock(AUG_19, async () => {
    await mountPicker("");
    await click(title());

    assert.ok($('[data-testid="year-2006"]'), "20 years back");
    assert.ok($('[data-testid="year-2031"]'), "5 years forward");
    assert.equal($('[data-testid="year-2005"]'), null, "and no further back");
    assert.equal($('[data-testid="year-2032"]'), null, "and no further forward");
    assert.equal(yearCells().length, 26, "26 entries inclusive");
    assert.equal($('[data-testid="year-2026"]').getAttribute("aria-selected"), "true");
    assert.equal(selectedCells().length, 1, "and only that one");
  });
});

test("AC-11: picking a year returns to the month grid without picking or closing", async () => {
  const { state } = await mountPicker("2026-03-07");

  await click(title());
  await click($('[data-testid="year-2020"]'));

  assert.equal($('[data-testid="year-view"]'), null, "the year view is gone");
  assert.equal(title().textContent, "March 2020", "same month index, new year");
  assert.ok(dayCell("2020-03-01"), "the grid is back");
  assert.equal(state.picks.length, 0, "onPick has not fired");
  assert.equal(state.closes, 0);
  assert.ok(picker(), "the picker is still open");
});

// ═════════════════════════════════════════════════════════════════════════════
// Picking and dismissing
// ═════════════════════════════════════════════════════════════════════════════

test("AC-12: tapping a day fires onPick once with that ISO string and closes", async () => {
  const { state } = await mountPicker("2026-03-01");

  await click(dayCell("2026-03-07"));

  assert.deepEqual(state.picks, ["2026-03-07"], "exactly one call");
  assert.equal(state.closes, 1);
  assert.equal(picker(), null, "the picker is gone");
});

test("AC-13: the backdrop dismisses without picking and leaves the value alone", async () => {
  const { state } = await mountPicker("2026-03-07");

  await click(picker());

  assert.equal(state.closes, 1);
  assert.equal(state.picks.length, 0);
  assert.equal(state.value, "2026-03-07");
  assert.equal(picker(), null);
});

test("AC-13: the close button dismisses without picking", async () => {
  const { state } = await mountPicker("2026-03-07");

  await click($('[data-testid="picker-close"]'));

  assert.equal(state.closes, 1);
  assert.equal(state.picks.length, 0);
  assert.equal(state.value, "2026-03-07");
});

test("AC-13: Escape dismisses without picking", async () => {
  const { state } = await mountPicker("2026-03-07");

  await pressEscape();

  assert.equal(state.closes, 1);
  assert.equal(state.picks.length, 0);
  assert.equal(state.value, "2026-03-07");
  assert.equal(picker(), null);
});

// ═════════════════════════════════════════════════════════════════════════════
// Timezone — the entity-053 lesson, not to be reintroduced
// ═════════════════════════════════════════════════════════════════════════════

test("AC-14: with no value the picker opens on the LOCAL month and marks the local today", async () => {
  await atClock(SEP_01, async () => {
    // The defect this pins, measured: UTC is still saying 31 August.
    assert.equal(new Date().toISOString().split("T")[0], "2026-08-31", "UTC says August");

    await mountPicker("");

    // A toISOString()-derived default reads "August 2026" and marks 2026-08-31.
    assert.equal(title().textContent, "September 2026");
    assert.equal(dayCell("2026-09-01").dataset.today, "true");
    assert.equal($$('[data-today="true"]').length, 1, "exactly one cell is today");
    assert.equal(dayCell("2026-08-31"), null, "August is not even on screen");
    assert.equal(selectedCells().length, 0, "today is marked, nothing is selected");
  });
});

test("AC-15: day-cell ISO strings are built from local parts", async () => {
  const { state } = await mountPicker("2026-03-01");

  // Measured: new Date(2026,2,7).toISOString().split("T")[0] is 2026-03-06 here.
  assert.equal(new Date(2026, 2, 7).toISOString().split("T")[0], "2026-03-06", "fixture check");

  // Found by the LABEL "7", so a cell whose id came from toISOString() is still
  // the one clicked — and it would hand back 2026-03-06.
  await click(dayLabelled(7));

  assert.deepEqual(state.picks, ["2026-03-07"]);
});

// ═════════════════════════════════════════════════════════════════════════════
// Home
// ═════════════════════════════════════════════════════════════════════════════

test("AC-16: Home's date label is a button that opens the picker at the current date", async () => {
  await atClock(AUG_19, async () => {
    installWithExpenseWrites();
    const container = await mount(loadHome());

    const label = homeDateButton(container);
    assert.ok(label, "the label is present");
    assert.equal(label.tagName, "BUTTON", "and it is a real control, not a span");

    await click(label);

    assert.ok(picker(), "the picker opened");
    assert.equal(title().textContent, "August 2026");
    assert.equal(dayCell("2026-08-19").getAttribute("aria-selected"), "true", "today, local");
    assert.equal(selectedCells().length, 1);
  });
});

test("AC-17: a date picked on Home reaches the POST body", async () => {
  await atClock(MAR_15, async () => {
    const g = installWithExpenseWrites();
    const container = await mount(loadHome());

    await click(homeDateButton(container));
    await click(dayCell("2026-03-07"));
    await click(keypadKey(container, "1"));
    await click(keypadKey(container, "00"));
    await click(homeSaveButton(container));

    assert.equal(g.expenseWrites.length, 1, "exactly one write");
    assert.equal(g.expenseWrites[0].method, "POST");
    assert.equal(g.expenseWrites[0].body.amount, 100, "the amount went through too");
    // Not 2026-03-15 (the untouched default) and not 2026-03-06 (the UTC form).
    assert.equal(g.expenseWrites[0].body.date, "2026-03-07");
  });
});

test("AC-18: the chevrons still step +/-1 day after a pick", async () => {
  await atClock(MAR_15, async () => {
    installWithExpenseWrites();
    const container = await mount(loadHome());

    await click(homeDateButton(container));
    await click(dayCell("2026-03-07"));
    assert.ok(homeDateButton(container).textContent.includes("2026-03-07"));

    const [left, right] = homeChevrons(container);
    await click(right);
    assert.ok(
      homeDateButton(container).textContent.includes("2026-03-08"),
      homeDateButton(container).textContent
    );

    await click(left);
    await click(left);
    assert.ok(
      homeDateButton(container).textContent.includes("2026-03-06"),
      homeDateButton(container).textContent
    );
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Expense edit sheet — from History and from the Reports drill-down
// ═════════════════════════════════════════════════════════════════════════════

/** AC-19 and AC-20 verbatim, run against whichever mount is handed in, so the
 *  drill-down case (AC-21) cannot drift from the History case. */
async function assertEditSheetDateFlow(openRow) {
  const g = installWithExpenseWrites();
  const container = await mount(openRow.page());
  await openEditMode(openRow.row(container));

  // AC-19 — the control is a button, and it opens on the expense's own date.
  const button = editDateButton();
  assert.ok(button, "the date field is a button");
  assert.equal(button.tagName, "BUTTON");
  await click(button);
  assert.ok(picker(), "the picker opened");
  assert.equal(title().textContent, "August 2026");
  assert.equal(dayCell("2026-08-01").getAttribute("aria-selected"), "true");
  assert.equal(selectedCells().length, 1);

  // AC-20 — the pick reaches editForm.date and then the PATCH body.
  await click(prev());
  assert.equal(title().textContent, "July 2026");
  await click(dayCell("2026-07-15"));
  assert.equal(picker(), null, "picking closed the picker");
  assert.ok($('[data-testid="edit-date-button"]'), "the edit sheet is still open");

  await click(editSaveButton());
  assert.equal(g.expenseWrites.length, 1, "exactly one write");
  assert.equal(g.expenseWrites[0].method, "PATCH");
  assert.equal(g.expenseWrites[0].body.date, "2026-07-15", "the picked date, not the original");
  return g;
}

test("AC-19/AC-20: the edit sheet's date button opens the picker and the pick reaches the PATCH", async () => {
  await assertEditSheetDateFlow({
    page: loadHistory,
    row: (c) => historyRow(c, "row-live-id"),
  });
});

test("AC-21: the Reports drill-down mount behaves identically, with no second implementation", async () => {
  const DrillDown = loadDrillDown();
  await assertEditSheetDateFlow({
    page: () => () =>
      React.createElement(DrillDown, {
        year: 2026,
        month: 8,
        categoryId: "cat_003",
        categoryName: "Groceries",
        icon: "🥕",
        periodLabel: "August 2026",
        payer: "all",
        onBack() {},
        onDataChanged() {},
      }),
    row: (c) => historyRow(c, "row-live-id"),
  });
});

test("AC-21: reports/page.tsx is compiled for the tests", () => {
  // The build note in the spec: .test-build-ui had no reports/ output before this
  // entity, so the drill-down above could not have been mounted at all.
  const pkg = require("../package.json");
  assert.ok(
    pkg.scripts["test:compile"].includes("app/reports/page.tsx"),
    "reports/page.tsx is in test:compile"
  );
  assert.ok(
    fs.existsSync(path.join(__dirname, "../.test-build-ui/reports/DrillDown.js")),
    "and the drill-down was actually emitted"
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// History custom range
// ═════════════════════════════════════════════════════════════════════════════

test("AC-22: From and To each write only their own field", async () => {
  await atClock(JAN_15, async () => {
    installWithExpenseWrites();
    const container = await mount(loadHistory());
    await openCustomRange(container);

    await click($('[data-testid="filter-date-from"]'));
    await click(dayCell("2026-01-01"));
    assert.equal($('[data-testid="filter-date-from"]').textContent.trim(), "2026-01-01");
    assert.equal(
      $('[data-testid="filter-date-to"]').textContent.trim(),
      "picker.choose_date",
      "To was not touched"
    );

    await click($('[data-testid="filter-date-to"]'));
    await click(dayCell("2026-01-31"));
    assert.equal($('[data-testid="filter-date-to"]').textContent.trim(), "2026-01-31");
    assert.equal(
      $('[data-testid="filter-date-from"]').textContent.trim(),
      "2026-01-01",
      "From was not clobbered"
    );

    // Applying proves both values left the sheet, not just that they rendered.
    await click(bodyButtonByText("common.apply"));
    const chips = [...container.querySelectorAll("span")].map((s) => s.textContent);
    assert.ok(
      chips.some((c) => c.includes("2026-01-01") && c.includes("2026-01-31")),
      chips.join(" | ")
    );
  });
});

test("AC-22: opening To second shows To's own value, not From's", async () => {
  await atClock(JAN_15, async () => {
    installWithExpenseWrites();
    const container = await mount(loadHistory());
    await openCustomRange(container);

    await click($('[data-testid="filter-date-from"]'));
    await click(dayCell("2026-01-01"));
    await click($('[data-testid="filter-date-to"]'));

    // A shared `value` wired to the wrong field would select 2026-01-01 here.
    assert.equal(selectedCells().length, 0, "To is still empty");
    assert.equal(title().textContent, "January 2026");
  });
});

test("AC-23: an empty field opens on the local month with nothing selected", async () => {
  await atClock(SEP_01, async () => {
    installWithExpenseWrites();
    const container = await mount(loadHistory());
    await openCustomRange(container);

    await click($('[data-testid="filter-date-from"]'));

    assert.equal(selectedCells().length, 0, "no cell is selected");
    assert.equal(title().textContent, "September 2026", "the LOCAL month, not the UTC one");
    assert.equal(dayCell("2026-09-01").dataset.today, "true", "today is still marked");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// i18n and regression
// ═════════════════════════════════════════════════════════════════════════════

test("AC-24: month and weekday names follow i18n.language", async () => {
  i18nState.language = "en";
  await mountPicker("2026-03-07");
  const en = { title: title().textContent, weekdays: $$('[data-testid^="weekday-"]').map((e) => e.textContent) };

  i18nState.language = "zh";
  try {
    await mountPicker("2026-03-07");
    const zh = { title: title().textContent, weekdays: $$('[data-testid^="weekday-"]').map((e) => e.textContent) };

    assert.equal(en.title, "March 2026");
    assert.equal(zh.title, "2026年3月");
    assert.notEqual(zh.title, en.title, "the title is genuinely localised");
    assert.notDeepEqual(zh.weekdays, en.weekdays, "and so are the weekday headers");
    assert.equal(en.weekdays[0], "Sun");
    assert.equal(zh.weekdays[0], "週日");
  } finally {
    i18nState.language = "en";
  }
});

test("AC-25: every new string is a key present in both locales, zh translated", async () => {
  await mountPicker("2026-03-07");

  // t() echoes its key here, so a hardcoded English label would render as prose
  // and fail these three.
  assert.equal(prev().getAttribute("aria-label"), "picker.previous_month");
  assert.equal(next().getAttribute("aria-label"), "picker.next_month");
  assert.equal($('[data-testid="picker-close"]').getAttribute("aria-label"), "picker.close");
  assert.equal(title().getAttribute("aria-label"), "picker.select_year");

  for (const key of ["previous_month", "next_month", "select_year", "close", "choose_date"]) {
    assert.equal(typeof EN.picker[key], "string", `en ${key}`);
    assert.equal(typeof ZH.picker[key], "string", `zh ${key}`);
    assert.notEqual(EN.picker[key], ZH.picker[key], `zh ${key} is translated, not copied`);
  }

  assert.deepEqual(
    Object.keys(EN.picker).sort(),
    Object.keys(ZH.picker).sort(),
    "the two picker blocks have identical key sets"
  );
  assert.deepEqual(Object.keys(EN).sort(), Object.keys(ZH).sort(), "and so do the files");
});

test("AC-26: only the two Subscriptions inputs still use a native date input", () => {
  const root = path.join(__dirname, "../app");
  const hits = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) {
        fs.readFileSync(full, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (line.includes('type="date"')) hits.push(`${path.relative(root, full)}:${i + 1}`);
          });
      }
    }
  })(root);

  assert.deepEqual(
    hits.map((h) => h.split(":")[0]),
    ["subscriptions/page.tsx", "subscriptions/page.tsx"],
    `native date inputs remain at ${hits.join(", ")}`
  );
});
