/**
 * Entity 061, phase 2 of 2 — write the approved normalization sheet's rows into a
 * target's Expenses tab, reversibly.
 *
 * This script cannot produce a normalization sheet and the extractor cannot write an
 * expense row. That split is the point: the captain's approval sits STRUCTURALLY
 * between them (AC-14), so there is no flag that runs straight through her gate.
 *
 * Usage — every phase needs BOTH an explicit --target and an explicit --from-sheet:
 *   node -r ./scripts/load-local-env.js scripts/import-historical-expenses.js \
 *       --target staging --from-sheet "Migration 2023-2024" --dry-run
 *   ... --snapshot | --apply | --verify | --undo | --rehearse
 *
 * Neither flag has a default, and that is deliberate twice over. `load-local-env.js`
 * resolves a `SPREADSHEET_ID` that today is PRODUCTION's, so a defaulted target
 * writes live financial data (AC-12); and a defaulted sheet name would let a
 * re-generate silently substitute a tab the captain never approved (AC-14).
 *
 * Two credential sets are live in one run whenever `--target production`:
 *   - the normalization sheet is read with STAGING credentials, always, because the
 *     production service account cannot see the spreadsheet it lives in;
 *   - expense rows are written with the TARGET's credentials.
 * See `migration-env.js`.
 *
 * The write shape is `backfill-subscription-history.js`'s, proven on this sheet by
 * entity 051: deterministic ids, batched all-or-nothing `insertDimension` +
 * `updateCells`, skip-if-id-present idempotency, and a `PartialWriteError` carrying
 * the ids already written.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  buildColumnMap,
  buildWriteRow,
  cell,
  columnLetter,
} = require("../lib/sheetSchema");
const { EXPENSES_SPEC, CATEGORIES_SPEC } = require("../lib/sheetSchema");

const {
  READONLY_SCOPE,
  WRITE_SCOPE,
  resolveTargets,
  sheetsClientFor,
  accountEmail,
} = require("./migration-env");

const {
  APPROVAL_MARKER,
  CONTROL_ROW_MARKER,
  IN_SCOPE_YEARS,
  REPORT_DIR,
  parseSheetGrid,
  text,
} = require("./extract-historical-expenses");

/** Every row this feature writes carries this prefix. Undo matches on it and only it. */
const ID_PREFIX = "exp-hist-";

const WRITE_BATCH_SIZE = 50;

/**
 * `paid_by` / `created_by` for an imported row: **`user1`'s display name**.
 *
 * CAPTAIN'S RULING, 2026-08-31. The source has no payer column — column A is a
 * row-kind tag, C the sub-category, D a free-text detail label, E the literal
 * `Daily` — so I first proposed a neutral `Historical` literal on the grounds that
 * naming a payer would invent a fact. The captain ruled `user1`, and she is right:
 * the workbook is `ijacwei_income收支`, her own personal ledger. A personal ledger
 * has no payer column because there was only ever one payer. `user1` is therefore
 * the recorded truth of that ledger, and `Historical` would have been the invention
 * — a payer who never existed, sitting in every per-payer report for two years.
 *
 * THE VALUE IS THE DISPLAY NAME, NOT THE ID, and that distinction is the whole
 * hazard here. Read from the live sheets rather than assumed: `paid_by` holds only
 * `ijac` and `wei` on both staging (453/952) and production (785/1375) — the id
 * `user1` appears nowhere in either tab. The app writes the *name* at
 * creation time (`resolveUserDisplayNames`, `functions/src/index.ts:242`) and
 * Reports filters by resolving id to name before comparing
 * (`resolvePayerName`, `app/app/lib/reportService.ts`). Writing the literal
 * `"user1"` would have filed 1,670 rows against a third payer that matches no
 * filter and appears in no breakdown.
 *
 * Resolved through the app's own `USERS` table so this cannot drift from it. A test
 * asserts the written value equals what the app maps `user1` to, which fails if this
 * is ever changed to the id, to `Historical`, or to anything else.
 */
const HISTORICAL_ACTOR_ID = "user1";

/** Mirrors `LEGACY_USER_MAP` in `functions/src/index.ts:235`. */
const LEGACY_USER_NAMES = { user1: "ijac", user2: "wei" };

let actorNameCache = null;

/**
 * `user1`'s display name, from the app's own module — never a second copy of it.
 *
 * Memoised: resolved once per run rather than once per row, and the resolved value is
 * logged so a run says out loud which payer 1,670 rows are about to carry.
 */
function historicalActorName() {
  if (actorNameCache !== null) return actorNameCache;
  const compiled = path.resolve(__dirname, "..", "..", "app", ".test-build", "users.js");
  if (fs.existsSync(compiled)) {
    const { USERS } = require(compiled);
    const user = USERS.find((u) => u.id === HISTORICAL_ACTOR_ID);
    if (user?.name) {
      actorNameCache = user.name;
      return actorNameCache;
    }
  }
  // The API's own fallback chain, in the same order it uses: the Users tab, then
  // LEGACY_USER_MAP, then the raw id (`functions/src/index.ts:235-247`). The compiled
  // module is absent only when `npm --prefix ../app run build:lib` has not run.
  actorNameCache = LEGACY_USER_NAMES[HISTORICAL_ACTOR_ID] ?? HISTORICAL_ACTOR_ID;
  return actorNameCache;
}

const DEFAULT_RECEIPT = path.join(REPORT_DIR, "061-rehearsal-receipt.json");

class ImportError extends Error {}

class PartialWriteError extends Error {
  constructor(message, writtenIds) {
    super(message);
    this.name = "PartialWriteError";
    this.writtenIds = writtenIds;
  }
}

