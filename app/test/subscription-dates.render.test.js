// Run with: npm test
// Start/end dates on the Subscriptions screen (entity 053). Mounts the real page
// and asserts on what reaches the DOM and on the request bodies that LEAVE the
// page — never on which helper was called. Cancel used to PATCH the moment it
// was clicked, so "the handler exists" is not the claim under test: the claims
// are that no request goes out until the captain confirms, and that the request
// carries the date the modal was showing.

// Asia/Taipei is UTC+8, where the whole 00:00–07:59 window is the failure this
// entity has to avoid. Set before any module captures the zone.
process.env.TZ = "Asia/Taipei";

const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { installGlobals, mockAuth, mount, SUBSCRIPTIONS } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");

mockAuth();

const loadPage = () => require("../.test-build-ui/subscriptions/page.js").default;

const click = (el) =>
  React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

const setValue = (input, value) =>
  React.act(async () => {
    const setter = Object.getOwnPropertyDescriptor(global.window.HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new global.window.Event("input", { bubbles: true }));
  });

const pressEscape = () =>
  React.act(async () => {
    global.document.dispatchEvent(
      new global.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
  });

// ─── Picker helpers (entity 057) ─────────────────────────────────────────────
// Both date fields are now triggers that open the shared DatePickerModal. It
// portals to document.body as a SIBLING of the mounted container, so
// container.querySelector cannot see it — picker queries run against the
// document, exactly as date-picker.render.test.js:70-71 documents.

const $ = (sel) => global.document.querySelector(sel);

const picker = () => $('[data-testid="date-picker"]');
const dayCell = (iso) => $(`[data-testid="day-${iso}"]`);

/** The year and month the grid is showing, read off its first day cell, so
 *  navigation is computed from what is on screen rather than assumed. */
function cursor() {
  const firstDay = $('[data-testid="day-grid"] button[data-testid^="day-"]');
  assert.ok(firstDay, "the picker's day grid is on screen");
  const [year, month] = firstDay.dataset.testid.slice(4).split("-").map(Number);
  return { year, index: year * 12 + month };
}

/** Open `trigger`'s picker and pick `iso` the way the captain does — year view
 *  for a different year, then month stepping. This is the replacement for the
 *  old setValue() on the native input: same intent, driven through the real
 *  control, so a picker that opened on the wrong month fails here rather than
 *  being bypassed by typing a string straight into the field. */
async function pickDate(trigger, iso) {
  await click(trigger);
  assert.ok(picker(), "the trigger opened the picker");

  const [year, month] = iso.split("-").map(Number);
  if (cursor().year !== year) {
    await click($('[data-testid="picker-title"]'));
    const yearCell = $(`[data-testid="year-${year}"]`);
    assert.ok(yearCell, `${year} is outside the picker's year range`);
    await click(yearCell);
  }

  const target = year * 12 + month;
  for (let steps = 0; cursor().index !== target; steps++) {
    assert.ok(steps < 12, `could not step the grid to ${iso}`);
    await click($(cursor().index < target ? '[data-testid="picker-next"]' : '[data-testid="picker-prev"]'));
  }

  const cell = dayCell(iso);
  assert.ok(cell, `${iso} is not on the grid the picker settled on`);
  await click(cell);
  assert.equal(picker(), null, "picking a day closed the picker");
}

/** 00:30 on the 19th in Taipei — 16:30 on the 18th in UTC. */
const EARLY_MORNING = Date.parse("2026-08-18T16:30:00Z");

/** Run `fn` with the clock frozen, so a pre-filled "today" is a fixed string. */
async function atClock(nowMs, fn) {
  mock.timers.enable({ apis: ["Date"], now: nowMs });
  try {
    return await fn();
  } finally {
    mock.timers.reset();
  }
}

const cardFor = (container, name) =>
  [...container.querySelectorAll("div.card")].find((c) => c.textContent.includes(name));

/** The section heading a card sits under: "Active" or "Cancelled". */
const sectionOf = (container, name) => {
  const card = cardFor(container, name);
  const section = card.closest("section");
  return section.querySelector("div.uppercase").textContent;
};

const endDateTrigger = (container) => container.querySelector('[data-testid="cancel-end-date"]');
const endDateError = (container) => container.querySelector('[data-testid="cancel-end-date-error"]');
const startDateTrigger = (container) => container.querySelector('[data-testid="add-start-date"]');
const modalBox = (container) => container.querySelector(".modal-open");

/** The header's "+ Add" button — the only btn-primary before a modal opens. */
const openAddModal = (container) =>
  click([...container.querySelectorAll("button")].find((b) => b.className.includes("btn-primary")));

const cancelButtonFor = (container, name) =>
  [...cardFor(container, name).querySelectorAll("button")]
    .find((b) => b.textContent.includes("subscriptions.cancel"));

const buttonByKey = (container, key) =>
  [...modalBox(container).querySelectorAll("button")].find((b) => b.textContent.trim() === key);

/** Open the archive modal for `name` and hand back the request count taken first. */
async function openCancelModal(container, name) {
  const before = global.__requests.length;
  await click(cancelButtonFor(container, name));
  return before;
}

// installGlobals returns the request log; stash it so the helper above can see it.
function install(opts) {
  const g = installGlobals(opts);
  global.__requests = g.requests;
  return g;
}

// ---------------------------------------------------------------------------
// AC-7 / AC-10 — nothing is written until the captain confirms.
// ---------------------------------------------------------------------------

test("AC-7: clicking Cancel opens a modal and issues no request", async () => {
  const g = install();
  const container = await mount(loadPage());

  const before = await openCancelModal(container, "Netflix");

  assert.ok(modalBox(container), "the confirmation modal is in the DOM");
  assert.ok(endDateTrigger(container), "and it holds an end-date field");
  // The whole point: the old handler PATCHed here, recording only THAT it ended.
  assert.equal(g.requests.length, before, `no request was issued, got ${g.requests.slice(before)}`);
  assert.equal(g.subWrites.length, 0);
  assert.equal(sectionOf(container, "Netflix"), "subscriptions.active", "the card has not moved");
});

test("AC-10: dismissing by backdrop issues no request and leaves the subscription active", async () => {
  const g = install();
  const container = await mount(loadPage());
  const before = await openCancelModal(container, "Netflix");

  await click(container.querySelector(".modal-backdrop"));

  assert.equal(modalBox(container), null, "the modal closed");
  assert.equal(g.requests.length, before, "still no request");
  assert.equal(g.subWrites.length, 0);
  assert.equal(sectionOf(container, "Netflix"), "subscriptions.active");
  assert.equal(g.subscriptions.find((s) => s.id === "sub-1").end_date, "", "no end date was stored");
});

test("AC-10: dismissing by the modal's own Cancel button issues no request", async () => {
  const g = install();
  const container = await mount(loadPage());
  const before = await openCancelModal(container, "Netflix");

  await click(buttonByKey(container, "common.cancel"));

  assert.equal(modalBox(container), null);
  assert.equal(g.requests.length, before);
  assert.equal(g.subWrites.length, 0);
});

// ---------------------------------------------------------------------------
// AC-8 — the pre-filled date is the LOCAL day, not the UTC one.
// ---------------------------------------------------------------------------

test("AC-8: at 00:30 Taipei the field is pre-filled with today, not yesterday", async () => {
  await atClock(EARLY_MORNING, async () => {
    // The defect this pins: the app's existing convention would fill in the 18th.
    assert.equal(new Date().toISOString().split("T")[0], "2026-08-18", "UTC says the 18th");

    install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");

    // Entity 057 swapped the native input for a picker trigger, so the four
    // assertions here are the same claims re-aimed at the new control: the
    // shown date is textContent rather than .value, and "not read-only" is
    // proved by the tap actually opening the picker rather than by a property
    // a <button> does not have.
    assert.equal(endDateTrigger(container).textContent.trim(), "2026-08-19");
    assert.equal(endDateTrigger(container).type, "button", "a tappable trigger, not a typed-into field");
    assert.equal(endDateTrigger(container).disabled, false);

    await click(endDateTrigger(container));
    assert.ok(picker(), "tapping it opens the picker — still editable");
    assert.equal(
      dayCell("2026-08-19").getAttribute("aria-selected"),
      "true",
      "and the picker opens ON the pre-filled local day, not the UTC 18th"
    );
  });
});

test("AC-8: the pre-filled date is editable", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");

    await pickDate(endDateTrigger(container), "2026-07-01");
    // A controlled trigger that ignored the pick would still read 2026-08-19.
    assert.equal(endDateTrigger(container).textContent.trim(), "2026-07-01");
  });
});

