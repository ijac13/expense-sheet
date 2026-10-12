/**
 * One-time setup for Income & business earnings, run once per sheet:
 *
 *   1. Adds the `kind` and `business` headers to Categories if they are missing
 *      (past the widest occupied row, the same rule as ensureColumns).
 *   2. Sets the existing Tenant (房客支出) category to fill in `rent`, so every past
 *      Tenant expense counts toward Rent with no expense row touched.
 *   3. Appends the new categories, in the order the Earnings page shows them:
 *        expense  Rent paid      房租支出  🏠  fills in rent
 *        income   Salary         薪水      💼
 *        income   Uber           Uber      🚗  business uber
 *        income   Rent received  房租收入  🏠  business rent
 *        income   Random         雜項收入  ✨
 *
 * Idempotent by name_en: a category that already exists is left alone, so a
 * second --apply writes nothing. Nothing is ever deleted.
 *
 * Usage (from functions/, so the preload finds the env files):
 *   node -r ./scripts/load-local-env.js scripts/apply-income-categories.js --target staging --dry-run
 *   node -r ./scripts/load-local-env.js scripts/apply-income-categories.js --target staging --apply
 */

const { buildColumnMap, buildWriteRow, cell, columnLetter, CATEGORIES_SPEC } = require("../lib/sheetSchema");
const { READONLY_SCOPE, WRITE_SCOPE, resolveTargets, sheetsClientFor, accountEmail } = require("./migration-env");

const TAB = CATEGORIES_SPEC.tab;
const TENANT_NAME = "Tenant";

const NEW_CATEGORIES = [
  { name_en: "Rent paid", name_zh: "房租支出", icon: "🏠", kind: "expense", business: "rent", gov_category: "housing_utilities" },
  { name_en: "Salary", name_zh: "薪水", icon: "💼", kind: "income", business: "" },
  { name_en: "Uber", name_zh: "Uber", icon: "🚗", kind: "income", business: "uber" },
  { name_en: "Rent received", name_zh: "房租收入", icon: "🏠", kind: "income", business: "rent" },
  { name_en: "Random", name_zh: "雜項收入", icon: "✨", kind: "income", business: "" },
];

class SetupError extends Error {}

/**
 * Pure: what --apply would do to this grid. `rows` is the whole tab, header first.
 * Returns the headers to create (with their column index), the Tenant update, and
 * the rows to append.
 */
