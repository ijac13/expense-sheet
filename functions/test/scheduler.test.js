// Run with: npm run build && node --test test/
// Subscription auto-add (entity 050). Assertions land on the cells that reach the
// in-memory sheet and on the JSON the status endpoint returns — never on the
// source. The Apps Script this replaced passed every code reading and still wrote
// nothing for months, so "the code says so" is not evidence here.
const test = require("node:test");
const assert = require("node:assert/strict");
const { makeSheets, loadApi, call } = require("./sheetsStub");
const { runSubscriptionScheduler, readSchedulerStatus, taipeiDate, isDueOn } = require("../lib/scheduler");

// Production shape: 10 columns, with the captain's `month` / `amount value`
// helper columns at I and J that the backend knows nothing about.
const EXPENSES_HEADER = ["id", "date", "amount", "category_id", "paid_by", "created_by", "notes", "created_at", "month", "amount value"];
const EXPENSES_ROWS = [
  ["exp-1", "2026-08-01", "250", "cat_001", "ijac", "ijac", "lunch", "2026-08-01T02:00:00.000Z", "2026-08", "250"],
];

const SUBS_HEADER = ["id", "name", "amount", "category_id", "frequency", "due_day", "due_month", "paid_by", "is_active"];

// Every live `is_active` cell is the STRING "true", not a boolean — the exact
// value the old Apps Script's `!== true` check rejected on all 31 rows.
const sub = (over = {}) => {
  const s = { id: "sub-1", name: "Netflix", amount: "390", category_id: "cat_002", frequency: "monthly", due_day: "15", due_month: "", paid_by: "ijac", is_active: "true", ...over };
  return [s.id, s.name, s.amount, s.category_id, s.frequency, s.due_day, s.due_month, s.paid_by, s.is_active];
};

const SCHEDULER_LOG_HEADER = ["run_at", "due_count", "created_count", "skipped_count", "error"];

function fixture({ subs = [sub()], expenses = EXPENSES_ROWS, log } = {}) {
  const tabs = {
    Expenses: { header: EXPENSES_HEADER, rows: expenses.map((r) => r.slice()) },
    Subscriptions: { header: SUBS_HEADER, rows: subs },
  };
  if (log) tabs.SchedulerLog = { header: log.header, rows: log.rows };
  return makeSheets(tabs);
}

/** 01:00 Asia/Taipei on the given date — the hour the schedule fires. */
const at = (isoDate) => Date.parse(`${isoDate}T01:00:00+08:00`);

const run = (f, isoDate) => runSubscriptionScheduler(f.sheets, "sheet-under-test", at(isoDate));

/** Data rows of a tab, header excluded. */
const dataRows = (f, tab) => f.grids[tab].slice(1);
const expenseRows = (f) => dataRows(f, "Expenses");
const logRows = (f) => dataRows(f, "SchedulerLog");
const cellOf = (row, header, name) => row[header.indexOf(name)];

// ---------------------------------------------------------------------------
// AC-1 — mechanism
// ---------------------------------------------------------------------------

test("AC-1: the deploy manifest registers a daily 01:00 Asia/Taipei schedule", async () => {
  const f = fixture();
  loadApi(f.sheets); // installs the googleapis stub before index.js loads
  const { subscriptionScheduler } = require("../lib/index.js");

  // __endpoint is what `firebase deploy` reads to create the Cloud Scheduler job,
  // so this is the schedule that actually gets registered — not a source comment.
  const trigger = subscriptionScheduler.__endpoint.scheduleTrigger;
  assert.equal(trigger.schedule, "0 1 * * *");
  // Without this the job runs at 01:00 UTC, which is 09:00 in Taipei — every
  // entry for the first third of a Taipei day would be filed a day early.
  assert.equal(trigger.timeZone, "Asia/Taipei");
  assert.equal(subscriptionScheduler.__endpoint.platform, "gcfv2");
});

test("AC-1: the scheduled handler writes through the same path as the unit tests", async () => {
  const f = fixture({ subs: [sub({ due_day: String(new Date().getDate()) })] });
  loadApi(f.sheets);
  const { subscriptionScheduler } = require("../lib/index.js");

  // Invoking the exported function end-to-end proves the wiring, not just the
  // module it delegates to: a handler that never called the scheduler would
  // leave the SchedulerLog empty.
  await subscriptionScheduler.run({});
  assert.equal(logRows(f).length, 1);
});

