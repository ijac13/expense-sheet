/**
 * Entity 061 / D6 — bring staging's Categories tab into line with production, so a
 * staging rehearsal can resolve every category name the captain might use.
 *
 * ADDITIVE ONLY, and reversible. The captain chose **R1** at the spec gate: add the
 * production names staging is missing under NEW ids, and leave staging's own entries
 * (`Test Cat`, `Antkee`, `ScrollTest`) exactly where they are. She explicitly
 * declined R2, the overwrite of `cat_023`-`cat_025` — somebody may be testing
 * against those, and an overwrite would silently change the meaning of any staging
 * expense already filed under them rather than breaking visibly.
 *
 * Production is the REFERENCE, never a target. This script reads production's
 * Categories tab with a read-only scope and writes only to staging. There is no flag
 * that makes production the write target.
 *
 * Why this is a separate script from the importer: it writes CATEGORY data, which the
 * import never does. Keeping it out of the importer keeps AC-9's "no category was
 * created" assertion meaningful.
 *
 * Usage:
 *   node -r ./scripts/load-local-env.js scripts/sync-staging-categories.js --dry-run
 *   node -r ./scripts/load-local-env.js scripts/sync-staging-categories.js --apply
 *   node -r ./scripts/load-local-env.js scripts/sync-staging-categories.js --undo
 *
 * `--apply` records the ids it added in a receipt; `--undo` removes exactly those
 * and nothing else.
 */

const fs = require("fs");
const path = require("path");

const { buildColumnMap, buildWriteRow, cell } = require("../lib/sheetSchema");
const { CATEGORIES_SPEC } = require("../lib/sheetSchema");

const {
  READONLY_SCOPE,
  WRITE_SCOPE,
  resolveTargets,
  sheetsClientFor,
  accountEmail,
} = require("./migration-env");
const { REPORT_DIR } = require("./extract-historical-expenses");

const DEFAULT_RECEIPT = path.join(REPORT_DIR, "061-staging-categories-receipt.json");

class SyncError extends Error {}

function foldName(name) {
  return String(name ?? "").trim().toLowerCase();
}

async function readCategoryGrid(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${CATEGORIES_SPEC.tab}'!A:Z`,
  });
  const grid = res.data.values ?? [];
  const map = buildColumnMap(grid, CATEGORIES_SPEC);
  const rows = grid.slice(1).map((row, i) => ({
    rowIndex: i + 1,
    cells: row.map((c) => String(c ?? "")),
    id: String(cell(row, map, "id") ?? ""),
    name_en: String(cell(row, map, "name_en") ?? ""),
    name_zh: String(cell(row, map, "name_zh") ?? ""),
    icon: String(cell(row, map, "icon") ?? ""),
    sort_order: String(cell(row, map, "sort_order") ?? ""),
    is_active: String(cell(row, map, "is_active") ?? ""),
  })).filter((r) => r.id !== "");
  return { grid, map, rows };
}

