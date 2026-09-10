/**
 * Entity 067 — backfill ijac's own 健保 (health insurance) and 勞保 (labor
 * insurance) recurring costs for January-September 2026, the months these two
 * real app Subscriptions (`due_day: 5`, created 2026-09-07) never fired: the
 * live scheduler's `isDueOn` never checks `start_date`, only `due_day` against
 * today, and both subscriptions' September due day had already passed when
 * they were created — so their first real fire is 2026-10-05.
 *
 * The 2 subscriptions' amount/category/payer and the 9-month window are pinned
 * by the approved spec — a literal list here, never read from the live
 * Subscriptions tab or derived from `now` — so a later edit to a subscription's
 * current amount, or a run any month after September 2026, cannot silently
 * change what this backfill writes for Jan-Sep 2026.
 *
 * Usage — every phase needs an explicit --target:
 *   node -r ./scripts/load-local-env.js scripts/backfill-subscription-067.js --target staging --dry-run
 *   node -r ./scripts/load-local-env.js scripts/backfill-subscription-067.js --target staging --apply
 *   node -r ./scripts/load-local-env.js scripts/backfill-subscription-067.js --target staging --undo
 *
 *   --fixture <dir>     run --dry-run against local JSON (Expenses.json, Categories.json)
 *                        instead of Sheets; --apply/--undo always need a real spreadsheet.
 *   --manifest <path>   manifest location (default below, one per --target).
 *
 * Write mechanism reused unmodified from entity 065/051: `buildColumnMap`/`buildWriteRow`
 * from the compiled scheduler-adjacent `lib/sheetSchema`, and the same all-or-nothing
 * insertDimension+updateCells batchUpdate the live scheduler itself uses.
 */

const fs = require("fs");
const path = require("path");

const { buildColumnMap, buildWriteRow, cell } = require("../lib/sheetSchema");
const { EXPENSES_SPEC, CATEGORIES_SPEC } = require("../lib/sheetSchema");
const { resolveCredentialPairs, sheetsClientFor, READONLY_SCOPE, WRITE_SCOPE } = require("./migration-env");

/** Every row this entity writes carries this prefix, and only this entity's undo matches it. */
const ID_PREFIX = "exp-sub067-";
const REPORT_DIR = path.resolve(__dirname, "..", "backfill-reports");

// Pinned by the approved spec — never read from the live Subscriptions tab
// (AC-3's falsifier: reading "current" subscription state would let a later
// edit rewrite Jan-Sep 2026 history on a re-run).
const SUBSCRIPTIONS = [
  { subscriptionId: "sub-1788741741902", amount: 3172, category_id: "cat_024", paid_by: "ijac", created_by: "ijac", notes: "健保 ijac" },
  { subscriptionId: "sub-1788741714162", amount: 1145, category_id: "cat_024", paid_by: "ijac", created_by: "ijac", notes: "勞保 ijac" },
];

// Fixed window, a literal list — never computed from `daysInMonth`/`now` (AC-6).
// The 5th of each month: these subscriptions' own due_day, not the 1st.
const MONTHS = [
  "2026-01-05", "2026-02-05", "2026-03-05", "2026-04-05",
  "2026-05-05", "2026-06-05", "2026-07-05", "2026-08-05", "2026-09-05",
];

const REQUIRED_CATEGORIES = ["cat_024"];

class BackfillError extends Error {}

function backfillId(subscriptionId, isoDate) {
  return `${ID_PREFIX}${subscriptionId}-${isoDate}`;
}

function generateCandidates() {
  const out = [];
  for (const sub of SUBSCRIPTIONS) {
    for (const date of MONTHS) {
      out.push({
        id: backfillId(sub.subscriptionId, date),
        subscriptionId: sub.subscriptionId,
        date,
        amount: sub.amount,
        category_id: sub.category_id,
        paid_by: sub.paid_by,
        created_by: sub.created_by,
        notes: sub.notes,
      });
    }
  }
  return out;
}

// Both sides go through Number(amount): the sheet stores amount as text, so
// "1145" (existing row) and 1145 (candidate) must compare equal.
function dedupKey({ date, amount, category_id, paid_by }) {
  return [date, Number(amount), category_id, paid_by].join("|");
}

/**
 * Splits every candidate into write vs. skip against ALL existing Expenses rows —
 * live state, not a manifest — so a pre-existing row covering one of these
 * subscription-months is caught the same way on the first run or the tenth
 * (AC-2, AC-8).
 */
function planCandidates(candidates, existingRows) {
  const existingIds = new Set(existingRows.map((r) => r.id));
  const byKey = new Map();
  for (const row of existingRows) {
    const key = dedupKey(row);
    if (!byKey.has(key)) byKey.set(key, row.id);
  }

  const toWrite = [];
  const skipped = [];
  for (const c of candidates) {
    if (existingIds.has(c.id)) {
      skipped.push({ candidate: c, reason: "already-written", matchedId: c.id });
      continue;
    }
    const matchedId = byKey.get(dedupKey(c));
    if (matchedId) {
      skipped.push({ candidate: c, reason: "pre-existing-row", matchedId });
      continue;
    }
    toWrite.push(c);
  }
  return { toWrite, skipped };
}

