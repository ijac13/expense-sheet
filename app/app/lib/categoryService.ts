import { Category } from "./categories";

export function addCategory(data: Omit<Category, "id" | "sort_order" | "is_active">, currentMax: number): Category {
  console.log("[stub] addCategory", data);
  return { ...data, id: crypto.randomUUID(), sort_order: currentMax + 1, is_active: true };
}

export function updateCategory(id: string, data: Partial<Pick<Category, "name_en" | "name_zh" | "icon">>): void {
  console.log("[stub] updateCategory", id, data);
}

export function archiveCategory(id: string): void {
  console.log("[stub] archiveCategory", id);
}

export function restoreCategory(id: string): void {
  console.log("[stub] restoreCategory", id);
}

export function reorderCategory(id: string, direction: "up" | "down"): void {
  console.log("[stub] reorderCategory", id, direction);
}
