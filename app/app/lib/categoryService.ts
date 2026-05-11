import { Category } from "./categories";

const API_BASE = "/api/categories";

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error(`Failed to load categories: ${res.status}`);
  return res.json() as Promise<Category[]>;
}

export async function addCategory(
  data: Omit<Category, "id" | "sort_order" | "is_active">
): Promise<Category> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to add category: ${res.status}`);
  return res.json() as Promise<Category>;
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<Category, "name_en" | "name_zh" | "icon" | "sort_order" | "is_active">>
): Promise<Category> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update category: ${res.status}`);
  return res.json() as Promise<Category>;
}

export async function archiveCategory(id: string): Promise<void> {
  await updateCategory(id, { is_active: false });
}

export async function restoreCategory(id: string): Promise<void> {
  await updateCategory(id, { is_active: true });
}

export async function reorderCategory(
  id: string,
  direction: "up" | "down",
  categories: Category[]
): Promise<void> {
  const sorted = [...categories.filter((c) => c.is_active)].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const idx = sorted.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= sorted.length) return;

  const catA = sorted[idx];
  const catB = sorted[swapIdx];
  await Promise.all([
    updateCategory(catA.id, { sort_order: catB.sort_order }),
    updateCategory(catB.id, { sort_order: catA.sort_order }),
  ]);
}
