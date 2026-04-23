import { Expense } from "./expenses";

const API_BASE = "/api/expenses";

/**
 * Fetch all expenses from the API, sorted by date descending.
 */
export async function getAllExpenses(): Promise<Expense[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) {
    throw new Error(`Failed to fetch expenses: ${res.status} ${res.statusText}`);
  }
  const all: Expense[] = await res.json();
  return all.sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
