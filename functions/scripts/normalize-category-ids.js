/**
 * Entity 054 — rewrite every legacy-slug `category_id` stored in the Expenses and
 * Subscriptions tabs to the live `cat_NNN` id it already resolves to today, so
 * category display becomes a direct id match against the Categories tab instead of
 * a two-hop name-matching bridge that breaks silently on a rename.
 *
 * The mapping is never written down here. Every target id comes from calling the
 * app's own `resolveCategory()` against the live Categories tab at run time, so
 * the migration and the bridge it retires cannot disagree — there is no second
 * table to keep in sync. That function ships as TypeScript in the app package, so
 * it has to be compiled first:
 *
 *   npm --prefix ../app run build:lib
 *
 * Usage (from functions/):
 *   npm run migrate:category-ids:dry-run   # readonly token, prints the plan, writes nothing
 *   npm run migrate:category-ids           # writes, then verifies against a pre-run snapshot
 *
 *   --dry-run   plan only. Mints a spreadsheets.readonly token, so a write is not
 *               merely skipped by this code — it is impossible for the token.
 *
 * Required env vars (supplied by `-r ./scripts/load-local-env.js`):
 *   SPREADSHEET_ID                  Target spreadsheet
 *   GOOGLE_SERVICE_ACCOUNT_KEY      Service-account JSON (or GOOGLE_APPLICATION_CREDENTIALS / ADC)
 *
 * The Categories tab is read and never written. Only the `category_id` column of
 * the two data tabs is written, located by header name rather than by letter.
 */

const fs = require("fs");
const path = require("path");

const {
  buildColumnMap,
  cell,
  columnLetter,
  CATEGORIES_SPEC,
  EXPENSES_SPEC,
  SUBSCRIPTIONS_SPEC,
} = require("../lib/sheetSchema");

const READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

// Every changed run of rows is its own range in one values.batchUpdate. Chunked so
// a 2000-row migration cannot exceed the request size limit or the write quota.
const RANGE_BATCH_SIZE = 100;

const MIGRATED_SPECS = [EXPENSES_SPEC, SUBSCRIPTIONS_SPEC];

const APP_CATEGORIES_BUILD = path.resolve(
  __dirname, "..", "..", "app", ".test-build", "categories.js"
);

/** A condition the captain has to resolve by hand. Nothing is written when it fires. */
class HaltError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "HaltError";
    this.details = details;
  }
}

class VerificationError extends Error {
  constructor(message, failures) {
    super(message);
    this.name = "VerificationError";
    this.failures = failures;
  }
}

