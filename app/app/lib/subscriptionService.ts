import { Subscription } from "./subscriptions";

export function addSubscription(data: Omit<Subscription, "id" | "is_active">): Subscription {
  console.log("[stub] addSubscription", data);
  return { ...data, id: crypto.randomUUID(), is_active: true };
}

export function updateSubscription(
  id: string,
  data: Partial<Pick<Subscription, "name" | "category_id" | "due_day" | "due_month">>
): void {
  console.log("[stub] updateSubscription", id, data);
}

export function cancelSubscription(id: string): void {
  console.log("[stub] cancelSubscription", id);
}
