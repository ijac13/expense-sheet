import { Expense } from "./expenses";

export function updateExpense(id: string, data: Partial<Omit<Expense, "id" | "created_by" | "created_at">>): void {
  console.log("[stub] updateExpense", id, data);
}

export function deleteExpense(id: string): void {
  console.log("[stub] deleteExpense", id);
}