// ---------------------------------------------------------------------------
// Row identity, notes, timestamps
// ---------------------------------------------------------------------------

/**
 * `exp-hist-{year}-{NNNN}`, following the `exp-auto-{sub}-{date}` convention rather
 * than `008`'s `exp_2025_NNNN` — `008` states plainly that running it twice creates
 * duplicates, and that is the one part of its precedent not to copy.
 *
 * NNNN is the row's 1-based position within its year among the approved sheet's
 * `include` rows SORTED BY KEY. Sorting by key rather than by sheet row order is
 * what makes the id stable: the captain can re-sort or filter the tab without
 * renumbering every row, and a re-run then finds every id already present and
 * writes nothing (AC-5).
 */
function historicalId(year, indexWithinYear) {
  return `${ID_PREFIX}${year}-${String(indexWithinYear).padStart(4, "0")}`;
}

/**
 * `notes` for an imported row: four provenance fields plus the item name when the
 * source carried one.
 *
 * The `key` is the load-bearing field. Bucket and sub-category are NOT unique — rows
 * 8/9 and 19-26 of every band repeat `住/家具設備` and `住/住家維修`, distinguished
 * only by the free-text detail column — so provenance recorded as taxonomy alone
 * cannot say which source cell a given expense came from. AC-2's join and AC-16's
 * carry-forward both hang off it.
 */
function buildNotes(row) {
  const parts = [row.bucket ?? "", row.sub_category ?? "", row.detail ?? ""];
  if (text(row.item_name) !== "") parts.push(text(row.item_name));
  parts.push(`key=${row.key}`);
  return parts.join(" | ");
}

function parseNotes(notes) {
  const parts = String(notes ?? "").split(" | ");
  const last = parts[parts.length - 1] ?? "";
  if (!last.startsWith("key=")) return null;
  if (parts.length < 4) return null;
  return {
    bucket: parts[0],
    sub_category: parts[1],
    detail: parts[2],
    item_name: parts.length >= 5 ? parts[3] : "",
    key: last.slice("key=".length),
  };
}

/**
 * `created_at` derived from the row's date with a time-of-day, per the `008`
 * precedent — 1,670 rows must not share one timestamp.
 *
 * Derived from the key by hash rather than from `Math.random()`, so a `--dry-run` and
 * the `--apply` that follows it print byte-identical rows. A random time would make
 * the dry-run's output unable to prove anything about the write.
 */
function createdAtFor(dateIso, key) {
  const h = crypto.createHash("sha256").update(key, "utf8").digest();
  const secondOfDay = (((h[0] << 16) | (h[1] << 8) | h[2]) >>> 0) % 86400;
  const hh = String(Math.floor(secondOfDay / 3600)).padStart(2, "0");
  const mm = String(Math.floor((secondOfDay % 3600) / 60)).padStart(2, "0");
  const ss = String(secondOfDay % 60).padStart(2, "0");
  return `${dateIso}T${hh}:${mm}:${ss}.000Z`;
}

