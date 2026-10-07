import type { UserId } from "./users";

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;     // English
  category_name_zh: string;  // Traditional Chinese
  icon: string;
  total: number;
  count: number;
  percentage: number;
}

export interface PayerBreakdown {
  payer_id: string;
  payer_name: string;
  total: number;
  percentage: number;
}

export interface MonthlyComparison {
  prev_month_total: number;
  prev_month_label: string;
  same_month_last_year_total: number;
  same_month_last_year_label: string;
}

export interface MonthlySummary {
  year: number;
  month: number;
  label: string; // e.g. "April 2026"
  total: number;
  categories: CategoryBreakdown[];
  payers: PayerBreakdown[];
  comparison: MonthlyComparison;
  expense_count: number;
}

export interface MonthlyTrend {
  month: number;
  label: string; // e.g. "Jan"
  total: number;
  prev_total: number; // the same month, one year earlier
}

// The captain's planning-sheet split of a year: Fixed (categories switched on as
// fixed), Big extras (other expenses noted #大筆), Living costs (the rest).
export type CostGroup = "fixed" | "big_extra" | "living";

export interface CostGroupTotal {
  total: number;
  percentage: number; // share of the year total
}

export interface AnnualCostGroups {
  fixed: CostGroupTotal & { categories: CategoryBreakdown[] };
  big_extra: CostGroupTotal & { expenses: ReportExpense[] };
  living: CostGroupTotal & { categories: CategoryBreakdown[] };
}

// The year before, cut to the same stretch of days: Jan 1 to today's date while
// the viewed year is still running, the whole year once it has ended.
export interface AnnualComparison {
  year: number;
  through: string | null; // "MM-DD" cutoff, inclusive; null = the full year
  total: number;
  groups: AnnualCostGroups;
}

export interface AnnualSummary {
  year: number;
  total: number;
  categories: CategoryBreakdown[];
  groups: AnnualCostGroups;
  payers: PayerBreakdown[];
  monthly_trend: MonthlyTrend[];
  comparison: AnnualComparison;
  expense_count: number;
}

export interface ReportExpense {
  id: string;
  date: string;
  amount: number;
  category_id: string;
  category_name: string;     // English
  category_name_zh: string;  // Traditional Chinese
  icon: string;
  paid_by: string;           // raw user id, resolved to a display name at render time
  notes: string;
  created_by?: string;
  created_at: string;
  subscription_id?: string;
}

// Was a hardcoded "all" | "user1" | "user2" union — now derived from UserId so it
// can't silently drift from the actual USERS list (see reportService.ts's
// resolvePayerName, which needs this to be a real user id to look up a name).
export type PayerFilter = "all" | UserId;
export type ChartType = "pie" | "bar";
export type ReportPeriod = "monthly" | "annual";
