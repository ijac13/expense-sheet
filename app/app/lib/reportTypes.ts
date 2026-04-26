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
  paid_by: string;
  notes: string;
}

export type PayerFilter = "all" | "user1" | "user2";
export type ChartType = "pie" | "bar";
export type ReportPeriod = "monthly" | "annual";
