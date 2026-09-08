/**
 * Entity 066, phase 2 of 2 — write the approved normalization sheet's rows into a
 * target's Expenses tab, reversibly.
 *
 * Reuses the generic Sheets IO `061`/`064` already proved (`readExpenses`,
 * `readCategories`, `insertRowsAtTop`, `deleteRowsByIdPrefix`, `snapshotOf`,
 * `diffSnapshot`) directly from `import-historical-expenses.js`, rather than
 * re-implementing them — none of that plumbing is specific to the band-grid
 * source, only 061's OWN category/id/notes logic is, which this file does not use.
 *
 * Usage — every phase needs an explicit --target and --from-sheet:
 *   node -r ./scripts/load-local-env.js scripts/import-migration066-expenses.js \
 *       --target staging --from-sheet "Migration066 Jan-Apr 2026" --dry-run
 *   ... --snapshot | --apply | --verify | --undo | --rehearse
 *
 * `--undo` needs no `--years`: this entity has one fixed window and its id
 * prefix (`exp-mig066-`) is already fully scoped by construction (AC-7) — unlike
 * `061`'s multi-year prefix, which needed an explicit year scope to avoid
 * reaching another entity's rows sharing the same year.
 *
 * Category names resolve against the target's live `name_zh` (never `name_en` —
 * the source is entirely Chinese), because staging and production diverge on
 * `房客` vs `房客支出` (spec finding 6): a mapping rehearsed on staging's exact
 * match would be undefined on production.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { buildWriteRow, buildColumnMap, cell } = require("../lib/sheetSchema");
const { EXPENSES_SPEC, CATEGORIES_SPEC } = require("../lib/sheetSchema");

const {
  READONLY_SCOPE,
  WRITE_SCOPE,
  resolveTargets,
  sheetsClientFor,
  accountEmail,
} = require("./migration-env");

const {
  readExpenses,
  insertRowsAtTop,
  deleteRowsByIdPrefix,
  snapshotOf,
  diffSnapshot,
} = require("./import-historical-expenses");

const {
  CONTROL_ROW_MARKER,
  APPROVAL_MARKER,
  WINDOW_START,
  WINDOW_END,
  parseSheetGrid,
  text,
} = require("./extract-migration066-expenses");

/** Every row this entity writes carries this prefix; undo matches on it and only it. */
const ID_PREFIX = "exp-mig066-";

/** ijac's own personal ledger — no payer column in the source, a fixed literal (spec finding 3). */
const ACTOR = "ijac";

const REPORT_DIR = path.resolve(__dirname, "..", "backfill-reports");
const WRITE_BATCH_SIZE = 50;

class ImportError extends Error {}

class PartialWriteError extends Error {
  constructor(message, writtenIds) {
    super(message);
    this.name = "PartialWriteError";
    this.writtenIds = writtenIds;
  }
}

// ---------------------------------------------------------------------------
// Timestamps, amounts
// ---------------------------------------------------------------------------

/**
 * Derived from the row's own key by hash, never `Math.random()` or `Date.now()` —
 * a `--dry-run` and the `--apply` that follows it must print byte-identical rows.
 */
function createdAtFor(dateIso, key) {
  const h = crypto.createHash("sha256").update(key, "utf8").digest();
  const secondOfDay = (((h[0] << 16) | (h[1] << 8) | h[2]) >>> 0) % 86400;
  const hh = String(Math.floor(secondOfDay / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secondOfDay % 3600) / 60)).padStart(2, "0");
  const ss = String(secondOfDay % 60).padStart(2, "0");
  return `${dateIso}T${hh}:${mm}:${ss}.000Z`;
}

