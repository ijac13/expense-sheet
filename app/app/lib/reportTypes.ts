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

// A month to compare against, cut to the viewed month's days while that month
// is still running: viewing Oct on Oct 7 compares Sep 1–7 and Oct 1–7 last year.
export interface MonthComparison {
  year: number;
  month: number;
  through_day: number | null; // inclusive cutoff; null = the whole month
  total: number;
  groups: AnnualCostGroups;
}

export interface MonthlySummary {
  year: number;
  month: number;
  label: string; // e.g. "April 2026"
  total: number; // Life only; groups.rent and groups.uber hold the rest
  categories: CategoryBreakdown[];
  groups: AnnualCostGroups;
  payers: PayerBreakdown[];
  comparison: { prev_month: MonthComparison; last_year: MonthComparison };
  expense_count: number;
}

export interface MonthlyTrend {
  month: number;
  label: string; // e.g. "Jan"
  total: number;
  prev_total: number; // the same month, one year earlier
}

// The captain's planning-sheet split of a year: Fixed (categories switched on as
// fixed), Big extras (other expenses noted #大筆), Living costs (the rest) —
// together, Life. Rent and Uber each hold their business's costs, which stay out
// of every total unless "Include business costs" is chosen.
export type CostGroup = "fixed" | "big_extra" | "living" | "rent" | "uber";
export type BusinessGroup = Extract<CostGroup, "rent" | "uber">;

export interface CostGroupTotal {
  total: number;
  percentage: number; // share of the year total
}

export interface AnnualCostGroups {
  fixed: CostGroupTotal & { categories: CategoryBreakdown[] };
  big_extra: CostGroupTotal & { expenses: ReportExpense[] };
  living: CostGroupTotal & { categories: CategoryBreakdown[] };
  // Percentages here are of Life + Rent + Uber, the total they are shown against.
  rent: CostGroupTotal & { categories: CategoryBreakdown[] };
  uber: CostGroupTotal & { categories: CategoryBreakdown[] };
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

// ---------------------------------------------------------------------------
// Income & earnings
// ---------------------------------------------------------------------------

export interface IncomeLine {
  category_id: string;
  category_name: string;
  category_name_zh: string;
  icon: string;
  total: number;
}

export interface BusinessCard {
  type: "business";
  business: "rent" | "uber";
  income: IncomeLine[];      // one line per income category of this business
  income_total: number;
  costs: CategoryBreakdown[];
  costs_total: number;
  earnings: number;          // income_total − costs_total; negative is a loss
  trend: { label: string; earnings: number }[]; // last 6 months, or the year's 12
}

export interface IncomeCard extends IncomeLine {
  type: "income";
}

export interface EarningsSummary {
  money_in: number;   // plain income + every business's earnings
  spending: number;   // Life spending, the same total Reports shows
  left_over: number;
  cards: (IncomeCard | BusinessCard)[]; // in the income categories' sort order
}
