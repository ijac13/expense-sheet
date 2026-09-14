import { Expense } from "./expenses";
import { apiFetch } from "./apiClient";

const API_BASE = "/api";

/**
 * The session's one `GET /api` result, shared by Home, History, and Reports so
 * navigating between them within a session issues at most one such request.
 * A rejected fetch is not cached — the next caller gets a fresh attempt rather
 * than being stuck on a transient failure for the rest of the session.
 */
let cache: Promise<Expense[]> | null = null;

export function getSharedExpenses(): Promise<Expense[]> {
  if (!cache) {
    cache = apiFetch(API_BASE)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch expenses: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<Expense[]>;
      })
      .catch((err) => {
        cache = null;
        throw err;
      });
  }
  return cache;
}

/**
 * Every write path that can change expense data (add/update/delete) must call
 * this, or a write silently goes stale on other pages for the rest of the
 * session.
 */
export function invalidateExpensesCache(): void {
  cache = null;
}
