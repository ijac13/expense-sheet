/**
 * Entity 051 — backfill the historical expense entries the subscription scheduler
 * never created, for the months the captain confirms are genuinely missing.
 *
 * Two phases separated by a file the captain edits by hand:
 *
 *   --analyze   reads the sheet, writes a per-subscription candidate report
 *               (gitignored — it holds real financial history, and this remote
 *               is public). Every `decision:` line is generated as `skip`.
 *   --apply     writes only the dates under a section the captain changed to
 *               `backfill`. An unedited report writes nothing.
 *
 * Usage:
 *   node -r ./scripts/load-local-env.js scripts/backfill-subscription-history.js --analyze
 *   node -r ./scripts/load-local-env.js scripts/backfill-subscription-history.js --apply --dry-run
 *   node -r ./scripts/load-local-env.js scripts/backfill-subscription-history.js --apply
 *
 *   --fixture ./scripts/fixtures/backfill-sample   run against local JSON instead of Sheets
 *   --report  <path>                               report location (default below)
 *   --now     YYYY-MM-DD                           pin the analysis date
 *
 * Requires `npm run build` first: the occurrence and row-shape logic is imported
 * from the compiled scheduler rather than reimplemented, so a backfilled row and a
 * scheduler-generated one cannot drift apart.
 */

const fs = require("fs");
const path = require("path");

const { isDueOn, daysInMonth, autoExpenseId, taipeiDate } = require("../lib/scheduler");
const {
  buildColumnMap,
  buildWriteRow,
  cell,
  columnLetter,
  rowToSubscription,
  EXPENSES_SPEC,
  SUBSCRIPTIONS_SPEC,
} = require("../lib/sheetSchema");

const WINDOW_START = "2025-01-01";
const DEFAULT_REPORT = path.resolve(__dirname, "..", "backfill-reports", "candidates.md");
const READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const WRITE_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Text + date helpers
// ---------------------------------------------------------------------------

// Both sides of every notes comparison go through this. The sheet holds
// `Member Agym` and `member b gym` against subscription names `Member A gym`
// and `Member B gym`;
// comparing either side raw scores both at zero.
function fold(text) {
  return String(text ?? "").toLowerCase().replace(/\s+/g, "");
}

function monthKey(isoDate) {
  return isoDate.slice(0, 7);
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Every date in [startIso, endIso] on which the scheduler would have fired.
 *
 * `isDueOn` and `daysInMonth` are the deployed scheduler's own — a local copy
 * would let the day-31 clamp drift, which is the difference between a February
 * occurrence on the 28th and none at all.
 */
function generateOccurrences(sub, startIso, endIso) {
  const out = [];
  const [startY, startM] = startIso.split("-").map(Number);
  const [endY, endM] = endIso.split("-").map(Number);

  for (let ym = startY * 12 + (startM - 1); ym <= endY * 12 + (endM - 1); ym++) {
    const year = Math.floor(ym / 12);
    const month = (ym % 12) + 1;
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (iso < startIso || iso > endIso) continue;
      if (isDueOn(sub, { year, month, day, iso })) out.push(iso);
    }
  }
  return out;
}

