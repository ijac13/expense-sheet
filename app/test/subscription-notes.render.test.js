// Run with: npm test
// Notes on the Subscriptions screen (entity 059, Group B). Mounts the real page
// and asserts on what reaches the DOM and on the request bodies that LEAVE the
// page — never on which helper was called. A note is the first free-text field
// on this screen, so the claims that matter are that an empty one is absent from
// the card rather than blank, that it is trimmed and capped before it is sent,
// and that a failed save leaves the card showing what it showed before.
const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { installGlobals, mockAuth, mount } = require("./helpers/dom.js");

const EN = require("../public/locales/en/common.json");
const ZH = require("../public/locales/zh/common.json");

mockAuth();

const loadPage = () => require("../.test-build-ui/subscriptions/page.js").default;

const click = (el) =>
  React.act(async () => {
    el.dispatchEvent(new global.window.Event("click", { bubbles: true }));
  });

/** Drive a controlled <input>/<textarea> the way React sees a real edit. */
const setValue = (el, value) =>
  React.act(async () => {
    const proto = el.tagName === "TEXTAREA"
      ? global.window.HTMLTextAreaElement.prototype
      : global.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new global.window.Event("input", { bubbles: true }));
  });

const cardFor = (container, name) =>
  [...container.querySelectorAll("div.card")].find((c) => c.textContent.includes(name));
const noteLine = (container, name) => cardFor(container, name).querySelector('[data-testid="notes"]');
const modalBox = (container) => container.querySelector(".modal-open");
const addNotes = (container) => container.querySelector('[data-testid="add-notes"]');
const editNotes = (container) => container.querySelector('[data-testid="edit-notes"]');

const openAddModal = (container) =>
  click([...container.querySelectorAll("button")].find((b) => b.className.includes("btn-primary")));

const buttonByKey = (container, key) =>
  [...modalBox(container).querySelectorAll("button")].find((b) => b.textContent.trim() === key);

const editButtonFor = (container, name) =>
  [...cardFor(container, name).querySelectorAll("button")].find((b) => b.textContent.includes("common.edit"));

// ---------------------------------------------------------------------------
// AC-B1 / AC-B2 — the field exists, and the Edit modal opens on the stored note.
// ---------------------------------------------------------------------------

test("AC-B1: the Add modal has an empty Notes textarea, after the Start Date field", async () => {
  installGlobals();
  const container = await mount(loadPage());
  await openAddModal(container);

  const notes = addNotes(container);
  assert.ok(notes, "the Add modal renders a Notes field");
  assert.equal(notes.tagName, "TEXTAREA", "a textarea, so a note can hold line breaks");
  assert.equal(notes.value, "", "a new subscription starts with no note");

  // Position, not just presence: compareDocumentPosition is the DOM's own
  // ordering, so this fails if the field is moved above Start Date.
  const startField = container.querySelector('[data-testid="add-start-date"]');
  assert.ok(
    startField.compareDocumentPosition(notes) & global.Node.DOCUMENT_POSITION_FOLLOWING,
    "Notes comes after Start Date"
  );
});

test("AC-B2: the Edit modal pre-fills the stored note", async () => {
  installGlobals();
  const container = await mount(loadPage());

  // Spotify's fixture note. A modal that opened blank would silently erase it on
  // save, because handleEdit sends whatever the textarea holds.
  await click(editButtonFor(container, "Spotify"));
  assert.equal(editNotes(container).value, "shared with mum");
});

test("AC-B2: a subscription with no note opens an EMPTY textarea, not the last one's", async () => {
  installGlobals();
  const container = await mount(loadPage());

  await click(editButtonFor(container, "Spotify"));
  assert.equal(editNotes(container).value, "shared with mum", "fixture check");
  await click(buttonByKey(container, "common.cancel"));

  // Netflix's note is "". Stale state from the previous open would show
  // "shared with mum" here and write it onto Netflix on the next save.
  await click(editButtonFor(container, "Netflix"));
  assert.strictEqual(editNotes(container).value, "");
});

// ---------------------------------------------------------------------------
// AC-B3 — an empty note never blocks saving.
// ---------------------------------------------------------------------------

test("AC-B3: an empty Notes field neither disables Save nor blocks the write", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  await click(editButtonFor(container, "Netflix"));

  assert.strictEqual(editNotes(container).value, "", "the note is empty");
  const save = buttonByKey(container, "common.save");
  // Contrast with amount, which does disable Save — asserted directly below.
  assert.equal(save.disabled, false, "Save is enabled with an empty note");

  await click(save);
  assert.equal(g.subWrites.length, 1, "the save went through");
  assert.equal(modalBox(container), null, "and the modal closed");
});

