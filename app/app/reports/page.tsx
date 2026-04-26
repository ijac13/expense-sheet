"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { USERS } from "../lib/users";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DONUT_COLORS = ["#1e6d4a", "#5ea87f", "#f9c440", "#d97757", "#7dc6b8", "#bfdba8"];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ---------------------------------------------------------------------------
// Donut chart helpers
// ---------------------------------------------------------------------------
function segmentProps(percent: number, offset: number, total: number) {
  const circumference = 2 * Math.PI * 88;
  const dash = (percent / total) * circumference;
  const dashOffset = circumference - (offset / total) * circumference;
  return { strokeDasharray: `${dash} ${circumference - dash}`, strokeDashoffset: dashOffset };
}

function DonutChart({ categories, totalLabel }: { categories: CategoryBreakdown[]; totalLabel: string }) {
  const total = categories.reduce((s, c) => s + c.total, 0);
  if (total === 0) return null;

  let offset = 0;
  return (
    <div className="flex justify-center">
      <svg width={240} height={240} viewBox="0 0 240 240">
        {/* Track */}
        <circle
          cx={120} cy={120} r={88}
          fill="none"
          stroke="var(--color-base-200)"
          strokeWidth={22}
        />
        {categories.map((cat, i) => {
          const props = segmentProps(cat.total, offset, total);
          offset += cat.total;
          return (
            <circle
              key={cat.category_id}
              cx={120} cy={120} r={88}
              fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
              strokeWidth={22}
              strokeDasharray={props.strokeDasharray}
              strokeDashoffset={props.strokeDashoffset}
              style={{ transform: "rotate(-90deg)", transformOrigin: "120px 120px" }}
            />
          );
        })}
        <text x={120} y={114} textAnchor="middle" fontSize={13} fill="currentColor" opacity={0.5}>{totalLabel}</text>
        <text x={120} y={134} textAnchor="middle" fontSize={18} fontWeight={600} fill="currentColor">
          {`NT$${(total / 1000).toFixed(0)}k`}
        </text>
      </svg>
    </div>
  );
}

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
// Insights card
// ---------------------------------------------------------------------------
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