// ---------------------------------------------------------------------------
// AC-2 — active filter
// ---------------------------------------------------------------------------

test("AC-2: a subscription whose is_active cell is the string \"true\" is selected", async () => {
  const f = fixture({ subs: [sub({ is_active: "true" })] });
  const result = await run(f, "2026-08-15");

  // The old script's `row[col('is_active')] !== true` skipped this exact row, so
  // a regression to a boolean comparison drops due_count and created_count to 0.
  assert.equal(result.due_count, 1);
  assert.equal(result.created_count, 1);
  assert.equal(expenseRows(f).length, 2);
});

test("AC-2: is_active \"false\" is the only value that deactivates", async () => {
  const f = fixture({ subs: [
    sub({ id: "sub-off", is_active: "false" }),
    sub({ id: "sub-blank", is_active: "" }),
  ]});
  const result = await run(f, "2026-08-15");

  assert.equal(result.due_count, 1, "only the cancelled row was filtered out");
  assert.equal(cellOf(expenseRows(f)[0], EXPENSES_HEADER, "id"), "exp-auto-sub-blank-2026-08-15");
});

// ---------------------------------------------------------------------------
// AC-3 / AC-4 — due-date matching
// ---------------------------------------------------------------------------

test("AC-3: a monthly due_day 15 fires on the 15th and on no adjacent day", async () => {
  for (const [date, expected] of [["2026-08-14", 0], ["2026-08-15", 1], ["2026-08-16", 0]]) {
    const f = fixture({ subs: [sub({ due_day: "15" })] });
    const result = await run(f, date);
    assert.equal(result.created_count, expected, `${date} expected ${expected}`);
  }
});

test("AC-3: due_day 31 clamps to the last day of a short month", async () => {
  // Fires on Feb 28 (2026 is not a leap year) and Apr 30 — never skipped, never
  // doubled onto a day the month does not have.
  for (const [date, expected] of [["2026-02-28", 1], ["2026-02-27", 0], ["2026-04-30", 1], ["2026-04-29", 0], ["2026-03-31", 1]]) {
    const f = fixture({ subs: [sub({ due_day: "31" })] });
    const result = await run(f, date);
    assert.equal(result.created_count, expected, `${date} expected ${expected}`);
  }
});

test("AC-4: an annual subscription fires on exactly one date in the year", async () => {
  const annual = sub({ id: "sub-ins", frequency: "annual", due_day: "5", due_month: "6" });
  const fired = [];
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 31; day++) {
      const iso = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      // Skip dates the calendar does not have (Date.parse would roll them over).
      if (new Date(`${iso}T00:00:00Z`).getUTCDate() !== day) continue;
      const f = fixture({ subs: [annual] });
      if ((await run(f, iso)).created_count > 0) fired.push(iso);
    }
  }
  assert.deepEqual(fired, ["2026-06-05"]);
});

test("AC-4: an annual due_day 29 in February clamps to the 28th in a non-leap year", async () => {
  const feb29 = sub({ id: "sub-leap", frequency: "annual", due_day: "29", due_month: "2" });
  assert.equal((await run(fixture({ subs: [feb29] }), "2026-02-28")).created_count, 1);
  // 2028 is a leap year: the same subscription fires on the 29th, not the 28th.
  assert.equal((await run(fixture({ subs: [feb29] }), "2028-02-29")).created_count, 1);
  assert.equal((await run(fixture({ subs: [feb29] }), "2028-02-28")).created_count, 0);
});

test("AC-3/AC-4: the due date is the Asia/Taipei day, not the UTC day", async () => {
  // 2026-08-15T17:30Z is already the 16th in Taipei (UTC+8). A function running
  // on a UTC clock would file this run under the 15th.
  const utcEvening = Date.parse("2026-08-15T17:30:00Z");
  assert.equal(taipeiDate(utcEvening).iso, "2026-08-16");

  const f = fixture({ subs: [sub({ due_day: "16" })] });
  const result = await runSubscriptionScheduler(f.sheets, "sheet-under-test", utcEvening);
  assert.equal(result.created_count, 1);
  assert.equal(cellOf(expenseRows(f)[0], EXPENSES_HEADER, "date"), "2026-08-16");
});

