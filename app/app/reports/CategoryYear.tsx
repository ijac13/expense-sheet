"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryMonth, CostGroup, PayerFilter } from "../lib/reportTypes";
import { getCategoryMonths } from "../lib/reportService";
import DrillDown from "./DrillDown";
import TrendCard from "./TrendChart";

interface Props {
  year: number;
  categoryId: string;
  categoryName: string;
  icon: string;
  payer: PayerFilter;
  group?: CostGroup; // the cost-group row it was opened from
  onBack: () => void;
  onDataChanged: () => void;
}

/**
 * One Annual category month by month (080): the year total, a chart of this
 * category's months beside last year's, and one row per month, newest first.
 * A month opens its expenses in DrillDown; Back from there returns here.
 */
export default function CategoryYear({ year, categoryId, categoryName, icon, payer, group, onBack, onDataChanged }: Props) {
  const { t } = useTranslation();
  const [months, setMonths] = useState<CategoryMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  function load() {
    setLoading(true);
    setError(false);
    getCategoryMonths(year, categoryId, payer, group)
      .then((data) => { setMonths(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }

  // Reloads on coming back from a month too, so an edit made there shows here.
  useEffect(() => {
    if (openMonth === null) load();
  }, [year, categoryId, payer, group, openMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (openMonth === null) window.scrollTo(0, 0); }, [openMonth]);

  if (openMonth !== null) {
    const m = months[openMonth - 1];
    return (
      <DrillDown
        year={year}
        month={openMonth}
        categoryId={categoryId}
        categoryName={categoryName}
        icon={icon}
        periodLabel={`${m?.label ?? openMonth} ${year}`}
        payer={payer}
        group={group}
        onBack={() => setOpenMonth(null)}
        onDataChanged={onDataChanged}
      />
    );
  }

  // A running year lists up to this month; a later month shows only when it has
  // spending (an expense dated ahead), so the rows always add up to the year.
  const now = new Date();
  const lastListed = year < now.getFullYear() ? 12 : year === now.getFullYear() ? now.getMonth() + 1 : 0;
  const rows = months.filter((m) => m.month <= lastListed || m.total > 0).reverse();
  const total = months.reduce((s, m) => s + m.total, 0);
  const count = months.reduce((s, m) => s + m.count, 0);

  return (
    <div className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto">
      <div className="bg-primary text-primary-content px-4 pt-6 pb-4">
        <button type="button" onClick={onBack} className="flex items-center gap-2 text-primary-content/80 mb-3 text-sm">
          <span>←</span> {t("reports.back")}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <div className="text-xl font-bold">{categoryName}</div>
            <div className="text-sm opacity-70">{year}</div>
          </div>
        </div>
        {!loading && !error && (
          <div className="mt-3">
            <div className="text-sm opacity-70">{t("reports.total")}</div>
            <div data-testid="category-year-total" className="text-3xl font-mono font-bold">NT${total.toLocaleString()}</div>
            <div className="text-sm opacity-70 mt-1">{count} {t("reports.transactions")}</div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-base-content/60 text-sm">{t("errors.load_failed")}</p>
            <button type="button" className="btn btn-sm btn-ghost" onClick={load}>{t("errors.retry")}</button>
          </div>
        )}

        {!loading && !error && (
          <>
            <TrendCard data={months} year={year} includeBusiness={false} />
            <div data-testid="category-months" className="bg-base-200 rounded-2xl p-4">
              <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold mb-2 px-2">
                {t("reports.by_month")}
              </div>
              {rows.map((m) => (
                <button
                  type="button"
                  key={m.month}
                  data-testid="category-month-row"
                  disabled={m.total === 0}
                  onClick={() => setOpenMonth(m.month)}
                  className="w-full flex justify-between items-baseline py-2 px-2 hover:bg-base-300 transition-colors rounded-lg text-left disabled:hover:bg-transparent disabled:opacity-60"
                >
                  <span className="text-sm">{m.label}</span>
                  <span className="flex items-baseline gap-2">
                    {m.count > 0 && (
                      <span className="text-xs text-base-content/50">{m.count} {t("reports.transactions")}</span>
                    )}
                    <span className="font-mono text-sm">NT${m.total.toLocaleString()}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