/** Integer minor units, so AC-2's per-year sums compare EXACTLY and not as floats. */
function minorUnits(amount) {
  const n = Number(text(amount));
  if (!Number.isFinite(n)) {
    throw new ImportError(`Amount ${JSON.stringify(amount)} is not a number.`);
  }
  return Math.round(n * 100);
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

/**
 * Turns the approved sheet's rows into the rows to write, and accounts for every row
 * it is NOT writing.
 *
 * Nothing is dropped without being counted. A row excluded by status, by year, or by
 * the captain's own hand appears in the returned tallies, so the dry-run's numbers
 * add up to the sheet's row count rather than to whatever survived the filters.
 */
function planImport(sheetRows, { years = IN_SCOPE_YEARS } = {}) {
  const excluded = { undated: [], orphaned: [], excludeStatus: [], outOfScopeYear: [], otherStatus: [] };
  const included = [];

  for (const row of sheetRows) {
    const status = text(row.status).toLowerCase();
    if (status === "undated") { excluded.undated.push(row.key); continue; }
    if (status === "orphaned") { excluded.orphaned.push(row.key); continue; }
    if (status === "exclude") { excluded.excludeStatus.push(row.key); continue; }
    if (status !== "include") { excluded.otherStatus.push(`${row.key} (${status || "blank"})`); continue; }

    const date = text(row.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new ImportError(
        `${row.key}: status is "include" but the date is ${JSON.stringify(date)}, not YYYY-MM-DD. ` +
        `Set the date, or set status to "undated" or "exclude".`
      );
    }
    const year = Number(date.slice(0, 4));
    if (!years.includes(year)) {
      excluded.outOfScopeYear.push(`${row.key} (${date})`);
      continue;
    }
    included.push({ ...row, date, year });
  }

  // Sorted by key so the ids do not depend on the tab's row order.
  included.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const counters = new Map();
  const candidates = included.map((row) => {
    const next = (counters.get(row.year) ?? 0) + 1;
    counters.set(row.year, next);
    return {
      ...row,
      id: historicalId(row.year, next),
      notes: buildNotes(row),
      createdAt: createdAtFor(row.date, row.key),
      amountMinor: minorUnits(row.amount),
    };
  });

  const perYear = {};
  for (const c of candidates) {
    perYear[c.year] = perYear[c.year] ?? { rows: 0, totalMinor: 0 };
    perYear[c.year].rows++;
    perYear[c.year].totalMinor += c.amountMinor;
  }

  return { candidates, excluded, perYear, sheetRowCount: sheetRows.length };
}

// ---------------------------------------------------------------------------
// AC-9 — the pre-write category resolution
// ---------------------------------------------------------------------------

function foldName(name) {
  return String(name ?? "").trim().toLowerCase();
}

/**
 * Resolves every `name_en` the run is about to use against the TARGET's own live
 * Categories tab, before the first write.
 *
 * A pre-flight and not a rehearsal, because a staging rehearsal cannot prove
 * anything about production's tab: the two diverge from `cat_023`, where the same id
 * carries a different meaning (`Test Cat / Antkee / ScrollTest` on staging,
 * `Tenant / Insurance / Tax` on production). Resolving lazily per row instead would
 * write every row up to the first unresolved name and abort halfway — the
 * all-or-nothing property is what the pre-write check buys.
 */
function resolveCategoryNames(names, liveCategories) {
  const byName = new Map();
  const duplicates = [];
  for (const category of liveCategories) {
    const folded = foldName(category.name_en);
    if (folded === "") continue;
    if (byName.has(folded)) duplicates.push(category.name_en);
    else byName.set(folded, category.id);
  }

  const resolved = new Map();
  const unresolved = [];
  for (const name of names) {
    const id = byName.get(foldName(name));
    if (id === undefined) unresolved.push(name);
    else resolved.set(name, id);
  }

  return { resolved, unresolved, duplicates, available: liveCategories.map((c) => c.name_en) };
}

// ---------------------------------------------------------------------------
// Snapshot and diff (AC-1, AC-6)
// ---------------------------------------------------------------------------

function snapshotOf(grid, map) {
  const idAt = map.index.id;
  return {
    header: (grid[0] ?? []).map((c) => String(c ?? "")),
    rows: grid.slice(1).map((row) => ({
      id: String(row[idAt] ?? ""),
      cells: row.map((c) => String(c ?? "")),
    })),
  };
}

/**
 * The snapshot against the tab as it now stands, keyed on the row `id` and NEVER on a
 * row index.
 *
 * Rows are inserted at the top, which shifts every index below them, and two people
 * log expenses in this app while a migration runs. An index-keyed diff would report
 * every pre-existing row as modified.
 */
function diffSnapshot(before, after) {
  const beforeById = new Map(before.rows.map((r) => [r.id, r]));
  const afterById = new Map(after.rows.map((r) => [r.id, r]));

  const modified = [];
  const deleted = [];
  const added = [];

  for (const [id, row] of beforeById) {
    const now = afterById.get(id);
    if (!now) { deleted.push(id); continue; }
    if (JSON.stringify(row.cells) !== JSON.stringify(now.cells)) modified.push(id);
  }
  for (const id of afterById.keys()) if (!beforeById.has(id)) added.push(id);

  const isImported = (id) => id.startsWith(ID_PREFIX);
  return {
    modified,
    deleted,
    added,
    // AC-1's number: what the import did to rows that were already there.
    preExistingModified: modified.filter((id) => !isImported(id)),
    preExistingDeleted: deleted.filter((id) => !isImported(id)),
    importedAdded: added.filter(isImported),
    foreignAdded: added.filter((id) => !isImported(id)),
  };
}

// ---------------------------------------------------------------------------
// Live IO
// ---------------------------------------------------------------------------

async function readGrid(sheets, spreadsheetId, tab, lastColumn = "Z") {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tab}'!A:${lastColumn}`,
  });
  return res.data.values ?? [];
}

async function readCategories(sheets, spreadsheetId) {
  const grid = await readGrid(sheets, spreadsheetId, CATEGORIES_SPEC.tab);
  const map = buildColumnMap(grid, CATEGORIES_SPEC);
  return grid.slice(1)
    .map((row) => ({
      id: String(cell(row, map, "id") ?? ""),
      name_en: String(cell(row, map, "name_en") ?? ""),
    }))
    .filter((c) => c.id !== "");
}

async function readExpenses(sheets, spreadsheetId) {
  const grid = await readGrid(sheets, spreadsheetId, EXPENSES_SPEC.tab);
  const map = buildColumnMap(grid, EXPENSES_SPEC);
  return { grid, map };
}

async function sheetIdFor(sheets, spreadsheetId, tabName) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const found = meta.data.sheets?.find((s) => s.properties?.title === tabName);
  if (!found) throw new ImportError(`No tab named "${tabName}" in ${spreadsheetId}.`);
  return found.properties.sheetId;
}

/**
 * The insert and the write ride in ONE batchUpdate, the same all-or-nothing shape the
 * scheduler uses, so a rejected write never leaves a blank row behind.
 */
async function insertRowsAtTop(sheets, spreadsheetId, tabName, rows) {
  const sheetId = await sheetIdFor(sheets, spreadsheetId, tabName);
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

/**
 * Deletes exactly the rows whose id carries the historical prefix.
 *
 * Matching on the id prefix and not on the date year is what lets a row either user
 * added by hand between apply and undo survive — including one they added dated 2024.
 * Deleted bottom-up so an earlier deletion cannot shift a later index.
 */
async function deleteRowsByIdPrefix(sheets, spreadsheetId, prefix, log) {
  const { grid, map } = await readExpenses(sheets, spreadsheetId);
  const idAt = map.index.id;
  const targetRowIndexes = [];
  grid.forEach((row, i) => {
    if (i === 0) return;
    if (String(row[idAt] ?? "").startsWith(prefix)) targetRowIndexes.push(i);
  });

  const sheetId = await sheetIdFor(sheets, spreadsheetId, EXPENSES_SPEC.tab);
  // Contiguous runs, deleted from the bottom up.
  const runs = [];
  for (const i of targetRowIndexes) {
    const last = runs[runs.length - 1];
    if (last && last.end === i) last.end = i + 1;
    else runs.push({ start: i, end: i + 1 });
  }
  for (const run of runs.reverse()) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: run.start, endIndex: run.end },
        }}],
      },
    });
  }
  log(`[undo] removed ${targetRowIndexes.length} row(s) with the ${prefix} prefix in ${runs.length} batch(es)`);
  return { removed: targetRowIndexes.length };
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

