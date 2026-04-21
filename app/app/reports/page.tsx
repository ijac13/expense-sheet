"use client";

import { useEffect, useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  MonthlySummary,
  AnnualSummary,
  CategoryBreakdown,
  PayerFilter,
  ChartType,
  ReportPeriod,
} from "../lib/reportTypes";
import { getMonthlySummary, getAnnualSummary } from "../lib/reportService";
import DrillDown from "./DrillDown";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PIE_COLORS = [
  "#7c3aed", "#2563eb", "#16a34a", "#d97706",
  "#dc2626", "#6b7280", "#ec4899", "#14b8a6",
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ---------------------------------------------------------------------------
// Delta badge
// ---------------------------------------------------------------------------
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const delta = current - previous;
  const pct = Math.abs(Math.round((delta / previous) * 100));
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
        up ? "bg-error/10 text-error" : "bg-success/10 text-success"
      }`}
    >
      {up ? "▲" : "▼"} {pct}%
    </span>
  );
}

// ---------------------------------------------------------------------------
// Category row
// ---------------------------------------------------------------------------
function CategoryRow({
  cat,
  onDrillDown,
}: {
  cat: CategoryBreakdown;
  onDrillDown: (cat: CategoryBreakdown) => void;
}) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-3 py-3 px-4 hover:bg-base-200 transition-colors rounded-xl text-left"
      onClick={() => onDrillDown(cat)}
    >
      <span className="text-2xl w-8 text-center">{cat.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <span className="font-medium text-sm truncate">{cat.category_name}</span>
          <span className="font-mono font-semibold text-sm ml-2 shrink-0">
            NT${cat.total.toLocaleString()}
          </span>
        </div>
        <div className="mt-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${cat.percentage}%` }}
          />
        </div>
        <div className="text-xs text-base-content/50 mt-0.5">{cat.percentage}%</div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ReportsPage() {
  const now = new Date();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [payer, setPayer] = useState<PayerFilter>("all");
  const [chartType, setChartType] = useState<ChartType>("pie");

  // Monthly navigation
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  // Annual navigation
  const [annualYear, setAnnualYear] = useState(now.getFullYear());

  // Data
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [annual, setAnnual] = useState<AnnualSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Drill-down state
  const [drillDownCategory, setDrillDownCategory] = useState<CategoryBreakdown | null>(null);

  // Mount guard — prevents recharts SSR issues during static export
  useEffect(() => setMounted(true), []);

  // Load monthly data
  useEffect(() => {
    if (period !== "monthly") return;
    setLoading(true);
    getMonthlySummary(year, month, payer)
      .then((data) => {
        setMonthly(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period, year, month, payer]);

  // Load annual data
  useEffect(() => {
    if (period !== "annual") return;
    setLoading(true);
    getAnnualSummary(annualYear, payer)
      .then((data) => {
        setAnnual(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period, annualYear, payer]);

  const prevMonth = useCallback(() => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  }, [month]);

  const nextMonth = useCallback(() => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  }, [month]);

  // Drill-down view
  if (drillDownCategory) {
    return (
      <DrillDown
        year={period === "monthly" ? year : annualYear}
        month={period === "monthly" ? month : null}
        categoryId={drillDownCategory.category_id}
        categoryName={drillDownCategory.category_name}
        icon={drillDownCategory.icon}
        periodLabel={
          period === "monthly"
            ? `${MONTH_SHORT[month - 1]} ${year}`
            : String(annualYear)
        }
        payer={payer}
        onBack={() => setDrillDownCategory(null)}
      />
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-primary text-primary-content px-4 pt-12 pb-4">
        <h1 className="text-xl font-bold mb-3">Reports</h1>

        {/* Period toggle */}
        <div className="flex gap-1 bg-primary-content/10 rounded-xl p-1 mb-3">
          {(["monthly", "annual"] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors capitalize ${
                period === p
                  ? "bg-primary-content text-primary"
                  : "text-primary-content/70"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Payer filter */}
        <div className="flex gap-1 bg-primary-content/10 rounded-xl p-1">
          {(["all", "user1", "user2"] as PayerFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPayer(p)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                payer === p
                  ? "bg-primary-content text-primary"
                  : "text-primary-content/70"
              }`}
            >
              {p === "all" ? "All" : p === "user1" ? "Me" : "Partner"}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Body */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        )}

        {/* ================================================================ */}
        {/* MONTHLY VIEW */}
        {/* ================================================================ */}
        {!loading && period === "monthly" && (
          <>
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="btn btn-ghost btn-sm"
              >
                &#8592;
              </button>
              <span className="font-semibold text-base">
                {monthly?.label ?? `${MONTH_SHORT[month - 1]} ${year}`}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="btn btn-ghost btn-sm"
              >
                &#8594;
              </button>
            </div>

            {monthly && monthly.total === 0 ? (
              /* Empty state */
              <div className="text-center py-16 text-base-content/40">
                <div className="text-5xl mb-3">📊</div>
                <div className="font-medium">No data for this period</div>
                <div className="text-sm mt-1">Try a different month</div>
              </div>
            ) : monthly ? (
              <>
                {/* Total */}
                <div className="card bg-base-200 rounded-2xl">
                  <div className="card-body p-5">
                    <div className="text-xs text-base-content/50 uppercase tracking-wide">
                      Total Spending
                    </div>
                    <div className="text-4xl font-mono font-bold text-primary mt-1">
                      NT${monthly.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-base-content/50 mt-1">
                      {monthly.expense_count} transactions
                    </div>
                  </div>
                </div>

                {/* Chart type toggle */}
                <div className="flex justify-end gap-1">
                  {(["pie", "bar"] as ChartType[]).map((ct) => (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => setChartType(ct)}
                      className={`btn btn-xs ${chartType === ct ? "btn-primary" : "btn-ghost"}`}
                    >
                      {ct === "pie" ? "Pie" : "Bar"}
                    </button>
                  ))}
                </div>

                {/* Category chart — guarded by mounted to avoid SSR issues */}
                {mounted && (
                  chartType === "pie" ? (
                    <div className="flex justify-center">
                      <PieChart width={260} height={220}>
                        <Pie
                          data={monthly.categories}
                          dataKey="total"
                          nameKey="category_name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          strokeWidth={2}
                        >
                          {monthly.categories.map((entry, index) => (
                            <Cell
                              key={entry.category_id}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`NT$${Number(value).toLocaleString()}`, ""]}
                        />
                      </PieChart>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={monthly.categories}
                        margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
                      >
                        <XAxis
                          dataKey="category_name"
                          tick={{ fontSize: 10 }}
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis tick={{ fontSize: 10 }} width={50} />
                        <Tooltip
                          formatter={(value) => [`NT$${Number(value).toLocaleString()}`, "Amount"]}
                        />
                        <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}

                {/* Category list */}
                <div className="card bg-base-100 border border-base-200 rounded-2xl overflow-hidden">
                  <div className="px-4 pt-3 pb-1 text-xs text-base-content/50 uppercase tracking-wide font-semibold">
                    By Category
                  </div>
                  <div className="divide-y divide-base-200">
                    {monthly.categories.map((cat) => (
                      <CategoryRow
                        key={cat.category_id}
                        cat={cat}
                        onDrillDown={setDrillDownCategory}
                      />
                    ))}
                  </div>
                </div>

                {/* By payer */}
                <div className="card bg-base-200 rounded-2xl">
                  <div className="card-body p-4">
                    <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-2">
                      By Payer
                    </div>
                    <div className="space-y-2">
                      {monthly.payers.map((p) => (
                        <div key={p.payer_id} className="flex justify-between items-center">
                          <span className="text-sm font-medium">{p.payer_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-base-content/50">{p.percentage}%</span>
                            <span className="font-mono font-semibold text-sm">
                              NT${p.total.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Comparison */}
                <div className="card bg-base-200 rounded-2xl">
                  <div className="card-body p-4">
                    <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-3">
                      Comparison
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-base-content/70">
                          vs {monthly.comparison.prev_month_label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            NT${monthly.comparison.prev_month_total.toLocaleString()}
                          </span>
                          <DeltaBadge
                            current={monthly.total}
                            previous={monthly.comparison.prev_month_total}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-base-content/70">
                          vs {monthly.comparison.same_month_last_year_label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            NT${monthly.comparison.same_month_last_year_total.toLocaleString()}
                          </span>
                          <DeltaBadge
                            current={monthly.total}
                            previous={monthly.comparison.same_month_last_year_total}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insights stub */}
                <div className="p-4 bg-base-200 rounded-xl text-sm text-base-content/50">
                  ✨ Insights coming soon...
                </div>
              </>
            ) : null}
          </>
        )}

        {/* ================================================================ */}
        {/* ANNUAL VIEW */}
        {/* ================================================================ */}
        {!loading && period === "annual" && (
          <>
            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAnnualYear((y) => y - 1)}
                className="btn btn-ghost btn-sm"
              >
                &#8592;
              </button>
              <span className="font-semibold text-base">{annualYear}</span>
              <button
                type="button"
                onClick={() => setAnnualYear((y) => y + 1)}
                className="btn btn-ghost btn-sm"
              >
                &#8594;
              </button>
            </div>

            {annual && (
              <>
                {/* Total */}
                <div className="card bg-base-200 rounded-2xl">
                  <div className="card-body p-5">
                    <div className="text-xs text-base-content/50 uppercase tracking-wide">
                      Annual Total
                    </div>
                    <div className="text-4xl font-mono font-bold text-primary mt-1">
                      NT${annual.total.toLocaleString()}
                    </div>
                    <div className="text-xs text-base-content/50 mt-1">
                      {annual.expense_count} transactions
                    </div>
                  </div>
                </div>

                {/* Chart type toggle */}
                <div className="flex justify-end gap-1">
                  {(["pie", "bar"] as ChartType[]).map((ct) => (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => setChartType(ct)}
                      className={`btn btn-xs ${chartType === ct ? "btn-primary" : "btn-ghost"}`}
                    >
                      {ct === "pie" ? "Pie" : "Bar"}
                    </button>
                  ))}
                </div>

                {/* Category chart — guarded by mounted */}
                {mounted && (
                  chartType === "pie" ? (
                    <div className="flex justify-center">
                      <PieChart width={260} height={220}>
                        <Pie
                          data={annual.categories}
                          dataKey="total"
                          nameKey="category_name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          strokeWidth={2}
                        >
                          {annual.categories.map((entry, index) => (
                            <Cell
                              key={entry.category_id}
                              fill={PIE_COLORS[index % PIE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => [`NT$${Number(value).toLocaleString()}`, ""]}
                        />
                      </PieChart>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={annual.categories}
                        margin={{ top: 4, right: 8, left: 0, bottom: 40 }}
                      >
                        <XAxis
                          dataKey="category_name"
                          tick={{ fontSize: 10 }}
                          angle={-35}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis tick={{ fontSize: 10 }} width={50} />
                        <Tooltip
                          formatter={(value) => [`NT$${Number(value).toLocaleString()}`, "Amount"]}
                        />
                        <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}

                {/* Category list */}
                <div className="card bg-base-100 border border-base-200 rounded-2xl overflow-hidden">
                  <div className="px-4 pt-3 pb-1 text-xs text-base-content/50 uppercase tracking-wide font-semibold">
                    By Category
                  </div>
                  <div className="divide-y divide-base-200">
                    {annual.categories.map((cat) => (
                      <CategoryRow
                        key={cat.category_id}
                        cat={cat}
                        onDrillDown={setDrillDownCategory}
                      />
                    ))}
                  </div>
                </div>

                {/* Month-by-month bar chart — guarded by mounted */}
                {mounted && (
                  <div className="card bg-base-200 rounded-2xl">
                    <div className="card-body p-4">
                      <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-3">
                        Monthly Trend
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart
                          data={annual.monthly_trend}
                          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                        >
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} width={50} />
                          <Tooltip
                            formatter={(value) => [`NT$${Number(value).toLocaleString()}`, "Amount"]}
                          />
                          <Bar dataKey="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* By payer */}
                <div className="card bg-base-200 rounded-2xl">
                  <div className="card-body p-4">
                    <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-2">
                      By Payer
                    </div>
                    <div className="space-y-2">
                      {annual.payers.map((p) => (
                        <div key={p.payer_id} className="flex justify-between items-center">
                          <span className="text-sm font-medium">{p.payer_name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-base-content/50">{p.percentage}%</span>
                            <span className="font-mono font-semibold text-sm">
                              NT${p.total.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Insights stub */}
                <div className="p-4 bg-base-200 rounded-xl text-sm text-base-content/50">
                  ✨ Insights coming soon...
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