// ---------------------------------------------------------------------------
// AC-5 / AC-6 — the written row
// ---------------------------------------------------------------------------

test("AC-5: the row carries only real Expenses fields, mapped from the subscription", async () => {
  const f = fixture({ subs: [sub({ name: "Netflix", amount: "390", category_id: "cat_002", paid_by: "ijac" })] });
  await run(f, "2026-08-15");

  const row = expenseRows(f)[0];
  const get = (name) => cellOf(row, EXPENSES_HEADER, name);
  assert.equal(get("notes"), "Netflix", "notes is the subscription name");
  assert.equal(get("amount"), "390");
  assert.equal(get("category_id"), "cat_002");
  assert.equal(get("paid_by"), "ijac");
  assert.equal(get("created_by"), "ijac", "created_by is the subscription's paid_by");
  assert.equal(get("date"), "2026-08-15");
  assert.equal(get("created_at"), "2026-08-14T17:00:00.000Z", "01:00 Taipei as an ISO instant");
});

test("AC-5: writing a status or subscription_id field would throw, not be dropped", async () => {
  const { buildWriteRow, buildColumnMap, EXPENSES_SPEC } = require("../lib/sheetSchema");
  const map = buildColumnMap([EXPENSES_HEADER], EXPENSES_SPEC);

  // The old script set both and its own helper silently discarded them. Here the
  // same attempt is a hard error, so the drift cannot recur unnoticed.
  for (const field of ["status", "subscription_id"]) {
    assert.throws(
      () => buildWriteRow([], map, { id: "x", [field]: "confirmed" }),
      new RegExp(`no column with that header exists`),
      `${field} must not be silently droppable`
    );
  }

  // And the scheduler's own row does not contain them: it is exactly header-wide,
  // so there is no cell either name could occupy.
  const f = fixture();
  await run(f, "2026-08-15");
  assert.equal(expenseRows(f)[0].length, EXPENSES_HEADER.length);
});

test("AC-6: the row is header-wide with the helper columns blank, like POST /api", async () => {
  const f = fixture();
  await run(f, "2026-08-15");
  const row = expenseRows(f)[0];

  assert.equal(row.length, 10, "header width, not a hardcoded 8");
  assert.equal(row[8], "", "month left blank");
  assert.equal(row[9], "", "amount value left blank");

  // Byte-identical in shape to what the app's own POST writes: same length, same
  // blank positions. Only the id/date/created_at differ by construction.
  const api = loadApi(f.sheets);
  await call(api, "POST", "/api", { date: "2026-08-15", amount: "390", category_id: "cat_002", paid_by: "ijac", created_by: "ijac", notes: "Netflix" });
  const posted = expenseRows(f)[0];
  assert.equal(posted.length, row.length);
  assert.deepEqual([posted[8], posted[9]], [row[8], row[9]]);
});

test("AC-6: a renamed Expenses header fails loudly instead of writing to the wrong column", async () => {
  const f = makeSheets({
    Expenses: { header: ["id", "date", "amount", "category_id", "paid_by", "created_by", "note", "created_at"], rows: [] },
    Subscriptions: { header: SUBS_HEADER, rows: [sub()] },
  });
  await assert.rejects(run(f, "2026-08-15"), /missing required column header "notes"/);
  assert.equal(expenseRows(f).length, 0, "nothing was written");
  // The failure is recorded rather than silent — the whole point of AC-9.
  assert.match(cellOf(logRows(f)[0], SCHEDULER_LOG_HEADER, "error"), /notes/);
});

// ---------------------------------------------------------------------------
// AC-7 — idempotency
// ---------------------------------------------------------------------------

