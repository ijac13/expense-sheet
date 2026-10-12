"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getEarningsSummary } from "../../lib/reportService";
import { BusinessCard, EarningsSummary, IncomeCard } from "../../lib/reportTypes";
import { BUSINESS_ICONS } from "../../lib/categories";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function signed(n: number): string {
  return `${n < 0 ? "−" : "+"}NT$${Math.abs(n).toLocaleString()}`;
}

// The period comes from the Reports row that opened this page (?y=2026&m=10,
// or ?y=2026 for a whole year). Read after mount: a static export has no
// server to hand the query string to the first render.
function periodFromUrl(): { year: number; month: number | null } {
  const now = new Date();
  const params = new URLSearchParams(window.location.search);
  const year = Number(params.get("y")) || now.getFullYear();
  const m = params.get("m");
  if (m === null) return params.get("y") ? { year, month: null } : { year, month: now.getMonth() + 1 };
  const month = Number(m);
  return { year, month: month >= 1 && month <= 12 ? month : now.getMonth() + 1 };
}

function TrendBars({ trend }: { trend: BusinessCard["trend"] }) {
  const max = Math.max(1, ...trend.map((p) => Math.abs(p.earnings)));
  const hasLoss = trend.some((p) => p.earnings < 0);
  // Bars grow up from a zero line for a profit and down from it for a loss.
  const up = 56;
  const down = hasLoss ? 28 : 0;
  return (
    <div data-testid="business-trend" className="flex items-stretch gap-1 pt-2">
      {trend.map((p, i) => {
        const h = (Math.abs(p.earnings) / max) * (p.earnings < 0 ? down || up : up);
        const last = i === trend.length - 1;
        return (
          <div key={`${p.label}-${i}`} className="flex-1 flex flex-col items-center min-w-0">
            <div className="w-full flex flex-col justify-end" style={{ height: up }}>
              {p.earnings > 0 && (
                <div className={`w-full rounded-t bg-success ${last ? "" : "opacity-55"}`} style={{ height: h }} />
              )}
            </div>
            <div className="w-full border-t border-base-content/20" />
            <div className="w-full" style={{ height: down }}>
              {p.earnings < 0 && (
                <div className={`w-full rounded-b bg-error ${last ? "" : "opacity-55"}`} style={{ height: h }} />
              )}
            </div>
            <span className="text-[10px] text-base-content/50 mt-1">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function BusinessCardView({ card, lang }: { card: BusinessCard; lang: string }) {
  const { t } = useTranslation();
  const name = (zh: string, en: string) => (lang === "zh" && zh ? zh : en);
  return (
    <div data-testid={`card-${card.business}`} className="bg-base-200 rounded-2xl p-4 space-y-2">
      <div className="text-xs text-base-content/50 uppercase tracking-wide font-semibold">
        {BUSINESS_ICONS[card.business]} {t(`earnings.business_${card.business}`)}
      </div>
      {card.income.map((l) => (
        <div key={l.category_id} className="flex justify-between text-sm">
          <span>{name(l.category_name_zh, l.category_name)}</span>
          <span className="font-mono text-success">+{l.total.toLocaleString()}</span>
        </div>
      ))}
      {card.costs.length === 0 ? (
        <div className="flex justify-between text-sm">
          <span className="text-base-content/60">{t("earnings.costs")}</span>
          <span className="font-mono">0</span>
        </div>
      ) : (
        card.costs.map((c) => (
          <div key={c.category_id} className="flex justify-between text-sm">
            <span>{c.icon} {name(c.category_name_zh, c.category_name)}</span>
            <span className="font-mono text-error">−{c.total.toLocaleString()}</span>
          </div>
        ))
      )}
      <div className="flex justify-between items-baseline border-t border-base-300 pt-2 font-semibold">
        <span>{t(`earnings.earnings_${card.business}`)}</span>
        <span data-testid={`earnings-${card.business}`} className={`font-mono text-base ${card.earnings < 0 ? "text-error" : "text-success"}`}>
          {signed(card.earnings)}
        </span>
      </div>
      <TrendBars trend={card.trend} />
    </div>
  );
}

function IncomeCardView({ card, lang }: { card: IncomeCard; lang: string }) {
  return (
    <div data-testid={`card-income-${card.category_id}`} className="bg-base-200 rounded-2xl p-4 flex justify-between items-baseline">
      <span className="font-semibold">{card.icon} {lang === "zh" && card.category_name_zh ? card.category_name_zh : card.category_name}</span>
      <span className="font-mono font-semibold text-success">+NT${card.total.toLocaleString()}</span>
    </div>
  );
}

export default function EarningsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [period, setPeriod] = useState<{ year: number; month: number | null } | null>(null);
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => setPeriod(periodFromUrl()), []);

  useEffect(() => {
    if (!period) return;
    setSummary(null);
    setFailed(false);
    getEarningsSummary(period.year, period.month)
      .then(setSummary)
      .catch(() => setFailed(true));
  }, [period]);

  function step(dir: 1 | -1) {
    setPeriod((p) => {
      if (!p) return p;
      if (p.month === null) return { year: p.year + dir, month: null };
      const index = p.year * 12 + (p.month - 1) + dir;
      return { year: Math.floor(index / 12), month: (index % 12) + 1 };
    });
  }

  const label = period ? (period.month === null ? String(period.year) : `${MONTH_SHORT[period.month - 1]} ${period.year}`) : "";

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto pb-24">
      <div className="sticky top-0 bg-base-100 px-4 pt-6 pb-3 border-b border-base-300 z-10">
        <Link href="/reports" className="flex items-center gap-1 text-sm text-primary mb-2">
          <ChevronLeft size={16} /> {t("reports.title")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("earnings.title")}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => step(-1)} className="btn btn-ghost btn-sm" aria-label="Previous">
            <ChevronLeft size={18} />
          </button>
          <span className="font-semibold text-base">{label}</span>
          <button type="button" onClick={() => step(1)} className="btn btn-ghost btn-sm" aria-label="Next">
            <ChevronRight size={18} />
          </button>
        </div>

        {failed && <p className="text-sm text-error text-center">{t("earnings.load_failed")}</p>}
        {!summary && !failed && (
          <div className="flex justify-center py-16"><span className="loading loading-spinner loading-md text-primary" /></div>
        )}

        {summary && (
          <>
            <div data-testid="earnings-summary" className="bg-base-200 rounded-2xl p-4 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[11px] text-base-content/50 uppercase tracking-wide font-semibold">{t("earnings.money_in")}</div>
                  <div className="font-mono font-semibold">{summary.money_in.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[11px] text-base-content/50 uppercase tracking-wide font-semibold">{t("earnings.spending")}</div>
                  <div className="font-mono font-semibold">{summary.spending.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[11px] text-base-content/50 uppercase tracking-wide font-semibold">{t("earnings.left_over")}</div>
                  <div className={`font-mono font-semibold ${summary.left_over < 0 ? "text-error" : "text-success"}`}>
                    {summary.left_over < 0 ? "−" : "+"}{Math.abs(summary.left_over).toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-base-content/60">{t("earnings.money_in_hint")}</p>
            </div>

            {summary.cards.length === 0 && (
              <p className="text-sm text-base-content/50 text-center py-8">{t("earnings.empty")}</p>
            )}
            {summary.cards.map((card) =>
              card.type === "business"
                ? <BusinessCardView key={card.business} card={card} lang={lang} />
                : <IncomeCardView key={card.category_id} card={card} lang={lang} />
            )}
          </>
        )}
      </div>
    </main>
  );
}
