import { apiFetch } from "./apiClient";

export interface Income {
  id: string;
  date: string; // "YYYY-MM-DD"
  amount: number;
  category_id: string;
  received_by: string;
  created_by?: string;
  notes?: string;
  created_at: string;
}

const API_BASE = "/api/income";

function isIncomeRow(row: unknown): row is Income {
  return typeof row === "object" && row !== null && "received_by" in row && !("paid_by" in row);
}

// The session's one GET /api/income, shared by Home, History and the Earnings
// page — the same pattern as expensesCache.ts. A failed fetch is not cached.
let cache: Promise<Income[]> | null = null;

export function getSharedIncomes(): Promise<Income[]> {
  if (!cache) {
    cache = apiFetch(API_BASE)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch income: ${res.status} ${res.statusText}`);
        return res.json() as Promise<Income[]>;
      })
      // Only rows that are really income. A backend older than this page answers
      // /api/income with the expense list, which would otherwise show every
      // expense a second time as income.
      .then((rows) => (Array.isArray(rows) ? rows.filter(isIncomeRow) : []))
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

/** Every income write calls this, or other pages keep showing the old list. */
export function invalidateIncomesCache(): void {
  cache = null;
}

async function send(method: string, body: unknown, failure: string): Promise<Response> {
  const res = await apiFetch(API_BASE, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, string>;
    throw new Error(err.error ?? `${failure} (${res.status})`);
  }
  invalidateIncomesCache();
  return res;
}

export async function addIncome(income: Omit<Income, "id" | "created_at">): Promise<Income> {
  return (await send("POST", income, "Failed to save income")).json();
}

export async function updateIncome(
  id: string,
  data: Partial<Omit<Income, "id" | "created_by" | "created_at">>
): Promise<Income> {
  return (await send("PATCH", { id, ...data }, "Update failed")).json();
}

export async function deleteIncome(id: string): Promise<void> {
  await send("DELETE", { id }, "Delete failed");
}