/**
 * Reads the normalization tab and refuses unless the captain signed it off.
 *
 * Two independent refusals, both AC-14: the tab must be named explicitly on the
 * command line (so a re-generate cannot silently substitute a different one), and its
 * `B1` must hold `APPROVED`.
 */
async function readApprovedSheet(sheets, spreadsheetId, tabName, { requireApproval = true } = {}) {
  const grid = await readGrid(sheets, spreadsheetId, tabName, "P");
  if (grid.length === 0) throw new ImportError(`Tab "${tabName}" in ${spreadsheetId} is empty.`);
  const parsed = parseSheetGrid(grid);
  if (parsed.control.marker !== CONTROL_ROW_MARKER) {
    throw new ImportError(
      `Tab "${tabName}" does not look like a normalization sheet: A1 is ` +
      `${JSON.stringify(parsed.control.marker)}, expected ${JSON.stringify(CONTROL_ROW_MARKER)}.`
    );
  }
  if (requireApproval && parsed.control.approval !== APPROVAL_MARKER) {
    throw new ImportError(
      `Tab "${tabName}" is not approved: B1 is ${JSON.stringify(parsed.control.approval)}, ` +
      `expected ${JSON.stringify(APPROVAL_MARKER)}. Nothing was written and the Expenses row ` +
      `count is unchanged. The captain types ${APPROVAL_MARKER} into B1 when she has read the sheet.`
    );
  }
  return parsed;
}

function candidateRow(candidate, expensesMap, categoryId, actor = historicalActorName()) {
  return buildWriteRow([], expensesMap, {
    id: candidate.id,
    date: candidate.date,
    amount: String(candidate.amount),
    category_id: categoryId,
    paid_by: actor,
    created_by: actor,
    notes: candidate.notes,
    created_at: candidate.createdAt,
  });
}

/**
 * A digest over the rows AS READ, including the captain's hand corrections.
 *
 * AC-18 names the sheet's `C1` digest, and that digest is stamped by the extractor —
 * so it does NOT change when she edits a date or an amount by hand. A receipt bound
 * to `C1` alone would therefore still match after she corrected three rows, and
 * production would import a sheet whose content nobody had rehearsed. This second
 * digest closes that: the receipt carries both, and both must match.
 *
 * Recorded as a finding rather than smuggled in — see the stage report.
 */
function contentDigest(rows) {
  const canonical = rows
    .map((r) => [r.key, r.date, r.amount, r.category_name_en, r.status].map((v) => text(v)).join(""))
    .sort()
    .join("\n");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 32);
}

/**
 * The staging rehearsal's receipt (AC-18).
 *
 * It records the DIGEST of what it rehearsed, not merely that a rehearsal happened.
 * Checking only for a receipt's existence would let a stale one from an earlier
 * rehearsal satisfy the gate while production imported a sheet nobody had ever
 * rehearsed.
 */
function receiptFor({ target, fromSheet, digest, contentDigest: content, rowCount, undoResult, approvedAtRehearsal, at }) {
  return { entity: "061", target, fromSheet, digest, contentDigest: content, rowCount, undoResult, approvedAtRehearsal, at };
}

function assertRehearsed(receiptPath, { fromSheet, digest, contentDigest: content }) {
  if (!fs.existsSync(receiptPath)) {
    throw new ImportError(
      `No staging-rehearsal receipt at ${receiptPath}. A production import is only ` +
      `permitted after the SAME normalization sheet has been rehearsed on staging ` +
      `(snapshot, apply, verify, hand-add a row, undo, diff). Run --target staging --rehearse first.`
    );
  }
  const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
  if (receipt.target !== "staging") {
    throw new ImportError(`Receipt at ${receiptPath} records target "${receipt.target}", not a staging rehearsal.`);
  }
  if (receipt.fromSheet !== fromSheet) {
    throw new ImportError(
      `Receipt at ${receiptPath} rehearsed sheet ${JSON.stringify(receipt.fromSheet)}, but this run ` +
      `imports ${JSON.stringify(fromSheet)}.`
    );
  }
  if (receipt.digest !== digest) {
    throw new ImportError(
      `Receipt at ${receiptPath} rehearsed generation digest ${receipt.digest}, but ` +
      `${JSON.stringify(fromSheet)} now carries ${digest}. The sheet about to be imported is NOT the ` +
      `one that was rehearsed. Re-run the staging rehearsal against this generation.`
    );
  }
  if (content !== undefined && receipt.contentDigest !== content) {
    throw new ImportError(
      `Receipt at ${receiptPath} rehearsed content digest ${receipt.contentDigest}, but ` +
      `${JSON.stringify(fromSheet)}'s rows now hash to ${content}. The sheet's CONTENT changed after ` +
      `the rehearsal — a hand correction to a date, an amount, a category or a status. The generation ` +
      `digest cannot see that, which is why this second one exists. Re-run the staging rehearsal.`
    );
  }
  return receipt;
}

// ---------------------------------------------------------------------------
// Verify (AC-1, AC-2, AC-4c, AC-9, AC-10)
// ---------------------------------------------------------------------------

