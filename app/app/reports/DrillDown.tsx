"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReportExpense, PayerFilter } from "../lib/reportTypes";
import { getExpensesByCategory } from "../lib/reportService";
import { USERS } from "../lib/users";

interface Props {
  year: number;
  month: number | null; // null = annual view
  categoryId: string;
  categoryName: string;
  icon: string;
  periodLabel: string;
  payer: PayerFilter;
  onBack: () => void;
}

export default function DrillDown({
  year,
  month,
  categoryId,
  categoryName,
  icon,
  periodLabel,
  payer,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<ReportExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  function load() {
    setLoading(true);
    setError(null);
    getExpensesByCategory(year, month, categoryId, payer)
      .then((data) => { setExpenses(data); setLoading(false); })
      .catch(() => { setError("load_failed"); setLoading(false); });
  }

  useEffect(load, [year, month, categoryId, payer]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-primary text-primary-content px-4 pt-6 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-primary-content/80 mb-3 text-sm"
        >
          <span>←</span> {t("reports.back")}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <div className="text-xl font-bold">{categoryName}</div>
            <div className="text-sm opacity-70">{periodLabel}</div>
          </div>
        </div>
        {!loading && !error && (
          <div className="mt-3">
            <div className="text-sm opacity-70">{t("reports.total")}</div>
            <div className="text-3xl font-mono font-bold">
              NT${total.toLocaleString()}
            </div>
            <div className="text-sm opacity-70 mt-1">{expenses.length} {t("reports.transactions")}</div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-base-content/60 text-sm">{t("errors.load_failed")}</p>
            <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
              {t("errors.retry")}
            </button>
          </div>
        )}

        {!loading && !error && expenses.length === 0 && (
          <div className="text-center py-16 text-base-content/40">
            <div className="text-4xl mb-3">{icon}</div>
            <div className="font-medium">{t("reports.no_data_period")}</div>
          </div>
        )}

        {!loading && !error && expenses.length > 0 && (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <div key={expense.id} className="card bg-base-200 shadow-sm">
                <div className="card-body p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-base-content/60">{expense.date}</div>
                      {expense.notes && (
                        <div className="text-sm mt-0.5 truncate">{expense.notes}</div>
                      )}
                      <div className="text-xs text-base-content/50 mt-0.5">
                        {USERS.find(u => u.id === expense.paid_by || u.name === expense.paid_by)?.name ?? expense.paid_by}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-mono font-semibold">
                        NT${expense.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
