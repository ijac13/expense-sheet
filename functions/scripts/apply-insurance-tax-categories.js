/**
 * One-time admin script for entity 042 (Split Insurance and Tax Out of "Other").
 *
 * Does the two things the deployed API cannot do:
 *   1. Appends two Categories rows with fixed slug ids (`insurance`, `tax`) —
 *      POST /api/categories always generates `cat_NNN`, so those rows must be
 *      written directly via the Sheets API instead.
 *   2. Retags the 5 known historical expenses (AC-8) and the 房屋稅 subscription
 *      (AC-9) by writing category_id directly, then re-reads to confirm AC-10/AC-11.
 *
 * This script talks to the Sheets API the same way functions/src/index.ts does
 * (`google.auth.getClient()` — Application Default Credentials, or
 * GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key file), plus
 * the GOOGLE_SERVICE_ACCOUNT_KEY-as-JSON-string fallback used by
 * scripts/migrate-2025.js (entity 008) for parity with that precedent.
 *
 * Usage:
 *   node scripts/apply-insurance-tax-categories.js --dry-run   # read + plan only, no writes
 *   node scripts/apply-insurance-tax-categories.js             # read, write, verify
 *   node scripts/apply-insurance-tax-categories.js --fixture ./scripts/fixtures/sample
 *       # run the full plan/match/verify logic against local JSON fixtures instead of
 *       # live Sheets — no credentials needed. Used to prove the algorithm itself
 *       # (matching, idempotency, AC-10/AC-11 math) before any live credentials exist.
 *
 * Required env vars (live mode only):
 *   SPREADSHEET_ID                  Target spreadsheet ID (production or a test copy)
 *   GOOGLE_APPLICATION_CREDENTIALS  Path to service-account JSON key (ADC also works)
 *   GOOGLE_SERVICE_ACCOUNT_KEY      Alternative: raw/base64 JSON key string
 *
 * Window used for AC-10/AC-11: 2026-05-01 through 2026-07-31 (inclusive), per spec.
 */

const CATEGORIES_TAB = "Categories";
const EXPENSES_TAB = "Expenses";
const SUBSCRIPTIONS_TAB = "Subscriptions";

const WINDOW_START = "2026-05-01";
const WINDOW_END = "2026-07-31";

const NEW_CATEGORY_ROWS = [
  // id, name_en, name_zh, icon, sort_order, is_active, gov_category
  ["insurance", "Insurance", "保險", "🛡️", "23", "true", "insurance_financial"],
  ["tax", "Tax", "稅金", "🧾", "24", "true", "miscellaneous"],
];

// AC-8 target table. Matched by amount + current category_id (+ notes substring
// where two rows would otherwise collide, e.g. the two `other`+insurance rows are
// disambiguated by amount alone since 15010 !== 15062).
const RETAG_TARGETS = [
  { amount: 123176, from_category: "other", to_category: "tax", label: "income tax" },
  { amount: 1001, from_category: "other", to_category: "tax", label: "house tax (房屋稅)" },
  { amount: 15010, from_category: "other", to_category: "insurance", label: "insurance premium" },
  { amount: 15062, from_category: "other", to_category: "insurance", label: "insurance premium" },
  {
    amount: 5268,
    from_category: "medical",
    to_category: "insurance",
    label: "ijac 國壽保費",
    notes_contains: "國壽保費",
  },
];

const SUBSCRIPTION_NAME = "房屋稅";
const SUBSCRIPTION_TO_CATEGORY = "tax";

// ---------------------------------------------------------------------------
// Row <-> object helpers (mirrors functions/src/index.ts rowToX exactly)
// ---------------------------------------------------------------------------
function rowToCategory(row) {
  return {
    id: row[0] ?? "",
    name_en: row[1] ?? "",
    name_zh: row[2] ?? "",
    icon: row[3] ?? "",
    sort_order: Number(row[4] ?? 0),
    is_active: row[5] !== "false",
    gov_category: row[6] ?? null,
  };
}

function rowToExpense(row) {
  return {
    id: row[0] ?? "",
    date: row[1] ?? "",
    amount: Number(row[2] ?? 0),
    category_id: row[3] ?? "",
    paid_by: row[4] ?? "",
    created_by: row[5] ?? "",
    notes: row[6] ?? "",
    created_at: row[7] ?? "",
  };
}