// A `sub-<epoch-ms>` id decodes to when the subscription RECORD was created —
// one of the two bounds the spec requires reporting, since the tab has no
// started_at column and a span reaching back past both bounds is a pure guess.
function recordCreatedAt(subId) {
  const m = /^sub-(\d{12,})$/.exec(String(subId ?? ""));
  if (!m) return null;
  const ms = Number(m[1]);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : taipeiDate(ms).iso;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

// Subscriptions indistinguishable by amount, category, frequency and due day
// share one evidence pool: the four gym subscriptions are identical on all four,
// so per-row attribution is impossible and only per-month counting is truthful.
function cohortKey(sub) {
  return [sub.amount, sub.category_id, sub.frequency, sub.due_day, sub.due_month ?? ""].join("|");
}

function analyze({ subscriptions, expenses, todayIso, windowStart = WINDOW_START }) {
  const active = subscriptions.filter((s) => s.is_active);
  const windowed = expenses.filter((e) => e.date >= windowStart && e.date <= todayIso);

  const occurrencesBySub = new Map();
  for (const sub of active) {
    occurrencesBySub.set(sub.id, generateOccurrences(sub, windowStart, todayIso));
  }

  // Which subscriptions' notes fingerprints claim each row. A row with two
  // claimants is claimed by both — it is only ever removed from the pool of a
  // subscription that does NOT claim it.
  const claimants = windowed.map((e) =>
    active.filter((s) => fold(s.name) !== "" && fold(e.notes).includes(fold(s.name))).map((s) => s.id)
  );

  const notesRowsBySub = new Map();
  const amountCatRowsBySub = new Map();
  for (const sub of active) {
    const notes = [];
    const amountCat = [];
    windowed.forEach((e, i) => {
      if (claimants[i].includes(sub.id)) notes.push(i);
      // The single-claim rule: a row another subscription's notes claim is gone
      // from this one's amount+category pool. Without it, 0900000001 inherits
      // all 33 of YouTube's payments — both are NT$200 in `digital`.
      const claimedByOther = claimants[i].some((id) => id !== sub.id);
      if (!claimedByOther && e.amount === sub.amount && e.category_id === sub.category_id) {
        amountCat.push(i);
      }
    });
    notesRowsBySub.set(sub.id, notes);
    amountCatRowsBySub.set(sub.id, amountCat);
  }

  const cohorts = new Map();
  for (const sub of active) {
    const key = cohortKey(sub);
    if (!cohorts.has(key)) cohorts.set(key, []);
    cohorts.get(key).push(sub);
  }

  const rowMonths = windowed.map((e) => monthKey(e.date));

  const combined = new Map();
  const notesOnly = new Map();
  const amountOnly = new Map();
  const monthStats = new Map();

  for (const [key, cohortMembers] of cohorts) {
    const shared = { members: cohortMembers, occurrencesBySub, notesRowsBySub, amountCatRowsBySub, rowMonths };
    mergeInto(combined, coverCohort({ ...shared, useNotes: true, useAmountCat: true }));
    mergeInto(notesOnly, coverCohort({ ...shared, useNotes: true, useAmountCat: false }));
    mergeInto(amountOnly, coverCohort({ ...shared, useNotes: false, useAmountCat: true }));
    monthStats.set(key, cohortMonthStats(shared));
  }

  const sections = active.map((sub) => {
    const occurrences = occurrencesBySub.get(sub.id);
    const notesIdx = notesRowsBySub.get(sub.id);
    const amountIdx = amountCatRowsBySub.get(sub.id);
    const coveredSet = combined.get(sub.id);
    const missing = occurrences.filter((iso) => !coveredSet.has(iso));

    const coveredNotes = notesOnly.get(sub.id).size;
    const coveredAmount = amountOnly.get(sub.id).size;

    let classification;
    if (notesIdx.length === 0 && amountIdx.length === 0) classification = "NO-EVIDENCE";
    else if (Math.abs(coveredNotes - coveredAmount) > 1) classification = "CONFLICTED";
    else if (missing.length === 0) classification = "COVERED";
    else classification = "PARTIAL";

    const evidenceIdx = [...new Set([...notesIdx, ...amountIdx])];
    const amountsSeen = [...new Set(evidenceIdx.map((i) => windowed[i].amount))].sort((a, b) => a - b);

    const stats = monthStats.get(cohortKey(sub));
    const flags = [];
    const doubleLogged = new Set();
    for (const iso of missing) {
      const ym = monthKey(iso);
      const here = stats.get(ym);
      if (!here || here.rows >= here.expected) continue;
      for (const neighbour of [shiftMonth(ym, -1), shiftMonth(ym, 1)]) {
        const other = stats.get(neighbour);
        if (other && other.rows > other.expected) doubleLogged.add(neighbour);
      }
    }
    for (const ym of [...doubleLogged].sort()) flags.push(`DOUBLE_LOGGED_NEIGHBOUR(${ym})`);
    if (amountsSeen.length > 0 && !amountsSeen.includes(sub.amount)) flags.push("PRICE_MISMATCH");
    if (cohortOf(cohorts, sub).length > 1) flags.push(`COHORT_OF_${cohortOf(cohorts, sub).length}`);

    const created = recordCreatedAt(sub.id);
    const earliestEvidence = evidenceIdx.length
      ? evidenceIdx.map((i) => windowed[i].date).sort()[0]
      : null;
    if (missing.length > 0) {
      const first = missing[0];
      if (created && first < created && (!earliestEvidence || first < earliestEvidence)) {
        flags.push("SPAN_PRECEDES_RECORD_CREATION");
      }
    }

    return {
      sub,
      classification,
      notesRowCount: notesIdx.length,
      amountRowCount: amountIdx.length,
      coveredByNotes: coveredNotes,
      coveredByAmountCategory: coveredAmount,
      amountsSeen,
      expected: occurrences.length,
      covered: coveredSet.size,
      missing,
      flags,
      recordCreatedAt: created,
      earliestEvidence,
      cohortSize: cohortOf(cohorts, sub).length,
    };
  });

  return { windowStart, todayIso, sections };
}

function cohortOf(cohorts, sub) {
  return cohorts.get(cohortKey(sub));
}

function mergeInto(target, source) {
  for (const [subId, set] of source) target.set(subId, set);
}

/**
 * Coverage for one cohort, counted per calendar month rather than tested as a
 * boolean. Occurrences consume evidence rows one-for-one: four subscriptions
 * against a month holding three rows leaves exactly one missing, not zero and
 * not four.
 *
 * Notes evidence is consumed first, so a row whose note names its subscription
 * covers that subscription rather than whichever cohort member is enumerated
 * first.
 */
function coverCohort({ members, occurrencesBySub, notesRowsBySub, amountCatRowsBySub, rowMonths, useNotes, useAmountCat }) {
  const covered = new Map(members.map((s) => [s.id, new Set()]));

  const occByMonth = new Map();
  for (const sub of members) {
    for (const iso of occurrencesBySub.get(sub.id)) {
      const ym = monthKey(iso);
      if (!occByMonth.has(ym)) occByMonth.set(ym, []);
      occByMonth.get(ym).push({ subId: sub.id, iso });
    }
  }

  for (const [ym, occurrences] of occByMonth) {
    const consumed = new Set();
    const done = new Set();

    // Notes first: a row whose note names its subscription covers THAT
    // subscription, rather than whichever cohort member happens to be enumerated
    // first. Only then does the anonymous amount+category pool get distributed.
    if (useNotes) {
      for (const sub of members) {
        const rows = notesRowsBySub.get(sub.id).filter((i) => !consumed.has(i) && rowMonths[i] === ym);
        let next = 0;
        for (const occ of occurrences) {
          if (next >= rows.length) break;
          if (occ.subId !== sub.id || done.has(occ)) continue;
          consumed.add(rows[next++]);
          done.add(occ);
          covered.get(sub.id).add(occ.iso);
        }
      }
    }

    if (useAmountCat) {
      const pool = [];
      const seen = new Set();
      for (const sub of members) {
        for (const i of amountCatRowsBySub.get(sub.id)) {
          if (consumed.has(i) || seen.has(i) || rowMonths[i] !== ym) continue;
          seen.add(i);
          pool.push(i);
        }
      }
      let next = 0;
      for (const occ of occurrences) {
        if (next >= pool.length) break;
        if (done.has(occ)) continue;
        consumed.add(pool[next++]);
        done.add(occ);
        covered.get(occ.subId).add(occ.iso);
      }
    }
  }

  return covered;
}

/** Per-month expected-vs-available counts for one cohort, for AC-8's neighbour check. */
function cohortMonthStats({ members, occurrencesBySub, notesRowsBySub, amountCatRowsBySub, rowMonths }) {
  const stats = new Map();
  const bump = (ym, field) => {
    if (!stats.has(ym)) stats.set(ym, { expected: 0, rows: 0 });
    stats.get(ym)[field]++;
  };

  for (const sub of members) {
    for (const iso of occurrencesBySub.get(sub.id)) bump(monthKey(iso), "expected");
  }

  const evidence = new Set();
  for (const sub of members) {
    for (const i of notesRowsBySub.get(sub.id)) evidence.add(i);
    for (const i of amountCatRowsBySub.get(sub.id)) evidence.add(i);
  }
  for (const i of evidence) bump(rowMonths[i], "rows");

  return stats;
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

const LEGEND = `<!--
How to use this file
  1. Read each section. Nothing is written until you change a \`decision:\` line.
  2. Set \`decision: backfill\` for a subscription whose missing dates you accept.
  3. Delete any date from \`missing dates:\` you do NOT want written.
  4. Check \`amount:\` — it defaults to the subscription's CURRENT amount, which may
     not be what you actually paid in 2025.
  5. Re-run with --apply. Re-running is safe: ids are deterministic, so a row that
     already exists is skipped rather than duplicated.

Classifications
  COVERED      every occurrence has a matching row already
  PARTIAL      some months are missing, evidence agrees on which
  CONFLICTED   the notes signature and the amount+category signature disagree by
               more than one occurrence. Neither was chosen for you — read both.
  NO-EVIDENCE  nothing anywhere corroborates this subscription. The full span is
               proposed with nothing backing it; treat a backfill here as a guess.
-->`;

function renderReport(model) {
  const lines = [
    "# Subscription backfill candidates",
    "",
    `- generated: ${model.generatedAt}`,
    `- window: ${model.windowStart} .. ${model.todayIso}`,
    `- active subscriptions: ${model.sections.length}`,
    `- total candidate rows: ${model.sections.reduce((n, s) => n + s.missing.length, 0)}`,
    "",
    LEGEND,
    "",
  ];

  for (const s of model.sections) {
    const sig =
      s.classification === "CONFLICTED"
        ? "CONFLICTED — both signatures listed below, none chosen"
        : s.classification === "NO-EVIDENCE"
          ? "none — no row matches this subscription by either signature"
          : s.notesRowCount > 0 && s.amountRowCount > 0
            ? `notes + amount+category (${s.notesRowCount + s.amountRowCount} rows)`
            : s.notesRowCount > 0
              ? `notes "${fold(s.sub.name)}" (${s.notesRowCount} rows)`
              : `amount+category ${s.sub.amount}/${s.sub.category_id} (${s.amountRowCount} rows)`;

    lines.push(
      `## ${s.sub.id} — ${s.sub.name}`,
      "",
      `- classification: ${s.classification}`,
      `- signature: ${sig}`,
      `  - notes "${fold(s.sub.name)}": ${s.notesRowCount} rows, covers ${s.coveredByNotes} occurrences`,
      `  - amount+category ${s.sub.amount}/${s.sub.category_id}: ${s.amountRowCount} rows, covers ${s.coveredByAmountCategory} occurrences`,
      `- distinct amounts seen: ${s.amountsSeen.length ? s.amountsSeen.join(", ") : "(none)"}`,
      `- expected: ${s.expected}`,
      `- covered: ${s.covered}`,
      `- missing: ${s.missing.length}`,
      `- missing dates: ${s.missing.length ? s.missing.join(", ") : "(none)"}`,
      `- flags: ${s.flags.length ? s.flags.join(", ") : "(none)"}`,
      `- bounds: record created ${s.recordCreatedAt ?? "unknown"}; earliest evidence row ${s.earliestEvidence ?? "none"}`,
      `- amount: ${s.sub.amount}${amountNote(s)}`,
      "- decision: skip",
      ""
    );
  }

  return lines.join("\n");
}

function amountNote(s) {
  if (s.amountsSeen.length === 0 || s.amountsSeen.includes(s.sub.amount)) return "";
  return `  # record says ${s.sub.amount}, evidence rows show ${s.amountsSeen.join("/")} — confirm which to write`;
}

// ---------------------------------------------------------------------------
// Report parsing
// ---------------------------------------------------------------------------

class ReportError extends Error {}

function parseReport(text) {
  const sections = [];
  let current = null;

  text.split("\n").forEach((raw, i) => {
    const lineNo = i + 1;
    const heading = /^##\s+(\S+)\s+—\s+(.*)$/.exec(raw);
    if (heading) {
      current = { subId: heading[1], name: heading[2].trim(), fields: {}, lineNos: {} };
      sections.push(current);
      return;
    }
    const field = /^-\s+([a-z][a-z ]*?):\s*(.*)$/.exec(raw);
    if (!field || !current) return;
    const key = field[1].trim();
    current.fields[key] = field[2].trim();
    current.lineNos[key] = lineNo;
    current.raw = current.raw ?? {};
    current.raw[key] = raw;
  });

  return sections;
}

/** Strips a trailing `# …` annotation so an untouched AC-14 amount line parses. */
function stripComment(value) {
  const hash = value.indexOf("#");
  return (hash === -1 ? value : value.slice(0, hash)).trim();
}

/**
 * Turns parsed sections into a write plan, validating every field against the
 * sheet rather than against the report itself. A date typed by hand that the
 * subscription was never due on is caught here, before anything is written.
 */
function buildPlan(sections, subscriptions, todayIso, windowStart = WINDOW_START) {
  const byId = new Map(subscriptions.map((s) => [s.id, s]));
  const plan = [];

  for (const section of sections) {
    const quote = (key) => `line ${section.lineNos[key]}: ${section.raw[key]}`;
    const decision = stripComment(section.fields.decision ?? "").toLowerCase();

    if (decision !== "skip" && decision !== "backfill") {
      throw new ReportError(
        `Unknown decision "${section.fields.decision ?? "(missing)"}" for ${section.subId} — ` +
        `expected "skip" or "backfill". ${quote("decision")}`
      );
    }
    if (decision === "skip") continue;

    const sub = byId.get(section.subId);
    if (!sub) {
      throw new ReportError(`No subscription "${section.subId}" in the Subscriptions tab — refusing to write.`);
    }
    if (!sub.is_active) {
      throw new ReportError(`Subscription "${section.subId}" is not active — refusing to write.`);
    }

    const amount = Number(stripComment(section.fields.amount ?? ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ReportError(
        `Amount for ${section.subId} is not a positive number. ${quote("amount")}`
      );
    }

    const raw = stripComment(section.fields["missing dates"] ?? "");
    const dates = raw === "(none)" || raw === "" ? [] : raw.split(",").map((d) => d.trim()).filter(Boolean);

    // Recomputed from the subscription, not read back from the report: the report
    // is a hand-edited file, so it cannot be its own authority on what is a real
    // due date.
    const valid = new Set(generateOccurrences(sub, windowStart, todayIso));
    for (const date of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new ReportError(`"${date}" is not a YYYY-MM-DD date for ${section.subId}. ${quote("missing dates")}`);
      }
      if (!valid.has(date)) {
        throw new ReportError(
          `${section.subId} was never due on ${date} — it is not one of its occurrences between ` +
          `${windowStart} and ${todayIso}. ${quote("missing dates")}`
        );
      }
    }

    if (dates.length > 0) plan.push({ sub, amount, dates });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * The row a backfill writes. Same id function and same buildWriteRow call the
 * scheduler makes, so a backfilled row and a scheduler row for the same
 * subscription and date are byte-identical — which is also what makes the two
 * unable to collide.
 */
function buildBackfillRow(expensesMap, sub, isoDate, amount, createdAtIso) {
  return buildWriteRow([], expensesMap, {
    id: autoExpenseId(sub.id, isoDate),
    date: isoDate,
    amount: String(amount),
    category_id: sub.category_id,
    paid_by: sub.paid_by,
    created_by: sub.paid_by,
    notes: sub.name,
    created_at: createdAtIso,
  });
}

class PartialWriteError extends Error {
  constructor(message, writtenIds) {
    super(message);
    this.name = "PartialWriteError";
    this.writtenIds = writtenIds;
  }
}

async function readColumnMapLive(sheets, spreadsheetId, spec) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${spec.tab}!A1:Z1`,
  });
  return buildColumnMap(response.data.values ?? [], spec);
}

// Same all-or-nothing shape the scheduler uses: the insert and the write ride in
// one batchUpdate, so a rejected write never leaves a blank row behind.
async function insertRowsAtTop(sheets, spreadsheetId, tabName, rows) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tabName)?.properties?.sheetId ?? 0;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { insertDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 1 + rows.length },
          inheritFromBefore: false,
        }},
        { updateCells: {
          start: { sheetId, rowIndex: 1, columnIndex: 0 },
          rows: rows.map((r) => ({ values: r.map((v) => ({ userEnteredValue: { stringValue: v } })) })),
          fields: "userEnteredValue",
        }},
      ],
    },
  });
}

async function applyPlan({ sheets, spreadsheetId, plan, createdAtIso, dryRun = false, batchSize = WRITE_BATCH_SIZE, log = console.log }) {
  const expensesMap = await readColumnMapLive(sheets, spreadsheetId, EXPENSES_SPEC);

  const idColumn = columnLetter(expensesMap.index.id);
  const idResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${EXPENSES_SPEC.tab}!${idColumn}:${idColumn}`,
  });
  const existingIds = new Set(
    (idResponse.data.values ?? []).slice(1).map((r) => String(r[0] ?? ""))
  );

  const candidates = [];
  for (const item of plan) {
    for (const date of item.dates) {
      candidates.push({
        id: autoExpenseId(item.sub.id, date),
        row: buildBackfillRow(expensesMap, item.sub, date, item.amount, createdAtIso),
        subId: item.sub.id,
        date,
      });
    }
  }

  const pending = candidates.filter((c) => !existingIds.has(c.id));
  const skipped = candidates.length - pending.length;
  for (const c of candidates) {
    if (existingIds.has(c.id)) log(`[skip] ${c.id} already present`);
  }

  if (dryRun) {
    for (const c of pending) log(`[dry-run] would write ${c.id} | ${c.row.join(" | ")}`);
    log(`[dry-run] ${pending.length} row(s) would be written, ${skipped} skipped as already present.`);
    return { created: 0, skipped, wouldCreate: pending.length, writtenIds: [] };
  }

  const writtenIds = [];
  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    try {
      await insertRowsAtTop(sheets, spreadsheetId, EXPENSES_SPEC.tab, batch.map((c) => c.row));
    } catch (err) {
      throw new PartialWriteError(
        `Write failed after ${writtenIds.length} row(s): ${err.message ?? err}`,
        writtenIds
      );
    }
    for (const c of batch) {
      writtenIds.push(c.id);
      log(`[write] ${c.id}`);
    }
  }

  return { created: writtenIds.length, skipped, wouldCreate: 0, writtenIds };
}

