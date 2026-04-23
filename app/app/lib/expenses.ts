export interface Expense {
  id: string;
  date: string; // ISO date string "YYYY-MM-DD"
  amount: number;
  category_id: string;
  paid_by: string;
  created_by?: string; // who logged the expense
  notes?: string;
  created_at: string; // ISO datetime
  subscription_id?: string; // set if created by a recurring subscription
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

const API_BASE = "/api/expenses";

/**
 * Add an expense via the Firebase Function API.
 */
export async function addExpense(expense: Omit<Expense, "id" | "created_at">): Promise<Expense> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(expense),
  });
  if (!res.ok) {
    throw new Error(`Failed to save expense: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<Expense>;
}

/**
 * Get all today's expenses from the API.
 */
export async function getTodayExpenses(): Promise<Expense[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) {
    throw new Error(`Failed to fetch expenses: ${res.status} ${res.statusText}`);
  }
  const all: Expense[] = await res.json();
  const today = new Date().toISOString().split("T")[0];
  return all
    .filter((e) => e.date === today)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getDailyTotal(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}