// ---------------------------------------------------------------------------
// AC-9 — confirming sends exactly one PATCH carrying the date on screen.
// ---------------------------------------------------------------------------

test("AC-9: confirming sends one PATCH with the shown date and moves the card to Cancelled", async () => {
  await atClock(EARLY_MORNING, async () => {
    const g = install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");

    await pickDate(endDateTrigger(container), "2026-07-01");
    await click(buttonByKey(container, "subscriptions.confirm_cancel"));

    assert.equal(g.subWrites.length, 1, "exactly one request");
    assert.equal(g.subWrites[0].method, "PATCH");
    assert.equal(g.subWrites[0].body.id, "sub-1");
    assert.equal(g.subWrites[0].body.is_active, false);
    // Not today's date: a page that recomputed "today" at submit time would send
    // 2026-08-19 and silently discard the captain's correction.
    assert.equal(g.subWrites[0].body.end_date, "2026-07-01");

    assert.equal(modalBox(container), null, "the modal closed");
    assert.equal(sectionOf(container, "Netflix"), "subscriptions.cancelled");
  });
});

test("AC-9: confirming the untouched pre-fill sends today's local date", async () => {
  await atClock(EARLY_MORNING, async () => {
    const g = install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");
    await click(buttonByKey(container, "subscriptions.confirm_cancel"));

    assert.equal(g.subWrites.length, 1);
    assert.equal(g.subWrites[0].body.end_date, "2026-08-19");
  });
});

