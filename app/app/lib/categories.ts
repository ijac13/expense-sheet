export interface Category {
  id: string;
  name_en: string;
  name_zh: string;
  icon: string;
  sort_order: number;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "eating-out", name_en: "Eating Out", name_zh: "外食", icon: "🍜", sort_order: 1 },
  { id: "daily-necessities", name_en: "Daily Necessities", name_zh: "日用品", icon: "🧴", sort_order: 2 },
  { id: "groceries", name_en: "Groceries", name_zh: "食材", icon: "🥬", sort_order: 3 },
  { id: "medical", name_en: "Medical", name_zh: "醫療", icon: "🏥", sort_order: 4 },
  { id: "travel", name_en: "Travel", name_zh: "旅遊", icon: "✈️", sort_order: 5 },
  { id: "transportation", name_en: "Transportation", name_zh: "交通", icon: "🚌", sort_order: 6 },
  { id: "digital", name_en: "Digital", name_zh: "數位", icon: "💻", sort_order: 7 },
  { id: "babies", name_en: "Babies", name_zh: "寶貝", icon: "👶", sort_order: 8 },
  { id: "clothing", name_en: "Clothing", name_zh: "衣服", icon: "👕", sort_order: 9 },
  { id: "sports", name_en: "Sports", name_zh: "運動", icon: "🏃", sort_order: 10 },
  { id: "gifts", name_en: "Gifts", name_zh: "禮物", icon: "🎁", sort_order: 11 },
  { id: "tuition", name_en: "Tuition", name_zh: "學費", icon: "📚", sort_order: 12 },
  { id: "tolls", name_en: "Tolls", name_zh: "過路", icon: "🛣️", sort_order: 13 },
  { id: "equipment", name_en: "Equipment", name_zh: "設備", icon: "🔧", sort_order: 14 },
  { id: "fuel", name_en: "Fuel", name_zh: "加油", icon: "⛽", sort_order: 15 },
  { id: "entertainment", name_en: "Entertainment", name_zh: "娛樂", icon: "🎬", sort_order: 16 },
  { id: "rent", name_en: "Rent", name_zh: "房租", icon: "🏠", sort_order: 17 },
  { id: "shopping", name_en: "Shopping", name_zh: "購物", icon: "🛒", sort_order: 18 },
  { id: "car-repair", name_en: "Car Repair", name_zh: "修車", icon: "🚗", sort_order: 19 },
  { id: "donate", name_en: "Donate", name_zh: "捐款", icon: "💝", sort_order: 20 },
  { id: "mortgage", name_en: "Mortgage", name_zh: "房貸", icon: "🏡", sort_order: 21 },
  { id: "other", name_en: "Other", name_zh: "其他", icon: "📦", sort_order: 22 },
];

export const LAST_CATEGORY_KEY = "expense_last_category_id";

export function getDefaultCategory(): string {
  if (typeof window === "undefined") return DEFAULT_CATEGORIES[0].id;
  const stored = localStorage.getItem(LAST_CATEGORY_KEY);
  if (stored && DEFAULT_CATEGORIES.find((c) => c.id === stored)) return stored;
  return DEFAULT_CATEGORIES[0].id;
}

export function saveLastCategory(categoryId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_CATEGORY_KEY, categoryId);
}
