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
}

export const MOCK_SUBSCRIPTIONS: Subscription[] = [
  { id: "sub1", name: "Netflix", amount: 390, category_id: "entertainment", frequency: "monthly", due_day: 15, paid_by: "user1", is_active: true },
  { id: "sub2", name: "Spotify", amount: 149, category_id: "entertainment", frequency: "monthly", due_day: 1, paid_by: "user2", is_active: true },
  { id: "sub3", name: "iCloud", amount: 30, category_id: "digital", frequency: "monthly", due_day: 20, paid_by: "user1", is_active: false },
];

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