// ---------------------------------------------------------------------------
// AC-11 — the client blocks an end date before the start date.
// ---------------------------------------------------------------------------

test("AC-11: an end date before the start date is blocked with a message and no request", async () => {
  const g = install();
  const container = await mount(loadPage());
  // Netflix's fixture start_date is 2026-03-01.
  assert.equal(SUBSCRIPTIONS.find((s) => s.id === "sub-1").start_date, "2026-03-01");
  const before = await openCancelModal(container, "Netflix");

  await pickDate(endDateTrigger(container), "2026-02-28");
  await click(buttonByKey(container, "subscriptions.confirm_cancel"));

  assert.ok(endDateError(container), "a visible message is in the DOM");
  assert.equal(endDateError(container).textContent, "subscriptions.end_before_start");
  assert.equal(g.subWrites.length, 0, "confirm was a no-op");
  assert.equal(g.requests.length, before);
  assert.ok(modalBox(container), "the modal stayed open");
  assert.equal(sectionOf(container, "Netflix"), "subscriptions.active");
});

test("AC-11: an end date EQUAL to the start date is accepted", async () => {
  const g = install();
  const container = await mount(loadPage());
  await openCancelModal(container, "Netflix");

  // Started and cancelled the same day is real; the guard is strictly-earlier.
  await pickDate(endDateTrigger(container), "2026-03-01");
  await click(buttonByKey(container, "subscriptions.confirm_cancel"));

  assert.equal(endDateError(container), null);
  assert.equal(g.subWrites.length, 1);
  assert.equal(g.subWrites[0].body.end_date, "2026-03-01");
});