function verifyAgainst({ expenses, map, approved, plan, categories, snapshot, years = IN_SCOPE_YEARS }) {
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

  // AC-10 — provenance parses to four fields, the `key` among them.
  const provenance = imported.map((r) => ({ row: r, parsed: parseNotes(r.notes) }));
  const unparseable = provenance.filter((p) => p.parsed === null);
  if (unparseable.length > 0) {
    fail("AC-10 provenance", `${unparseable.length} imported row(s) have notes that do not yield four fields plus a key`);
  }

  // AC-2 — every app row traces to exactly one `include` sheet row, and back.
  const approvedByKey = new Map(approved.map((r) => [r.key, r]));
  const includeKeys = new Set(plan.candidates.map((c) => c.key));

  const seen = new Map();
  const orphanRows = [];
  for (const p of provenance) {
    if (!p.parsed) continue;
    if (!approvedByKey.has(p.parsed.key)) { orphanRows.push(p.row.id); continue; }
    seen.set(p.parsed.key, (seen.get(p.parsed.key) ?? 0) + 1);
  }
  const duplicated = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  const missing = [...includeKeys].filter((k) => !seen.has(k));

  if (orphanRows.length > 0) fail("AC-2 unmatched app row", `${orphanRows.length}: ${orphanRows.slice(0, 5).join(", ")}`);
  if (missing.length > 0) fail("AC-2 missing app row", `${missing.length}: ${missing.slice(0, 5).join(", ")}`);
  if (duplicated.length > 0) fail("AC-2 duplicated key", `${duplicated.length}: ${duplicated.slice(0, 5).join(", ")}`);

  // AC-2 — per-year sums EXACTLY equal, as integer minor units. Both sides are
  // artefacts we control, so any variance at all is a defect in our own arithmetic
  // and a tolerance would only hide one.
  const appByYear = {};
  for (const p of provenance) {
    if (!p.parsed) continue;
    const year = Number(p.row.date.slice(0, 4));
    appByYear[year] = (appByYear[year] ?? 0) + minorUnits(p.row.amount);
  }
  const yearSums = {};
  for (const year of years) {
    const expected = plan.perYear[year]?.totalMinor ?? 0;
    const actual = appByYear[year] ?? 0;
    yearSums[year] = { expectedMinor: expected, actualMinor: actual, equal: expected === actual };
    if (expected !== actual) {
      fail("AC-2 per-year sum", `${year}: sheet ${expected} minor units, app ${actual} — must be EQUAL, not within a tolerance`);
    }
  }

  // AC-4c — the third and last enforcement point. It holds against causes the first
  // two cannot see, such as a hand edit to a date in the normalization sheet.
  const outOfRange = imported.filter((r) => !years.some((y) => r.date.startsWith(`${y}-`)));
  if (outOfRange.length > 0) {
    fail("AC-4c out-of-range date", `${outOfRange.length}: ${outOfRange.slice(0, 5).map((r) => `${r.id}@${r.date}`).join(", ")}`);
  }

  // AC-9 — every imported category_id lives on the target's own tab, and no category
  // was created.
  const liveIds = new Set(categories.live.map((c) => c.id));
  const strayCategories = [...new Set(imported.map((r) => r.category_id))].filter((id) => !liveIds.has(id));
  if (strayCategories.length > 0) {
    fail("AC-9 unknown category_id", strayCategories.join(", "));
  }
  if (categories.countBefore !== null && categories.countBefore !== categories.live.length) {
    fail("AC-9 categories changed", `${categories.countBefore} rows before, ${categories.live.length} after — the import must create none`);
  }

  // AC-1 — nothing pre-existing was altered or deleted.
  let snapshotDiff = null;
  if (snapshot) {
    snapshotDiff = diffSnapshot(snapshot, snapshotOf(expenses, map));
    if (snapshotDiff.preExistingModified.length > 0) {
      fail("AC-1 modified", `${snapshotDiff.preExistingModified.length}: ${snapshotDiff.preExistingModified.slice(0, 5).join(", ")}`);
    }
    if (snapshotDiff.preExistingDeleted.length > 0) {
      fail("AC-1 deleted", `${snapshotDiff.preExistingDeleted.length}: ${snapshotDiff.preExistingDeleted.slice(0, 5).join(", ")}`);
    }
  }

  return {
    importedCount: imported.length,
    outOfRangeCount: outOfRange.length,
    unmatchedCount: orphanRows.length,
    missingCount: missing.length,
    duplicatedCount: duplicated.length,
    unparseableNotesCount: unparseable.length,
    yearSums,
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
    receipt: value("--receipt") ?? DEFAULT_RECEIPT,
    handAddId: value("--hand-add-id"),
  };
}

function defaultSnapshotPath(target, fromSheet) {
  const slug = String(fromSheet).replace(/[^A-Za-z0-9]+/g, "-");
  return path.join(REPORT_DIR, `061-snapshot-${target}-${slug}.json`);
}