function loadResolveCategory() {
  if (!fs.existsSync(APP_CATEGORIES_BUILD)) {
    throw new Error(
      `Missing ${APP_CATEGORIES_BUILD}.\n` +
      `Run \`npm --prefix ../app run build:lib\` first — this script calls the app's own ` +
      `resolveCategory() rather than reimplementing it, so it needs the compiled module.`
    );
  }
  return require(APP_CATEGORIES_BUILD).resolveCategory;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

// Same shape rowToCategory in functions/src/index.ts returns, including its
// deliberate lack of filtering: a row with a blank id is still a row, and
// resolveCategory has to see exactly what the app sees.
function liveCategoriesFrom(rows) {
  const map = buildColumnMap(rows, CATEGORIES_SPEC);
  return rows.slice(1).map((row) => ({
    id: String(cell(row, map, "id") ?? ""),
    name_en: String(cell(row, map, "name_en") ?? ""),
    name_zh: String(cell(row, map, "name_zh") ?? ""),
    icon: String(cell(row, map, "icon") ?? ""),
    sort_order: Number(cell(row, map, "sort_order") ?? 0),
    is_active: cell(row, map, "is_active") !== "false",
  }));
}

async function readGrid(sheets, spreadsheetId, tab) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!A:Z`,
  });
  return response.data.values ?? [];
}

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

/**
 * Classify every data row of one tab. Rows are returned with their 1-based sheet
 * row number, so a write range can be built without re-finding the row by id.
 *
 * Values are compared raw — never trimmed. `resolveCategory` compares with `===`
 * and the API does not trim either, so a stored ` eating-out` genuinely does not
 * resolve in the app today. Trimming it here to force a match would migrate the
 * row to a category the app never displayed for it.
 */
function planTab({ rows, spec, liveCategories, resolveCategory }) {
  const map = buildColumnMap(rows, spec);
  const liveIds = new Set(liveCategories.map((c) => c.id));

  const changes = [];
  const alreadyLive = new Map();
  const blank = [];
  const unmappable = new Map();

  for (let i = 1; i < rows.length; i++) {
    const rowNumber = i + 1;
    const value = String(cell(rows[i], map, "category_id") ?? "");

    if (value === "") {
      blank.push(rowNumber);
      continue;
    }
    if (liveIds.has(value)) {
      alreadyLive.set(value, (alreadyLive.get(value) ?? 0) + 1);
      continue;
    }

    // Not a live id, so resolveCategory's first branch has already missed. What
    // comes back is either the live twin of the slug's name_en, or — when the
    // twin was renamed or removed — the baked-in DEFAULT_CATEGORIES entry, whose
    // id is the slug itself and therefore not a live id. Requiring the result to
    // be live is what separates "bridged" from "fell back".
    const resolved = resolveCategory(value, liveCategories);
    if (!resolved || !liveIds.has(resolved.id)) {
      const seen = unmappable.get(value) ?? { value, rows: 0, resolvedTo: resolved ? resolved.id : null };
      seen.rows += 1;
      unmappable.set(value, seen);
      continue;
    }

    changes.push({ rowNumber, from: value, to: resolved.id });
  }

  return {
    tab: spec.tab,
    map,
    dataRows: rows.length - 1,
    changes,
    alreadyLive,
    blank,
    unmappable: [...unmappable.values()],
  };
}

// Two live categories with the same name_en make the bridge's `find` a coin
// flip. Zero exist today; if one ever does, which id a slug migrates to is the
// captain's call, not `find`'s.
function duplicateLiveNames(liveCategories) {
  const byName = new Map();
  for (const c of liveCategories) {
    byName.set(c.name_en, [...(byName.get(c.name_en) ?? []), c.id]);
  }
  return [...byName.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name_en, ids]) => ({ name_en, ids }));
}

/**
 * Plan both tabs, or throw. Every unmappable value across BOTH tabs is collected
 * before halting, so one run names the full set of things the captain has to
 * decide rather than surfacing them one re-run at a time.
 */
function planMigration({ categoriesRows, tabRows, resolveCategory }) {
  const liveCategories = liveCategoriesFrom(categoriesRows);

  const duplicates = duplicateLiveNames(liveCategories);
  if (duplicates.length > 0) {
    throw new HaltError(
      `Halting: the live Categories tab has ${duplicates.length} duplicated name_en value(s), so the ` +
      `slug -> name bridge is ambiguous. Nothing was written.\n` +
      duplicates.map((d) => `  "${d.name_en}" is shared by ${d.ids.join(", ")}`).join("\n"),
      { duplicates }
    );
  }

  const plans = MIGRATED_SPECS.map((spec) =>
    planTab({ rows: tabRows[spec.tab], spec, liveCategories, resolveCategory })
  );

  const blocked = plans.filter((p) => p.unmappable.length > 0);
  if (blocked.length > 0) {
    const lines = blocked.flatMap((p) => [
      `  ${p.tab}:`,
      ...p.unmappable.map(
        (u) =>
          `    "${u.value}" — ${u.rows} row(s); ` +
          (u.resolvedTo
            ? `resolves only to the baked-in "${u.resolvedTo}", which is not in the live Categories tab`
            : `matches no live id and no DEFAULT_CATEGORIES slug`)
      ),
    ]);
    throw new HaltError(
      `Halting: ${blocked.reduce((n, p) => n + p.unmappable.length, 0)} category_id value(s) resolve to no ` +
      `live category. Nothing was written — decide these by hand rather than letting the script guess.\n` +
      lines.join("\n"),
      { unmappable: blocked.map((p) => ({ tab: p.tab, values: p.unmappable })) }
    );
  }

  return { liveCategories, plans };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

// Consecutive changed rows become one range. An already-live row breaks the run,
// so no range ever covers a row that is not being changed — an already-correct
// cell is not rewritten with its own value.
function writeRanges(plan) {
  const column = columnLetter(plan.map.index.category_id);
  const ranges = [];
  for (const change of plan.changes) {
    const last = ranges[ranges.length - 1];
    if (last && change.rowNumber === last.endRow + 1) {
      last.endRow = change.rowNumber;
      last.values.push([change.to]);
      continue;
    }
    ranges.push({
      startRow: change.rowNumber,
      endRow: change.rowNumber,
      values: [[change.to]],
    });
  }
  return ranges.map((r) => ({
    range: `${plan.tab}!${column}${r.startRow}:${column}${r.endRow}`,
    values: r.values,
  }));
}

async function applyPlan({ sheets, spreadsheetId, plan, log = console.log }) {
  const data = writeRanges(plan);
  if (data.length === 0) {
    log(`[write] ${plan.tab}: nothing to change`);
    return { ranges: 0, rows: 0 };
  }
  for (let i = 0; i < data.length; i += RANGE_BATCH_SIZE) {
    const batch = data.slice(i, i + RANGE_BATCH_SIZE);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: batch },
    });
    log(`[write] ${plan.tab}: ${batch.length} range(s), ${batch.reduce((n, d) => n + d.values.length, 0)} row(s)`);
  }
  return { ranges: data.length, rows: plan.changes.length };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Diff a full pre-run grid against a full post-run grid. The category_id column
 * must hold exactly the planned target on every changed row and its original
 * value everywhere else; every other cell, the header row, and the row count must
 * be untouched.
 *
 * Cells are normalised through `?? ""` only for absence, never for content —
 * Sheets omits trailing blanks, so a short row and a row padded with empties are
 * the same sheet state, while ` x` and `x` are not.
 */
function diffGrids({ before, after, map, changes, tab }) {
  const failures = [];
  const categoryColumn = map.index.category_id;
  const target = new Map(changes.map((c) => [c.rowNumber, c.to]));

  if (before.length !== after.length) {
    failures.push(`${tab}: row count changed ${before.length} -> ${after.length}`);
  }
  const width = (grid) => Math.max(...grid.map((r) => r.length), 0);
  const cellAt = (grid, r, c) => String(grid[r]?.[c] ?? "");

  const rowCount = Math.max(before.length, after.length);
  const columnCount = Math.max(width(before), width(after));

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < columnCount; c++) {
      const was = cellAt(before, r, c);
      const now = cellAt(after, r, c);
      if (c === categoryColumn && r > 0) {
        const expected = target.get(r + 1) ?? was;
        if (now !== expected) {
          failures.push(`${tab}!${columnLetter(c)}${r + 1}: expected "${expected}", found "${now}"`);
        }
        continue;
      }
      if (was !== now) {
        failures.push(`${tab}!${columnLetter(c)}${r + 1}: "${was}" -> "${now}" (must not change)`);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function reportPlan(plan, log) {
  const byValue = new Map();
  for (const change of plan.changes) {
    const seen = byValue.get(change.from) ?? { to: change.to, rows: 0 };
    seen.rows += 1;
    byValue.set(change.from, seen);
  }

  log(`\n[${plan.tab}] ${plan.dataRows} data row(s)`);
  const sorted = [...byValue.entries()].sort((a, b) => b[1].rows - a[1].rows);
  for (const [from, { to, rows }] of sorted) {
    log(`  change   ${from} -> ${to}  (${rows} row(s))`);
  }
  const live = [...plan.alreadyLive.entries()].sort((a, b) => b[1] - a[1]);
  for (const [id, rows] of live) {
    log(`  already live  ${id}  (${rows} row(s)) — excluded from the write set`);
  }
  if (plan.blank.length > 0) {
    log(`  blank    ${plan.blank.length} row(s) with an empty category_id — left untouched`);
  }
  log(
    `  totals: ${plan.changes.length} to change, ` +
    `${[...plan.alreadyLive.values()].reduce((n, v) => n + v, 0)} already live, ` +
    `${plan.blank.length} blank`
  );
}

// Post-run per-category totals, so a partial run is visible as a number rather
// than inferred from the absence of an error.
function categoryTotals(plan) {
  const totals = new Map(plan.alreadyLive);
  for (const change of plan.changes) {
    totals.set(change.to, (totals.get(change.to) ?? 0) + 1);
  }
  return totals;
}

// ---------------------------------------------------------------------------
// Sheets client
// ---------------------------------------------------------------------------

async function sheetsClient(scope) {
  const { google } = require("googleapis");
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("SPREADSHEET_ID env var is required");

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

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function run({ sheets, spreadsheetId, dryRun, resolveCategory, log = console.log }) {
  const categoriesRows = await readGrid(sheets, spreadsheetId, CATEGORIES_SPEC.tab);
  const tabRows = {};
  for (const spec of MIGRATED_SPECS) {
    tabRows[spec.tab] = await readGrid(sheets, spreadsheetId, spec.tab);
  }

  const { liveCategories, plans } = planMigration({ categoriesRows, tabRows, resolveCategory });
  log(`[categories] ${liveCategories.length} live categor(ies) read; the tab is never written to`);

  for (const plan of plans) reportPlan(plan, log);

  const pending = plans.reduce((n, p) => n + p.changes.length, 0);
  if (dryRun) {
    log(`\n[dry-run] ${pending} row(s) would change. No writes performed (readonly token).`);
    return { dryRun: true, wouldChange: pending, plans };
  }
  if (pending === 0) {
    log(`\n[apply] every category_id is already a live id — nothing to write.`);
    return { dryRun: false, changed: 0, plans, verified: true };
  }

  let changed = 0;
  for (const plan of plans) {
    const result = await applyPlan({ sheets, spreadsheetId, plan, log });
    changed += result.rows;
  }

  // Re-read everything and diff it against what was read before the write. This
  // is the AC-9/AC-10 evidence: not "the writes were addressed at column D", but
  // "no cell outside column D differs".
  const failures = [];
  for (const plan of plans) {
    const after = await readGrid(sheets, spreadsheetId, plan.tab);
    failures.push(...diffGrids({
      before: tabRows[plan.tab],
      after,
      map: plan.map,
      changes: plan.changes,
      tab: plan.tab,
    }));
  }
  const categoriesAfter = await readGrid(sheets, spreadsheetId, CATEGORIES_SPEC.tab);
  if (JSON.stringify(categoriesAfter) !== JSON.stringify(categoriesRows)) {
    failures.push(`${CATEGORIES_SPEC.tab}: tab changed during the run — it must never be written to`);
  }

  if (failures.length > 0) {
    throw new VerificationError(
      `Post-run verification failed with ${failures.length} difference(s):\n` +
      failures.slice(0, 40).map((f) => `  ${f}`).join("\n") +
      (failures.length > 40 ? `\n  … and ${failures.length - 40} more` : ""),
      failures
    );
  }

  log(`\n[verify] ${changed} row(s) changed; every other cell, the header rows, the row counts and the Categories tab are byte-identical.`);
  for (const plan of plans) {
    const totals = [...categoryTotals(plan).entries()].sort((a, b) => b[1] - a[1]);
    log(`[verify] ${plan.tab} per-category rows: ${totals.map(([id, n]) => `${id}=${n}`).join(" ")}`);
  }

  return { dryRun: false, changed, plans, verified: true };
}

async function main() {
  const dryRun = process.argv.slice(2).includes("--dry-run");
  const resolveCategory = loadResolveCategory();

  // The readonly scope is the guarantee, not a comment: a token minted for
  // spreadsheets.readonly cannot write even if this code were wrong.
  const { sheets, spreadsheetId } = await sheetsClient(dryRun ? READONLY_SCOPE : WRITE_SCOPE);
  console.log(`[mode] ${dryRun ? "dry-run (readonly token)" : "apply"} on ${spreadsheetId}`);

  await run({ sheets, spreadsheetId, dryRun, resolveCategory });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`\n[error] ${err.message ?? err}`);
    process.exitCode = 1;
  });
}

module.exports = {
  READONLY_SCOPE,
  WRITE_SCOPE,
  RANGE_BATCH_SIZE,
  APP_CATEGORIES_BUILD,
  HaltError,
  VerificationError,
  loadResolveCategory,
  sheetsClient,
  liveCategoriesFrom,
  duplicateLiveNames,
  planTab,
  planMigration,
  writeRanges,
  applyPlan,
  diffGrids,
  categoryTotals,
  run,
};
