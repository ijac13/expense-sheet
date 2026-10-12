"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReportExpense, PayerFilter, CostGroup } from "../lib/reportTypes";
import { getExpensesByCategory, getIncomesByCategory } from "../lib/reportService";
import { DEFAULT_CATEGORIES, Category } from "../lib/categories";
import { getCategories } from "../lib/categoryService";
import { USERS } from "../lib/users";
import ExpenseEditSheet from "../components/ExpenseEditSheet";

interface Props {
  year: number;
  month: number | null; // null = annual view
  categoryId: string;
  categoryName: string;
  icon: string;
  periodLabel: string;
  payer: PayerFilter;
  group?: CostGroup; // set when opened from a cost-group row
  kind?: "expense" | "income"; // income lists the category's income rows (077)
  onBack: () => void;
  onDataChanged: () => void;
}

export default function DrillDown({
  year,
  month,
  categoryId,
  categoryName,
  icon,
  periodLabel,
  payer,
  group,
  kind = "expense",
  onBack,
  onDataChanged,
}: Props) {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<ReportExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [selected, setSelected] = useState<ReportExpense | null>(null);

  // Every active category: the edit sheet narrows its picker to the row's own kind.
  const categories = useMemo(
    () => allCategories.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [allCategories]
  );
  const isIncome = kind === "income";
  const fetchRows = () => (isIncome
    ? getIncomesByCategory(year, month, categoryId)
    : getExpensesByCategory(year, month, categoryId, payer, group));

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    getCategories()
      .then((cats) => {
        if (cats.length > 0) setAllCategories(cats);
      })
      .catch(() => {
        // Keep DEFAULT_CATEGORIES as fallback
      });
  }, []);

  function load() {
    setLoading(true);
    setError(null);
    fetchRows()
      .then((data) => { setExpenses(data); setLoading(false); })
      .catch(() => { setError("load_failed"); setLoading(false); });
  }

  useEffect(load, [year, month, categoryId, payer, group, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch after a write so rows, the header total, and the transaction count come from
  // server truth — an edit can move an expense out of this category, period, or payer filter.
  function refreshAfterWrite() {
    onDataChanged();
    fetchRows()
      .then(setExpenses)
      .catch(() => setError("load_failed"));
  }

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
            <div data-testid="drill-total" className="text-3xl font-mono font-bold">
              {isIncome ? "+" : ""}NT${total.toLocaleString()}
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
              <button
                type="button"
                key={expense.id}
                onClick={() => setSelected(expense)}
                className="card bg-base-200 shadow-sm w-full text-left hover:bg-base-300 transition-colors"
              >
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
                      <div className={`font-mono font-semibold ${isIncome ? "text-success" : ""}`}>
                        {isIncome ? "+" : ""}NT${expense.amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <ExpenseEditSheet
          expense={isIncome ? { ...selected, kind: "income" } : selected}
          categories={categories}
          allCategories={allCategories}
          onClose={() => setSelected(null)}
          onSaved={refreshAfterWrite}
          onDeleted={refreshAfterWrite}
        />
      )}
    </div>
  );
}
