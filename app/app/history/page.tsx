"use client";

import { useMemo, useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAllExpenses } from "../lib/historyService";
import { DEFAULT_CATEGORIES } from "../lib/categories";
import { Expense } from "../lib/expenses";
import { USERS } from "../lib/users";

interface DayGroup {
  date: string;
  total: number;
  expenses: Expense[];
}

function groupByDate(expenses: Expense[]): DayGroup[] {
  const map = new Map<string, Expense[]>();
  for (const exp of expenses) {
    const list = map.get(exp.date) ?? [];
    list.push(exp);
    map.set(exp.date, list);
  }
  const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return sortedDates.map((date) => {
    const dayExpenses = map.get(date)!;
    return {
      date,
      total: dayExpenses.reduce((sum, e) => sum + e.amount, 0),
      expenses: dayExpenses,
    };
  });
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDateHeader(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

export default function HistoryPage() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Expense | null>(null);

  useEffect(() => {
    getAllExpenses()
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => groupByDate(expenses), [expenses]);

  const monthGroups = useMemo(() => {
    const months = new Map<string, DayGroup[]>();
    for (const g of groups) {
      const mk = getMonthKey(g.date);
      const arr = months.get(mk) ?? [];
      arr.push(g);
      months.set(mk, arr);
    }
    return Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [groups]);

  const selectedCat = selected ? DEFAULT_CATEGORIES.find(c => c.id === selected.category_id) : null;
  const selectedPaidBy = selected ? USERS.find(u => u.id === selected.paid_by) : null;
  const selectedCreatedBy = selected ? USERS.find(u => u.id === selected.created_by) : null;

  if (loading) {
    return (
      <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-6 pb-20">
        <h1 className="text-2xl font-semibold mb-4">{t("history.title")}</h1>
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      </main>
    );
  }

  if (expenses.length === 0) {
    return (
      <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-6 pb-20">
        <h1 className="text-2xl font-semibold mb-4">{t("history.title")}</h1>
        <p className="text-base-content/50 text-sm text-center pt-12">{t("history.no_expenses")}</p>
      </main>
    );
  }

  return (
    <>
      <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto pb-20">
        <div className="sticky top-0 bg-base-100 px-4 pt-6 pb-3 border-b border-base-300">
          <h1 className="text-2xl font-semibold">{t("history.title")}</h1>
        </div>

        <div className="py-2">
          {monthGroups.map(([monthKey, dayGroups]) => {
            const monthTotal = dayGroups.reduce((s, g) => s + g.total, 0);
            const entryCount = dayGroups.reduce((s, g) => s + g.expenses.length, 0);
            return (
              <div key={monthKey} className="mb-4">
                {/* Month header */}
                <div className="flex items-center justify-between px-4 py-2 bg-base-200">
                  <span className="text-sm font-semibold text-base-content/80">{formatMonthLabel(monthKey)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-base-content/40">{entryCount} {t("history.entries")}</span>
                    <span className="text-sm font-semibold">NT${monthTotal.toLocaleString()}</span>
                  </div>
                </div>

                {dayGroups.map((group) => (
                  <div key={group.date}>
                    {/* Date group header */}
                    <div className="flex justify-between items-center px-4 pt-3 pb-1.5 border-b border-base-300/60">
                      <span className="text-[11px] uppercase tracking-wider text-base-content/50 font-medium">
                        {formatDateHeader(group.date)}
                      </span>
                      <span className="text-sm font-semibold text-base-content">
                        NT${group.total.toLocaleString()}
                      </span>
                    </div>

                    {/* Expense rows */}
                    <div className="divide-y divide-base-300">
                      {group.expenses.map((expense) => {
                        const cat = DEFAULT_CATEGORIES.find(c => c.id === expense.category_id);
                        const paidByUser = USERS.find(u => u.id === expense.paid_by);
                        return (
                          <button
                            key={expense.id}
                            onClick={() => setSelected(expense)}
                            className="w-full grid grid-cols-[44px_1fr_auto] gap-3 items-center px-4 py-3 hover:bg-base-200 transition-colors text-left"
                          >
                            <span className="grid place-items-center w-10 h-10 rounded-xl bg-white border border-base-300">
                              <span className="text-xl">{cat?.icon ?? "💰"}</span>
                            </span>
                            <div className="min-w-0">
                              <div className="text-[15px] font-medium">{cat?.name_en ?? expense.category_id}</div>
                              {expense.notes && (
                                <div className="text-[13px] text-base-content/50 mt-0.5 truncate">{expense.notes}</div>
                              )}
                              <div className="text-[12px] text-base-content/40 mt-0.5">
                                {paidByUser?.name ?? expense.paid_by}
                              </div>
                            </div>
                            <div className="text-[15px] font-medium tabular-nums shrink-0">
                              NT${expense.amount.toLocaleString()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </main>

      {/* Expense detail bottom sheet */}
      {selected && (
        <div
          className="fixed inset-0 z-[60] bg-black/45 flex items-end"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md mx-auto bg-base-100 rounded-t-3xl pb-8"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle + close */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="w-9 h-1 rounded-full bg-base-300 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <div />
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-full bg-base-200 text-base-content/60">
                <X size={18} />
              </button>
            </div>

            {/* Category icon + name */}
            <div className="flex items-center gap-4 px-5 pt-2 pb-4 border-b border-base-300">
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
                <span className="text-3xl">{selectedCat?.icon ?? "💰"}</span>
              </span>
              <div>
                <div className="text-xl font-semibold">{selectedCat?.name_en ?? selected.category_id}</div>
                <div className="text-sm text-base-content/50">{formatFullDate(selected.date)}</div>
              </div>
              <div className="ml-auto text-2xl font-semibold tabular-nums">
                NT${selected.amount.toLocaleString()}
              </div>
            </div>

            {/* Details */}
            <div className="px-5 py-4 space-y-3">
              {selected.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">Note</div>
                  <div className="text-base text-base-content">{selected.notes}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">Paid by</div>
                  <div className="text-sm font-medium">{selectedPaidBy?.name ?? selected.paid_by}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">Logged by</div>
                  <div className="text-sm font-medium">{selectedCreatedBy?.name ?? selected.created_by}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
