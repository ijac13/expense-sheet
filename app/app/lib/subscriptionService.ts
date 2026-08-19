import { Subscription } from "./subscriptions";

const API_BASE = "/api/subscriptions";

export interface SchedulerStatus {
  last_run_at: string | null;
  due_count: number;
  created_count: number;
  skipped_count: number;
  error: string;
  stale: boolean;
}

// A scheduler that stopped and an API that cannot answer are the same thing from
// the captain's side: no evidence auto-add ran. Both report stale, because this
// feature exists precisely because a silent stoppage went unnoticed for months.
export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  const unknown: SchedulerStatus = {
    last_run_at: null,
    due_count: 0,
    created_count: 0,
    skipped_count: 0,
    error: "",
    stale: true,
  };
  try {
    const res = await fetch("/api/scheduler-status");
    if (!res.ok) return unknown;
    return (await res.json()) as SchedulerStatus;
  } catch {
    return unknown;
  }
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`Failed to load subscriptions: ${res.status}`);
  return res.json() as Promise<Subscription[]>;
}

export async function addSubscription(data: Omit<Subscription, "id" | "is_active">): Promise<Subscription> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to add subscription: ${res.status}`);
  return res.json() as Promise<Subscription>;
}

export async function updateSubscription(
  id: string,
  data: Partial<Pick<Subscription, "name" | "amount" | "category_id" | "due_day" | "due_month">>
): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok) throw new Error(`Failed to update subscription: ${res.status}`);
}

// The end date is passed in rather than derived here: it is whatever the captain
// confirmed in the modal, which may be days earlier than today.
export async function cancelSubscription(id: string, end_date: string): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, is_active: false, end_date }),
  });
  if (!res.ok) throw new Error(`Failed to cancel subscription: ${res.status}`);
}