test("AC-B3: an empty AMOUNT still disables Save — the contrast the AC names", async () => {
  installGlobals();
  const container = await mount(loadPage());
  await click(editButtonFor(container, "Netflix"));

  await setValue(container.querySelector('input[type="number"]'), "");
  assert.equal(buttonByKey(container, "common.save").disabled, true, "amount still guards Save");
  // And the empty note is not what did it.
  assert.strictEqual(editNotes(container).value, "");
});

// ---------------------------------------------------------------------------
// AC-B4 / AC-B5 — capped at 200, trimmed before it is sent.
// ---------------------------------------------------------------------------

test("AC-B4: the textarea caps a note at 200 characters, typed or pasted", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  await openAddModal(container);

  const notes = addNotes(container);
  assert.equal(notes.maxLength, 200, "the native cap a browser enforces while typing");

  // A paste arrives as one 500-character change. jsdom does not enforce
  // maxLength on a programmatic set, so this is the handler's own cap under
  // test: dropping the slice makes state hold all 500 and this fails.
  await setValue(notes, "x".repeat(500));
  assert.equal(addNotes(container).value.length, 200, "state kept only the first 200");

  await setValue(container.querySelector('input[placeholder="e.g. Netflix"]'), "HBO");
  await setValue(container.querySelector('input[type="number"]'), "200");
  await click(buttonByKey(container, "subscriptions.add"));
  assert.equal(g.subWrites[0].body.notes.length, 200, "and only 200 characters were sent");
});

test("AC-B5: a whitespace-only note is sent as \"\", indistinguishable from unset", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  await openAddModal(container);

  await setValue(addNotes(container), "   \n\n   ");
  await setValue(container.querySelector('input[placeholder="e.g. Netflix"]'), "HBO");
  await setValue(container.querySelector('input[type="number"]'), "200");
  await click(buttonByKey(container, "subscriptions.add"));

  assert.strictEqual(g.subWrites[0].body.notes, "", "sent as empty, not as spaces");
  // And it renders as unset rather than as a blank line taking up card space.
  assert.equal(noteLine(container, "HBO"), null);
});

test("AC-B5: a note with real text is trimmed at the edges but kept intact inside", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  await click(editButtonFor(container, "Netflix"));

  await setValue(editNotes(container), "  cancel  before renewal  ");
  await click(buttonByKey(container, "common.save"));

  assert.equal(g.subWrites[0].body.notes, "cancel  before renewal", "edges trimmed, interior untouched");
});

// ---------------------------------------------------------------------------
// AC-B6 / AC-B7 / AC-B8 — the note on the card.
// ---------------------------------------------------------------------------

test("AC-B6: a non-empty note renders its exact text on an ACTIVE card", async () => {
  installGlobals();
  const container = await mount(loadPage());

  const line = noteLine(container, "Spotify");
  assert.ok(line, "the note is on the active card");
  assert.equal(line.textContent, "shared with mum", "verbatim — not truncated and not decorated");
});

test("AC-B6: a non-empty note renders on a CANCELLED card too", async () => {
  installGlobals();
  const container = await mount(loadPage());

  // iCloud is cancelled. A note rendered only in the Active branch fails here.
  const line = noteLine(container, "iCloud");
  assert.ok(line, "the note is on the cancelled card");
  assert.equal(line.textContent, "family plan");
});

test("AC-B7: an empty note renders no element at all, on either side of the split", async () => {
  installGlobals();
  const container = await mount(loadPage());

  // Absent from the DOM — not an empty div, and not one hidden by CSS, so it
  // consumes no vertical space. Same rule as start_date / end_date.
  assert.equal(noteLine(container, "Netflix"), null, "active card with no note");
  assert.equal(noteLine(container, "Disney+"), null, "cancelled card with no note");
});

test("AC-B8: newlines inside a note survive to the DOM and are not collapsed by markup", async () => {
  installGlobals({
    subscriptions: [
      { id: "sub-1", name: "Netflix", amount: 390, category_id: "cat_003", frequency: "monthly", due_day: 15, paid_by: "Karen", is_active: true, start_date: "", end_date: "", notes: "line one\nline two" },
    ],
  });
  const container = await mount(loadPage());

  const line = noteLine(container, "Netflix");
  // Two separate claims. First: the newline reaches the DOM as a newline —
  // rendering the note through anything that normalises whitespace loses it here.
  assert.equal(line.textContent, "line one\nline two");
  // Second: the element asks for pre-line, which is what makes that newline a
  // visual line break. jsdom loads no stylesheet and computes no layout, so the
  // class token is the strongest available proof that the break will render.
  assert.ok(
    line.className.split(/\s+/).includes("whitespace-pre-line"),
    `the note element does not request pre-line wrapping: ${line.className}`
  );
});