test("AC-11: a subscription with no start date accepts any end date", async () => {
  const g = install();
  const container = await mount(loadPage());
  // Spotify has start_date "" — the shape of every row in the sheet today. A
  // missing start date must never block recording an end date.
  await openCancelModal(container, "Spotify");

  await pickDate(endDateTrigger(container), "2020-01-01");
  await click(buttonByKey(container, "subscriptions.confirm_cancel"));

  assert.equal(endDateError(container), null);
  assert.equal(g.subWrites.length, 1);
  assert.equal(g.subWrites[0].body.end_date, "2020-01-01");
});

test("AC-11: correcting the date clears the message and lets the archive through", async () => {
  const g = install();
  const container = await mount(loadPage());
  await openCancelModal(container, "Netflix");

  await pickDate(endDateTrigger(container), "2026-02-28");
  await click(buttonByKey(container, "subscriptions.confirm_cancel"));
  assert.ok(endDateError(container));

  await pickDate(endDateTrigger(container), "2026-04-01");
  assert.equal(endDateError(container), null, "the message cleared as soon as the date changed");

  await click(buttonByKey(container, "subscriptions.confirm_cancel"));
  assert.equal(g.subWrites.length, 1);
  assert.equal(g.subWrites[0].body.end_date, "2026-04-01");
});

// ---------------------------------------------------------------------------
// A failed write leaves the screen alone.
// ---------------------------------------------------------------------------

test("a failed archive keeps the modal open and the card in Active", async () => {
  const g = install({ failSubscriptionWrites: true });
  global.alert = () => {};
  const container = await mount(loadPage());
  await openCancelModal(container, "Netflix");

  await click(buttonByKey(container, "subscriptions.confirm_cancel"));

  assert.equal(g.subWrites.length, 1, "the request was attempted");
  assert.ok(modalBox(container), "the modal stayed open showing the failure");
  assert.equal(sectionOf(container, "Netflix"), "subscriptions.active", "no local state was mutated");
});

// ---------------------------------------------------------------------------
// AC-13 / AC-14 — starting a subscription.
// ---------------------------------------------------------------------------

test("AC-13: the Add modal's start date is pre-filled with the local date and is editable", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());

    await openAddModal(container);

    const trigger = startDateTrigger(container);
    assert.ok(trigger, "the Add modal has a start date field");
    assert.equal(trigger.type, "button", "a picker trigger, not a typed-into field");
    // Same derivation AC-8 pins: the 19th locally, never the UTC 18th.
    assert.equal(trigger.textContent.trim(), "2026-08-19");

    await pickDate(trigger, "2025-11-30");
    assert.equal(
      startDateTrigger(container).textContent.trim(),
      "2025-11-30",
      "editable before submitting"
    );
  });
});

test("AC-14: creating a subscription sends the submitted start_date and an empty end_date", async () => {
  await atClock(EARLY_MORNING, async () => {
    const g = install();
    const container = await mount(loadPage());

    await openAddModal(container);
    await setValue(container.querySelector('input[placeholder="e.g. Netflix"]'), "Disney+");
    await setValue(container.querySelector('input[type="number"]'), "270");
    await pickDate(startDateTrigger(container), "2025-11-30");
    await click(buttonByKey(container, "subscriptions.add"));

    assert.equal(g.subWrites.length, 1);
    assert.equal(g.subWrites[0].method, "POST");
    assert.equal(g.subWrites[0].body.start_date, "2025-11-30", "the edited date, not today");
    assert.strictEqual(g.subWrites[0].body.end_date, "", "a new subscription has no end date");
  });
});

// ---------------------------------------------------------------------------
// AC-20 / AC-21 — the cancelled card.
// ---------------------------------------------------------------------------

