"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { getAllExpenses } from "../lib/historyService";
import { DEFAULT_CATEGORIES, CATEGORY_ICONS } from "../lib/categories";
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
  return dateStr.slice(0, 7); // "YYYY-MM"
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

export default function HistoryPage() {
  const expenses = useMemo(() => getAllExpenses(), []);
  const groups = useMemo(() => groupByDate(expenses), [expenses]);

  // Group day-groups by month
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

  if (expenses.length === 0) {
    return (
      <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-12 pb-20">
        <h1 className="text-2xl font-semibold mb-4">History</h1>
        <p className="text-base-content/50 text-sm text-center pt-12">No expenses yet</p>
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto pb-20">
      <div className="sticky top-0 bg-base-100 px-4 pt-12 pb-3 border-b border-base-300">
        <h1 className="text-2xl font-semibold">History</h1>
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
                  <span className="text-xs text-base-content/40">{entryCount} entries</span>
                  <span className="text-sm font-semibold">NT${monthTotal.toLocaleString()}</span>
                </div>
              </div>

              {dayGroups.map((group) => (
                <div key={group.date}>
                  {/* Date group header */}
                  <div className="flex justify-between items-center px-4 pt-3 pb-1">
                    <span className="text-[11px] uppercase tracking-wider text-base-content/50 font-medium">
                      {formatDateHeader(group.date)}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-base-content/50 font-medium">
                      NT${group.total.toLocaleString()}
                    </span>
                  </div>

                  {/* Expense rows */}
                  <div className="divide-y divide-base-300">
                    {group.expenses.map((expense) => {
                      const cat = DEFAULT_CATEGORIES.find(c => c.id === expense.category_id);
                      const Icon = cat ? (CATEGORY_ICONS[cat.id] ?? Package) : Package;
                      const paidByUser = USERS.find(u => u.id === expense.paid_by);
                      return (
                        <Link
                          key={expense.id}
                          href={`/expense/${expense.id}`}
                          className="grid grid-cols-[44px_1fr_auto] gap-3 items-center px-4 py-3 hover:bg-base-200 transition-colors"
                        >
                          <span className="grid place-items-center w-10 h-10 rounded-xl bg-white border border-base-300">
                            <Icon size={22} strokeWidth={1.6} className="text-base-content" />
                          </span>
                          <div>
                            <div className="text-[15px] font-medium">{cat?.name_en ?? expense.category_id}</div>
                            {expense.notes && (
                              <div className="text-[13px] text-base-content/50 mt-0.5">{expense.notes}</div>
                            )}
                            <div className="text-[12px] text-base-content/40 mt-0.5">
                              {paidByUser?.name ?? expense.paid_by}
                            </div>
                          </div>
                          <div className="text-[15px] font-medium tabular-nums">
                            NT${expense.amount.toLocaleString()}
                          </div>
                        </Link>
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
  );
}
