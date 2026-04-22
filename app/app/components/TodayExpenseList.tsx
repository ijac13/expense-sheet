"use client";

import Link from "next/link";
import { Expense, getTodayExpenses, getDailyTotal } from "../lib/expenses";
import { DEFAULT_CATEGORIES } from "../lib/categories";
import { USERS } from "../lib/users";

interface TodayExpenseListProps {
  expenses: Expense[];
  onAddNew: () => void;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export default function TodayExpenseList({ expenses, onAddNew }: TodayExpenseListProps) {
  const today = new Date().toISOString().split("T")[0];
  const todayExpenses = getTodayExpenses(expenses);
  const total = getDailyTotal(todayExpenses);

  return (
    <div className="flex flex-col min-h-screen bg-base-100">
      {/* Header */}
      <div className="bg-primary text-primary-content px-4 pt-12 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-80">Today</div>
            <div className="text-2xl font-bold">{formatDate(today)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-80">Total</div>
            <div className="text-2xl font-bold">NT${total.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Expense list */}
      <div className="flex-1 px-4 py-3 space-y-2">
        {todayExpenses.length === 0 ? (
          <div className="text-center text-base-content/50 py-12">
            No expenses today yet
          </div>
        ) : (
          todayExpenses.map((expense) => {
            const category = DEFAULT_CATEGORIES.find((c) => c.id === expense.category_id);
            return (
              <Link key={expense.id} href={`/expense/${expense.id}`} className="block">
                <div className="card bg-base-100 border border-base-200 shadow-sm">
                  <div className="card-body p-3 flex-row items-center gap-3">
                    <div className="text-3xl">{category?.icon ?? "📦"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-base-content">
                        {category?.name_en ?? "Other"}
                      </div>
                      {expense.notes && (
                        <div className="text-xs text-base-content/60 truncate">{expense.notes}</div>
                      )}
                      <div className="text-xs text-base-content/40">Paid by {USERS.find((u) => u.id === expense.paid_by)?.name ?? expense.paid_by}</div>
                    </div>
                    <div className="text-lg font-semibold text-primary whitespace-nowrap">
                      NT${expense.amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* FAB to add new */}
      <div className="sticky bottom-0 p-4 bg-base-100/90 backdrop-blur-sm border-t border-base-200">
        <button
          type="button"
          onClick={onAddNew}
          className="btn btn-primary w-full text-lg"
        >
          + Add Expense
        </button>
      </div>
    </div>
  );
}
