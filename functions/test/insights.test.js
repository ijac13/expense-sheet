// Run with: npm run build && node --test test/
// Exercises the /api/insights period window against fixture expenses. The
// endpoint itself needs Google Sheets and an Anthropic key; this does not.
const test = require("node:test");
const assert = require("node:assert/strict");

const { parseInsightsPeriod, buildInsightsPrompt } = require("../lib/insights");

const NOW = Date.UTC(2026, 6, 15); // 2026-07-15

function exp(date, category_id, amount) {
  return { date, category_id, amount };
}

// Data in every month of 2025 and Jan–Jul 2026, one row per month, plus a
// second category in May 2026.
const HISTORY = [];
for (const year of [2025, 2026]) {
  const lastMonth = year === 2026 ? 7 : 12;
  for (let m = 1; m <= lastMonth; m++) {
    HISTORY.push(exp(`${year}-${String(m).padStart(2, "0")}-10`, "food", 100 * m));
  }
}
HISTORY.push(exp("2026-05-20", "transport", 777));

function build(period, expenses = HISTORY, subscriptions = []) {
  return buildInsightsPrompt({ expenses, subscriptions, period, nowMs: NOW });
}

test("AC-4: malformed periods are rejected", () => {
  assert.equal(parseInsightsPeriod(undefined), null);
  assert.equal(parseInsightsPeriod({}), null);
  assert.equal(parseInsightsPeriod({ period: "monthly", year: 2026, month: 0 }), null);
  assert.equal(parseInsightsPeriod({ period: "monthly", year: 2026, month: 13 }), null);
  assert.equal(parseInsightsPeriod({ period: "monthly", year: 2026 }), null);
  assert.equal(parseInsightsPeriod({ period: "monthly", year: "2026", month: 5 }), null);
  assert.equal(parseInsightsPeriod({ period: "annual", year: 2026.5 }), null);
  assert.equal(parseInsightsPeriod({ period: "weekly", year: 2026 }), null);
});

test("AC-1/AC-2: well-formed periods parse to the requested window", () => {
  assert.deepEqual(parseInsightsPeriod({ period: "monthly", year: 2026, month: 5 }),
    { type: "monthly", year: 2026, month: 5 });
  assert.deepEqual(parseInsightsPeriod({ period: "annual", year: 2025 }),
    { type: "annual", year: 2025 });
});

test("AC-5: monthly totals cover only the requested month", () => {
  const r = build({ type: "monthly", year: 2026, month: 5 });
  assert.equal(r.kind, "prompt");
  const spending = r.prompt.split("## Spending so far")[1].split("##")[0];
  // May 2026 holds food 500 and transport 777, and nothing else.
  assert.match(spending, /transport: NT\$777/);
  assert.match(spending, /food: NT\$500/);
  assert.doesNotMatch(spending, /NT\$700/); // July's food row must not leak in
});

test("AC-6: the label is the requested month, not the current one", () => {
  assert.match(build({ type: "monthly", year: 2026, month: 5 }).prompt,
    /## Spending so far \(May 2026\) by category/);
  assert.equal(build({ type: "monthly", year: 2026, month: 5 }).periodLabel, "May 2026");
});

test("AC-7: comparison windows walk back from the requested month", () => {
  const r = build({ type: "monthly", year: 2026, month: 5 });
  // Previous 3 months of May 2026 = Feb/Mar/Apr food (200+300+400)/3 = 300.
  const prev3 = r.prompt.split("## Previous 3-month average by category")[1].split("##")[0];
  assert.match(prev3, /food: NT\$300/);
  // Same month last year = May 2025 food 500.
  const lastYear = r.prompt.split("## Same month last year by category")[1].split("##")[0];
  assert.match(lastYear, /food: NT\$500/);
  assert.doesNotMatch(lastYear, /transport/);
});

test("AC-8: annual totals cover only the requested year", () => {
  const r = build({ type: "annual", year: 2025 });
  const spending = r.prompt.split("## Spending so far")[1].split("##")[0];
  // 2025 food = 100+200+...+1200 = 7800; no 2026 transport row.
  assert.match(spending, /food: NT\$7,800/);
  assert.doesNotMatch(spending, /transport/);
});

test("AC-9: annual mode compares against the prior year and drops monthly blocks", () => {
  const r = build({ type: "annual", year: 2026 });
  assert.match(r.prompt, /## Previous year \(2025\) by category\n {2}food: NT\$7,800/);
  assert.doesNotMatch(r.prompt, /Previous 3-month average/);
  assert.doesNotMatch(r.prompt, /Same month last year/);
});

test("AC-10: the label is the requested year", () => {
  assert.match(build({ type: "annual", year: 2025 }).prompt,
    /## Spending so far \(2025\) by category/);
});

test("AC-11: an empty period returns insufficient rather than another period's data", () => {
  // A future month, a gap month, and a month before all data.
  for (const period of [
    { type: "monthly", year: 2027, month: 3 },
    { type: "monthly", year: 2024, month: 8 },
    { type: "annual", year: 2030 },
  ]) {
    assert.deepEqual(build(period), { kind: "insufficient", days: 0 },
      `${JSON.stringify(period)} should be insufficient`);
  }
});

test("AC-12: tier reflects history up to the requested period, ignoring later months", () => {
  // Feb 2025 is preceded by one month of data only, though 18 later months exist.
  const feb = build({ type: "monthly", year: 2025, month: 2 });
  assert.equal(feb.tier, "month");
  assert.doesNotMatch(feb.prompt, /Previous 3-month average/);
  // April 2025 is preceded by Jan/Feb/Mar.
  assert.equal(build({ type: "monthly", year: 2025, month: 4 }).tier, "full");
});

test("AC-12: the day span ends at the requested period, not today", () => {
  const sparse = [exp("2026-05-28", "food", 50), exp("2026-07-02", "food", 60)];
  // Viewed from July, May holds 3 days of history even though today is 2026-07-15.
  assert.deepEqual(buildInsightsPrompt({
    expenses: sparse, subscriptions: [], period: { type: "monthly", year: 2026, month: 5 }, nowMs: NOW,
  }), { kind: "insufficient", days: 3 });
});

test("AC-13: comparison windows with no stored data are omitted, not zeroed", () => {
  // Jan 2026 has 3 preceding months of data (Oct–Dec 2025) but no Jan 2025 row.
  const noLastYear = HISTORY.filter((e) => !String(e.date).startsWith("2025-01"));
  const r = buildInsightsPrompt({
    expenses: noLastYear, subscriptions: [], period: { type: "monthly", year: 2026, month: 1 }, nowMs: NOW,
  });
  assert.equal(r.tier, "full");
  assert.match(r.prompt, /## Previous 3-month average/);
  assert.doesNotMatch(r.prompt, /Same month last year/);
  assert.doesNotMatch(r.prompt, /\(no data\)/);
});