// ---------------------------------------------------------------------------
// Data sources
// ---------------------------------------------------------------------------

function readRows(rows, spec, mapper) {
  const map = buildColumnMap(rows, spec);
  return rows.slice(1).map((r) => mapper(r, map));
}

// Column-resolved rather than positional, so a reordered Expenses tab cannot
// silently feed the analysis the wrong field (entity 047).
function rowToExpense(row, map) {
  return {
    id: String(cell(row, map, "id") ?? ""),
    date: String(cell(row, map, "date") ?? ""),
    amount: Number(cell(row, map, "amount") ?? 0),
    category_id: String(cell(row, map, "category_id") ?? ""),
    notes: String(cell(row, map, "notes") ?? ""),
  };
}

function fixtureSource(dir) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8"));
  return {
    mode: "fixture",
    async getSubscriptions() {
      return readRows(read("Subscriptions"), SUBSCRIPTIONS_SPEC, rowToSubscription);
    },
    async getExpenses() {
      return readRows(read("Expenses"), EXPENSES_SPEC, rowToExpense);
    },
  };
}

async function sheetsClient(scope) {
  const { google } = require("googleapis");
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID env var is required for a live run");

  let authClient;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    let raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      if (decoded.trim().startsWith("{")) raw = decoded;
    } catch {
      // not base64; use as-is
    }
    const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(raw), scopes: [scope] });
    authClient = await auth.getClient();
  } else {
    authClient = await google.auth.getClient({ scopes: [scope] });
  }

  return { sheets: google.sheets({ version: "v4", auth: authClient }), spreadsheetId };
}

