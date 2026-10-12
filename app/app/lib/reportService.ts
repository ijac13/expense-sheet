/**
 * reportService.ts — fetches real expense data from the Firebase Function API.
 * Aggregation logic (monthly/annual summaries, category breakdowns) is preserved.
 */

import {
  MonthlySummary,
  AnnualSummary,
  ReportExpense,
  CategoryBreakdown,
  PayerBreakdown,
  MonthlyTrend,
  PayerFilter,
  CostGroup,
  AnnualCostGroups,
  EarningsSummary,
  IncomeCard,
  BusinessCard,
} from "./reportTypes";
import { Expense } from "./expenses";
import { DEFAULT_CATEGORIES, Category, categoryIcon, resolveCategory, isFixedCategory, businessOf, isIncomeCategory } from "./categories";
import { getSessionCategories } from "./categoryService";
import { USERS } from "./users";
import { getSharedExpenses } from "./expensesCache";
import { getSharedIncomes, Income } from "./incomes";

// ---------------------------------------------------------------------------
// Category metadata — resolved live-list-first, DEFAULT_CATEGORIES as fallback
// ---------------------------------------------------------------------------
// Live category data (same source the category picker already uses) always wins,
// so a rename or a staging-only id (e.g. `cat_003`) resolves correctly. Falls back
// to DEFAULT_CATEGORIES only if the live fetch fails (offline/API down), and to the
// raw id only if the category genuinely isn't in either list (AC-1..AC-4).
//
// Cached per session, not per call (AC-5): stepping months must not re-issue
// this request. Only a genuine success is cached — a failed fetch is retried
// on the next call rather than pinning the page to DEFAULT_CATEGORIES for the
// rest of the session. The cache lives in categoryService so that every
// category write clears it (071: a Fixed switch saved in Settings).
async function fetchCategoryList(): Promise<Category[]> {
  try {
    const live = await getSessionCategories();
    if (live && live.length > 0) return live;
  } catch {
    // GET /api/categories failed — fall through to the DEFAULT_CATEGORIES fallback.
  }
  return DEFAULT_CATEGORIES;
}

function getCatMeta(
  catId: string,
  categories: Category[]
): { name_en: string; name_zh: string; icon: string } {
  const cat = resolveCategory(catId, categories);
  return {
    name_en: cat?.name_en ?? catId,
    name_zh: cat?.name_zh ?? catId,
    icon: categoryIcon(cat),
  };
}

function getPayerName(userId: string): string {
  return USERS.find(u => u.id === userId)?.name ?? userId;
}

// ---------------------------------------------------------------------------
// Payer filter — PayerFilter carries a user *id* (the <select>'s option value);
// stored `paid_by` is the display *name* written at expense-creation time
// (app/app/page.tsx). Resolve id -> name before comparing so the filter actually
// matches instead of comparing an id against a name that can never equal it.
// ---------------------------------------------------------------------------
function resolvePayerName(payer: Exclude<PayerFilter, "all">): string {
  return USERS.find((u) => u.id === payer)?.name ?? payer;
}