test("AC-20: a cancelled subscription with an end date shows it", async () => {
  install();
  const container = await mount(loadPage());

  const card = cardFor(container, "Disney+");
  const line = card.querySelector('[data-testid="end-date"]');
  assert.ok(line, "the end date is on the card");
  assert.ok(line.textContent.includes("2026-06-30"), line.textContent);
  assert.ok(line.textContent.includes("subscriptions.ended"), "labelled from a translation key");
});

test("AC-21: a cancelled subscription with no end date renders no end-date element at all", async () => {
  install();
  const container = await mount(loadPage());

  // iCloud is the shape of all 10 subscriptions already cancelled today.
  const card = cardFor(container, "iCloud");
  assert.equal(sectionOf(container, "iCloud"), "subscriptions.cancelled", "fixture check");
  // Absent from the DOM — not an empty span, and not a placeholder date.
  assert.equal(card.querySelector('[data-testid="end-date"]'), null);
  assert.ok(!card.textContent.includes("subscriptions.ended"), card.textContent);
});

test("AC-21: an ACTIVE subscription renders no end-date element either", async () => {
  install();
  const container = await mount(loadPage());
  assert.equal(cardFor(container, "Netflix").querySelector('[data-testid="end-date"]'), null);
});

test("AC-20: the end date appears on the card as soon as an archive succeeds", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");
    await pickDate(endDateTrigger(container), "2026-07-01");
    await click(buttonByKey(container, "subscriptions.confirm_cancel"));

    const line = cardFor(container, "Netflix").querySelector('[data-testid="end-date"]');
    assert.ok(line, "no reload needed to see when it ended");
    assert.ok(line.textContent.includes("2026-07-01"), line.textContent);
  });
});

// ---------------------------------------------------------------------------
// AC-26 / AC-27 — the start date on the card, and the two dates together.
//
// The captain caught this live on staging: start_date was captured but never
// shown anywhere. Both fields follow the SAME absent-not-placeholder rule, and
// they follow it independently — every subscription that predates this entity
// has no start_date, and a subscription archived through this feature has an
// end_date with no start_date behind it. So the four combinations are all real
// data, and each is asserted on its own rather than inferred from the others.
// ---------------------------------------------------------------------------

const startDateLine = (container, name) =>
  cardFor(container, name).querySelector('[data-testid="start-date"]');
const endDateLine = (container, name) =>
  cardFor(container, name).querySelector('[data-testid="end-date"]');

test("AC-26: an ACTIVE subscription with a start date shows it", async () => {
  install();
  const container = await mount(loadPage());

  assert.equal(sectionOf(container, "Netflix"), "subscriptions.active", "fixture check");
  const line = startDateLine(container, "Netflix");
  assert.ok(line, "the start date is on the active card");
  assert.ok(line.textContent.includes("2026-03-01"), line.textContent);
  assert.ok(line.textContent.includes("subscriptions.started"), "labelled from a translation key");
});

test("AC-26: an ACTIVE subscription with no start date renders no start-date element at all", async () => {
  install();
  const container = await mount(loadPage());

  // Spotify is the shape of all 21 subscriptions already active today: no
  // start_date on record. Absent from the DOM — not an empty span, not a
  // placeholder, and above all not a fabricated date.
  assert.equal(sectionOf(container, "Spotify"), "subscriptions.active", "fixture check");
  assert.equal(startDateLine(container, "Spotify"), null);
  assert.ok(!cardFor(container, "Spotify").textContent.includes("subscriptions.started"));
});

test("AC-26/AC-21: a card with neither date renders neither element", async () => {
  install();
  const container = await mount(loadPage());

  // iCloud: cancelled before this feature existed, so both fields are "".
  const card = cardFor(container, "iCloud");
  assert.equal(card.querySelector('[data-testid="start-date"]'), null);
  assert.equal(card.querySelector('[data-testid="end-date"]'), null);
});

