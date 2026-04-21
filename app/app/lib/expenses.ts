export interface Expense {
  id: string;
  date: string; // ISO date string "YYYY-MM-DD"
  amount: number;
  category_id: string;
  paid_by: string;
  notes: string;
  created_at: string; // ISO datetime
}

export const MOCK_EXPENSES: Expense[] = [
  {
    id: "mock-001",
    date: new Date().toISOString().split("T")[0],
    amount: 380,
    category_id: "eating-out",
    paid_by: "user1",
    notes: "Lunch with team",
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-002",
    date: new Date().toISOString().split("T")[0],
    amount: 1200,
    category_id: "groceries",
    paid_by: "user2",
    notes: "",
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "mock-003",
    date: new Date().toISOString().split("T")[0],
    amount: 250,
    category_id: "transportation",
    paid_by: "user1",
    notes: "Taxi to airport",
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
];

export function getTodayExpenses(expenses: Expense[]): Expense[] {
  const today = new Date().toISOString().split("T")[0];
  return expenses
    .filter((e) => e.date === today)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getDailyTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Stub save: logs to console and returns the new expense.
 * Replace with real Firebase call in entity 006.
 */
export function stubSaveExpense(expense: Omit<Expense, "id" | "created_at">): Expense {
  const newExpense: Expense = {
    ...expense,
    id: `exp-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  console.log("[stub] Saving expense:", newExpense);
  return newExpense;
}