/** Integer minor units, so sums compare EXACTLY rather than as floats. */
function minorUnits(amount) {
  const n = Number(text(amount));
  if (!Number.isFinite(n)) throw new ImportError(`Amount ${JSON.stringify(amount)} is not a number.`);
  return Math.round(n * 100);
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/**
 * Turns the approved sheet's rows into the rows to write. Nothing is dropped
 * without being counted, so the dry-run's numbers add up to the sheet's row
 * count rather than to whatever survived the filters.
 */
function planImport(sheetRows) {
  const excluded = { orphaned: [], excludeStatus: [], outOfWindow: [], otherStatus: [] };
  const included = [];

  for (const row of sheetRows) {
    const status = text(row.status).toLowerCase();
    if (status === "orphaned") { excluded.orphaned.push(row.key); continue; }
    if (status === "exclude") { excluded.excludeStatus.push(row.key); continue; }
    if (status !== "include") { excluded.otherStatus.push(`${row.key} (${status || "blank"})`); continue; }

    const date = text(row.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ImportError(`${row.key}: status is "include" but the date is ${JSON.stringify(date)}, not YYYY-MM-DD.`);
    }
    if (date < WINDOW_START || date > WINDOW_END) {
      excluded.outOfWindow.push(`${row.key} (${date})`);
      continue;
    }
    included.push({ ...row, date });
  }

  const candidates = included.map((row) => ({
    ...row,
    id: row.key, // exp-mig066-r{sourceRow}, already collision-free and traceable by construction
    createdAt: createdAtFor(row.date, row.key),
    amountMinor: minorUnits(row.amount),
  }));

  const totalMinor = candidates.reduce((sum, c) => sum + c.amountMinor, 0);
  return { candidates, excluded, totalMinor, sheetRowCount: sheetRows.length };
}

// ---------------------------------------------------------------------------
// Category resolution (name_zh, never name_en — see file header)
// ---------------------------------------------------------------------------

function foldName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function resolveCategoryNamesZh(names, liveCategories) {
  const byName = new Map();
  const duplicates = [];
  for (const category of liveCategories) {
    const folded = foldName(category.name_zh);
    if (folded === "") continue;
    if (byName.has(folded)) duplicates.push(category.name_zh);
    else byName.set(folded, category.id);
  }
  const resolved = new Map();
  const unresolved = [];
  for (const name of names) {
    const id = byName.get(foldName(name));
    if (id === undefined) unresolved.push(name);
    else resolved.set(name, id);
  }
  return { resolved, unresolved, duplicates, available: liveCategories.map((c) => c.name_zh) };
}

/** `061`'s own `readCategories` only carries `name_en`; this entity needs `name_zh`. */
async function readCategoriesZh(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${CATEGORIES_SPEC.tab}'!A:Z` });
  const grid = res.data.values ?? [];
  const map = buildColumnMap(grid, CATEGORIES_SPEC);
  return grid.slice(1)
    .map((row) => ({ id: String(cell(row, map, "id") ?? ""), name_zh: String(cell(row, map, "name_zh") ?? "") }))
    .filter((c) => c.id !== "");
}

// ---------------------------------------------------------------------------
// Row build
// ---------------------------------------------------------------------------

function candidateRow(candidate, expensesMap, categoryId) {
  return buildWriteRow([], expensesMap, {
    id: candidate.id,
    date: candidate.date,
    amount: String(candidate.amount),
    category_id: categoryId,
    paid_by: ACTOR,
    created_by: ACTOR,
    notes: candidate.notes, // byte-for-byte from the source's own 備註 (AC-10) — never re-encoded
    created_at: candidate.createdAt,
  });
}

// ---------------------------------------------------------------------------
// Approved sheet
// ---------------------------------------------------------------------------

async function readApprovedSheet(sheets, spreadsheetId, tabName, { requireApproval = true } = {}) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tabName}'!A:P` });
  const grid = res.data.values ?? [];
  if (grid.length === 0) throw new ImportError(`Tab "${tabName}" in ${spreadsheetId} is empty.`);
  const parsed = parseSheetGrid(grid);
  if (parsed.control.marker !== CONTROL_ROW_MARKER) {
    throw new ImportError(`Tab "${tabName}" does not look like a normalization sheet: A1 is ${JSON.stringify(parsed.control.marker)}.`);
  }
  if (requireApproval && parsed.control.approval !== APPROVAL_MARKER) {
    throw new ImportError(
      `Tab "${tabName}" is not approved: B1 is ${JSON.stringify(parsed.control.approval)}, expected ` +
      `${JSON.stringify(APPROVAL_MARKER)}. Nothing was written and the Expenses row count is unchanged.`
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Verify (AC-1, AC-2 [count/date-range already checked at extract], AC-6, AC-9)
// ---------------------------------------------------------------------------

function verifyAgainst({ expenses, map, plan, categories, snapshot }) {
  const rows = expenses.slice(1).map((row) => ({
    id: String(cell(row, map, "id") ?? ""),
    date: String(cell(row, map, "date") ?? ""),
    amount: String(cell(row, map, "amount") ?? ""),
    category_id: String(cell(row, map, "category_id") ?? ""),
    notes: String(cell(row, map, "notes") ?? ""),
  }));
  const imported = rows.filter((r) => r.id.startsWith(ID_PREFIX));

  const findings = [];
  const fail = (label, detail) => findings.push({ label, detail });

  // Every candidate's id traces to exactly one imported app row, and back — the
  // id itself IS the source-row key, so this is a direct set comparison rather
  // than a notes-parse round-trip.
  const candidateIds = new Set(plan.candidates.map((c) => c.id));
  const importedIds = new Set(imported.map((r) => r.id));
  const missing = [...candidateIds].filter((id) => !importedIds.has(id));
  const unexpected = [...importedIds].filter((id) => !candidateIds.has(id));
  if (missing.length > 0) fail("missing app row", `${missing.length}: ${missing.slice(0, 5).join(", ")}`);
  if (unexpected.length > 0) fail("unexpected exp-mig066- row", `${unexpected.length}: ${unexpected.slice(0, 5).join(", ")}`);

  // Notes preserved byte-for-byte (AC-10).
  const byId = new Map(plan.candidates.map((c) => [c.id, c]));
  const notesMismatch = imported.filter((r) => byId.has(r.id) && byId.get(r.id).notes !== r.notes);
  if (notesMismatch.length > 0) fail("AC-10 notes mismatch", `${notesMismatch.length}: ${notesMismatch.slice(0, 5).map((r) => r.id).join(", ")}`);

  // Sum EXACTLY equal, as integer minor units — both sides are artefacts we
  // control, so any variance is a defect in our own arithmetic.
  const appTotalMinor = imported.reduce((sum, r) => sum + minorUnits(r.amount), 0);
  if (appTotalMinor !== plan.totalMinor) {
    fail("sum mismatch", `sheet ${plan.totalMinor} minor units, app ${appTotalMinor} — must be EQUAL`);
  }

  // Every imported category_id lives on the target's own tab, and no category was created.
  const liveIds = new Set(categories.live.map((c) => c.id));
  const strayCategories = [...new Set(imported.map((r) => r.category_id))].filter((id) => !liveIds.has(id));
  if (strayCategories.length > 0) fail("unknown category_id", strayCategories.join(", "));
  if (categories.countBefore !== null && categories.countBefore !== categories.live.length) {
    fail("categories changed", `${categories.countBefore} rows before, ${categories.live.length} after`);
  }

  // AC-1 — nothing pre-existing was altered or deleted.
  let snapshotDiff = null;
  if (snapshot) {
    snapshotDiff = diffSnapshot(snapshot, snapshotOf(expenses, map));
    const preExistingModified = snapshotDiff.modified.filter((id) => !id.startsWith(ID_PREFIX));
    const preExistingDeleted = snapshotDiff.deleted.filter((id) => !id.startsWith(ID_PREFIX));
    if (preExistingModified.length > 0) fail("AC-1 modified", `${preExistingModified.length}: ${preExistingModified.slice(0, 5).join(", ")}`);
    if (preExistingDeleted.length > 0) fail("AC-1 deleted", `${preExistingDeleted.length}: ${preExistingDeleted.slice(0, 5).join(", ")}`);
  }

  return {
    importedCount: imported.length,
    missingCount: missing.length,
    unexpectedCount: unexpected.length,
    notesMismatchCount: notesMismatch.length,
    sheetTotalMinor: plan.totalMinor,
    appTotalMinor,
    snapshotDiff,
    categoriesBefore: categories.countBefore,
    categoriesAfter: categories.live.length,
    findings,
    passed: findings.length === 0,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const PHASES = ["dry-run", "snapshot", "apply", "verify", "undo", "rehearse"];

function parseArgs(argv) {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  const phases = PHASES.filter((p) => argv.includes(`--${p}`));
  return {
    phases,
    target: value("--target"),
    fromSheet: value("--from-sheet"),
    snapshotFile: value("--snapshot-file"),
    handAddId: value("--hand-add-id"),
  };
}

function defaultSnapshotPath(target, fromSheet) {
  const slug = String(fromSheet).replace(/[^A-Za-z0-9]+/g, "-");
  return path.join(REPORT_DIR, `066-snapshot-${target}-${slug}.json`);
}

async function run(argv, { log = console.log, env = process.env, sheetsFor = sheetsClientFor, now = () => new Date() } = {}) {
  const args = parseArgs(argv);
  if (args.phases.length !== 1) {
    throw new ImportError(`Pass exactly one of ${PHASES.map((p) => `--${p}`).join(", ")}; got ${args.phases.length}.`);
  }
  const phase = args.phases[0];

  // AC-11 — no target, no run.
  const targets = resolveTargets({ target: args.target, env });

  if (phase === "undo") {
    const scope = WRITE_SCOPE;
    const writeSheets = await sheetsFor(targets.write, scope);
    log(`[undo] target=${targets.target} (${targets.write.spreadsheetId}) as ${accountEmail(targets.write)}`);
    const result = await deleteRowsByIdPrefix(writeSheets, targets.write.spreadsheetId, ID_PREFIX, log);
    return { phase, ...result };
  }

  if (!args.fromSheet) {
    throw new ImportError('--from-sheet "<tab name>" is required and has no default.');
  }

  const readScope = phase === "dry-run" || phase === "verify" ? READONLY_SCOPE : WRITE_SCOPE;
  const readSheets = await sheetsFor(targets.read, READONLY_SCOPE);
  const writeSheets = await sheetsFor(targets.write, readScope);

  log(`[import] phase=${phase} target=${targets.target} (${targets.write.spreadsheetId}) writing as ${accountEmail(targets.write)}`);
  log(`[import] normalization sheet "${args.fromSheet}" read from ${targets.read.spreadsheetId} as ${accountEmail(targets.read)}`);

  const snapshotFile = args.snapshotFile ?? defaultSnapshotPath(targets.target, args.fromSheet);

  if (phase === "snapshot") {
    const { grid, map } = await readExpenses(writeSheets, targets.write.spreadsheetId);
    const categories = await readCategoriesZh(writeSheets, targets.write.spreadsheetId);
    const snapshot = { ...snapshotOf(grid, map), categoryCount: categories.length, at: now().toISOString() };
    fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 1), "utf8");
    log(`[snapshot] ${snapshot.rows.length} Expenses row(s), ${categories.length} Categories row(s) -> ${snapshotFile}`);
    return { phase, snapshot, snapshotFile };
  }

  const approvedSheet = await readApprovedSheet(readSheets, targets.read.spreadsheetId, args.fromSheet, {
    requireApproval: phase !== "dry-run" && phase !== "rehearse",
  });
  const plan = planImport(approvedSheet.rows);

  log(
    `[plan] ${plan.sheetRowCount} sheet row(s): ${plan.candidates.length} to write, ` +
    `excluded ${plan.excluded.orphaned.length} orphaned / ${plan.excluded.excludeStatus.length} status=exclude / ` +
    `${plan.excluded.outOfWindow.length} out-of-window / ${plan.excluded.otherStatus.length} unrecognised status`
  );
  log(`[plan] total ${plan.totalMinor / 100}`);

  const liveCategories = await readCategoriesZh(writeSheets, targets.write.spreadsheetId);
  const distinctNames = [...new Set(plan.candidates.map((c) => c.category_name_zh))];
  const resolution = resolveCategoryNamesZh(distinctNames, liveCategories);

  if (resolution.duplicates.length > 0) {
    throw new ImportError(`${targets.target}'s Categories tab holds duplicate name_zh values (${resolution.duplicates.join(", ")}).`);
  }
  if (resolution.unresolved.length > 0) {
    throw new ImportError(
      `${resolution.unresolved.length} category name(s) do not exist on ${targets.target}'s Categories tab: ` +
      `${resolution.unresolved.join(", ")}.\nAvailable there: ${resolution.available.join(", ")}.`
    );
  }
  log(`[categories] all ${distinctNames.length} name(s) resolve on ${targets.target}: ` +
    distinctNames.map((n) => `${n}=${resolution.resolved.get(n)}`).join(", "));

  const { grid: expensesGrid, map: expensesMap } = await readExpenses(writeSheets, targets.write.spreadsheetId);
  const existingIds = new Set(expensesGrid.slice(1).map((r) => String(r[expensesMap.index.id] ?? "")));

  const rows = plan.candidates.map((c) => ({ candidate: c, cells: candidateRow(c, expensesMap, resolution.resolved.get(c.category_name_zh)) }));

  if (phase === "dry-run") {
    const pending = rows.filter((r) => !existingIds.has(r.candidate.id));
    log(`[dry-run] ${pending.length} row(s) would be written, ${rows.length - pending.length} skipped as already present.`);
    log(`[dry-run] nothing was written. Approval marker in B1: ${JSON.stringify(approvedSheet.control.approval)}`);
    return { phase, plan, resolution, wouldWrite: pending.length, skipped: rows.length - pending.length };
  }

  if (phase === "verify") {
    const snapshot = fs.existsSync(snapshotFile) ? JSON.parse(fs.readFileSync(snapshotFile, "utf8")) : null;
    if (!snapshot) log(`[verify] no snapshot at ${snapshotFile} — AC-1's before/after diff is SKIPPED, not passed`);
    const result = verifyAgainst({
      expenses: expensesGrid,
      map: expensesMap,
      plan,
      categories: { live: liveCategories, countBefore: snapshot?.categoryCount ?? null },
      snapshot,
    });
    for (const f of result.findings) log(`[verify] FAIL ${f.label}: ${f.detail}`);
    log(`[verify] imported=${result.importedCount} missing=${result.missingCount} unexpected=${result.unexpectedCount} notes-mismatch=${result.notesMismatchCount}`);
    log(`[verify] sheet total ${result.sheetTotalMinor / 100} vs app total ${result.appTotalMinor / 100}`);
    log(`[verify] ${result.passed ? "PASSED" : "FAILED"}`);
    if (!result.passed) throw new ImportError(`Verification failed with ${result.findings.length} finding(s).`);
    return { phase, result };
  }

  if (phase === "apply") {
    const pending = rows.filter((r) => !existingIds.has(r.candidate.id));
    const skipped = rows.length - pending.length;
    log(`[apply] ${pending.length} row(s) to write, ${skipped} already present`);

    const writtenIds = [];
    for (let i = 0; i < pending.length; i += WRITE_BATCH_SIZE) {
      const batch = pending.slice(i, i + WRITE_BATCH_SIZE);
      try {
        await insertRowsAtTop(writeSheets, targets.write.spreadsheetId, EXPENSES_SPEC.tab, batch.map((r) => r.cells));
      } catch (err) {
        throw new PartialWriteError(`Write failed after ${writtenIds.length} row(s): ${err.message ?? err}`, writtenIds);
      }
      for (const r of batch) writtenIds.push(r.candidate.id);
      log(`[apply] wrote ${writtenIds.length}/${pending.length}`);
    }
    log(`[apply] created=${writtenIds.length} skipped=${skipped}`);
    return { phase, created: writtenIds.length, skipped, writtenIds };
  }

  if (phase === "rehearse") {
    if (targets.target !== "staging") {
      throw new ImportError(`--rehearse runs against staging only, got "${targets.target}".`);
    }
    return rehearse({ args, targets, writeSheets, plan, rows, liveCategories, snapshotFile, log, now });
  }

  throw new ImportError(`Unhandled phase ${phase}.`);
}

async function rehearse({ targets, writeSheets, plan, rows, snapshotFile, log, now, args }) {
  const spreadsheetId = targets.write.spreadsheetId;
  const steps = [];
  const record = (step, detail) => { steps.push({ step, detail }); log(`[rehearse] ${step}: ${detail}`); };

  const before = await readExpenses(writeSheets, spreadsheetId);
  const categoriesBefore = await readCategoriesZh(writeSheets, spreadsheetId);
  const snapshot = { ...snapshotOf(before.grid, before.map), categoryCount: categoriesBefore.length, at: now().toISOString() };
  fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 1), "utf8");
  record("snapshot", `${snapshot.rows.length} Expenses rows, ${categoriesBefore.length} Categories rows -> ${snapshotFile}`);

  const distinctNames = [...new Set(plan.candidates.map((c) => c.category_name_zh))];
  const resolution = resolveCategoryNamesZh(distinctNames, categoriesBefore);

  const pending = rows.filter((r) => !snapshot.rows.some((s) => s.id === r.candidate.id));
  const writtenIds = [];
  for (let i = 0; i < pending.length; i += WRITE_BATCH_SIZE) {
    const batch = pending.slice(i, i + WRITE_BATCH_SIZE);
    await insertRowsAtTop(writeSheets, spreadsheetId, EXPENSES_SPEC.tab, batch.map((r) => r.cells));
    for (const r of batch) writtenIds.push(r.candidate.id);
  }
  record("apply", `${writtenIds.length} row(s) written`);

  const applied = await readExpenses(writeSheets, spreadsheetId);
  const categoriesAfter = await readCategoriesZh(writeSheets, spreadsheetId);
  const verification = verifyAgainst({
    expenses: applied.grid,
    map: applied.map,
    plan,
    categories: { live: categoriesAfter, countBefore: categoriesBefore.length },
    snapshot,
  });
  for (const f of verification.findings) log(`[rehearse] verify FAIL ${f.label}: ${f.detail}`);
  if (!verification.passed) {
    throw new ImportError(`Rehearsal verification failed with ${verification.findings.length} finding(s). The ${writtenIds.length} rows are still on staging — run --undo to remove them.`);
  }
  record("verify", `PASSED — ${verification.importedCount} imported rows trace to the sheet, sum exact`);

  // Hand-add a decoy row, the way a live user would while the migration runs —
  // dated inside the imported window, so an undo matching on date rather than
  // id-prefix would delete it too (proves AC-6/AC-7's real discriminator).
  const handAddId = args.handAddId ?? `manual-rehearsal-${now().getTime()}`;
  const handAddRow = buildWriteRow([], applied.map, {
    id: handAddId,
    date: "2026-03-15",
    amount: "1",
    category_id: [...resolution.resolved.values()][0],
    paid_by: "rehearsal",
    created_by: "rehearsal",
    notes: "entity 066 rehearsal — a row added by hand between apply and undo",
    created_at: now().toISOString(),
  });
  await insertRowsAtTop(writeSheets, spreadsheetId, EXPENSES_SPEC.tab, [handAddRow]);
  record("hand-add", `${handAddId} dated 2026-03-15, inside the imported window`);

  const undoResult = await deleteRowsByIdPrefix(writeSheets, spreadsheetId, ID_PREFIX, log);
  record("undo", `${undoResult.removed} row(s) removed, scoped to [${ID_PREFIX}]`);

  const after = await readExpenses(writeSheets, spreadsheetId);
  const diff = diffSnapshot(snapshot, snapshotOf(after.grid, after.map));
  const problems = [];
  if (diff.modified.filter((id) => !id.startsWith(ID_PREFIX)).length > 0) problems.push(`pre-existing row(s) modified`);
  if (diff.deleted.filter((id) => !id.startsWith(ID_PREFIX)).length > 0) problems.push(`pre-existing row(s) deleted`);
  const survivingImported = diff.added.filter((id) => id.startsWith(ID_PREFIX));
  if (survivingImported.length > 0) problems.push(`${survivingImported.length} ${ID_PREFIX} row(s) survived the undo`);
  const otherAdded = diff.added.filter((id) => !id.startsWith(ID_PREFIX));
  if (!otherAdded.includes(handAddId)) problems.push(`the hand-added row ${handAddId} did NOT survive the undo`);
  if (problems.length > 0) throw new ImportError(`Rehearsal diff failed: ${problems.join("; ")}.`);
  record("diff", `clean — 0 pre-existing rows touched, 0 ${ID_PREFIX} rows left, hand-added row survived`);

  await deleteRowsByIdPrefix(writeSheets, spreadsheetId, handAddId, log);
  const finalGrid = await readExpenses(writeSheets, spreadsheetId);
  const finalDiff = diffSnapshot(snapshot, snapshotOf(finalGrid.grid, finalGrid.map));
  if (finalDiff.added.length > 0 || finalDiff.modified.length > 0 || finalDiff.deleted.length > 0) {
    throw new ImportError(`Staging was not restored: ${finalDiff.added.length} added, ${finalDiff.modified.length} modified, ${finalDiff.deleted.length} deleted.`);
  }
  record("restore", "staging is byte-identical to the snapshot");

  return { phase: "rehearse", steps, verification, writtenIds, handAddId };
}

async function main() {
  await run(process.argv.slice(2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n[error] ${err.message ?? err}`);
    if (err instanceof PartialWriteError && err.writtenIds.length > 0) {
      console.error(`[error] these ids WERE written; --undo removes exactly them:`);
      for (const id of err.writtenIds) console.error(`  ${id}`);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  ID_PREFIX,
  ACTOR,
  ImportError,
  PartialWriteError,
  createdAtFor,
  minorUnits,
  planImport,
  foldName,
  resolveCategoryNamesZh,
  readCategoriesZh,
  candidateRow,
  readApprovedSheet,
  verifyAgainst,
  parseArgs,
  defaultSnapshotPath,
  PHASES,
  run,
};