function rowToSubscription(row) {
  return {
    id: row[0] ?? "",
    name: row[1] ?? "",
    amount: Number(row[2] ?? 0),
    category_id: row[3] ?? "",
    frequency: row[4] ?? "monthly",
    due_day: Number(row[5] ?? 1),
    due_month: row[6] ? Number(row[6]) : undefined,
    paid_by: row[7] ?? "",
    is_active: row[8] !== "false",
  };
}

// ---------------------------------------------------------------------------
// Data source: either a live Sheets client or a local fixture directory
// ---------------------------------------------------------------------------
function loadFixtureSource(dir) {
  const fs = require("fs");
  const path = require("path");
  const categories = JSON.parse(fs.readFileSync(path.join(dir, "Categories.json"), "utf8"));
  const expenses = JSON.parse(fs.readFileSync(path.join(dir, "Expenses.json"), "utf8"));
  const subscriptions = JSON.parse(fs.readFileSync(path.join(dir, "Subscriptions.json"), "utf8"));

  const state = { categories, expenses, subscriptions };
  const writes = [];

  return {
    mode: "fixture",
    async getCategories() {
      return state.categories;
    },
    async getExpenses() {
      return state.expenses;
    },
    async getSubscriptions() {
      return state.subscriptions;
    },
    async appendCategoryRows(rows) {
      writes.push({ op: "append", tab: CATEGORIES_TAB, rows });
      for (const r of rows) state.categories.push(rowToCategory(r));
    },
    async patchExpenseCategory(id, newCategoryId) {
      writes.push({ op: "patch", tab: EXPENSES_TAB, id, category_id: newCategoryId });
      const e = state.expenses.find((x) => x.id === id);
      if (e) e.category_id = newCategoryId;
    },
    async patchSubscriptionCategory(id, newCategoryId) {
      writes.push({ op: "patch", tab: SUBSCRIPTIONS_TAB, id, category_id: newCategoryId });
      const s = state.subscriptions.find((x) => x.id === id);
      if (s) s.category_id = newCategoryId;
    },
    getWrites() {
      return writes;
    },
  };
}

async function loadLiveSource() {
  const { google } = require("googleapis");

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID env var is required for a live run");
  }

  let authClient;
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    let raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    try {
      raw = Buffer.from(raw, "base64").toString("utf8").trim().startsWith("{")
        ? Buffer.from(raw, "base64").toString("utf8")
        : raw;
    } catch {
      // not base64, use as-is
    }
    const key = JSON.parse(raw);
    const auth = new google.auth.GoogleAuth({
      credentials: key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    authClient = await auth.getClient();
  } else {
    // Application Default Credentials, or GOOGLE_APPLICATION_CREDENTIALS file path —
    // same call the deployed function makes.
    authClient = await google.auth.getClient({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  const sheets = google.sheets({ version: "v4", auth: authClient });

  return {
    mode: "live",
    async getCategories() {
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${CATEGORIES_TAB}!A:G` });
      return (resp.data.values ?? []).slice(1).map(rowToCategory);
    },
    async getExpenses() {
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${EXPENSES_TAB}!A:H` });
      return (resp.data.values ?? []).slice(1).map(rowToExpense);
    },
    async getSubscriptions() {
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SUBSCRIPTIONS_TAB}!A:I` });
      return (resp.data.values ?? []).slice(1).map(rowToSubscription);
    },
    async appendCategoryRows(rows) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${CATEGORIES_TAB}!A:G`,
        valueInputOption: "RAW",
        requestBody: { values: rows },
      });
    },
    async patchExpenseCategory(id, newCategoryId) {
      // Find row index, then update only column D (category_id) to preserve
      // every other column byte-identical.
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${EXPENSES_TAB}!A:H` });
      const rows = resp.data.values ?? [];
      const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
      if (idx === -1) throw new Error(`patchExpenseCategory: id ${id} not found`);
      if (!newCategoryId) throw new Error(`patchExpenseCategory: no target category for row ${id}`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${EXPENSES_TAB}!D${idx + 1}:D${idx + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [[newCategoryId]] },
      });
    },
    async patchSubscriptionCategory(id, newCategoryId) {
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${SUBSCRIPTIONS_TAB}!A:I` });
      const rows = resp.data.values ?? [];
      const idx = rows.findIndex((r, i) => i > 0 && r[0] === id);
      if (idx === -1) throw new Error(`patchSubscriptionCategory: id ${id} not found`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SUBSCRIPTIONS_TAB}!D${idx + 1}:D${idx + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: [[newCategoryId]] },
      });
    },
    getWrites() {
      return [];
    },
  };
}

