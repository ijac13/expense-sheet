"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Maximize2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MonthlyTrend } from "../lib/reportTypes";

const THIS_YEAR_COLOR = "#1e6d4a";
const LAST_YEAR_COLOR = "#c2c7c0";

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
  // Recharts skips zero-height bars and numbers only the drawn ones, so the
  // month comes from originalDataIndex, not the click's index.
  const onClick = onPick ? (bar: { originalDataIndex: number }) => onPick(bar.originalDataIndex) : undefined;
  return (
    <>
      <Bar dataKey="prev_total" name={String(year - 1)} fill={LAST_YEAR_COLOR} radius={[3, 3, 0, 0]}
        onClick={onClick} />
      <Bar dataKey="total" name={String(year)} fill={THIS_YEAR_COLOR} radius={[3, 3, 0, 0]}
        onClick={onClick} />
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

export default function TrendCard({ data: trend, year, includeBusiness }: { data: MonthlyTrend[]; year: number; includeBusiness: boolean }) {
  const { t } = useTranslation();
  const [enlarged, setEnlarged] = useState(false);
  const data = includeBusiness
    ? trend.map((m) => ({ ...m, total: m.total + m.business, prev_total: m.prev_total + m.prev_business }))
    : trend;
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