// ---------------------------------------------------------------------------
// Data fetcher — the session-scoped cache shared with Home and History
// (expensesCache.ts), invalidated on every local write.
// ---------------------------------------------------------------------------
async function fetchAllExpenses(): Promise<Expense[]> {
  return getSharedExpenses();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function filterByPayer(expenses: Expense[], payer: PayerFilter): Expense[] {
  if (payer === "all") return expenses;
  const target = resolvePayerName(payer);
  return expenses.filter((e) => e.paid_by === target);
}

function buildCategoryBreakdown(expenses: Expense[], categories: Category[]): CategoryBreakdown[] {
  const map: Record<string, { total: number; count: number }> = {};
  for (const e of expenses) {
    if (!map[e.category_id]) map[e.category_id] = { total: 0, count: 0 };
    map[e.category_id].total += e.amount;
    map[e.category_id].count += 1;
  }
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  return Object.entries(map)
    .map(([cat_id, { total, count }]) => {
      const meta = getCatMeta(cat_id, categories);
      return {
        category_id: cat_id,
        category_name: meta.name_en,
        category_name_zh: meta.name_zh,
        icon: meta.icon,
        total,
        count,
        percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

// Either hash: Chinese keyboards often type the full-width ＃.
const BIG_EXTRA_KEYWORDS = ["#大筆", "＃大筆"];

// A business tag wins over everything: Rent and Uber costs are never Life.
// Then a fixed category wins over the keyword. An unresolvable category is living.
function costGroupOf(e: Expense, categories: Category[]): CostGroup {
  if (businessOf(e, categories)) return "business";
  if (isFixedCategory(resolveCategory(e.category_id, categories))) return "fixed";
  if (BIG_EXTRA_KEYWORDS.some((k) => (e.notes ?? "").includes(k))) return "big_extra";
  return "living";
}

/** The expenses that count as Life spending: everything not tagged to a business. */
function lifeOnly(expenses: Expense[], categories: Category[]): Expense[] {
  return expenses.filter((e) => !businessOf(e, categories));
}

function sum(list: { amount: number }[]): number {
  return list.reduce((s, e) => s + e.amount, 0);
}

function buildCostGroups(expenses: Expense[], categories: Category[]): AnnualCostGroups {
  const of = (group: CostGroup) => expenses.filter((e) => costGroupOf(e, categories) === group);
  const fixed = of("fixed");
  const bigExtra = of("big_extra");
  const living = of("living");
  const business = of("business");
  // Life groups are shares of Life; Business is a share of everything, the
  // total it is shown against when business costs are included.
  const lifeTotal = sum(fixed) + sum(bigExtra) + sum(living);
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const share = (list: Expense[]) => ({ total: sum(list), percentage: pct(sum(list), lifeTotal) });
  return {
    business: {
      total: sum(business),
      percentage: pct(sum(business), lifeTotal + sum(business)),
      categories: buildCategoryBreakdown(business, categories),
    },
    fixed: { ...share(fixed), categories: buildCategoryBreakdown(fixed, categories) },
    big_extra: {
      ...share(bigExtra),
      expenses: bigExtra
        .sort((a, b) => b.amount - a.amount)
        .map((e) => toReportExpense(e, categories)),
    },
    living: { ...share(living), categories: buildCategoryBreakdown(living, categories) },
  };
}

function toReportExpense(e: Expense, categories: Category[]): ReportExpense {
  const meta = getCatMeta(e.category_id, categories);
  return {
    id: e.id,
    date: e.date,
    amount: e.amount,
    category_id: e.category_id,
    category_name: meta.name_en,
    category_name_zh: meta.name_zh,
    icon: meta.icon,
    paid_by: e.paid_by,
    notes: e.notes ?? "",
    created_by: e.created_by,
    created_at: e.created_at,
    subscription_id: e.subscription_id,
  };
}

function buildPayerBreakdown(expenses: Expense[]): PayerBreakdown[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    map[e.paid_by] = (map[e.paid_by] ?? 0) + e.amount;
  }
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  return Object.entries(map).map(([pid, total]) => ({
    payer_id: pid,
    payer_name: getPayerName(pid),
    total,
    percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
  }));
}

// ---------------------------------------------------------------------------
// getMonthlySummary
// ---------------------------------------------------------------------------
export async function getMonthlySummary(
  year: number,
  month: number,
  payer: PayerFilter = "all",
  today: Date = new Date()
): Promise<MonthlySummary> {
  const [allExpenses, categories] = await Promise.all([
    fetchAllExpenses(),
    fetchCategoryList(),
  ]);

  const ym = makeDate(year, month, 1).slice(0, 7);
  const monthAll = filterByPayer(
    allExpenses.filter((e) => e.date.startsWith(ym)),
    payer
  );
  const monthExpenses = lifeOnly(monthAll, categories);

  // While the viewed month is running, both comparisons stop at today's day;
  // a shorter month simply runs out first (Mar 1–30 vs Feb 1–28).
  const isCurrent = today.getFullYear() === year && today.getMonth() + 1 === month;
  const through_day = isCurrent ? today.getDate() : null;
  const compareWith = (y: number, mo: number) => {
    const prefix = makeDate(y, mo, 1).slice(0, 7);
    const list = filterByPayer(
      allExpenses.filter(
        (e) => e.date.startsWith(prefix) && (through_day === null || Number(e.date.slice(8, 10)) <= through_day)
      ),
      payer
    );
    return {
      year: y,
      month: mo,
      through_day,
      total: sum(lifeOnly(list, categories)),
      groups: buildCostGroups(list, categories),
    };
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return {
    year,
    month,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    total: monthExpenses.reduce((s, e) => s + e.amount, 0),
    categories: buildCategoryBreakdown(monthExpenses, categories),
    groups: buildCostGroups(monthAll, categories),
    payers: buildPayerBreakdown(monthExpenses),
    comparison: {
      prev_month: month === 1 ? compareWith(year - 1, 12) : compareWith(year, month - 1),
      last_year: compareWith(year - 1, month),
    },
    expense_count: monthExpenses.length,
  };
}

// ---------------------------------------------------------------------------
// getAnnualSummary
// ---------------------------------------------------------------------------
export async function getAnnualSummary(
  year: number,
  payer: PayerFilter = "all",
  today: Date = new Date()
): Promise<AnnualSummary> {
  const [allExpenses, categories] = await Promise.all([
    fetchAllExpenses(),
    fetchCategoryList(),
  ]);

  const yearPrefix = String(year);
  const yearAll = filterByPayer(
    allExpenses.filter((e) => e.date.startsWith(yearPrefix)),
    payer
  );
  const yearExpenses = lifeOnly(yearAll, categories);

  const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const monthTotal = (y: number, mo: number) => {
    const ym = makeDate(y, mo, 1).slice(0, 7);
    return sum(lifeOnly(filterByPayer(
      allExpenses.filter((e) => e.date.startsWith(ym)),
      payer
    ), categories));
  };
  const monthly_trend: MonthlyTrend[] = MONTH_SHORT.map((label, i) => ({
    month: i + 1,
    label,
    total: monthTotal(year, i + 1),
    prev_total: monthTotal(year - 1, i + 1),
  }));

  // While the viewed year is running, last year is cut at today's month-day so
  // both sides cover the same days. A string compare keeps Feb 29 safe.
  const todayIso = makeDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const through = today.getFullYear() === year ? todayIso.slice(5) : null;
  const prevPrefix = String(year - 1);
  const prevExpenses = filterByPayer(
    allExpenses.filter(
      (e) => e.date.startsWith(prevPrefix) && (through === null || e.date.slice(5, 10) <= through)
    ),
    payer
  );

  return {
    year,
    total: yearExpenses.reduce((s, e) => s + e.amount, 0),
    categories: buildCategoryBreakdown(yearExpenses, categories),
    groups: buildCostGroups(yearAll, categories),
    payers: buildPayerBreakdown(yearExpenses),
    monthly_trend,
    comparison: {
      year: year - 1,
      through,
      total: sum(lifeOnly(prevExpenses, categories)),
      groups: buildCostGroups(prevExpenses, categories),
    },
    expense_count: yearExpenses.length,
  };
}

// ---------------------------------------------------------------------------
// getExpensesByCategory
// ---------------------------------------------------------------------------
export async function getExpensesByCategory(
  year: number,
  month: number | null,
  categoryId: string,
  payer: PayerFilter = "all",
  // Narrows to one cost group, so a Living costs row drills into exactly the
  // expenses behind its amount (its big extras left out).
  group?: CostGroup
): Promise<ReportExpense[]> {
  const [allExpenses, categories] = await Promise.all([
    fetchAllExpenses(),
    fetchCategoryList(),
  ]);

  let expenses = allExpenses.filter((e) => e.category_id === categoryId);

  if (month !== null) {
    const ym = makeDate(year, month, 1).slice(0, 7);
    expenses = expenses.filter((e) => e.date.startsWith(ym));
  } else {
    expenses = expenses.filter((e) => e.date.startsWith(String(year)));
  }

  expenses = filterByPayer(expenses, payer);
  if (group) expenses = expenses.filter((e) => costGroupOf(e, categories) === group);

  return expenses
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => toReportExpense(e, categories));
}

// ---------------------------------------------------------------------------
// getEarningsSummary — Income & earnings for one month (or a whole year when
// month is null). Household-wide: the payer filter does not apply to income.
// ---------------------------------------------------------------------------
const TREND_MONTHS = 6;

export function buildEarningsSummary(
  expenses: Expense[],
  incomes: Income[],
  categories: Category[],
  year: number,
  month: number | null
): EarningsSummary {
  const prefixOf = (y: number, mo: number | null) => (mo === null ? String(y) : makeDate(y, mo, 1).slice(0, 7));
  const prefix = prefixOf(year, month);
  const inPeriod = <T extends { date: string }>(list: T[], p: string) => list.filter((x) => x.date.startsWith(p));

  const periodExpenses = inPeriod(expenses, prefix);
  const periodIncomes = inPeriod(incomes, prefix);
  const spending = sum(lifeOnly(periodExpenses, categories));

  const incomeBusiness = (i: Income) => resolveCategory(i.category_id, categories)?.business ?? "";
  const earningsOf = (biz: string, exps: Expense[], incs: Income[]) =>
    sum(incs.filter((i) => incomeBusiness(i) === biz)) - sum(exps.filter((e) => businessOf(e, categories) === biz));

  const line = (categoryId: string, list: Income[]) => {
    const meta = getCatMeta(categoryId, categories);
    return {
      category_id: categoryId,
      category_name: meta.name_en,
      category_name_zh: meta.name_zh,
      icon: meta.icon,
      total: sum(list.filter((i) => i.category_id === categoryId)),
    };
  };

  // The months a business card charts: the 6 ending at the viewed month, or
  // every month of the viewed year.
  const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trendMonths: { y: number; mo: number }[] = month === null
    ? MONTH_SHORT.map((_, i) => ({ y: year, mo: i + 1 }))
    : Array.from({ length: TREND_MONTHS }, (_, i) => {
        const index = year * 12 + (month - 1) - (TREND_MONTHS - 1 - i);
        return { y: Math.floor(index / 12), mo: (index % 12) + 1 };
      });

  // Cards follow the income categories' own order, each business once, at its
  // first income category. An income category with nothing this period still
  // shows (as NT$0) while active, so the page keeps the same shape every month.
  const incomeCats = categories
    .filter((c) => isIncomeCategory(c))
    .filter((c) => c.is_active || periodIncomes.some((i) => i.category_id === c.id))
    .sort((a, b) => a.sort_order - b.sort_order);
  const businessesSeen = new Set<string>();
  const cards: (IncomeCard | BusinessCard)[] = [];
  const addBusiness = (biz: "rent" | "uber") => {
    if (businessesSeen.has(biz)) return;
    businessesSeen.add(biz);
    const bizIncomes = periodIncomes.filter((i) => incomeBusiness(i) === biz);
    const costs = periodExpenses.filter((e) => businessOf(e, categories) === biz);
    const incomeIds = incomeCats.filter((c) => c.business === biz).map((c) => c.id);
    cards.push({
      type: "business",
      business: biz,
      income: incomeIds.map((id) => line(id, bizIncomes)),
      income_total: sum(bizIncomes),
      costs: buildCategoryBreakdown(costs, categories),
      costs_total: sum(costs),
      earnings: sum(bizIncomes) - sum(costs),
      trend: trendMonths.map(({ y, mo }) => ({
        label: MONTH_SHORT[mo - 1],
        earnings: earningsOf(biz, inPeriod(expenses, prefixOf(y, mo)), inPeriod(incomes, prefixOf(y, mo))),
      })),
    });
  };
  for (const c of incomeCats) {
    if (c.business) addBusiness(c.business);
    else cards.push({ type: "income", ...line(c.id, periodIncomes) });
  }
  // A business with costs but no income category yet still gets its card.
  for (const e of periodExpenses) {
    const biz = businessOf(e, categories);
    if (biz) addBusiness(biz);
  }

  const money_in = cards.reduce((s, c) => s + (c.type === "income" ? c.total : c.earnings), 0);
  return { money_in, spending, left_over: money_in - spending, cards };
}

export async function getEarningsSummary(year: number, month: number | null): Promise<EarningsSummary> {
  const [expenses, incomes, categories] = await Promise.all([
    fetchAllExpenses(),
    getSharedIncomes(),
    fetchCategoryList(),
  ]);
  return buildEarningsSummary(expenses, incomes, categories, year, month);
}
