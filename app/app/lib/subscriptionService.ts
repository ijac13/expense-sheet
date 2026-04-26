import { Subscription } from "./subscriptions";

const API_BASE = "/api/subscriptions";

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
  data: Partial<Pick<Subscription, "name" | "category_id" | "due_day" | "due_month">>
): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok) throw new Error(`Failed to update subscription: ${res.status}`);
}

export async function cancelSubscription(id: string): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, is_active: false }),
  });
  if (!res.ok) throw new Error(`Failed to cancel subscription: ${res.status}`);
}