/** The next free `cat_NNN`, counting from the highest already present on staging. */
function nextCategoryIds(stagingRows, count) {
  let highest = 0;
  for (const row of stagingRows) {
    const m = /^cat_(\d+)$/.exec(row.id);
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  const out = [];
  for (let i = 1; i <= count; i++) out.push(`cat_${String(highest + i).padStart(3, "0")}`);
  return out;
}

/**
 * What staging is missing, by NAME.
 *
 * Matching on `name_en` and not on id is the whole design: the two tabs hold the same
 * ids with different meanings from `cat_023` on, so an id-based comparison reports
 * them as present and identical when they are neither.
 */
function planSync(productionRows, stagingRows) {
  const stagingNames = new Set(stagingRows.map((r) => foldName(r.name_en)));
  const missing = productionRows.filter((r) => foldName(r.name_en) !== "" && !stagingNames.has(foldName(r.name_en)));
  const ids = nextCategoryIds(stagingRows, missing.length);
  return {
    additions: missing.map((row, i) => ({
      newId: ids[i],
      productionId: row.id,
      name_en: row.name_en,
      name_zh: row.name_zh,
      icon: row.icon,
      sort_order: row.sort_order,
      is_active: row.is_active || "true",
    })),
    // Recorded so the assertions below can prove nothing was touched.
    preExisting: stagingRows.map((r) => ({ id: r.id, name_en: r.name_en })),
  };
}

/**
 * AC-20's assertions, run after the write against freshly-read tabs.
 *
 * The first is the one that matters: every pre-existing staging id still carries its
 * ORIGINAL `name_en`. That is what fails if this is ever implemented as the
 * destructive reading of "make staging the same".
 */
function assertAdditive({ preExisting, stagingAfter, productionBefore, productionAfter, addedIds }) {
  const problems = [];
  const afterById = new Map(stagingAfter.map((r) => [r.id, r]));

  for (const original of preExisting) {
    const now = afterById.get(original.id);
    if (!now) { problems.push(`staging ${original.id} (${original.name_en}) was DELETED`); continue; }
    if (now.name_en !== original.name_en) {
      problems.push(`staging ${original.id} was ${JSON.stringify(original.name_en)}, is now ${JSON.stringify(now.name_en)}`);
    }
  }

  const stagingNames = new Set(stagingAfter.map((r) => foldName(r.name_en)));
  for (const row of productionAfter) {
    if (foldName(row.name_en) === "") continue;
    if (!stagingNames.has(foldName(row.name_en))) {
      problems.push(`production name ${JSON.stringify(row.name_en)} still does not resolve on staging`);
    }
  }

  const before = JSON.stringify(productionBefore.map((r) => r.cells));
  const after = JSON.stringify(productionAfter.map((r) => r.cells));
  if (before !== after) problems.push("production's Categories tab CHANGED — it is the reference, never a target");

  for (const id of addedIds) {
    if (!afterById.has(id)) problems.push(`the id this run claims to have added, ${id}, is not on staging`);
  }

  return problems;
}

async function appendCategoryRows(sheets, spreadsheetId, map, additions) {
  const values = additions.map((a) => buildWriteRow([], map, {
    id: a.newId,
    name_en: a.name_en,
    name_zh: a.name_zh,
    icon: a.icon,
    sort_order: a.sort_order,
    is_active: a.is_active,
  }));
  for (const row of values) {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${CATEGORIES_SPEC.tab}'!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [row] },
    });
  }
  return values.length;
}

async function deleteCategoryRowsByIds(sheets, spreadsheetId, ids, log) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const sheetId = meta.data.sheets?.find((s) => s.properties?.title === CATEGORIES_SPEC.tab)?.properties?.sheetId;
  if (sheetId === undefined) throw new SyncError(`No ${CATEGORIES_SPEC.tab} tab in ${spreadsheetId}.`);

  const { grid, map } = await readCategoryGrid(sheets, spreadsheetId);
  const idAt = map.index.id;
  const wanted = new Set(ids);
  const indexes = [];
  grid.forEach((row, i) => {
    if (i === 0) return;
    if (wanted.has(String(row[idAt] ?? ""))) indexes.push(i);
  });

  // Bottom-up, so an earlier deletion cannot shift a later index.
  for (const i of indexes.reverse()) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } } }],
      },
    });
  }
  log(`[undo] removed ${indexes.length} of ${ids.length} recorded id(s) from staging's ${CATEGORIES_SPEC.tab} tab`);
  return { removed: indexes.length };
}

function parseArgs(argv) {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i === -1 ? null : argv[i + 1] ?? null;
  };
  return {
    dryRun: argv.includes("--dry-run"),
    apply: argv.includes("--apply"),
    undo: argv.includes("--undo"),
    receipt: value("--receipt") ?? DEFAULT_RECEIPT,
  };
}