// ---------------------------------------------------------------------------
// AC-B9 — the label is a translation key, in both locales.
// ---------------------------------------------------------------------------

test("AC-B9: the Notes label comes from a key present in en and zh", async () => {
  installGlobals();
  const container = await mount(loadPage());
  await openAddModal(container);

  // No I18nextProvider is mounted, so t() echoes its key. Hardcoded English in
  // the component would render as "Notes" and fail this.
  assert.ok(modalBox(container).textContent.includes("subscriptions.notes_label"), modalBox(container).textContent);

  assert.equal(typeof EN.subscriptions.notes_label, "string");
  assert.equal(typeof ZH.subscriptions.notes_label, "string");
  assert.notEqual(EN.subscriptions.notes_label, ZH.subscriptions.notes_label, "zh is translated, not copied");
  assert.deepEqual(
    Object.keys(EN.subscriptions).sort(),
    Object.keys(ZH.subscriptions).sort(),
    "the two subscriptions blocks have identical key sets"
  );
});

// ---------------------------------------------------------------------------
// AC-B10 / AC-B11 — the card after a save, and after a save that failed.
// ---------------------------------------------------------------------------

test("AC-B10: editing a note updates the card with no reload", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  assert.equal(noteLine(container, "Spotify").textContent, "shared with mum", "fixture check");

  await click(editButtonFor(container, "Spotify"));
  await setValue(editNotes(container), "cancel before renewal");
  await click(buttonByKey(container, "common.save"));

  assert.equal(g.subWrites[0].body.notes, "cancel before renewal", "the PATCH carried the new note");
  assert.equal(
    noteLine(container, "Spotify").textContent,
    "cancel before renewal",
    "the card shows it without remounting"
  );
});

test("AC-B10: clearing a note removes the line from the card", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());

  await click(editButtonFor(container, "Spotify"));
  await setValue(editNotes(container), "");
  await click(buttonByKey(container, "common.save"));

  assert.strictEqual(g.subWrites[0].body.notes, "", "an explicit clear is sent as empty");
  assert.equal(noteLine(container, "Spotify"), null, "and the line is gone, not blank");
});

test("AC-B11: a failed save alerts and leaves the card's note at its pre-edit value", async () => {
  const g = installGlobals({ failSubscriptionWrites: true });
  const alerts = [];
  global.alert = (m) => alerts.push(m);
  const container = await mount(loadPage());

  await click(editButtonFor(container, "Spotify"));
  await setValue(editNotes(container), "this must not stick");
  await click(buttonByKey(container, "common.save"));

  assert.equal(g.subWrites.length, 1, "the request was attempted");
  assert.equal(alerts.length, 1, "the existing alert fired");
  // The claim: no local mutation on a write that did not land. An optimistic
  // update applied before the await would show "this must not stick" here.
  assert.equal(noteLine(container, "Spotify").textContent, "shared with mum");
});

// ---------------------------------------------------------------------------
// AC-D1 — the other fields still go out correctly alongside the note.
// ---------------------------------------------------------------------------

test("AC-D1: adding a subscription still sends every other field beside the note", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  await openAddModal(container);

  await setValue(container.querySelector('input[placeholder="e.g. Netflix"]'), "HBO");
  await setValue(container.querySelector('input[type="number"]'), "200");
  await setValue(addNotes(container), "family plan");
  await click(buttonByKey(container, "subscriptions.add"));

  const body = g.subWrites[0].body;
  assert.equal(body.name, "HBO");
  assert.equal(body.amount, 200);
  assert.equal(body.frequency, "monthly");
  assert.equal(body.due_day, 1);
  assert.ok(body.category_id, "a live category id was sent");
  assert.strictEqual(body.end_date, "");
  assert.equal(body.notes, "family plan");
});

test("AC-D1: editing sends name, amount, category and due day alongside the note", async () => {
  const g = installGlobals();
  const container = await mount(loadPage());
  await click(editButtonFor(container, "Netflix"));

  await setValue(container.querySelector('input[type="number"]'), "450");
  await setValue(editNotes(container), "price rise June");
  await click(buttonByKey(container, "common.save"));

  const body = g.subWrites[0].body;
  assert.equal(body.id, "sub-1");
  assert.equal(body.name, "Netflix");
  assert.equal(body.amount, 450);
  assert.ok(body.category_id);
  assert.equal(body.due_day, 15);
  assert.equal(body.notes, "price rise June");
});