function InsightsCard() {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "loading" | "done" | "insufficient" | "error">("idle");
  const [insights, setInsights] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTimer() {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  useEffect(() => () => stopTimer(), []);

  async function generate() {
    setState("loading");
    setErrorMsg("");
    startTimer();
    try {
      const res = await fetch(`${API_BASE}/api/insights`, { method: "POST" });
      const data = await res.json() as Record<string, unknown>;
      stopTimer();
      if (!res.ok) {
        const detail = String(data.detail ?? data.error ?? `Server error ${res.status}`);
        setErrorMsg(detail);
        setState("error");
        return;
      }
      if (data.insufficient_data) { setState("insufficient"); return; }
      if (data.insights) { setInsights(String(data.insights)); setState("done"); }
      else {
        setErrorMsg("No insights returned from API.");
        setState("error");
      }
    } catch (err) {
      stopTimer();
      setErrorMsg(err instanceof Error ? err.message : "Network error — check your connection.");
      setState("error");
    }
  }

  // Render markdown-ish bold (**text**) as <strong>
  function renderInsights(text: string) {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} className={line.trim() === "" ? "mt-2" : "leading-relaxed"}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
        </p>
      );
    });
  }

  if (state === "idle") return (
    <div className="bg-base-200 rounded-2xl p-5 space-y-3">
      <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">{t("reports.insights_title")}</div>
      <p className="text-sm text-base-content/70">
        {t("reports.insights_description")}
      </p>
      <button onClick={generate} className="btn btn-primary btn-sm w-full">
        {t("reports.generate_insights")}
      </button>
    </div>
  );

  if (state === "loading") return (
    <div className="bg-base-200 rounded-2xl p-5 flex flex-col items-center gap-3 py-8">
      <span className="loading loading-spinner loading-md text-primary" />
      <p className="text-sm text-base-content/70 text-center">
        {t("reports.insights_loading")}
      </p>
      <p className="text-xs text-base-content/40">
        {t("reports.insights_eta")}{elapsed > 0 ? ` · ${elapsed}s` : ""}
      </p>
    </div>
  );

  if (state === "insufficient") return (
    <div className="bg-base-200 rounded-2xl p-5">
      <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-2">{t("reports.insights_title")}</div>
      <p className="text-sm text-base-content/60">
        {t("reports.insights_insufficient")} {t("reports.insights_insufficient_msg")}
      </p>
    </div>
  );

  if (state === "error") return (
    <div className="bg-base-200 rounded-2xl p-5 space-y-3">
      <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">{t("reports.insights_title")}</div>
      <p className="text-sm text-error/80">{t("reports.insights_error")}</p>
      {errorMsg && (
        <p className="text-xs text-base-content/40 font-mono break-all bg-base-300 rounded px-2 py-1">{errorMsg}</p>
      )}
      <button onClick={generate} className="btn btn-ghost btn-sm">{t("errors.retry")}</button>
    </div>
  );

  // done
  return (
    <div className="bg-base-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">{t("reports.insights_title")}</div>
        <button onClick={() => setState("idle")} className="text-xs text-base-content/40 hover:text-base-content/70">
          {t("reports.regenerate")}
        </button>
      </div>
      <div className="text-sm text-base-content/80 space-y-1">
        {renderInsights(insights)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ReportsPage() {
  const { t } = useTranslation();
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
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto pb-20">
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <div className="sticky top-0 bg-base-100 px-4 pt-6 pb-3 border-b border-base-300 z-10">
        <h1 className="text-2xl font-semibold mb-3">{t("reports.title")}</h1>

        {/* Period toggle */}
        <div className="flex gap-1 bg-base-200 rounded-xl p-1 mb-3">
          {(["monthly", "annual"] as ReportPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-colors capitalize ${
                period === p
                  ? "bg-primary text-primary-content"
                  : "text-base-content/60"
              }`}
            >
              {t(`reports.${p}`)}
            </button>
          ))}
        </div>

        {/* Payer filter */}
        <select
          value={payer}
          onChange={e => setPayer(e.target.value as PayerFilter)}
          className="w-full px-3 py-2 rounded-xl bg-base-200 text-sm font-medium outline-none"
        >
          <option value="all">{t("reports.all_users")}</option>
          {USERS.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
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
              <button type="button" onClick={prevMonth} className="btn btn-ghost btn-sm">
                <ChevronLeft size={18} />
              </button>
              <span className="font-semibold text-base">
                {monthly?.label ?? `${MONTH_SHORT[month - 1]} ${year}`}
              </span>
              <button type="button" onClick={nextMonth} className="btn btn-ghost btn-sm">
                <ChevronRight size={18} />
              </button>
            </div>

            {monthly && monthly.total === 0 ? (
              <div className="text-center py-16 text-base-content/40">
                <div className="font-medium">{t("reports.no_data_period")}</div>
                <div className="text-sm mt-1">{t("reports.try_different_month")}</div>
              </div>
            ) : monthly ? (
              <>
                {/* Summary header */}
                <div className="bg-base-200 rounded-2xl p-5">
                  <div className="text-xs text-base-content/50 uppercase tracking-wide mb-1">{t("reports.total_spending")}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[40px] font-medium leading-none">
                      NT${Math.floor(monthly.total).toLocaleString()}
                    </span>
                    <span className="text-2xl text-base-content/50">
                      .{String(Math.round((monthly.total % 1) * 100)).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <DeltaBadge current={monthly.total} previous={monthly.comparison.prev_month_total} />
                    <span className="text-xs text-base-content/50">
                      vs {monthly.comparison.prev_month_label} · NT${Math.round(monthly.total / 30).toLocaleString()}{t("reports.day_avg")}
                    </span>
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
                      {ct === "pie" ? t("reports.donut") : t("reports.bar")}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                {mounted && (
                  chartType === "pie" ? (
                    <DonutChart categories={monthly.categories} totalLabel={t("reports.total")} />
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
                          formatter={(value) => [`NT$${Number(value).toLocaleString()}`, t("reports.amount")]}
                        />
                        <Bar dataKey="total" fill="#1e6d4a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}

                {/* Category list */}
                <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">
                  <div className="px-4 pt-3 pb-1 text-xs text-base-content/50 uppercase tracking-wide font-semibold">
                    {t("reports.by_category")}
                  </div>
                  <div className="divide-y divide-base-300">
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
                <div className="bg-base-200 rounded-2xl p-4">
                  <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-2">
                    {t("reports.by_payer")}
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

                {/* Comparison */}
                <div className="bg-base-200 rounded-2xl p-4">
                  <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-3">
                    {t("reports.comparison")}
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

                {/* AI Insights */}
                <InsightsCard />
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
              <button type="button" onClick={() => setAnnualYear((y) => y - 1)} className="btn btn-ghost btn-sm">
                <ChevronLeft size={18} />
              </button>
              <span className="font-semibold text-base">{annualYear}</span>
              <button type="button" onClick={() => setAnnualYear((y) => y + 1)} className="btn btn-ghost btn-sm">
                <ChevronRight size={18} />
              </button>
            </div>

            {annual && (
              <>
                {/* Summary header */}
                <div className="bg-base-200 rounded-2xl p-5">
                  <div className="text-xs text-base-content/50 uppercase tracking-wide mb-1">{t("reports.annual_total")}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[40px] font-medium leading-none">
                      NT${Math.floor(annual.total).toLocaleString()}
                    </span>
                    <span className="text-2xl text-base-content/50">
                      .{String(Math.round((annual.total % 1) * 100)).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="text-xs text-base-content/50 mt-1.5">
                    {annual.expense_count} {t("reports.transactions")} · NT${Math.round(annual.total / 12).toLocaleString()}{t("reports.month_avg")}
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
                      {ct === "pie" ? "Donut" : "Bar"}
                    </button>
                  ))}
                </div>

                {/* Chart */}
                {mounted && (
                  chartType === "pie" ? (
                    <DonutChart categories={annual.categories} totalLabel={t("reports.total")} />
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
                          formatter={(value) => [`NT$${Number(value).toLocaleString()}`, t("reports.amount")]}
                        />
                        <Bar dataKey="total" fill="#1e6d4a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}

                {/* Category list */}
                <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden">
                  <div className="px-4 pt-3 pb-1 text-xs text-base-content/50 uppercase tracking-wide font-semibold">
                    {t("reports.by_category")}
                  </div>
                  <div className="divide-y divide-base-300">
                    {annual.categories.map((cat) => (
                      <CategoryRow
                        key={cat.category_id}
                        cat={cat}
                        onDrillDown={setDrillDownCategory}
                      />
                    ))}
                  </div>
                </div>

                {/* Monthly trend chart */}
                {mounted && (
                  <div className="bg-base-200 rounded-2xl p-4">
                    <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-3">
                      {t("reports.monthly_trend")}
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart
                        data={annual.monthly_trend}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} width={50} />
                        <Tooltip
                          formatter={(value) => [`NT$${Number(value).toLocaleString()}`, t("reports.amount")]}
                        />
                        <Bar dataKey="total" fill="#1e6d4a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* By payer */}
                <div className="bg-base-200 rounded-2xl p-4">
                  <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-2">
                    {t("reports.by_payer")}
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

                {/* AI Insights */}
                <InsightsCard />
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
