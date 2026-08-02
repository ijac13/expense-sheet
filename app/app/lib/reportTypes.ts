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
}

export interface AnnualSummary {
  year: number;
  total: number;
  categories: CategoryBreakdown[];
  payers: PayerBreakdown[];
  monthly_trend: MonthlyTrend[];
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