test("AC-27: a CANCELLED subscription with both dates shows both", async () => {
  install();
  const container = await mount(loadPage());

  assert.equal(sectionOf(container, "Disney+"), "subscriptions.cancelled", "fixture check");
  const start = startDateLine(container, "Disney+");
  const end = endDateLine(container, "Disney+");
  assert.ok(start, "the start date is on the cancelled card, not just the end date");
  assert.ok(start.textContent.includes("2025-01-15"), start.textContent);
  assert.ok(end, "the end date is still there");
  assert.ok(end.textContent.includes("2026-06-30"), end.textContent);
});

test("AC-27: a CANCELLED subscription with an end date and no start date shows only the end date", async () => {
  // The shape produced by this very feature: archived through the modal, but
  // nobody ever backfilled when it began.
  install({
    subscriptions: [
      { id: "sub-9", name: "HBO", amount: 200, category_id: "cat_003", frequency: "monthly", due_day: 3, paid_by: "Karen", is_active: false, start_date: "", end_date: "2026-05-31", notes: "" },
    ],
  });
  const container = await mount(loadPage());

  assert.equal(startDateLine(container, "HBO"), null, "no start-date element is rendered");
  const end = endDateLine(container, "HBO");
  assert.ok(end, "the end date still shows on its own");
  assert.ok(end.textContent.includes("2026-05-31"), end.textContent);
});

test("AC-27: a CANCELLED subscription with a start date and no end date shows only the start date", async () => {
  // The reverse: a start date was recorded, then the captain archived it by
  // hand in the sheet without typing an end date.
  install({
    subscriptions: [
      { id: "sub-9", name: "HBO", amount: 200, category_id: "cat_003", frequency: "monthly", due_day: 3, paid_by: "Karen", is_active: false, start_date: "2025-02-14", end_date: "", notes: "" },
    ],
  });
  const container = await mount(loadPage());

  assert.equal(endDateLine(container, "HBO"), null, "no end-date element is rendered");
  const start = startDateLine(container, "HBO");
  assert.ok(start, "the start date shows on its own");
  assert.ok(start.textContent.includes("2025-02-14"), start.textContent);
});

test("AC-27: archiving keeps the start date and adds the end date beside it", async () => {
  // Guards the local state update as much as the render: it rewrites the
  // subscription on archive, and dropping start_date there would empty the
  // line the captain was just looking at, with no reload to reveal it.
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");
    await pickDate(endDateTrigger(container), "2026-07-01");
    await click(buttonByKey(container, "subscriptions.confirm_cancel"));

    assert.equal(sectionOf(container, "Netflix"), "subscriptions.cancelled", "it moved");
    const start = startDateLine(container, "Netflix");
    assert.ok(start, "the start date survived the archive");
    assert.ok(start.textContent.includes("2026-03-01"), start.textContent);
    assert.ok(endDateLine(container, "Netflix").textContent.includes("2026-07-01"));
  });
});

// ---------------------------------------------------------------------------
// AC-25 — every new string is a translation key present in both locales.
// ---------------------------------------------------------------------------

test("AC-25: the new strings come from keys present in en and zh with identical key sets", async () => {
  install();
  const container = await mount(loadPage());
  await openCancelModal(container, "Netflix");

  // No I18nextProvider is mounted, so t() echoes its key. Hardcoded English in
  // the component would render as prose and fail these.
  const modal = modalBox(container).textContent;
  assert.ok(modal.includes("subscriptions.cancel_title"), modal);
  assert.ok(modal.includes("subscriptions.end_date_label"), modal);
  assert.ok(modal.includes("subscriptions.confirm_cancel"), modal);

  for (const key of ["start_date_label", "end_date_label", "cancel_title", "confirm_cancel", "end_before_start", "started", "ended"]) {
    assert.equal(typeof EN.subscriptions[key], "string", `en ${key}`);
    assert.equal(typeof ZH.subscriptions[key], "string", `zh ${key}`);
    assert.notEqual(EN.subscriptions[key], ZH.subscriptions[key], `zh ${key} is translated, not copied`);
  }

  assert.deepEqual(
    Object.keys(EN.subscriptions).sort(),
    Object.keys(ZH.subscriptions).sort(),
    "the two subscriptions blocks have identical key sets"
  );
});

