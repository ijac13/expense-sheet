"use client";
import Link from "next/link";
import { Category, categoryIcon, resolveCategory } from "../lib/categories";
import { Expense } from "../lib/expenses";
import { USERS } from "../lib/users";

interface Props {
  expenses: Expense[];
  /** Full live list, archived included — the resolution source for these rows. */
  categories: Category[];
}

export default function TodayExpenseList({ expenses, categories }: Props) {
  if (expenses.length === 0) {
    return (
      <div className="px-4 pt-8 text-center text-base-content/40 text-sm">
        No expenses today
      </div>
    );
  }

  return (
    <div className="divide-y divide-base-300">
      {expenses.map(exp => {
        const cat = resolveCategory(exp.category_id, categories);
        const paidByUser = USERS.find(u => u.id === exp.paid_by);
        return (
          <Link
            key={exp.id}
            href={`/expense/${exp.id}`}
            className="grid grid-cols-[44px_1fr_auto] gap-3 items-center px-4 py-3 hover:bg-base-200 transition-colors"
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-white border border-base-300">
              <span className="text-xl">{categoryIcon(cat)}</span>
            </span>
            <div>
              <div className="text-[15px] font-medium">{cat?.name_en ?? exp.category_id}</div>
              {exp.notes && <div className="text-[13px] text-base-content/50 mt-0.5">{exp.notes}</div>}
              <div className="text-[12px] text-base-content/40 mt-0.5">
                {paidByUser?.name ?? exp.paid_by}
              </div>
            </div>
            <div className="text-[15px] font-medium tabular-nums">
              NT${exp.amount.toLocaleString()}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
