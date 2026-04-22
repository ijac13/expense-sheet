"use client";

import { useMemo } from "react";
import { getAllExpenses } from "../lib/historyService";
import { DEFAULT_CATEGORIES } from "../lib/categories";
import { Expense } from "../lib/expenses";

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
  // Sort dates descending
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

function formatDateHeader(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";

  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export default function HistoryPage() {
  const expenses = useMemo(() => getAllExpenses(), []);
  const groups = useMemo(() => groupByDate(expenses), [expenses]);

  if (expenses.length === 0) {
    return (
      <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-12">
        <p className="text-base-content/50">No expenses yet</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto pb-20">
      <div className="sticky top-0 bg-base-100 px-4 pt-12 pb-3 border-b border-base-200">
        <h1 className="text-2xl font-bold">History</h1>
      </div>
      <div className="px-4 py-3 space-y-6">
        {groups.map((group) => (
          <div key={group.date}>
            {/* Date header with daily total */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-base-content/70">
                {formatDateHeader(group.date)}
              </span>
              <span className="text-sm font-semibold">
                NT${group.total.toLocaleString()}
              </span>
            </div>
            {/* Expense rows */}
            <div className="space-y-2">
              {group.expenses.map((expense) => {
                const cat = DEFAULT_CATEGORIES.find(
                  (c) => c.id === expense.category_id
                );
                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-3 p-3 bg-base-200 rounded-xl"
                  >
                    <span className="text-2xl">{cat?.icon ?? "💸"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {cat?.name_en ?? expense.category_id}
                      </div>
                      {expense.notes && (
                        <div className="text-xs text-base-content/50 truncate">
                          {expense.notes}
                        </div>
                      )}
                      <div className="text-xs text-base-content/40">
                        Billed by {expense.created_by ?? expense.paid_by} · Paid
                        by {expense.paid_by}
                      </div>
                    </div>
                    <span className="font-semibold text-sm whitespace-nowrap">
                      NT${expense.amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