test("AC-7: the id is deterministic and a second run for the same date writes nothing", async () => {
  const f = fixture({ subs: [sub({ id: "sub-1778290646682", due_day: "17" })] });

  const first = await run(f, "2026-08-17");
  assert.equal(cellOf(expenseRows(f)[0], EXPENSES_HEADER, "id"), "exp-auto-sub-1778290646682-2026-08-17");
  assert.deepEqual(
    { due: first.due_count, created: first.created_count, skipped: first.skipped_count },
    { due: 1, created: 1, skipped: 0 }
  );

  const before = expenseRows(f).length;
  const second = await run(f, "2026-08-17");
  assert.deepEqual(
    { created: second.created_count, skipped: second.skipped_count },
    { created: 0, skipped: 1 }
  );
  assert.equal(expenseRows(f).length, before, "no second row appeared");
});

test("AC-7: a partial run's survivors are recognised, and only the gaps are filled", async () => {
  const subs = [sub({ id: "sub-a", due_day: "15" }), sub({ id: "sub-b", due_day: "15" })];
  const f = fixture({
    subs,
    // sub-a already landed before an earlier run died mid-flight.
    expenses: [["exp-auto-sub-a-2026-08-15", "2026-08-15", "390", "cat_002", "ijac", "ijac", "Netflix", "x", "", ""]],
  });

  const result = await run(f, "2026-08-15");
  assert.deepEqual(
    { due: result.due_count, created: result.created_count, skipped: result.skipped_count },
    { due: 2, created: 1, skipped: 1 }
  );
  const ids = expenseRows(f).map((r) => cellOf(r, EXPENSES_HEADER, "id"));
  assert.deepEqual(ids.filter((id) => id.startsWith("exp-auto")).sort(), [
    "exp-auto-sub-a-2026-08-15",
    "exp-auto-sub-b-2026-08-15",
  ]);
});

test("AC-7: rows land at the top, keeping the sheet newest-first", async () => {
  const f = fixture({ subs: [sub({ id: "sub-a" }), sub({ id: "sub-b" })] });
  await run(f, "2026-08-15");

  const ids = expenseRows(f).map((r) => cellOf(r, EXPENSES_HEADER, "id"));
  assert.deepEqual(ids, ["exp-auto-sub-a-2026-08-15", "exp-auto-sub-b-2026-08-15", "exp-1"]);
  assert.equal(f.grids.Expenses[0][0], "id", "the header row was not displaced");
});

// ---------------------------------------------------------------------------
// AC-8 / AC-9 — the heartbeat
// ---------------------------------------------------------------------------

test("AC-8: a run with nothing due still writes exactly one SchedulerLog row", async () => {
  const f = fixture({ subs: [sub({ due_day: "15" })] });
  const result = await run(f, "2026-08-02");

  assert.equal(result.due_count, 0);
  assert.equal(logRows(f).length, 1, "the heartbeat is what proves the run happened");
  const row = logRows(f)[0];
  assert.deepEqual(f.grids.SchedulerLog[0], SCHEDULER_LOG_HEADER, "tab and header created on demand");
  assert.equal(cellOf(row, SCHEDULER_LOG_HEADER, "due_count"), "0");
  assert.equal(cellOf(row, SCHEDULER_LOG_HEADER, "error"), "");
  assert.equal(cellOf(row, SCHEDULER_LOG_HEADER, "run_at"), new Date(at("2026-08-02")).toISOString());
});

test("AC-8: a deleted SchedulerLog tab is recreated on the next run", async () => {
  const f = fixture();
  await run(f, "2026-08-15");
  assert.ok(f.grids.SchedulerLog);

  f.deleteTab("SchedulerLog");
  await run(f, "2026-08-16");
  assert.deepEqual(f.grids.SchedulerLog[0], SCHEDULER_LOG_HEADER);
  assert.equal(logRows(f).length, 1);
});