async function liveSource(sheets, spreadsheetId) {
  const get = async (tab) => {
    const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${tab}!A:Z` });
    return resp.data.values ?? [];
  };
  return {
    mode: "live",
    async getSubscriptions() {
      return readRows(await get(SUBSCRIPTIONS_SPEC.tab), SUBSCRIPTIONS_SPEC, rowToSubscription);
    },
    async getExpenses() {
      return readRows(await get(EXPENSES_SPEC.tab), EXPENSES_SPEC, rowToExpense);
    },
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1];
  };
  return {
    analyze: argv.includes("--analyze"),
    apply: argv.includes("--apply"),
    dryRun: argv.includes("--dry-run"),
    fixture: value("--fixture"),
    report: value("--report") ?? DEFAULT_REPORT,
    now: value("--now"),
  };
}

async function runAnalyze(args, log = console.log) {
  const todayIso = args.now ?? taipeiDate(Date.now()).iso;

  // The readonly scope is the guarantee, not a comment: a token minted for
  // spreadsheets.readonly cannot write even if this code were wrong.
  const source = args.fixture
    ? fixtureSource(args.fixture)
    : await (async () => {
        const { sheets, spreadsheetId } = await sheetsClient(READONLY_SCOPE);
        return liveSource(sheets, spreadsheetId);
      })();

  const subscriptions = await source.getSubscriptions();
  const expenses = await source.getExpenses();
  log(`[analyze] ${source.mode}: ${subscriptions.filter((s) => s.is_active).length} active subscriptions, ${expenses.length} expense rows, through ${todayIso}`);

  const model = analyze({ subscriptions, expenses, todayIso });
  model.generatedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(args.report), { recursive: true });
  fs.writeFileSync(args.report, renderReport(model), "utf8");

  const counts = {};
  for (const s of model.sections) counts[s.classification] = (counts[s.classification] ?? 0) + 1;
  log(`[analyze] ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(" ")}`);
  log(`[analyze] ${model.sections.reduce((n, s) => n + s.missing.length, 0)} candidate rows across ${model.sections.length} subscriptions`);
  log(`[analyze] report written to ${args.report} (every decision defaults to skip — nothing is written until you edit it)`);
  return model;
}

async function runApply(args, log = console.log) {
  if (!fs.existsSync(args.report)) {
    throw new Error(`No report at ${args.report} — run --analyze first.`);
  }
  const todayIso = args.now ?? taipeiDate(Date.now()).iso;
  const sections = parseReport(fs.readFileSync(args.report, "utf8"));

  if (args.fixture) {
    throw new Error("--apply needs a real spreadsheet; --fixture is analysis-only.");
  }

  const { sheets, spreadsheetId } = await sheetsClient(WRITE_SCOPE);
  const source = await liveSource(sheets, spreadsheetId);
  const subscriptions = await source.getSubscriptions();

  const plan = buildPlan(sections, subscriptions, todayIso);
  const rowCount = plan.reduce((n, p) => n + p.dates.length, 0);
  log(`[apply] ${plan.length} subscription(s) marked backfill, ${rowCount} candidate row(s)${args.dryRun ? " (dry-run)" : ""}`);

  const result = await applyPlan({
    sheets,
    spreadsheetId,
    plan,
    createdAtIso: new Date().toISOString(),
    dryRun: args.dryRun,
    log,
  });
  log(`[apply] created=${result.created} skipped=${result.skipped}`);
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.analyze === args.apply) {
    throw new Error("Pass exactly one of --analyze or --apply.");
  }
  if (args.analyze) await runAnalyze(args);
  else await runApply(args);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n[error] ${err.message ?? err}`);
    if (err instanceof PartialWriteError && err.writtenIds.length > 0) {
      console.error(`[error] these ids WERE written and will be skipped on a re-run:`);
      for (const id of err.writtenIds) console.error(`  ${id}`);
      console.error(`[error] re-run --apply with the same report to write the remainder.`);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  WINDOW_START,
  DEFAULT_REPORT,
  READONLY_SCOPE,
  ReportError,
  PartialWriteError,
  fold,
  generateOccurrences,
  recordCreatedAt,
  analyze,
  renderReport,
  parseReport,
  stripComment,
  buildPlan,
  buildBackfillRow,
  applyPlan,
  rowToExpense,
  readRows,
  runAnalyze,
  runApply,
  parseArgs,
  coverCohort,
};