// ---------------------------------------------------------------------------
// Entity 057 — the two fields above are now triggers for the shared calendar.
// Everything from here down is new; everything above is entity 053's suite,
// unchanged except for the eight assertions that named the old native input.
// ---------------------------------------------------------------------------

// AC-1 (no native date input anywhere) is asserted by the app-wide walker in
// date-picker.render.test.js, which entity 046 built for exactly this invariant
// and which entity 057 updated to expect an empty result. Kept in one place.

test("AC-2: the Add form's Start Date opens the picker on its own value", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());
    await openAddModal(container);

    const trigger = startDateTrigger(container);
    assert.equal(trigger.tagName, "BUTTON");
    assert.equal(trigger.getAttribute("type"), "button", "a plain button, so it cannot submit anything");
    assert.equal(picker(), null, "the picker stays closed until the field is tapped");

    await click(trigger);

    assert.ok(picker(), "tapping the field opened the picker");
    assert.equal(
      dayCell("2026-08-19").getAttribute("aria-selected"),
      "true",
      "opened at addForm.start_date — a picker seeded from anywhere else misses this day"
    );
  });
});

test("AC-3: the Cancel confirmation's end date opens the picker on cancelDate", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");

    const trigger = endDateTrigger(container);
    assert.equal(trigger.tagName, "BUTTON");
    assert.equal(trigger.getAttribute("type"), "button");
    assert.equal(picker(), null);

    await click(trigger);

    assert.ok(picker(), "tapping the field opened the picker");
    assert.equal(dayCell("2026-08-19").getAttribute("aria-selected"), "true", "opened at cancelDate");
  });
});

test("AC-4: both triggers show the raw ISO date, matching the card line beneath them", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());

    await openAddModal(container);
    // Exactly the ISO string, not prose: the edit sheet formats its trigger, but
    // the Subscriptions cards render start/end verbatim, so prose here would
    // disagree with the line directly below it.
    assert.equal(startDateTrigger(container).textContent.trim(), "2026-08-19");

    await click(buttonByKey(container, "common.cancel"));
    await openCancelModal(container, "Netflix");
    assert.equal(endDateTrigger(container).textContent.trim(), "2026-08-19");
  });
});

test("AC-4: an empty value renders the choose_date fallback, not a blank tap target", async () => {
  // Unreachable through the UI — both fields are pre-filled at open time — so
  // the only honest way into the branch is to empty the pre-fill itself. The
  // compiled page calls todayLocalIso() through the module object at open time
  // (page.js:128, :218), so swapping the export drives the REAL page down the
  // real fallback path rather than re-rendering a replica of the markup.
  const lib = require("../.test-build-ui/lib/subscriptions.js");
  const realTodayLocalIso = lib.todayLocalIso;
  lib.todayLocalIso = () => "";
  try {
    install();
    const container = await mount(loadPage());

    await openAddModal(container);
    assert.equal(startDateTrigger(container).textContent.trim(), "picker.choose_date");

    await click(buttonByKey(container, "common.cancel"));
    await openCancelModal(container, "Netflix");
    assert.equal(endDateTrigger(container).textContent.trim(), "picker.choose_date");
  } finally {
    lib.todayLocalIso = realTodayLocalIso;
  }
});

