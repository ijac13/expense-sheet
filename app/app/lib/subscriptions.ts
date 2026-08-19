// Google Sheet tab name: "Subscriptions"
// The tab bar label (t("tabs.subscriptions")) resolves to "Subscriptions" in English.
// The Google Sheet tab must be named "Subscriptions" to match.

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  category_id: string;
  frequency: "monthly" | "annual";
  due_day: number;
  due_month?: number;
  paid_by: string;
  is_active: boolean;
  // Always a string, never null: the API returns "" for an unset date, so an
  // active subscription's end_date is "" rather than a second kind of empty.
  start_date: string;
  end_date: string;
}

export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { id: "sub1", name: "Netflix", amount: 390, category_id: "entertainment", frequency: "monthly", due_day: 15, paid_by: "user1", is_active: true, start_date: "", end_date: "" },
  { id: "sub2", name: "Spotify", amount: 149, category_id: "entertainment", frequency: "monthly", due_day: 1, paid_by: "user2", is_active: true, start_date: "", end_date: "" },
  { id: "sub3", name: "iCloud", amount: 30, category_id: "digital", frequency: "monthly", due_day: 20, paid_by: "user1", is_active: false, start_date: "", end_date: "" },
];

// The captain's LOCAL calendar date. `new Date().toISOString().split("T")[0]` —
// the convention elsewhere in this app — is UTC, so in Taipei (UTC+8) it returns
// YESTERDAY for anything done between 00:00 and 07:59. "Pre-filled with today's
// date" has to mean the day the captain is actually living in.
export function todayLocalIso(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Only two genuine ISO dates are ever compared. A hand-typed cell comes back
// locale-formatted (`2026/8/19`), and a legacy row has no start date at all —
// neither may block recording an end date. Equal dates are allowed: a
// subscription started and cancelled the same day is real.
export function endsBeforeStart(start: string, end: string): boolean {
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return false;
  return end < start;
}

export function getNextDueDate(sub: Subscription): Date {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  if (sub.frequency === "annual") {
    const dueMonth = (sub.due_month ?? 1) - 1; // convert to 0-indexed
    const daysInMonth = new Date(year, dueMonth + 1, 0).getDate();
    const day = Math.min(sub.due_day, daysInMonth);
    const candidate = new Date(year, dueMonth, day);
    if (candidate < today) candidate.setFullYear(year + 1);
    return candidate;
  } else {
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const day = Math.min(sub.due_day, daysInCurrentMonth);
    const candidate = new Date(year, month, day);
    if (candidate < today) {
      const nextMonth = month + 1;
      const daysInNextMonth = new Date(year, nextMonth + 1, 0).getDate();
      const nextDay = Math.min(sub.due_day, daysInNextMonth);
      return new Date(year, nextMonth, nextDay);
    }
    return candidate;
  }
}
