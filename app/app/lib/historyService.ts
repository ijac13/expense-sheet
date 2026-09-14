import { Expense } from "./expenses";
import { getSharedExpenses } from "./expensesCache";

/**
 * Fetch all expenses from the shared session cache, sorted by date descending.
 * Clones before sorting — the cache may hand the same array reference to
 * Home and Reports too, and Array#sort mutates in place.
 */
export async function getAllExpenses(): Promise<Expense[]> {
  const all = await getSharedExpenses();
  return [...all].sort((a, b) => {
    const dateDiff = b.date.localeCompare(a.date);
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