async function run(argv, { log = console.log, env = process.env, sheetsFor = sheetsClientFor, now = () => new Date() } = {}) {
  const args = parseArgs(argv);
  if (args.phases.length !== 1) {
    throw new ImportError(`Pass exactly one of ${PHASES.map((p) => `--${p}`).join(", ")}; got ${args.phases.length}.`);
  }
  const phase = args.phases[0];

  // AC-12 — no target, no run. `load-local-env.js` resolves a SPREADSHEET_ID that
  // today is production's, so an inferred target writes live financial data.
  const targets = resolveTargets({ target: args.target, env });
  if (!args.fromSheet) {
    throw new ImportError(
      '--from-sheet "<tab name>" is required and has no default. The tab must be named ' +
      'explicitly so a re-generate cannot silently substitute one the captain never approved.'
    );
  }

  const scope = phase === "dry-run" || phase === "verify" ? READONLY_SCOPE : WRITE_SCOPE;
  const readSheets = await sheetsFor(targets.read, READONLY_SCOPE);
  const writeSheets = await sheetsFor(targets.write, scope);

  log(`[import] phase=${phase} target=${targets.target} (${targets.write.spreadsheetId}) writing as ${accountEmail(targets.write)}`);
  log(`[import] normalization sheet "${args.fromSheet}" read from ${targets.read.spreadsheetId} as ${accountEmail(targets.read)}`);

  const snapshotFile = args.snapshotFile ?? defaultSnapshotPath(targets.target, args.fromSheet);

  // --- snapshot -----------------------------------------------------------
  if (phase === "snapshot") {
    const { grid, map } = await readExpenses(writeSheets, targets.write.spreadsheetId);
    const categories = await readCategories(writeSheets, targets.write.spreadsheetId);
    const snapshot = { ...snapshotOf(grid, map), categoryCount: categories.length, at: now().toISOString() };
    fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 1), "utf8");
    log(`[snapshot] ${snapshot.rows.length} Expenses row(s), ${categories.length} Categories row(s) -> ${snapshotFile}`);
    return { phase, snapshot, snapshotFile };
  }

  // Every remaining phase needs the approved sheet. `--undo` is the one exception:
  // it must work even when the sheet is gone or unapproved, or an undo could be
  // blocked by the very state it exists to clean up.
  if (phase === "undo") {
    const result = await deleteRowsByIdPrefix(writeSheets, targets.write.spreadsheetId, ID_PREFIX, log);
    return { phase, ...result };
  }

  const approvedSheet = await readApprovedSheet(readSheets, targets.read.spreadsheetId, args.fromSheet, {
    // Two phases run before she has signed anything, by design:
    //   --dry-run  is how she sees what the import WOULD write before approving it;
    //   --rehearse is how the evidence she needs in order to approve gets produced.
    // Both are safe to allow: the dry-run writes nothing at all, and the rehearsal
    // writes only to STAGING and restores it byte-for-byte. AC-14's gate is on the
    // app of record, and `--target production --apply` still refuses without
    // `B1 == APPROVED` whatever any receipt says.
    requireApproval: phase !== "dry-run" && phase !== "rehearse",
  });
  if (phase === "rehearse" && approvedSheet.control.approval !== APPROVAL_MARKER) {
    log(
      `[rehearse] NOTE: B1 is ${JSON.stringify(approvedSheet.control.approval)}, not ${APPROVAL_MARKER}. ` +
      `Rehearsing an unapproved sheet is expected — the rehearsal is what she reads before approving. ` +
      `The receipt records this, and a production import still refuses until B1 says ${APPROVAL_MARKER}.`
    );
  }
  const plan = planImport(approvedSheet.rows);

  log(
    `[plan] ${plan.sheetRowCount} sheet row(s): ${plan.candidates.length} to write, ` +
    `excluded ${plan.excluded.undated.length} undated / ${plan.excluded.orphaned.length} orphaned / ` +
    `${plan.excluded.excludeStatus.length} status=exclude / ${plan.excluded.outOfScopeYear.length} out-of-scope year / ` +
    `${plan.excluded.otherStatus.length} unrecognised status`
  );
  for (const [year, stats] of Object.entries(plan.perYear)) {
    log(`[plan] ${year}: ${stats.rows} rows, ${stats.totalMinor / 100} total`);
  }

  const liveCategories = await readCategories(writeSheets, targets.write.spreadsheetId);
  const distinctNames = [...new Set(plan.candidates.map((c) => c.category_name_en))];
  const resolution = resolveCategoryNames(distinctNames, liveCategories);

  if (resolution.duplicates.length > 0) {
    throw new ImportError(
      `${targets.target}'s Categories tab holds duplicate name_en values ` +
      `(${resolution.duplicates.join(", ")}). A name that resolves to two ids cannot be resolved at all.`
    );
  }
  if (resolution.unresolved.length > 0) {
    throw new ImportError(
      `${resolution.unresolved.length} category name(s) do not exist on ${targets.target}'s Categories tab: ` +
      `${resolution.unresolved.join(", ")}.\nAvailable there: ${resolution.available.join(", ")}.\n` +
      `Nothing was written and the Expenses row count is unchanged.`
    );
  }
  log(`[categories] all ${distinctNames.length} name(s) resolve on ${targets.target}: ` +
    distinctNames.map((n) => `${n}=${resolution.resolved.get(n)}`).join(", "));

  const { grid: expensesGrid, map: expensesMap } = await readExpenses(writeSheets, targets.write.spreadsheetId);
  const existingIds = new Set(expensesGrid.slice(1).map((r) => String(r[expensesMap.index.id] ?? "")));

  // Said out loud, because it is the one field with no source: 1,670 rows are about
  // to carry this payer, and it must be the DISPLAY NAME the app stores, never the id.
  const actor = historicalActorName();
  log(`[actor] paid_by = created_by = ${JSON.stringify(actor)} (${HISTORICAL_ACTOR_ID}'s display name, per the captain's ruling)`);

  const rows = plan.candidates.map((c) => ({
    candidate: c,
    cells: candidateRow(c, expensesMap, resolution.resolved.get(c.category_name_en), actor),
  }));

  // --- dry-run ------------------------------------------------------------
  if (phase === "dry-run") {
    const pending = rows.filter((r) => !existingIds.has(r.candidate.id));
    log(`[dry-run] ${pending.length} row(s) would be written, ${rows.length - pending.length} skipped as already present.`);
    log(`[dry-run] nothing was written. Approval marker in B1: ${JSON.stringify(approvedSheet.control.approval)}`);
    return { phase, plan, resolution, wouldWrite: pending.length, skipped: rows.length - pending.length };
  }

  // --- verify -------------------------------------------------------------
  if (phase === "verify") {
    const snapshot = fs.existsSync(snapshotFile) ? JSON.parse(fs.readFileSync(snapshotFile, "utf8")) : null;
    if (!snapshot) log(`[verify] no snapshot at ${snapshotFile} — AC-1's before/after diff is SKIPPED, not passed`);
    const result = verifyAgainst({
      expenses: expensesGrid,
      map: expensesMap,
      approved: approvedSheet.rows,
      plan,
      categories: { live: liveCategories, countBefore: snapshot?.categoryCount ?? null },
      snapshot,
    });
    for (const f of result.findings) log(`[verify] FAIL ${f.label}: ${f.detail}`);
    log(
      `[verify] imported=${result.importedCount} unmatched=${result.unmatchedCount} missing=${result.missingCount} ` +
      `duplicated=${result.duplicatedCount} out-of-range-dates=${result.outOfRangeCount} ` +
      `notes-unparseable=${result.unparseableNotesCount}`
    );
    for (const [year, s] of Object.entries(result.yearSums)) {
      log(`[verify] ${year}: sheet ${s.expectedMinor / 100} vs app ${s.actualMinor / 100} — ${s.equal ? "EQUAL" : "DIFFERENT"}`);
    }
    if (result.snapshotDiff) {
      log(
        `[verify] AC-1 against snapshot: ${result.snapshotDiff.preExistingModified.length} modified, ` +
        `${result.snapshotDiff.preExistingDeleted.length} deleted among pre-existing rows; ` +
        `${result.snapshotDiff.importedAdded.length} imported rows added, ` +
        `${result.snapshotDiff.foreignAdded.length} other rows added`
      );
    }
    log(`[verify] ${result.passed ? "PASSED" : "FAILED"}`);
    if (!result.passed) throw new ImportError(`Verification failed with ${result.findings.length} finding(s).`);
    return { phase, result };
  }

  // --- apply --------------------------------------------------------------
  if (phase === "apply") {
    // AC-18 — no production write before a completed staging rehearsal OF THE SAME
    // generation. The digest comparison is the load-bearing half: existence alone
    // would let a stale receipt wave through a sheet nobody rehearsed.
    if (targets.target === "production") {
      const receipt = assertRehearsed(args.receipt, {
        fromSheet: args.fromSheet,
        digest: approvedSheet.control.digest,
        contentDigest: contentDigest(approvedSheet.rows),
      });
      log(`[apply] staging rehearsal receipt accepted: ${receipt.rowCount} rows, digest ${receipt.digest}`);
    }

    const pending = rows.filter((r) => !existingIds.has(r.candidate.id));
    const skipped = rows.length - pending.length;
    log(`[apply] ${pending.length} row(s) to write, ${skipped} already present`);

    const writtenIds = [];
    for (let i = 0; i < pending.length; i += WRITE_BATCH_SIZE) {
      const batch = pending.slice(i, i + WRITE_BATCH_SIZE);
      try {
        await insertRowsAtTop(writeSheets, targets.write.spreadsheetId, EXPENSES_SPEC.tab, batch.map((r) => r.cells));
      } catch (err) {
        throw new PartialWriteError(
          `Write failed after ${writtenIds.length} row(s): ${err.message ?? err}`,
          writtenIds
        );
      }
      for (const r of batch) writtenIds.push(r.candidate.id);
      log(`[apply] wrote ${writtenIds.length}/${pending.length}`);
    }
    log(`[apply] created=${writtenIds.length} skipped=${skipped}`);
    return { phase, created: writtenIds.length, skipped, writtenIds };
  }

  // --- rehearse -----------------------------------------------------------
  // snapshot -> apply -> verify -> hand-add a row -> undo -> diff. Staging only:
  // the whole point is to exercise apply AND undo against data nobody depends on.
  if (phase === "rehearse") {
    if (targets.target !== "staging") {
      throw new ImportError(
        `--rehearse runs against staging only, got "${targets.target}". A rehearsal on ` +
        `production is not a rehearsal.`
      );
    }
    return rehearse({
      args, targets, readSheets, writeSheets, approvedSheet, plan, rows, snapshotFile, log, now,
      liveCategories, resolution,
    });
  }

  throw new ImportError(`Unhandled phase ${phase}.`);
}