// ---------------------------------------------------------------------------
// Plan + apply
// ---------------------------------------------------------------------------
function inWindow(date) {
  return date >= WINDOW_START && date <= WINDOW_END;
}

async function planCategoryInserts(source) {
  const categories = await source.getCategories();

  // The Categories tab uses cat_NNN ids while every expense/subscription row
  // references slugs (`other`, `medical`, …). This guard used to halt here,
  // because a category id that missed the hard-coded DEFAULT_CATEGORIES list
  // rendered as a raw id. Entity 044 removed that coupling — getCatMeta now
  // resolves against the live category list and falls back to DEFAULT_CATEGORIES
  // per id — so a mixed scheme is cosmetic rather than a rendering failure, and
  // slug ids are what the expense data already points at.
  const catNnn = categories.filter((c) => /^cat_\d+$/.test(c.id));
  if (catNnn.length > 0) {
    console.log(
      `[warn] ${catNnn.length}/${categories.length} existing category ids use the cat_NNN scheme; adding insurance/tax as slugs alongside them (entity 042, post-044 decision).`
    );
  }

  const haveInsurance = categories.some((c) => c.id === "insurance");
  const haveTax = categories.some((c) => c.id === "tax");

  const toInsert = NEW_CATEGORY_ROWS.filter((row) => {
    if (row[0] === "insurance") return !haveInsurance;
    if (row[0] === "tax") return !haveTax;
    return true;
  });

  return { toInsert, alreadyPresent: { insurance: haveInsurance, tax: haveTax } };
}

function findRetagMatch(expenses, target) {
  return expenses.filter((e) => {
    if (e.amount !== target.amount) return false;
    if (e.category_id !== target.from_category) return false;
    if (target.notes_contains && !String(e.notes ?? "").includes(target.notes_contains)) return false;
    return true;
  });
}

function alreadyApplied(expenses, target) {
  return expenses.filter((e) => e.amount === target.amount && e.category_id === target.to_category);
}

async function planRetags(source) {
  const expenses = await source.getExpenses();
  const plan = [];
  for (const target of RETAG_TARGETS) {
    const matches = findRetagMatch(expenses, target);
    if (matches.length === 1) {
      plan.push({ target, expense: matches[0], status: "pending" });
      continue;
    }
    if (matches.length === 0) {
      const done = alreadyApplied(expenses, target);
      if (done.length === 1) {
        plan.push({ target, expense: done[0], status: "already_applied" });
        continue;
      }
      throw new Error(
        `Halting: no unique match for target "${target.label}" (amount ${target.amount}, from ${target.from_category}). Found ${matches.length} candidates and ${done.length} already-applied candidates — refusing to guess.`
      );
    }
    throw new Error(
      `Halting: ${matches.length} rows match target "${target.label}" (amount ${target.amount}, from ${target.from_category}) — ambiguous, refusing to guess. ids: ${matches.map((m) => m.id).join(", ")}`
    );
  }
  return plan;
}

async function planSubscriptionRetag(source) {
  const subs = await source.getSubscriptions();
  const matches = subs.filter((s) => s.name === SUBSCRIPTION_NAME);
  if (matches.length !== 1) {
    throw new Error(`Halting: expected exactly 1 subscription named "${SUBSCRIPTION_NAME}", found ${matches.length}`);
  }
  const sub = matches[0];
  return { sub, status: sub.category_id === SUBSCRIPTION_TO_CATEGORY ? "already_applied" : "pending" };
}