/** Aborts before any write if the required category is missing (AC-7). */
function assertCategoriesResolve(categoryRows) {
  const ids = new Set(categoryRows.map((r) => r.id));
  const missing = REQUIRED_CATEGORIES.filter((id) => !ids.has(id));
  if (missing.length > 0) {
    throw new BackfillError(
      `Category id(s) not found on the target's Categories tab: ${missing.join(", ")}. Refusing to write anything.`
    );
  }
}

function rowToCategory(row, map) {
  return { id: String(cell(row, map, "id") ?? "") };
}

function rowToExpenseShape(row, map) {
  return {
    id: String(cell(row, map, "id") ?? ""),
    date: String(cell(row, map, "date") ?? ""),
    amount: Number(cell(row, map, "amount") ?? 0),
    category_id: String(cell(row, map, "category_id") ?? ""),
    paid_by: String(cell(row, map, "paid_by") ?? ""),
  };
}

function buildCandidateRow(expensesMap, candidate, createdAtIso) {
  return buildWriteRow([], expensesMap, {
    id: candidate.id,
    date: candidate.date,
    amount: String(candidate.amount),
    category_id: candidate.category_id,
    paid_by: candidate.paid_by,
    created_by: candidate.created_by,
    notes: candidate.notes,
    created_at: createdAtIso,
  });
}

// Same all-or-nothing shape the scheduler and entity 051/065 use: the insert and
// the write ride in one batchUpdate, so a rejected write never leaves a blank row.
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

async function deleteRowsById(sheets, spreadsheetId, tabName, ids) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tabName)?.properties?.sheetId ?? 0;

  const { map, rows } = await readGridLive(sheets, spreadsheetId, EXPENSES_SPEC);
  const wanted = new Set(ids);
  const indexes = [];
  rows.forEach((row, i) => {
    if (wanted.has(String(row[map.index.id] ?? ""))) indexes.push(i + 1); // +1: header occupies index 0
  });

  // Bottom-up, so an earlier deletion cannot shift a later index.
  for (const rowIndex of indexes.slice().sort((a, b) => b - a)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIndex, endIndex: rowIndex + 1 } } }],
      },
    });
  }
  return { removed: indexes.length };
}

async function readGridLive(sheets, spreadsheetId, spec) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${spec.tab}!A:Z` });
  const values = res.data.values ?? [];
  return { map: buildColumnMap(values, spec), rows: values.slice(1) };
}

function fixtureGrid(dir, name, spec) {
  const values = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), "utf8"));
  return { map: buildColumnMap(values, spec), rows: values.slice(1) };
}

function manifestPathFor(target, override) {
  return override ?? path.join(REPORT_DIR, `067-manifest-${target}.json`);
}

async function resolveWritePair(target, env) {
  if (!target) {
    throw new BackfillError(
      "No --target given. Pass --target staging or --target production explicitly; this script never infers a target."
    );
  }
  const pairs = resolveCredentialPairs(env);
  const pair = pairs[target];
  if (!pair) {
    throw new BackfillError(`--target must be "staging" or "production", got ${JSON.stringify(target)}.`);
  }
  if (!pair.spreadsheetId || !pair.credentialsJson) {
    throw new BackfillError(
      `Missing credentials for target "${target}": expected SPREADSHEET_ID_${target.toUpperCase()} and ` +
      `GOOGLE_SERVICE_ACCOUNT_KEY_${target.toUpperCase()} (via node -r ./scripts/load-local-env.js).`
    );
  }
  return pair;
}

function parseArgs(argv) {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  return {
    target: value("--target"),
    dryRun: argv.includes("--dry-run"),
    apply: argv.includes("--apply"),
    undo: argv.includes("--undo"),
    fixture: value("--fixture"),
    manifest: value("--manifest"),
  };
}

async function runUndo({ pair, args, log, sheetsFor }) {
  const manifestPath = manifestPathFor(args.target, args.manifest);
  if (!fs.existsSync(manifestPath)) {
    throw new BackfillError(
      `No manifest at ${manifestPath} — nothing recorded as written for target "${args.target}", so there is nothing to undo.`
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const writtenIds = manifest.writtenIds ?? [];
  const outsidePrefix = writtenIds.filter((id) => !id.startsWith(ID_PREFIX));
  if (outsidePrefix.length > 0) {
    throw new BackfillError(
      `Manifest ${manifestPath} names id(s) outside this entity's own "${ID_PREFIX}" prefix: ${outsidePrefix.join(", ")}. ` +
      `Refusing to undo from a manifest that could reach rows this entity did not write.`
    );
  }

  const sheets = await sheetsFor(pair, WRITE_SCOPE);
  const { removed } = await deleteRowsById(sheets, pair.spreadsheetId, EXPENSES_SPEC.tab, writtenIds);

  const after = await readGridLive(sheets, pair.spreadsheetId, EXPENSES_SPEC);
  const afterIds = new Set(after.rows.map((r) => String(r[after.map.index.id] ?? "")));
  const leftBehind = writtenIds.filter((id) => afterIds.has(id));
  if (leftBehind.length > 0) throw new BackfillError(`--undo left ${leftBehind.join(", ")} behind.`);

  log(`[undo] removed ${removed} of ${writtenIds.length} recorded id(s) from ${pair.spreadsheetId}`);
  return { phase: "undo", removed };
}

