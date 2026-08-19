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

const endDateInput = (container) => container.querySelector('[data-testid="cancel-end-date"]');
const endDateError = (container) => container.querySelector('[data-testid="cancel-end-date-error"]');
const startDateInput = (container) => container.querySelector('[data-testid="add-start-date"]');
const modalBox = (container) => container.querySelector(".modal-open");

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
  assert.ok(endDateInput(container), "and it holds an end-date field");
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

    assert.equal(endDateInput(container).value, "2026-08-19");
    assert.equal(endDateInput(container).type, "date", "an editable date input, not text");
    assert.equal(endDateInput(container).disabled, false);
    assert.equal(endDateInput(container).readOnly, false);
  });
});

test("AC-8: the pre-filled date is editable", async () => {
  await atClock(EARLY_MORNING, async () => {
    install();
    const container = await mount(loadPage());
    await openCancelModal(container, "Netflix");

    await setValue(endDateInput(container), "2026-07-01");
    // A controlled input that ignored the edit would still read 2026-08-19.
    assert.equal(endDateInput(container).value, "2026-07-01");
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

    await setValue(endDateInput(container), "2026-07-01");
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

  await setValue(endDateInput(container), "2026-02-28");
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
  await setValue(endDateInput(container), "2026-03-01");
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

  await setValue(endDateInput(container), "2020-01-01");
  await click(buttonByKey(container, "subscriptions.confirm_cancel"));

  assert.equal(endDateError(container), null);
  assert.equal(g.subWrites.length, 1);
  assert.equal(g.subWrites[0].body.end_date, "2020-01-01");
});

test("AC-11: correcting the date clears the message and lets the archive through", async () => {
  const g = install();
  const container = await mount(loadPage());
  await openCancelModal(container, "Netflix");

  await setValue(endDateInput(container), "2026-02-28");
  await click(buttonByKey(container, "subscriptions.confirm_cancel"));
  assert.ok(endDateError(container));

  await setValue(endDateInput(container), "2026-04-01");
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

    await click([...container.querySelectorAll("button")].find((b) => b.className.includes("btn-primary")));

    const input = startDateInput(container);
    assert.ok(input, "the Add modal has a start date field");
    assert.equal(input.type, "date");
    // Same derivation AC-8 pins: the 19th locally, never the UTC 18th.
    assert.equal(input.value, "2026-08-19");

    await setValue(input, "2025-11-30");
    assert.equal(input.value, "2025-11-30", "editable before submitting");
  });
});

test("AC-14: creating a subscription sends the submitted start_date and an empty end_date", async () => {
  await atClock(EARLY_MORNING, async () => {
    const g = install();
    const container = await mount(loadPage());

    await click([...container.querySelectorAll("button")].find((b) => b.className.includes("btn-primary")));
    await setValue(container.querySelector('input[placeholder="e.g. Netflix"]'), "Disney+");
    await setValue(container.querySelector('input[type="number"]'), "270");
    await setValue(startDateInput(container), "2025-11-30");
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
    await setValue(endDateInput(container), "2026-07-01");
    await click(buttonByKey(container, "subscriptions.confirm_cancel"));

    const line = cardFor(container, "Netflix").querySelector('[data-testid="end-date"]');
    assert.ok(line, "no reload needed to see when it ended");
    assert.ok(line.textContent.includes("2026-07-01"), line.textContent);
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

  for (const key of ["start_date_label", "end_date_label", "cancel_title", "confirm_cancel", "end_before_start", "ended"]) {
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