test("AC-9: a write failure is logged with a non-empty error and the handler rejects", async () => {
  const f = fixture();
  const expensesSheetId = (await f.sheets.spreadsheets.get({}))
    .data.sheets.find((s) => s.properties.title === "Expenses").properties.sheetId;
  const realBatch = f.sheets.spreadsheets.batchUpdate;
  f.sheets.spreadsheets.batchUpdate = async (args) => {
    const touchesExpenses = args.requestBody.requests.some(
      (r) => (r.insertDimension ?? r.updateCells)?.[r.insertDimension ? "range" : "start"]?.sheetId === expensesSheetId
    );
    if (touchesExpenses) throw new Error("Sheets 503: backend error");
    return realBatch(args);
  };

  await assert.rejects(run(f, "2026-08-15"), /Sheets 503: backend error/);

  // The insert and the write ride in one batchUpdate, so a rejected write leaves
  // no half-inserted blank row for the captain to find.
  assert.equal(expenseRows(f).length, 1, "only the pre-existing row remains");
  assert.deepEqual(expenseRows(f)[0], EXPENSES_ROWS[0]);
  const row = logRows(f)[0];
  assert.equal(cellOf(row, SCHEDULER_LOG_HEADER, "error"), "Sheets 503: backend error");
  assert.equal(cellOf(row, SCHEDULER_LOG_HEADER, "due_count"), "1", "counts up to the failure are kept");
  assert.equal(cellOf(row, SCHEDULER_LOG_HEADER, "created_count"), "0");
});

// ---------------------------------------------------------------------------
// AC-10 — status endpoint
// ---------------------------------------------------------------------------

test("AC-10: the status reports the newest run and is not stale right after it", async () => {
  const f = fixture();
  await run(f, "2026-08-15");
  await run(f, "2026-08-16");

  const status = await readSchedulerStatus(f.sheets, "sheet-under-test", at("2026-08-16") + 60_000);
  assert.equal(status.last_run_at, new Date(at("2026-08-16")).toISOString(), "newest row, not the first");
  assert.equal(status.created_count, 0, "the 16th had nothing due");
  assert.equal(status.error, "");
  assert.equal(status.stale, false);
});

test("AC-10: stale flips at 36 hours, and is true when no run was ever recorded", async () => {
  const f = fixture();
  await run(f, "2026-08-15");
  const ran = at("2026-08-15");
  const hours = (n) => ran + n * 3600_000;

  assert.equal((await readSchedulerStatus(f.sheets, "sheet-under-test", hours(35))).stale, false);
  assert.equal((await readSchedulerStatus(f.sheets, "sheet-under-test", hours(37))).stale, true);

  // A spreadsheet the scheduler has never touched has no SchedulerLog tab at all.
  const fresh = fixture();
  const never = await readSchedulerStatus(fresh.sheets, "sheet-under-test", hours(0));
  assert.deepEqual(never, { last_run_at: null, due_count: 0, created_count: 0, skipped_count: 0, error: "", stale: true });
  assert.equal(fresh.grids.SchedulerLog, undefined, "a status read must not create the tab");
});

test("AC-10: GET /api/scheduler-status serves that shape over HTTP", async () => {
  const f = fixture();
  await run(f, "2026-08-15");

  const api = loadApi(f.sheets);
  const res = await call(api, "GET", "/api/scheduler-status");

  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), [
    "created_count", "due_count", "error", "last_run_at", "skipped_count", "stale",
  ]);
  assert.equal(res.body.last_run_at, new Date(at("2026-08-15")).toISOString());
  assert.equal(res.body.created_count, 1);
  // Long past the window, so a live call years from now still proves the flag works.
  assert.equal(res.body.stale, true);

  // The route does not swallow the expenses collection: GET /api still works.
  assert.equal((await call(api, "GET", "/api")).body.length, 2);
});

// ---------------------------------------------------------------------------
// Edge cases from the spec that have no AC of their own
// ---------------------------------------------------------------------------

test("a subscription cancelled before the run produces no entry", async () => {
  const f = fixture({ subs: [sub({ is_active: "false", due_day: "15" })] });
  const result = await run(f, "2026-08-15");
  assert.equal(result.due_count, 0);
  assert.equal(expenseRows(f).length, 1);
});

test("a later run does not backfill a missed date", async () => {
  const f = fixture({ subs: [sub({ due_day: "15" })] });
  const result = await run(f, "2026-08-20");
  assert.equal(result.created_count, 0, "the 15th is gone; only the SchedulerLog gap records it");
  assert.equal(logRows(f).length, 1);
});

test("isDueOn treats a blank frequency as monthly, matching rowToSubscription", async () => {
  const today = taipeiDate(at("2026-08-15"));
  assert.equal(isDueOn({ frequency: "", due_day: 15, due_month: undefined }, today), true);
  assert.equal(isDueOn({ frequency: "annual", due_day: 15, due_month: undefined }, today), false);
});
