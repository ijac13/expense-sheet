"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "../lib/apiClient";
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
  ReportPeriod,
  CostGroup,
  AnnualCostGroups,
  AnnualComparison,
  MonthComparison,
  MonthlyTrend,
} from "../lib/reportTypes";
import { getMonthlySummary, getAnnualSummary } from "../lib/reportService";
import DrillDown from "./DrillDown";
import MonthPickerModal from "../components/MonthPickerModal";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { USERS } from "../lib/users";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const COST_GROUPS: CostGroup[] = ["fixed", "big_extra", "living"];
const COST_GROUP_COLORS: Record<CostGroup, string> = {
  fixed: "#1e6d4a",
  big_extra: "#f9c440",
  living: "#d97757",
};

const THIS_YEAR_COLOR = "#1e6d4a";
const LAST_YEAR_COLOR = "#c2c7c0";

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

function DonutChart({
  categories,
  totalLabel,
  colors,
  testId,
}: {
  categories: Pick<CategoryBreakdown, "category_id" | "total">[];
  totalLabel: string;
  colors: string[];
  testId?: string;
}) {
  const total = categories.reduce((s, c) => s + c.total, 0);
  if (total === 0) return null;

  let offset = 0;
  return (
    <div className="flex justify-center" data-testid={testId}>
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
              stroke={colors[i % colors.length]}
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
// Cost groups — Fixed / Big extras / Living costs, the period's only category
// breakdown. Each Compare button lays one earlier period's matching days beside it.
// ---------------------------------------------------------------------------
function compareLabel(c: AnnualComparison, t: (k: string, o?: Record<string, unknown>) => string) {
  if (c.through === null) return t("reports.compare_full", { year: c.year });
  const m = Number(c.through.slice(0, 2));
  const d = Number(c.through.slice(3));
  return t("reports.compare_partial", { year: c.year, m, d, mon: MONTH_SHORT[m - 1] });
}

/** "Sep 1–7", "Oct 1–7, 2025" or "Sep 2026" — the year shown only when it differs. */
function monthRangeLabel(
  c: MonthComparison,
  viewedYear: number,
  t: (k: string, o?: Record<string, unknown>) => string
) {
  const opts = { year: c.year, m: c.month, d: c.through_day, mon: MONTH_SHORT[c.month - 1] };
  if (c.through_day === null) return t("reports.range_month", opts);
  return t(c.year === viewedYear ? "reports.range_days" : "reports.range_days_year", opts);
}

interface CardComparison {
  key: string;
  button: string; // the toggle's label
  label: string;  // the short label beside each group's compared amount
  total: number;
  groups: AnnualCostGroups;
}

function CostGroupsCard({
  groups,
  comparisons,
  periodTotal,
  lang,
  onDrillDown,
}: {
  groups: AnnualCostGroups;
  comparisons: CardComparison[];
  periodTotal: number;
  lang: string;
  onDrillDown: (cat: CategoryBreakdown, group: CostGroup) => void;
}) {
  const { t } = useTranslation();
  // One comparison at a time; tapping the active button turns it off.
  const [selected, setSelected] = useState<string | null>(null);
  const comparison = comparisons.find((c) => c.key === selected) ?? null;
  const comparing = comparison !== null;
  const name = (zh: string, en: string) => (lang === "zh" && zh ? zh : en);
  // An empty group has no segment; colors stay paired with their group.
  const segments = COST_GROUPS.filter((g) => groups[g].total > 0).map((g) => ({ category_id: g, total: groups[g].total }));

  function categoryRows(group: "fixed" | "living") {
    const current = groups[group].categories;
    const previous = comparison?.groups[group].categories ?? [];
    const prevTotal = new Map(previous.map((c) => [c.category_id, c.total]));
    // While comparing, a category spent on only last year shows as NT$0 so a drop is visible.
    const goneThisYear = previous
      .filter((p) => !current.some((c) => c.category_id === p.category_id))
      .map((p) => ({ ...p, total: 0, count: 0, percentage: 0 }));
    const rows = comparing ? [...current, ...goneThisYear] : current;
    return rows.map((cat) => {
      const share = periodTotal > 0 ? Math.round((cat.total / periodTotal) * 100) : 0;
      const prev = prevTotal.get(cat.category_id) ?? 0;
      return (
        <button
          type="button"
          key={cat.category_id}
          data-testid={`${group}-row`}
          disabled={cat.total === 0}
          onClick={() => onDrillDown(cat, group)}
          className="w-full py-2 px-2 hover:bg-base-300 transition-colors rounded-lg text-left disabled:hover:bg-transparent"
        >
          <div className="flex justify-between items-baseline">
            <span className="text-sm truncate">{name(cat.category_name_zh, cat.category_name)}</span>
            <span className="font-mono text-sm ml-2 shrink-0">NT${cat.total.toLocaleString()}</span>
          </div>
          <div className="mt-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: COST_GROUP_COLORS[group] }} />
          </div>
          <div className="flex justify-between items-center text-xs text-base-content/50 mt-0.5">
            <span>{share}%</span>
            {comparing && (
              <span data-testid="row-compare" className="flex items-center gap-1.5">
                <span className="font-mono">NT${prev.toLocaleString()}</span>
                <DeltaBadge current={cat.total} previous={prev} />
              </span>
            )}
          </div>
        </button>
      );
    });
  }

  return (
    <div data-testid="cost-groups" className="bg-base-200 rounded-2xl p-4 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">
          {t("reports.cost_groups")}
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {comparisons.map((c) => (
            <button
              key={c.key}
              type="button"
              data-testid={`compare-${c.key}`}
              aria-pressed={selected === c.key}
              onClick={() => setSelected((s) => (s === c.key ? null : c.key))}
              className={`btn btn-xs ${selected === c.key ? "btn-primary" : "btn-ghost border border-base-300"}`}
            >
              {c.button}
            </button>
          ))}
        </div>
      </div>
      <DonutChart
        testId="group-donut"
        categories={segments}
        colors={segments.map((s) => COST_GROUP_COLORS[s.category_id])}
        totalLabel={t("reports.total")}
      />
      {comparison && (
        <div data-testid="total-compare" className="flex justify-between items-center px-2 text-sm">
          <span className="text-base-content/70">{t("reports.total")}</span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-base-content/50">NT${comparison.total.toLocaleString()} →</span>
            <span className="font-mono font-semibold">NT${periodTotal.toLocaleString()}</span>
            <DeltaBadge current={periodTotal} previous={comparison.total} />
          </span>
        </div>
      )}
      {COST_GROUPS.map((group) => (
        <div key={group}>
          <div className="flex justify-between items-baseline px-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COST_GROUP_COLORS[group] }} />
              {t(`reports.group_${group}`)}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-xs text-base-content/50">{groups[group].percentage}%</span>
              <span data-testid={`group-total-${group}`} className="font-mono font-semibold text-sm">
                NT${groups[group].total.toLocaleString()}
              </span>
            </span>
          </div>
          {comparison && (
            <div data-testid={`group-compare-${group}`} className="flex justify-end items-center gap-1.5 px-2 text-xs text-base-content/50">
              <span>{comparison.label}</span>
              <span className="font-mono">NT${comparison.groups[group].total.toLocaleString()}</span>
              <DeltaBadge current={groups[group].total} previous={comparison.groups[group].total} />
            </div>
          )}
          {group === "big_extra" ? (
            groups.big_extra.expenses.length === 0 ? (
              <p className="text-xs text-base-content/50 px-2 mt-1">{t("reports.group_big_extra_hint")}</p>
            ) : (
              groups.big_extra.expenses.map((e) => (
                <div key={e.id} data-testid="big-extra-row" className="flex justify-between items-start py-2 px-2">
                  <div className="min-w-0">
                    <div className="text-xs text-base-content/50">
                      {e.date} · {name(e.category_name_zh, e.category_name)}
                    </div>
                    <div className="text-sm truncate">{e.notes}</div>
                  </div>
                  <span className="font-mono text-sm ml-2 shrink-0">NT${e.amount.toLocaleString()}</span>
                </div>
              ))
            )
          ) : (
            categoryRows(group)
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly trend (Annual) — this year beside last year, with a full-screen
// landscape view. iOS pages can't rotate the screen, so in portrait the
// enlarged chart is drawn turned 90°: the captain turns the phone to read it.
// ---------------------------------------------------------------------------
function TrendLegend({ year }: { year: number }) {
  return (
    <span className="flex items-center gap-3 text-xs text-base-content/60">
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LAST_YEAR_COLOR }} />
        {year - 1}
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: THIS_YEAR_COLOR }} />
        {year}
      </span>
    </span>
  );
}

function TrendBars({ year, onPick }: { year: number; onPick?: (index: number) => void }) {
  return (
    <>
      <Bar dataKey="prev_total" name={String(year - 1)} fill={LAST_YEAR_COLOR} radius={[3, 3, 0, 0]}
        onClick={onPick ? (_: unknown, i: number) => onPick(i) : undefined} />
      <Bar dataKey="total" name={String(year)} fill={THIS_YEAR_COLOR} radius={[3, 3, 0, 0]}
        onClick={onPick ? (_: unknown, i: number) => onPick(i) : undefined} />
    </>
  );
}

// The enlarged chart's long and short side, from the window rather than from
// the rotated box: Recharts measures on-screen size, which rotation swaps.
function useLandscapeSize() {
  const read = () => ({
    long: Math.max(window.innerWidth, window.innerHeight),
    short: Math.min(window.innerWidth, window.innerHeight),
  });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const onResize = () => setSize(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

function TrendFullscreen({ data, year, onClose }: { data: MonthlyTrend[]; year: number; onClose: () => void }) {
  const { t } = useTranslation();
  const { long, short } = useLandscapeSize();
  const [picked, setPicked] = useState<number | null>(null);
  const pick = picked === null ? null : data[picked];
  return (
    <div data-testid="trend-fullscreen" className="fixed inset-0 z-[1000] bg-base-100 overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 landscape:rotate-0 flex flex-col p-4"
        style={{ width: long, height: short }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">
              {t("reports.monthly_trend")}
            </span>
            <TrendLegend year={year} />
          </div>
          <span data-testid="trend-picked" className="text-sm truncate">
            {pick ? (
              <>
                <span className="font-semibold">{pick.label}</span>
                <span className="text-base-content/60"> · {year - 1} </span>
                <span className="font-mono">NT${pick.prev_total.toLocaleString()}</span>
                <span className="text-base-content/60"> · {year} </span>
                <span className="font-mono">NT${pick.total.toLocaleString()}</span>
              </>
            ) : (
              <span className="text-base-content/50">{t("reports.trend_tap_hint")}</span>
            )}
          </span>
          <button type="button" aria-label={t("reports.close")} onClick={onClose} className="btn btn-ghost btn-sm btn-circle shrink-0">
            <X size={20} />
          </button>
        </div>
        <BarChart width={long - 32} height={short - 80} data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} width={56} />
          {TrendBars({ year, onPick: setPicked })}
        </BarChart>
      </div>
    </div>
  );
}

function TrendCard({ data, year }: { data: MonthlyTrend[]; year: number }) {
  const { t } = useTranslation();
  const [enlarged, setEnlarged] = useState(false);
  return (
    <div className="bg-base-200 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">
          {t("reports.monthly_trend")}
        </div>
        <div className="flex items-center gap-2">
          <TrendLegend year={year} />
          <button
            type="button"
            data-testid="trend-enlarge"
            aria-label={t("reports.enlarge")}
            onClick={() => setEnlarged(true)}
            className="btn btn-ghost btn-xs btn-square"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={1}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={50} />
          <Tooltip formatter={(value, name) => [`NT$${Number(value).toLocaleString()}`, name]} />
          {TrendBars({ year })}
        </BarChart>
      </ResponsiveContainer>
      {enlarged && <TrendFullscreen data={data} year={year} onClose={() => setEnlarged(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Insights card
// ---------------------------------------------------------------------------
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

type InsightsPeriod =
  | { type: "monthly"; year: number; month: number }
  | { type: "annual"; year: number };

interface InsightsCache {
  text: string;
  generatedAt: string; // ISO 8601
}

// Per-period key. The flat `insights_cache` key this replaces is never read, so
// an entry written before this change can never surface under a period.
function insightsCacheKey(period: InsightsPeriod): string {
  return period.type === "monthly"
    ? `insights_cache:monthly:${period.year}-${String(period.month).padStart(2, "0")}`
    : `insights_cache:annual:${period.year}`;
}

// The period a response says it analysed, as a cache key — the only way to tell
// whether an arriving result belongs to the period now on screen.
function echoedCacheKey(echo: unknown): string | null {
  if (typeof echo !== "object" || echo === null) return null;
  const e = echo as Record<string, unknown>;
  if (typeof e.year !== "number") return null;
  if (e.type === "annual") return insightsCacheKey({ type: "annual", year: e.year });
  if (e.type === "monthly" && typeof e.month === "number") {
    return insightsCacheKey({ type: "monthly", year: e.year, month: e.month });
  }
  return null;
}

function readInsightsCache(key: string): InsightsCache | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as InsightsCache;
  } catch {
    return null;
  }
}

function writeInsightsCache(key: string, cache: InsightsCache) {
  try {
    localStorage.setItem(key, JSON.stringify(cache));
  } catch {
    // localStorage unavailable or full — the insight stays on screen regardless
  }
}

function InsightsCard({ period }: { period: InsightsPeriod }) {
  const cacheKey = insightsCacheKey(period);
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "loading" | "done" | "insufficient" | "error" | "regen_error">("idle");
  const [insights, setInsights] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState("reports.insights_error");
  const [insufficientDays, setInsufficientDays] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentKeyRef = useRef(cacheKey);
  const inflightKeysRef = useRef<Set<string>>(new Set());

  // Re-reads the cache whenever the viewed period changes, so the card shows
  // this period's insight, this period's generation in flight, or nothing.
  useEffect(() => {
    currentKeyRef.current = cacheKey;
    const cached = readInsightsCache(cacheKey);
    if (cached) {
      setInsights(cached.text);
      setGeneratedAt(cached.generatedAt);
      setState("done");
      return;
    }
    setInsights("");
    setGeneratedAt(null);
    setState(inflightKeysRef.current.has(cacheKey) ? "loading" : "idle");
  }, [cacheKey]);

  function startTimer() {
    stopTimer();
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  useEffect(() => () => stopTimer(), []);

  async function generate() {
    const requestKey = cacheKey;
    const requestBody = period.type === "monthly"
      ? { period: "monthly", year: period.year, month: period.month }
      : { period: "annual", year: period.year };
    const isRegen = state === "done" || state === "regen_error";
    setState("loading");
    if (!isRegen) setErrorKey("reports.insights_error");
    inflightKeysRef.current.add(requestKey);
    startTimer();
    try {
      const res = await apiFetch(`${API_BASE}/api/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const data = await res.json() as Record<string, unknown>;
      stopTimer();
      // A result belongs to the period it says it analysed, not to whatever is
      // on screen when it lands. Errors carry no echo, so they fall back to the
      // period that was requested.
      const resultKey = echoedCacheKey(data.period) ?? requestKey;
      const isCurrent = resultKey === currentKeyRef.current;
      if (data.insufficient_data) {
        if (!isCurrent) return;
        setInsufficientDays(typeof data.days === "number" ? data.days : 0);
        setState("insufficient");
        return;
      }
      if (!res.ok) {
        if (!isCurrent) return;
        const code = String(data.error_code ?? "");
        const key = code === "ai_error"
          ? "reports.insights_error_ai"
          : code === "data_error"
          ? "reports.insights_error_data"
          : "reports.insights_error";
        setErrorKey(key);
        // If regen fails, keep the cached insight visible with the error shown
        setState(isRegen ? "regen_error" : "error");
        return;
      }
      if (data.insights) {
        const text = String(data.insights);
        const ts = new Date().toISOString();
        writeInsightsCache(resultKey, { text, generatedAt: ts });
        if (!isCurrent) return;
        setInsights(text);
        setGeneratedAt(ts);
        setState("done");
      } else {
        if (!isCurrent) return;
        setErrorKey("reports.insights_error");
        setState(isRegen ? "regen_error" : "error");
      }
    } catch {
      stopTimer();
      if (requestKey !== currentKeyRef.current) return;
      setErrorKey("reports.insights_error_data");
      // On network failure during regen, keep cache visible
      setState(isRegen ? "regen_error" : "error");
    } finally {
      inflightKeysRef.current.delete(requestKey);
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

  // AC-4: When no cache exists, show "Generate Insights"; otherwise "Regenerate"
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
    <div className="bg-base-200 rounded-2xl p-5 space-y-2">
      <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">{t("reports.insights_title")}</div>
      <p className="text-sm font-medium text-base-content/70">{t("reports.insights_insufficient")}</p>
      <p className="text-sm text-base-content/50">
        {insufficientDays > 0
          ? `${insufficientDays} / 7 ${t("reports.insights_days_progress")}`
          : null}
      </p>
      <p className="text-sm text-base-content/50">{t("reports.insights_insufficient_msg")}</p>
    </div>
  );

  if (state === "error") return (
    <div className="bg-base-200 rounded-2xl p-5 space-y-3">
      <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">{t("reports.insights_title")}</div>
      <p className="text-sm text-error/80">{t(errorKey)}</p>
      <button onClick={generate} className="btn btn-ghost btn-sm">{t("errors.retry")}</button>
    </div>
  );

  // done or regen_error — show cached insight
  // AC-3: Show timestamp; AC-4: button reads "Regenerate"; AC-6: show error inline on regen_error
  return (
    <div className="bg-base-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">{t("reports.insights_title")}</div>
        <button onClick={generate} className="btn btn-ghost btn-xs">
          {t("reports.regenerate")}
        </button>
      </div>
      <div className="text-sm text-base-content/80 space-y-1">
        {renderInsights(insights)}
      </div>
      {generatedAt && (
        <p className="text-xs text-base-content/40">
          {t("reports.insights_generated_at")} {new Date(generatedAt).toLocaleString()}
        </p>
      )}
      {state === "regen_error" && (
        <p className="text-xs text-error/80">{t(errorKey)}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ReportsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const now = new Date();
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<ReportPeriod>("monthly");
  const [payer, setPayer] = useState<PayerFilter>("all");

  // Monthly navigation
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  // Annual navigation
  const [annualYear, setAnnualYear] = useState(now.getFullYear());

  // Data
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [annual, setAnnual] = useState<AnnualSummary | null>(null);
  const [loading, setLoading] = useState(false);

  // Drill-down state
  const [drillDownCategory, setDrillDownCategory] = useState<CategoryBreakdown | null>(null);
  // Set when the drill-down was opened from a cost-group row (071).
  const [drillDownGroup, setDrillDownGroup] = useState<CostGroup | undefined>(undefined);

  // Bumped when the drill-down writes an expense, so summaries refetch instead of
  // showing figures the edit already invalidated.
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => setMounted(true), []);

  // Force a refetch (via the same dataVersion lever the drill-down write-path
  // already uses) when the user returns here via browser/gesture back-forward
  // navigation. Next's App Router client cache can reuse an already-rendered
  // page on that path without re-running mount effects (see the identical note
  // in history/page.tsx and node_modules/next/dist/docs/01-app/04-glossary.md#client-cache),
  // so a category renamed while Reports was already visited earlier in the
  // session would otherwise keep showing the old name. `popstate` never fires
  // for normal <Link>-tab navigation.
  useEffect(() => {
    function handlePopState() {
      setDataVersion((v) => v + 1);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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
  }, [period, year, month, payer, dataVersion]);

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
  }, [period, annualYear, payer, dataVersion]);

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
        categoryName={
          lang === "zh" && drillDownCategory.category_name_zh
            ? drillDownCategory.category_name_zh
            : drillDownCategory.category_name
        }
        icon={drillDownCategory.icon}
        periodLabel={
          period === "monthly"
            ? `${MONTH_SHORT[month - 1]} ${year}`
            : String(annualYear)
        }
        payer={payer}
        group={drillDownGroup}
        onBack={() => { setDrillDownCategory(null); setDrillDownGroup(undefined); }}
        onDataChanged={() => setDataVersion(v => v + 1)}
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
              <button
                type="button"
                data-testid="reports-month-button"
                onClick={() => setMonthPickerOpen(true)}
                className="font-semibold text-base"
              >
                {monthly?.label ?? `${MONTH_SHORT[month - 1]} ${year}`}
              </button>
              <button type="button" onClick={nextMonth} className="btn btn-ghost btn-sm">
                <ChevronRight size={18} />
              </button>
            </div>

            {monthPickerOpen && (
              <MonthPickerModal
                year={year}
                month={month}
                onPick={(y, m) => {
                  setYear(y);
                  setMonth(m);
                }}
                onClose={() => setMonthPickerOpen(false)}
              />
            )}

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
                    <DeltaBadge current={monthly.total} previous={monthly.comparison.prev_month.total} />
                    <span className="text-xs text-base-content/50">
                      vs {monthRangeLabel(monthly.comparison.prev_month, year, t)} · NT${Math.round(monthly.total / 30).toLocaleString()}{t("reports.day_avg")}
                    </span>
                  </div>
                </div>

                {/* Cost groups + compare to last month / same month last year */}
                <CostGroupsCard
                  groups={monthly.groups}
                  comparisons={(["prev_month", "last_year"] as const).map((key) => {
                    const c = monthly.comparison[key];
                    const range = monthRangeLabel(c, year, t);
                    return { key, button: t("reports.compare_vs", { range }), label: range, total: c.total, groups: c.groups };
                  })}
                  periodTotal={monthly.total}
                  lang={lang}
                  onDrillDown={(cat, group) => {
                    setDrillDownGroup(group);
                    setDrillDownCategory(cat);
                  }}
                />

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
                    {[monthly.comparison.prev_month, monthly.comparison.last_year].map((c) => (
                      <div key={`${c.year}-${c.month}`} data-testid="month-compare-line" className="flex justify-between items-center">
                        <span className="text-sm text-base-content/70">vs {monthRangeLabel(c, year, t)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">NT${c.total.toLocaleString()}</span>
                          <DeltaBadge current={monthly.total} previous={c.total} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insights */}
                <InsightsCard period={{ type: "monthly", year, month }} />
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

                {/* Monthly trend chart — this year vs last year */}
                {mounted && <TrendCard data={annual.monthly_trend} year={annualYear} />}

                {/* Cost groups — Fixed / Big extras / Living costs (071) */}
                {annual.expense_count > 0 && (
                  <CostGroupsCard
                    groups={annual.groups}
                    comparisons={[{
                      key: "last_year",
                      button: compareLabel(annual.comparison, t),
                      label: String(annual.comparison.year),
                      total: annual.comparison.total,
                      groups: annual.comparison.groups,
                    }]}
                    periodTotal={annual.total}
                    lang={lang}
                    onDrillDown={(cat, group) => {
                      setDrillDownGroup(group);
                      setDrillDownCategory(cat);
                    }}
                  />
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
                <InsightsCard period={{ type: "annual", year: annualYear }} />
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