async function run(argv, { log = console.log, env = process.env, sheetsFor = sheetsClientFor, now = () => new Date() } = {}) {
  const args = parseArgs(argv);
  const chosen = [args.dryRun, args.apply, args.undo].filter(Boolean);
  if (chosen.length !== 1) throw new BackfillError("Pass exactly one of --dry-run, --apply, --undo.");
  if (args.fixture && !args.dryRun) throw new BackfillError("--fixture is --dry-run only; --apply and --undo need a real spreadsheet.");

  const pair = await resolveWritePair(args.target, env);

  if (args.undo) return runUndo({ pair, args, log, sheetsFor });

  const source = args.fixture
    ? {
        mode: "fixture",
        sheets: null,
        expenses: fixtureGrid(args.fixture, "Expenses", EXPENSES_SPEC),
        categories: fixtureGrid(args.fixture, "Categories", CATEGORIES_SPEC),
      }
    : await (async () => {
        const sheets = await sheetsFor(pair, args.dryRun ? READONLY_SCOPE : WRITE_SCOPE);
        return {
          mode: "live",
          sheets,
          expenses: await readGridLive(sheets, pair.spreadsheetId, EXPENSES_SPEC),
          categories: await readGridLive(sheets, pair.spreadsheetId, CATEGORIES_SPEC),
        };
      })();

  assertCategoriesResolve(source.categories.rows.map((r) => rowToCategory(r, source.categories.map)));

  const candidates = generateCandidates();
  const expenseRows = source.expenses.rows.map((r) => rowToExpenseShape(r, source.expenses.map));
  const { toWrite, skipped } = planCandidates(candidates, expenseRows);

  log(`[${args.dryRun ? "dry-run" : "apply"}] ${source.mode}: ${candidates.length} candidate(s), ${toWrite.length} to write, ${skipped.length} skipped`);
  for (const s of skipped) log(`[skip] ${s.candidate.id} — ${s.reason}, matches existing id ${s.matchedId}`);

  if (args.dryRun) {
    for (const c of toWrite) log(`[dry-run] would write ${c.id} | ${c.date} | ${c.amount} | ${c.category_id} | ${c.paid_by}`);
    return { phase: "dry-run", created: 0, skipped: skipped.length, wouldCreate: toWrite.length, toWrite, skipped };
  }

  const createdAtIso = now().toISOString();
  if (toWrite.length > 0) {
    const rows = toWrite.map((c) => buildCandidateRow(source.expenses.map, c, createdAtIso));
    await insertRowsAtTop(source.sheets, pair.spreadsheetId, EXPENSES_SPEC.tab, rows);
  }

  // Merge into any prior manifest for this target, rather than overwrite it, so a
  // no-op re-apply (AC-8) cannot erase a previous run's undo record.
  const manifestPath = manifestPathFor(args.target, args.manifest);
  let manifest = { entity: "067", target: args.target, spreadsheetId: pair.spreadsheetId, writtenIds: [], rows: [] };
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch {
      // corrupt manifest — start fresh rather than fail an otherwise-successful apply
    }
  }
  const known = new Set(manifest.writtenIds ?? []);
  const rows = manifest.rows ?? [];
  for (const c of toWrite) {
    if (!known.has(c.id)) {
      known.add(c.id);
      rows.push(c);
    }
  }
  manifest = { entity: "067", target: args.target, spreadsheetId: pair.spreadsheetId, at: createdAtIso, writtenIds: [...known], rows };

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1), "utf8");

  log(`[apply] created=${toWrite.length} skipped=${skipped.length}`);
  log(`[apply] manifest ${manifestPath} now records ${manifest.writtenIds.length} id(s) — --undo removes exactly these`);
  return { phase: "apply", created: toWrite.length, skipped: skipped.length, manifestPath, manifest };
}

async function main() {
  await run(process.argv.slice(2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n[error] ${err.message ?? err}`);
    process.exitCode = 1;
  });
}

module.exports = {
  ID_PREFIX,
  SUBSCRIPTIONS,
  MONTHS,
  REQUIRED_CATEGORIES,
  REPORT_DIR,
  BackfillError,
  backfillId,
  generateCandidates,
  dedupKey,
  planCandidates,
  assertCategoriesResolve,
  rowToCategory,
  rowToExpenseShape,
  buildCandidateRow,
  insertRowsAtTop,
  deleteRowsById,
  readGridLive,
  fixtureGrid,
  manifestPathFor,
  resolveWritePair,
  parseArgs,
  run,
};
