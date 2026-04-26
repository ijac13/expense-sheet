import { Expense } from "./expenses";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export async function updateExpense(
  id: string,
  data: Partial<Omit<Expense, "id" | "created_by" | "created_at">>
): Promise<Expense> {
  const res = await fetch(`${API_BASE}/api`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error ?? `Update failed (${res.status})`);
  }
  return res.json();
}

export async function deleteExpense(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    throw new Error(err.error ?? `Delete failed (${res.status})`);
  }
}