async function run(argv, { log = console.log, env = process.env, sheetsFor = sheetsClientFor, now = () => new Date() } = {}) {
  const args = parseArgs(argv);
  const chosen = [args.dryRun, args.apply, args.undo].filter(Boolean);
  if (chosen.length !== 1) throw new SyncError("Pass exactly one of --dry-run, --apply, --undo.");

  // Both pairs, as always. The write pair here is ALWAYS staging, whatever else is
  // configured: there is no --target on this script by design.
  const targets = resolveTargets({ target: "staging", env });
  const productionPair = { ...targets.read, name: "production", spreadsheetId: env.SPREADSHEET_ID_PRODUCTION, credentialsJson: env.GOOGLE_SERVICE_ACCOUNT_KEY_PRODUCTION };
  if (!productionPair.spreadsheetId || !productionPair.credentialsJson) {
    throw new SyncError(
      "Production's Categories tab is the reference for this reconciliation, so " +
      "SPREADSHEET_ID_PRODUCTION and GOOGLE_SERVICE_ACCOUNT_KEY_PRODUCTION are required — " +
      "read-only. Run through `node -r ./scripts/load-local-env.js`."
    );
  }

  // Read-only scope on production is the guarantee, not the comment: a token minted
  // for spreadsheets.readonly cannot write even if this code were wrong.
  const productionSheets = await sheetsFor(productionPair, READONLY_SCOPE);
  const stagingSheets = await sheetsFor(targets.write, args.dryRun ? READONLY_SCOPE : WRITE_SCOPE);

  log(`[sync] production ${productionPair.spreadsheetId} as ${accountEmail(productionPair)} (READ-ONLY, never written)`);
  log(`[sync] staging ${targets.write.spreadsheetId} as ${accountEmail(targets.write)}`);

  if (args.undo) {
    if (!fs.existsSync(args.receipt)) {
      throw new SyncError(`No receipt at ${args.receipt} — nothing recorded as added, so there is nothing to undo.`);
    }
    const receipt = JSON.parse(fs.readFileSync(args.receipt, "utf8"));
    const result = await deleteCategoryRowsByIds(stagingSheets, targets.write.spreadsheetId, receipt.addedIds, log);
    const after = await readCategoryGrid(stagingSheets, targets.write.spreadsheetId);
    const leftBehind = receipt.addedIds.filter((id) => after.rows.some((r) => r.id === id));
    if (leftBehind.length > 0) throw new SyncError(`--undo left ${leftBehind.join(", ")} behind.`);
    const restored = receipt.preExisting.every((p) => after.rows.some((r) => r.id === p.id && r.name_en === p.name_en));
    log(`[undo] pre-run staging entries all present with their original names: ${restored}`);
    if (!restored) throw new SyncError("--undo did not restore the tab to its recorded pre-run state.");
    return { phase: "undo", ...result };
  }

  const productionBefore = await readCategoryGrid(productionSheets, productionPair.spreadsheetId);
  const stagingBefore = await readCategoryGrid(stagingSheets, targets.write.spreadsheetId);
  const plan = planSync(productionBefore.rows, stagingBefore.rows);

  log(`[sync] production ${productionBefore.rows.length} categories, staging ${stagingBefore.rows.length}`);
  if (plan.additions.length === 0) {
    log("[sync] every production name_en already resolves on staging — nothing to add.");
    return { phase: args.apply ? "apply" : "dry-run", plan, added: 0 };
  }
  for (const a of plan.additions) {
    log(`[sync] + ${a.newId} ${JSON.stringify(a.name_en)} (production ${a.productionId}) — a NEW id; nothing is overwritten`);
  }
  log(`[sync] staging entries left untouched: ${plan.preExisting.map((p) => `${p.id}=${p.name_en}`).join(", ")}`);

  if (args.dryRun) {
    log("[dry-run] nothing written.");
    return { phase: "dry-run", plan, added: 0 };
  }

  const added = await appendCategoryRows(stagingSheets, targets.write.spreadsheetId, stagingBefore.map, plan.additions);
  const addedIds = plan.additions.map((a) => a.newId);

  const stagingAfter = await readCategoryGrid(stagingSheets, targets.write.spreadsheetId);
  const productionAfter = await readCategoryGrid(productionSheets, productionPair.spreadsheetId);
  const problems = assertAdditive({
    preExisting: plan.preExisting,
    stagingAfter: stagingAfter.rows,
    productionBefore: productionBefore.rows,
    productionAfter: productionAfter.rows,
    addedIds,
  });
  if (problems.length > 0) throw new SyncError(`AC-20 assertions failed:\n  ${problems.join("\n  ")}`);

  const receipt = {
    entity: "061",
    at: now().toISOString(),
    spreadsheetId: targets.write.spreadsheetId,
    addedIds,
    additions: plan.additions,
    preExisting: plan.preExisting,
  };
  fs.mkdirSync(path.dirname(args.receipt), { recursive: true });
  fs.writeFileSync(args.receipt, JSON.stringify(receipt, null, 1), "utf8");

  log(`[sync] added ${added} category row(s): ${addedIds.join(", ")}`);
  log(`[sync] AC-20 assertions passed: every pre-existing staging id keeps its original name_en, every production name_en resolves, production byte-identical`);
  log(`[sync] receipt ${args.receipt} — --undo removes exactly these ids`);
  return { phase: "apply", plan, added, addedIds, receipt };
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
  DEFAULT_RECEIPT,
  SyncError,
  foldName,
  readCategoryGrid,
  nextCategoryIds,
  planSync,
  assertAdditive,
  appendCategoryRows,
  deleteCategoryRowsByIds,
  parseArgs,
  run,
};