async function rehearse({ args, targets, writeSheets, approvedSheet, plan, rows, snapshotFile, log, now, resolution }) {
  const spreadsheetId = targets.write.spreadsheetId;
  const steps = [];
  const record = (step, detail) => { steps.push({ step, detail }); log(`[rehearse] ${step}: ${detail}`); };

  // 1. snapshot
  const before = await readExpenses(writeSheets, spreadsheetId);
  const categoriesBefore = await readCategories(writeSheets, spreadsheetId);
  const snapshot = {
    ...snapshotOf(before.grid, before.map),
    categoryCount: categoriesBefore.length,
    at: now().toISOString(),
  };
  fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 1), "utf8");
  record("snapshot", `${snapshot.rows.length} Expenses rows, ${categoriesBefore.length} Categories rows -> ${snapshotFile}`);

  // 2. apply
  const pending = rows.filter((r) => !snapshot.rows.some((s) => s.id === r.candidate.id));
  const writtenIds = [];
  for (let i = 0; i < pending.length; i += WRITE_BATCH_SIZE) {
    const batch = pending.slice(i, i + WRITE_BATCH_SIZE);
    await insertRowsAtTop(writeSheets, spreadsheetId, EXPENSES_SPEC.tab, batch.map((r) => r.cells));
    for (const r of batch) writtenIds.push(r.candidate.id);
  }
  record("apply", `${writtenIds.length} row(s) written`);

  // 3. verify
  const applied = await readExpenses(writeSheets, spreadsheetId);
  const categoriesAfter = await readCategories(writeSheets, spreadsheetId);
  const verification = verifyAgainst({
    expenses: applied.grid,
    map: applied.map,
    approved: approvedSheet.rows,
    plan,
    categories: { live: categoriesAfter, countBefore: categoriesBefore.length },
    snapshot,
  });
  for (const f of verification.findings) log(`[rehearse] verify FAIL ${f.label}: ${f.detail}`);
  if (!verification.passed) {
    throw new ImportError(
      `Rehearsal verification failed with ${verification.findings.length} finding(s). ` +
      `The ${writtenIds.length} rows are still on staging — run --undo to remove them.`
    );
  }
  record("verify", `PASSED — ${verification.importedCount} imported rows trace to the sheet, per-year sums exact`);

  // 4. hand-add a row, the way one of the two users would while the migration runs
  const handAddId = args.handAddId ?? `manual-rehearsal-${now().getTime()}`;
  const handAddRow = buildWriteRow([], applied.map, {
    id: handAddId,
    // Deliberately dated inside an imported year: an undo that matched on the date
    // year rather than the id prefix would delete this row too.
    date: "2024-06-15",
    amount: "1",
    category_id: [...resolution.resolved.values()][0],
    paid_by: "rehearsal",
    created_by: "rehearsal",
    notes: "entity 061 rehearsal — a row added by hand between apply and undo",
    created_at: now().toISOString(),
  });
  await insertRowsAtTop(writeSheets, spreadsheetId, EXPENSES_SPEC.tab, [handAddRow]);
  record("hand-add", `${handAddId} dated 2024-06-15, inside an imported year`);

  // 5. undo
  const undoResult = await deleteRowsByIdPrefix(writeSheets, spreadsheetId, ID_PREFIX, log);
  record("undo", `${undoResult.removed} row(s) removed`);

  // 6. diff against the snapshot
  const after = await readExpenses(writeSheets, spreadsheetId);
  const diff = diffSnapshot(snapshot, snapshotOf(after.grid, after.map));
  const problems = [];
  if (diff.preExistingModified.length > 0) problems.push(`${diff.preExistingModified.length} pre-existing row(s) modified`);
  if (diff.preExistingDeleted.length > 0) problems.push(`${diff.preExistingDeleted.length} pre-existing row(s) deleted`);
  if (diff.importedAdded.length > 0) problems.push(`${diff.importedAdded.length} ${ID_PREFIX} row(s) survived the undo`);
  const survivors = diff.foreignAdded;
  if (!survivors.includes(handAddId)) {
    problems.push(`the hand-added row ${handAddId} did NOT survive the undo — undo is matching on something other than the id prefix`);
  }
  if (problems.length > 0) {
    throw new ImportError(`Rehearsal diff failed: ${problems.join("; ")}.`);
  }
  record("diff", `clean — 0 pre-existing rows touched, 0 ${ID_PREFIX} rows left, hand-added row survived`);

  // Clean up the rehearsal's own artefact so staging is left as it was found.
  await deleteRowsByIdPrefix(writeSheets, spreadsheetId, handAddId, log);
  const finalGrid = await readExpenses(writeSheets, spreadsheetId);
  const finalDiff = diffSnapshot(snapshot, snapshotOf(finalGrid.grid, finalGrid.map));
  if (finalDiff.added.length > 0 || finalDiff.modified.length > 0 || finalDiff.deleted.length > 0) {
    throw new ImportError(
      `Staging was not restored: ${finalDiff.added.length} added, ${finalDiff.modified.length} modified, ` +
      `${finalDiff.deleted.length} deleted against the snapshot.`
    );
  }
  record("restore", "staging is byte-identical to the snapshot");

  const receipt = receiptFor({
    target: "staging",
    fromSheet: args.fromSheet,
    digest: approvedSheet.control.digest,
    contentDigest: contentDigest(approvedSheet.rows),
    rowCount: writtenIds.length,
    undoResult,
    approvedAtRehearsal: approvedSheet.control.approval === APPROVAL_MARKER,
    at: now().toISOString(),
  });
  fs.mkdirSync(path.dirname(args.receipt), { recursive: true });
  fs.writeFileSync(args.receipt, JSON.stringify(receipt, null, 1), "utf8");
  record("receipt", `${args.receipt} (digest ${receipt.digest})`);

  return { phase: "rehearse", steps, receipt, verification, writtenIds, handAddId };
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
  HISTORICAL_ACTOR_ID,
  LEGACY_USER_NAMES,
  historicalActorName,
  WRITE_BATCH_SIZE,
  DEFAULT_RECEIPT,
  PHASES,
  ImportError,
  PartialWriteError,
  historicalId,
  buildNotes,
  parseNotes,
  createdAtFor,
  minorUnits,
  planImport,
  foldName,
  resolveCategoryNames,
  snapshotOf,
  diffSnapshot,
  readApprovedSheet,
  readCategories,
  readExpenses,
  candidateRow,
  receiptFor,
  contentDigest,
  assertRehearsed,
  verifyAgainst,
  deleteRowsByIdPrefix,
  insertRowsAtTop,
  parseArgs,
  defaultSnapshotPath,
  run,
};
