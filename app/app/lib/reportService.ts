/**
 * reportService.ts — stub service for reports.
 * Firebase Function calls are not yet wired; all data is generated from
 * realistic mock data. Replace each function body with a real API call
 * when entity 006 (auth) is complete.
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

// ---------------------------------------------------------------------------
// Mock expense records — realistic TWD amounts, two payers, 8 categories
// ---------------------------------------------------------------------------

interface RawExpense {
  id: string;
  date: string;
  amount: number;
  category_id: string;
  paid_by: "user1" | "user2";
  notes: string;
}

const CATEGORY_META: Record<string, { name: string; icon: string }> = {
  "eating-out":        { name: "Eating Out",       icon: "🍜" },
  groceries:           { name: "Groceries",         icon: "🥬" },
  transportation:      { name: "Transportation",    icon: "🚌" },
  "daily-necessities": { name: "Daily Necessities", icon: "🧴" },
  entertainment:       { name: "Entertainment",     icon: "🎬" },
  medical:             { name: "Medical",           icon: "🏥" },
  digital:             { name: "Digital",           icon: "💻" },
  shopping:            { name: "Shopping",          icon: "🛒" },
};

const PAYER_NAMES: Record<string, string> = {
  user1: "Me",
  user2: "Partner",
};

function makeDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMockExpenses(): RawExpense[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-based

  // Helper for previous month
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const sameMonthLastY = y - 1;

  const rows: RawExpense[] = [];
  let id = 1;

  function add(
    year: number,
    month: number,
    day: number,
    amount: number,
    category_id: string,
    paid_by: "user1" | "user2",
    notes = ""
  ) {
    rows.push({
      id: `mock-${String(id++).padStart(3, "0")}`,
      date: makeDate(year, month, day),
      amount,
      category_id,
      paid_by,
      notes,
    });
  }

  // Current month — spread across days
  add(y, m, 2,  420,  "eating-out",        "user1", "Lunch near office");
  add(y, m, 3,  1350, "groceries",         "user2", "Weekly shop");
  add(y, m, 4,  180,  "transportation",    "user1", "MRT top-up");
  add(y, m, 5,  890,  "daily-necessities", "user2", "Shampoo, soap");
  add(y, m, 6,  560,  "eating-out",        "user1", "Dinner out");
  add(y, m, 7,  320,  "entertainment",     "user2", "Cinema");
  add(y, m, 9,  2400, "medical",           "user1", "Dental check");
  add(y, m, 10, 1200, "digital",           "user2", "Annual subscription");
  add(y, m, 11, 750,  "eating-out",        "user2", "Hot pot");
  add(y, m, 12, 990,  "groceries",         "user1", "Fruit & veg");
  add(y, m, 14, 340,  "transportation",    "user2", "Taxi");
  add(y, m, 15, 4500, "shopping",          "user1", "Shoes");
  add(y, m, 16, 280,  "eating-out",        "user1", "Breakfast set");
  add(y, m, 17, 1100, "daily-necessities", "user2", "Cleaning supplies");
  add(y, m, 18, 620,  "entertainment",     "user1", "Board game café");

  // Previous month — lighter set
  add(prevY, prevM, 3,  390,  "eating-out",        "user1");
  add(prevY, prevM, 5,  1450, "groceries",         "user2");
  add(prevY, prevM, 8,  210,  "transportation",    "user1");
  add(prevY, prevM, 10, 780,  "daily-necessities", "user2");
  add(prevY, prevM, 12, 500,  "eating-out",        "user2");
  add(prevY, prevM, 15, 290,  "entertainment",     "user1");
  add(prevY, prevM, 18, 1800, "medical",           "user2");
  add(prevY, prevM, 20, 950,  "digital",           "user1");
  add(prevY, prevM, 22, 3600, "shopping",          "user2");

  // Same month last year — lighter set
  add(sameMonthLastY, m, 4,  350,  "eating-out",        "user1");
  add(sameMonthLastY, m, 7,  1200, "groceries",         "user2");
  add(sameMonthLastY, m, 11, 160,  "transportation",    "user1");
  add(sameMonthLastY, m, 14, 680,  "daily-necessities", "user2");
  add(sameMonthLastY, m, 17, 480,  "eating-out",        "user2");
  add(sameMonthLastY, m, 20, 2100, "medical",           "user1");
  add(sameMonthLastY, m, 23, 1050, "digital",           "user2");

  // Fill in other months of the current year for annual view
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((mo) => mo !== m);
  const catIds = Object.keys(CATEGORY_META);
  months.forEach((mo) => {
    // 5–7 entries per month
    const entries = 5 + (mo % 3);
    for (let i = 0; i < entries; i++) {
      const day = 3 + i * 4;
      const cat = catIds[i % catIds.length];
      const payer: "user1" | "user2" = i % 2 === 0 ? "user1" : "user2";
      const baseAmounts = [380, 1200, 550, 840, 420, 1600, 990, 760];
      const amount = baseAmounts[i % baseAmounts.length] + mo * 30;
      add(y, mo, Math.min(day, 28), amount, cat, payer);
    }
  });

  return rows;
}

const ALL_EXPENSES = buildMockExpenses();

// ---------------------------------------------------------------------------
// Helper: filter by payer
// ---------------------------------------------------------------------------
function filterByPayer(expenses: RawExpense[], payer: PayerFilter): RawExpense[] {
  if (payer === "all") return expenses;
  return expenses.filter((e) => e.paid_by === payer);
}

// ---------------------------------------------------------------------------
// Helper: build category breakdown
// ---------------------------------------------------------------------------
function buildCategoryBreakdown(expenses: RawExpense[]): CategoryBreakdown[] {
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

// ---------------------------------------------------------------------------
// Helper: build payer breakdown
// ---------------------------------------------------------------------------
function buildPayerBreakdown(expenses: RawExpense[]): PayerBreakdown[] {
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
  const ym = makeDate(year, month, 1).slice(0, 7); // "YYYY-MM"
  const monthExpenses = filterByPayer(
    ALL_EXPENSES.filter((e) => e.date.startsWith(ym)),
    payer
  );

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevYm = makeDate(prevYear, prevMonth, 1).slice(0, 7);
  const prevExpenses = filterByPayer(
    ALL_EXPENSES.filter((e) => e.date.startsWith(prevYm)),
    payer
  );

  const sameMonthLastYm = makeDate(year - 1, month, 1).slice(0, 7);
  const sameMonthLastYExpenses = filterByPayer(
    ALL_EXPENSES.filter((e) => e.date.startsWith(sameMonthLastYm)),
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
  const yearPrefix = String(year);
  const yearExpenses = filterByPayer(
    ALL_EXPENSES.filter((e) => e.date.startsWith(yearPrefix)),
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
      ALL_EXPENSES.filter((e) => e.date.startsWith(ym)),
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
  month: number | null, // null = entire year
  categoryId: string,
  payer: PayerFilter = "all"
): Promise<ReportExpense[]> {
  let expenses = ALL_EXPENSES.filter((e) => e.category_id === categoryId);

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
      notes: e.notes,
    }));
}