test("AC-5: picking a day writes only that field, leaving the rest of the Add form alone", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());
    await openAddModal(container);

    const nameInput = () => container.querySelector('input[placeholder="e.g. Netflix"]');
    const numberValues = () =>
      [...container.querySelectorAll('input[type="number"]')].map((i) => i.value);
    const categoryValue = () => container.querySelector("select").value;

    await setValue(nameInput(), "Disney+");
    await click(buttonByKey(container, "subscriptions.annual"));
    const before = { name: nameInput().value, numbers: numberValues(), category: categoryValue() };
    assert.equal(before.numbers.length, 3, "annual shows amount, due month and due day");

    await pickDate(startDateTrigger(container), "2025-11-30");

    assert.equal(startDateTrigger(container).textContent.trim(), "2025-11-30", "the date took the pick");
    assert.equal(picker(), null, "and the picker closed itself");
    assert.ok(modalBox(container), "the Add modal is still open underneath");
    assert.equal(nameInput().value, before.name, "the name survived");
    assert.deepEqual(numberValues(), before.numbers, "amount, due month and due day are untouched");
    assert.equal(categoryValue(), before.category, "the category is untouched");
    assert.ok(
      buttonByKey(container, "subscriptions.annual").className.includes("btn-primary"),
      "the frequency toggle is still on annual"
    );
  });
});

test("AC-11: the picker's overlay outranks daisyUI's .modal so it paints above the dialog", async () => {
  // jsdom computes no layout, so this pins both halves of the comparison
  // statically: the constant the picker has to beat, and the token it emits.
  // Asserting the daisyUI value too means a future daisyUI bump that moves the
  // constant fails here instead of silently making the check meaningless.
  const css = fs.readFileSync(
    path.join(__dirname, "..", "node_modules", "daisyui", "daisyui.css"),
    "utf8"
  );
  const declared = /\.modal\{[^}]*?z-index:\s*(\d+)/.exec(css);
  assert.ok(declared, "daisyUI still declares a z-index on .modal");
  const modalZ = Number(declared[1]);
  assert.equal(modalZ, 999, "the constant entity 057 raised the picker to beat");

  install();
  const container = await mount(loadPage());
  await openCancelModal(container, "Netflix");
  await click(endDateTrigger(container));

  const overlay = picker();
  assert.ok(overlay, "the picker is on screen");
  const token = /z-\[(\d+)\]/.exec(overlay.className);
  assert.ok(token, `the picker overlay carries no z-[N] token: ${overlay.className}`);
  assert.ok(
    Number(token[1]) > modalZ,
    `picker z-index ${token[1]} must be strictly greater than daisyUI's .modal ${modalZ}`
  );
});

test("dismissing the picker leaves the dialog that summoned it open, with its date intact", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");
    await click(endDateTrigger(container));
    assert.ok(picker(), "the picker is open on top of the Cancel dialog");

    // The overlay root IS the picker's backdrop, so clicking it is the dismiss.
    // Subscriptions hangs its own onClick on the sibling .modal-backdrop, which
    // this click must never reach.
    await click(picker());

    assert.equal(picker(), null, "the picker closed");
    assert.ok(modalBox(container), "the Cancel dialog underneath is still open");
    assert.equal(endDateTrigger(container).textContent.trim(), "2026-08-19", "still showing its date");
    assert.equal(sectionOf(container, "Netflix"), "subscriptions.active", "and nothing was archived");
  });
});

test("the picker's own close button closes only the picker", async () => {
  install();
  const container = await mount(loadPage());
  await openAddModal(container);
  await click(startDateTrigger(container));
  assert.ok(picker());

  await click($('[data-testid="picker-close"]'));

  assert.equal(picker(), null, "the picker closed");
  assert.ok(modalBox(container), "the Add modal is still open");
  assert.ok(startDateTrigger(container), "with its start-date field still there");
});

test("Escape closes the picker only, leaving the dialog underneath open", async () => {
  install();
  const container = await mount(loadPage());
  await openCancelModal(container, "Netflix");
  await click(endDateTrigger(container));
  assert.ok(picker());

  await pressEscape();

  assert.equal(picker(), null, "one Escape closed the picker");
  // Subscriptions' modals bind no Escape handler of their own. If a later change
  // adds one at the dialog level, both would close on a single press and this
  // fails rather than quietly losing the captain's place.
  assert.ok(modalBox(container), "the Cancel dialog is still open");
  assert.ok(endDateTrigger(container), "and still holds its end-date field");
});