// Note: does NOT compare against a "before" total read earlier in this same
// invocation — on an idempotent re-run (nothing left to apply), an earlier
// read already reflects the fully-migrated state, so a live before/after
// delta would silently pass 0 === 5268's complement and prove nothing. AC-11's
// "Medical is NT$5,268 lower" is instead verified structurally: every
// medical-origin retag target's expense id (known from the plan, valid
// whether it was just applied or already applied earlier) must now carry the
// target category — true in both a fresh run and a re-run.
async function verifyPostConditions(source, retagPlan) {
  const expenses = await source.getExpenses();
  const windowed = expenses.filter((e) => inWindow(e.date));

  const otherRows = windowed.filter((e) => e.category_id === "other");
  const totals = {};
  for (const e of windowed) totals[e.category_id] = (totals[e.category_id] ?? 0) + e.amount;

  const insuranceTotal = totals["insurance"] ?? 0;
  const taxTotal = totals["tax"] ?? 0;
  const medicalTotal = totals["medical"] ?? 0;

  const byId = new Map(expenses.map((e) => [e.id, e]));
  const medicalOriginTargets = retagPlan.filter((p) => p.target.from_category === "medical");
  const medicalMovedOut = medicalOriginTargets.reduce((s, p) => s + p.target.amount, 0);
  const medicalMoveConfirmed = medicalOriginTargets.every((p) => {
    const row = byId.get(p.expense.id);
    return row && row.category_id === p.target.to_category;
  });

  return {
    ac10_pass: otherRows.length === 0,
    ac10_other_rows: otherRows.map((e) => e.id),
    ac11_insurance_total: insuranceTotal,
    ac11_insurance_expected: 35340,
    ac11_tax_total: taxTotal,
    ac11_tax_expected: 124177,
    ac11_medical_total_now: medicalTotal,
    ac11_medical_moved_out: medicalMovedOut,
    ac11_medical_moved_out_expected: 5268,
    ac11_medical_move_confirmed: medicalMoveConfirmed,
    ac11_other_absent: !("other" in totals),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fixtureIdx = args.indexOf("--fixture");
  const fixtureDir = fixtureIdx !== -1 ? args[fixtureIdx + 1] : null;

  const source = fixtureDir ? loadFixtureSource(fixtureDir) : await loadLiveSource();
  console.log(`[mode] ${source.mode}${dryRun ? " (dry-run)" : ""}`);

  // 1. Category inserts
  const catPlan = await planCategoryInserts(source);
  console.log(`[categories] already present: insurance=${catPlan.alreadyPresent.insurance}, tax=${catPlan.alreadyPresent.tax}`);
  console.log(`[categories] to insert: ${catPlan.toInsert.map((r) => r[0]).join(", ") || "(none)"}`);

  // 2. Expense retag plan
  const retagPlan = await planRetags(source);
  for (const p of retagPlan) {
    console.log(`[expense] ${p.target.label}: amount=${p.target.amount} -> ${p.target.to_category} [${p.status}] id=${p.expense.id}`);
  }

  // 3. Subscription retag plan
  const subPlan = await planSubscriptionRetag(source);
  console.log(`[subscription] ${SUBSCRIPTION_NAME}: id=${subPlan.sub.id} -> ${SUBSCRIPTION_TO_CATEGORY} [${subPlan.status}]`);

  if (dryRun) {
    console.log("\n[dry-run] no writes performed.");
    return;
  }

  // Apply
  if (catPlan.toInsert.length > 0) {
    await source.appendCategoryRows(catPlan.toInsert);
    console.log(`[write] appended ${catPlan.toInsert.length} category row(s)`);
  }
  for (const p of retagPlan) {
    if (p.status === "already_applied") continue;
    await source.patchExpenseCategory(p.expense.id, p.target.to_category);
    console.log(`[write] expense ${p.expense.id} -> category_id=${p.target.to_category}`);
  }
  if (subPlan.status !== "already_applied") {
    await source.patchSubscriptionCategory(subPlan.sub.id, SUBSCRIPTION_TO_CATEGORY);
    console.log(`[write] subscription ${subPlan.sub.id} -> category_id=${SUBSCRIPTION_TO_CATEGORY}`);
  }

  // Verify
  const result = await verifyPostConditions(source, retagPlan);
  console.log("\n[verify]", JSON.stringify(result, null, 2));

  const allPass =
    result.ac10_pass &&
    result.ac11_insurance_total === result.ac11_insurance_expected &&
    result.ac11_tax_total === result.ac11_tax_expected &&
    result.ac11_medical_moved_out === result.ac11_medical_moved_out_expected &&
    result.ac11_medical_move_confirmed &&
    result.ac11_other_absent;

  console.log(allPass ? "\nAC-10/AC-11: PASS" : "\nAC-10/AC-11: FAIL — see above");
  if (!allPass) process.exitCode = 1;

  // Record ids for the stage report (AC-8 requirement)
  console.log("\n[AC-8 ids]");
  for (const p of retagPlan) console.log(`  ${p.target.label} (amount ${p.target.amount}): id=${p.expense.id}`);
  console.log(`[AC-9 id] ${SUBSCRIPTION_NAME}: id=${subPlan.sub.id}`);
}

main().catch((err) => {
  console.error("\n[error]", err.message ?? err);
  process.exitCode = 1;
});