function planIncomeCategories(rows) {
  const map = buildColumnMap(rows, CATEGORIES_SPEC);
  const data = rows.slice(1);
  const nameOf = (r) => String(cell(r, map, "name_en") ?? "").trim().toLowerCase();

  const missing = ["kind", "business"].filter((f) => map.index[f] === undefined);
  const first = rows.reduce((widest, r) => Math.max(widest, r.length), map.width);
  const newHeaders = missing.map((field, i) => ({ field, index: first + i }));
  const index = { ...map.index };
  for (const h of newHeaders) index[h.field] = h.index;
  const writeMap = { tab: map.tab, index, width: Math.max(map.width, first + newHeaders.length) };

  const tenantIndex = data.findIndex((r) => nameOf(r) === TENANT_NAME.toLowerCase());
  const tenant = tenantIndex === -1
    ? null
    : { rowNumber: tenantIndex + 2, current: String(cell(data[tenantIndex], map, "business") ?? "") };

  const maxNum = data.reduce((m, r) => {
    const match = String(cell(r, map, "id") ?? "").match(/^cat_(\d+)$/);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  const maxOrder = data.reduce((m, r) => Math.max(m, Number(cell(r, map, "sort_order") ?? 0) || 0), 0);

  const existing = new Set(data.map(nameOf));
  const additions = NEW_CATEGORIES
    .filter((c) => !existing.has(c.name_en.toLowerCase()))
    .map((c, i) => ({
      id: `cat_${String(maxNum + i + 1).padStart(3, "0")}`,
      name_en: c.name_en,
      name_zh: c.name_zh,
      icon: c.icon,
      sort_order: String(maxOrder + i + 1),
      is_active: "true",
      kind: c.kind,
      business: c.business,
      ...(c.gov_category && map.index.gov_category !== undefined && { gov_category: c.gov_category }),
    }));

  return { map, writeMap, newHeaders, tenant, additions };
}

function parseArgs(argv) {
  const i = argv.indexOf("--target");
  return {
    target: i === -1 ? null : argv[i + 1] ?? null,
    dryRun: argv.includes("--dry-run"),
    apply: argv.includes("--apply"),
  };
}

async function readGrid(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${TAB}!A:Z` });
  return res.data.values ?? [];
}

async function run(argv, { log = console.log, env = process.env, sheetsFor = sheetsClientFor } = {}) {
  const args = parseArgs(argv);
  if ([args.dryRun, args.apply].filter(Boolean).length !== 1) throw new SetupError("Pass exactly one of --dry-run, --apply.");
  const { write: pair } = resolveTargets({ target: args.target, env });
  const sheets = await sheetsFor(pair, args.dryRun ? READONLY_SCOPE : WRITE_SCOPE);
  log(`[income-setup] ${args.target} ${pair.spreadsheetId} as ${accountEmail(pair)}`);

  const before = await readGrid(sheets, pair.spreadsheetId);
  const plan = planIncomeCategories(before);

  for (const h of plan.newHeaders) log(`[income-setup] + header "${h.field}" in column ${columnLetter(h.index)}`);
  if (!plan.tenant) log(`[income-setup] ! no "${TENANT_NAME}" category found — its past rows will need a Fills in default set in Settings`);
  else if (plan.tenant.current === "rent") log(`[income-setup] = Tenant already fills in rent (row ${plan.tenant.rowNumber})`);
  else log(`[income-setup] ~ Tenant (row ${plan.tenant.rowNumber}) business "${plan.tenant.current}" -> "rent"`);
  for (const a of plan.additions) log(`[income-setup] + ${a.id} ${a.name_en} / ${a.name_zh} (${a.kind}${a.business ? `, ${a.business}` : ""}) sort ${a.sort_order}`);
  const skipped = NEW_CATEGORIES.filter((c) => !plan.additions.some((a) => a.name_en === c.name_en));
  for (const c of skipped) log(`[income-setup] = ${c.name_en} already exists, left alone`);

  if (args.dryRun) {
    log("[dry-run] nothing written.");
    return { phase: "dry-run", plan };
  }

  if (plan.newHeaders.length > 0) {
    const from = plan.newHeaders[0].index;
    const to = plan.newHeaders[plan.newHeaders.length - 1].index;
    await sheets.spreadsheets.values.update({
      spreadsheetId: pair.spreadsheetId,
      range: `${TAB}!${columnLetter(from)}1:${columnLetter(to)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [plan.newHeaders.map((h) => h.field)] },
    });
  }
  if (plan.tenant && plan.tenant.current !== "rent") {
    const col = columnLetter(plan.writeMap.index.business);
    await sheets.spreadsheets.values.update({
      spreadsheetId: pair.spreadsheetId,
      range: `${TAB}!${col}${plan.tenant.rowNumber}:${col}${plan.tenant.rowNumber}`,
      valueInputOption: "RAW",
      requestBody: { values: [["rent"]] },
    });
  }
  if (plan.additions.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: pair.spreadsheetId,
      range: `${TAB}!A:Z`,
      valueInputOption: "RAW",
      requestBody: { values: plan.additions.map((a) => buildWriteRow([], plan.writeMap, a)) },
    });
  }

  // Verify by reading back: a second plan over the result must have nothing left to do.
  const after = await readGrid(sheets, pair.spreadsheetId);
  const again = planIncomeCategories(after);
  const problems = [];
  if (again.newHeaders.length > 0) problems.push(`headers still missing: ${again.newHeaders.map((h) => h.field).join(", ")}`);
  if (again.additions.length > 0) problems.push(`categories still missing: ${again.additions.map((a) => a.name_en).join(", ")}`);
  if (again.tenant && again.tenant.current !== "rent") problems.push(`Tenant business reads "${again.tenant.current}"`);
  if (after.length !== before.length + plan.additions.length) problems.push(`row count ${before.length} -> ${after.length}, expected +${plan.additions.length}`);
  if (problems.length > 0) throw new SetupError(`verification failed:\n  ${problems.join("\n  ")}`);
  log(`[income-setup] verified: ${plan.additions.length} added, headers present, Tenant fills in rent`);
  return { phase: "apply", plan };
}

if (require.main === module) {
  run(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { planIncomeCategories, run, NEW_CATEGORIES, SetupError };
