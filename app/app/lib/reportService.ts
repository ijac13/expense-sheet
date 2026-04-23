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
} from "./reportTypes";
import { Expense } from "./expenses";

const API_BASE = "/api";

// ---------------------------------------------------------------------------
// Category metadata — display names and icons
// ---------------------------------------------------------------------------
const CATEGORY_META: Record<string, { name: string; icon: string }> = {
  "eating-out":        { name: "Eating Out",       icon: "🍜" },
  groceries:           { name: "Groceries",         icon: "🥬" },
  transportation:      { name: "Transportation",    icon: "🚌" },
  "daily-necessities": { name: "Daily Necessities", icon: "🧴" },
  entertainment:       { name: "Entertainment",     icon: "🎬" },
  medical:             { name: "Medical",           icon: "🏥" },
  digital:             { name: "Digital",           icon: "💻" },
  shopping:            { name: "Shopping",          icon: "🛒" },
  fuel:                { name: "Fuel",              icon: "⛽" },
  tolls:               { name: "Tolls",             icon: "🛣️" },
  rent:                { name: "Rent",              icon: "🏠" },
  clothing:            { name: "Clothing",          icon: "👗" },
  equipment:           { name: "Equipment",         icon: "🔧" },
};

const PAYER_NAMES: Record<string, string> = {
  user1: "Me",
  user2: "Partner",
};

// ---------------------------------------------------------------------------
// Data fetcher — cached per call (no module-level cache to avoid stale data)
// ---------------------------------------------------------------------------
async function fetchAllExpenses(): Promise<Expense[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) {
    throw new Error(`Failed to fetch expenses: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<Expense[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function filterByPayer(expenses: Expense[], payer: PayerFilter): Expense[] {
  if (payer === "all") return expenses;
  return expenses.filter((e) => e.paid_by === payer);
}

function buildCategoryBreakdown(expenses: Expense[]): CategoryBreakdown[] {
  const map: Record<string, { total: number; count: number }> = {};
  for (const e of expenses) {
    if (!map[e.category_id]) map[e.category_id] = { total: 0, count: 0 };
    map[e.category_id].total += e.amount;
    map[e.category_id].count += 1;
  }
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  return Object.entries(map)
    .map(([cat_id, { total, count }]) => ({
      category_id: cat_id,
      category_name: CATEGORY_META[cat_id]?.name ?? cat_id,
      icon: CATEGORY_META[cat_id]?.icon ?? "📦",
      total,
      count,
      percentage: grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function buildPayerBreakdown(expenses: Expense[]): PayerBreakdown[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    map[e.paid_by] = (map[e.paid_by] ?? 0) + e.amount;
  }
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);
  return Object.entries(map).map(([pid, total]) => ({
    payer_id: pid,
    payer_name: PAYER_NAMES[pid] ?? pid,
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
  payer: PayerFilter = "all"
): Promise<MonthlySummary> {
  const allExpenses = await fetchAllExpenses();

  const ym = makeDate(year, month, 1).slice(0, 7);
  const monthExpenses = filterByPayer(
    allExpenses.filter((e) => e.date.startsWith(ym)),
    payer
  );

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevYm = makeDate(prevYear, prevMonth, 1).slice(0, 7);
  const prevExpenses = filterByPayer(
    allExpenses.filter((e) => e.date.startsWith(prevYm)),
    payer
  );

  const sameMonthLastYm = makeDate(year - 1, month, 1).slice(0, 7);
  const sameMonthLastYExpenses = filterByPayer(
    allExpenses.filter((e) => e.date.startsWith(sameMonthLastYm)),
    payer
  );

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  return {
    year,
    month,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    total: monthExpenses.reduce((s, e) => s + e.amount, 0),
    categories: buildCategoryBreakdown(monthExpenses),
    payers: buildPayerBreakdown(monthExpenses),
    comparison: {
      prev_month_total: prevExpenses.reduce((s, e) => s + e.amount, 0),
      prev_month_label: `${MONTH_SHORT[prevMonth - 1]} ${prevYear}`,
      same_month_last_year_total: sameMonthLastYExpenses.reduce((s, e) => s + e.amount, 0),
      same_month_last_year_label: `${MONTH_SHORT[month - 1]} ${year - 1}`,
    },
    expense_count: monthExpenses.length,
  };
}

// ---------------------------------------------------------------------------
// getAnnualSummary
// ---------------------------------------------------------------------------
export async function getAnnualSummary(
  year: number,
  payer: PayerFilter = "all"
): Promise<AnnualSummary> {
  const allExpenses = await fetchAllExpenses();

  const yearPrefix = String(year);
  const yearExpenses = filterByPayer(
    allExpenses.filter((e) => e.date.startsWith(yearPrefix)),
    payer
  );

  const MONTH_SHORT = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const monthly_trend: MonthlyTrend[] = MONTH_SHORT.map((label, i) => {
    const mo = i + 1;
    const ym = makeDate(year, mo, 1).slice(0, 7);
    const total = filterByPayer(
      allExpenses.filter((e) => e.date.startsWith(ym)),
      payer
    ).reduce((s, e) => s + e.amount, 0);
    return { month: mo, label, total };
  });

  return {
    year,
    total: yearExpenses.reduce((s, e) => s + e.amount, 0),
    categories: buildCategoryBreakdown(yearExpenses),
    payers: buildPayerBreakdown(yearExpenses),
    monthly_trend,
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
  payer: PayerFilter = "all"
): Promise<ReportExpense[]> {
  const allExpenses = await fetchAllExpenses();

  let expenses = allExpenses.filter((e) => e.category_id === categoryId);

  if (month !== null) {
    const ym = makeDate(year, month, 1).slice(0, 7);
    expenses = expenses.filter((e) => e.date.startsWith(ym));
  } else {
    expenses = expenses.filter((e) => e.date.startsWith(String(year)));
  }

  expenses = filterByPayer(expenses, payer);

  return expenses
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({
      id: e.id,
      date: e.date,
      amount: e.amount,
      category_id: e.category_id,
      category_name: CATEGORY_META[e.category_id]?.name ?? e.category_id,
      icon: CATEGORY_META[e.category_id]?.icon ?? "📦",
      paid_by: PAYER_NAMES[e.paid_by] ?? e.paid_by,
      notes: e.notes ?? "",
    }));
}
