import type { LucideIcon } from "lucide-react";
import {
  Utensils, ShoppingCart, Carrot, Stethoscope, Plane, Bus,
  Smartphone, Baby, Shirt, Dumbbell, Gift, GraduationCap,
  Milestone, Wrench, Fuel, Gamepad2, Home, ShoppingBag,
  Car, HandHeart, Key, Package, Shield, Receipt,
} from "lucide-react";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "eating-out": Utensils,
  "daily-necessities": ShoppingCart,
  "groceries": Carrot,
  "medical": Stethoscope,
  "travel": Plane,
  "transportation": Bus,
  "digital": Smartphone,
  "babies": Baby,
  "clothing": Shirt,
  "sports": Dumbbell,
  "gifts": Gift,
  "tuition": GraduationCap,
  "tolls": Milestone,
  "equipment": Wrench,
  "fuel": Fuel,
  "entertainment": Gamepad2,
  "rent": Home,
  "shopping": ShoppingBag,
  "car-repair": Car,
  "donate": HandHeart,
  "mortgage": Key,
  "other": Package,
  "insurance": Shield,
  "tax": Receipt,
};

export type GovCategory =
  | "food_beverage_tobacco"
  | "clothing_footwear"
  | "housing_utilities"
  | "furnishings_household"
  | "health"
  | "transport_communication"
  | "recreation_culture_education"
  | "restaurants_accommodation"
  | "insurance_financial"
  | "miscellaneous";

export const GOV_CATEGORY_LABELS: Record<GovCategory, string> = {
  food_beverage_tobacco: "食品飲料及菸草",
  clothing_footwear: "衣著鞋襪類",
  housing_utilities: "住宅服務水電瓦斯及其他燃料",
  furnishings_household: "家具設備及家務服務",
  health: "醫療保健",
  transport_communication: "交通及資通訊",
  recreation_culture_education: "休閒、運動、文化及教育",
  restaurants_accommodation: "餐廳及住宿",
  insurance_financial: "保險及金融服務",
  miscellaneous: "其他",
};

export const GOV_CATEGORY_OPTIONS: GovCategory[] = [
  "food_beverage_tobacco",
  "clothing_footwear",
  "housing_utilities",
  "furnishings_household",
  "health",
  "transport_communication",
  "recreation_culture_education",
  "restaurants_accommodation",
  "insurance_financial",
  "miscellaneous",
];

export interface Category {
  id: string;
  name_en: string;
  name_zh: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  gov_category?: GovCategory;
  note?: string;
}

export const NOTE_MAX_LENGTH = 120;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "eating-out", name_en: "Eating Out", name_zh: "外食", icon: "🍜", sort_order: 1, is_active: true, gov_category: "restaurants_accommodation" },
  { id: "daily-necessities", name_en: "Daily Necessities", name_zh: "日用品", icon: "🧴", sort_order: 2, is_active: true, gov_category: "furnishings_household" },
  { id: "groceries", name_en: "Groceries", name_zh: "食材", icon: "🥬", sort_order: 3, is_active: true, gov_category: "food_beverage_tobacco" },
  { id: "medical", name_en: "Medical", name_zh: "醫療", icon: "🏥", sort_order: 4, is_active: true, gov_category: "health" },
  { id: "travel", name_en: "Travel", name_zh: "旅遊", icon: "✈️", sort_order: 5, is_active: true, gov_category: "recreation_culture_education" },
  { id: "transportation", name_en: "Transportation", name_zh: "交通", icon: "🚌", sort_order: 6, is_active: true, gov_category: "transport_communication" },
  { id: "digital", name_en: "Digital", name_zh: "數位", icon: "💻", sort_order: 7, is_active: true, gov_category: "transport_communication" },
  { id: "babies", name_en: "Babies", name_zh: "寶貝", icon: "👶", sort_order: 8, is_active: true, gov_category: "miscellaneous" },
  { id: "clothing", name_en: "Clothing", name_zh: "衣服", icon: "👕", sort_order: 9, is_active: true, gov_category: "clothing_footwear" },
  { id: "sports", name_en: "Sports", name_zh: "運動", icon: "🏃", sort_order: 10, is_active: true, gov_category: "recreation_culture_education" },
  { id: "gifts", name_en: "Gifts", name_zh: "禮物", icon: "🎁", sort_order: 11, is_active: true, gov_category: "miscellaneous" },
  { id: "tuition", name_en: "Tuition", name_zh: "學費", icon: "📚", sort_order: 12, is_active: true, gov_category: "recreation_culture_education" },
  { id: "tolls", name_en: "Tolls", name_zh: "過路", icon: "🛣️", sort_order: 13, is_active: true, gov_category: "transport_communication" },
  { id: "equipment", name_en: "Equipment", name_zh: "設備", icon: "🔧", sort_order: 14, is_active: true, gov_category: "furnishings_household" },
  { id: "fuel", name_en: "Fuel", name_zh: "加油", icon: "⛽", sort_order: 15, is_active: true, gov_category: "transport_communication" },
  { id: "entertainment", name_en: "Entertainment", name_zh: "娛樂", icon: "🎬", sort_order: 16, is_active: true, gov_category: "recreation_culture_education" },
  { id: "rent", name_en: "Rent", name_zh: "房租", icon: "🏠", sort_order: 17, is_active: true, gov_category: "housing_utilities" },
  { id: "shopping", name_en: "Shopping", name_zh: "購物", icon: "🛒", sort_order: 18, is_active: true, gov_category: "miscellaneous" },
  { id: "car-repair", name_en: "Car Repair", name_zh: "修車", icon: "🚗", sort_order: 19, is_active: true, gov_category: "transport_communication" },
  { id: "donate", name_en: "Donate", name_zh: "捐款", icon: "💝", sort_order: 20, is_active: true, gov_category: "miscellaneous" },
  { id: "mortgage", name_en: "Mortgage", name_zh: "房貸", icon: "🏡", sort_order: 21, is_active: true, gov_category: "housing_utilities" },
  { id: "other", name_en: "Other", name_zh: "其他", icon: "📦", sort_order: 22, is_active: true, gov_category: "miscellaneous" },
  { id: "insurance", name_en: "Insurance", name_zh: "保險", icon: "🛡️", sort_order: 23, is_active: true, gov_category: "insurance_financial" },
  { id: "tax", name_en: "Tax", name_zh: "稅金", icon: "🧾", sort_order: 24, is_active: true, gov_category: "miscellaneous" },
];

export const FALLBACK_ICON = "💰";

/**
 * Resolve a stored `category_id` to the live category it belongs to.
 *
 * 99% of stored expenses and every subscription carry a legacy slug id
 * (`eating-out`) that exists in no live category — the live list uses `cat_NNN`.
 * A direct `find` therefore misses and the caller renders a placeholder. Bridge
 * the slug through DEFAULT_CATEGORIES' `name_en` to the live category of the same
 * name, so the icon comes from the sheet Category Management writes rather than
 * from the baked-in map. Nothing is written back; the stored id stays a slug.
 *
 * Pass the UNFILTERED live list — resolving against an `is_active`-filtered list
 * misses an archived category.
 */
export function resolveCategory(
  categoryId: string,
  categories: Category[]
): Category | undefined {
  const live = categories.find((c) => c.id === categoryId);
  if (live) return live;

  const legacy = DEFAULT_CATEGORIES.find((c) => c.id === categoryId);
  if (!legacy) return undefined;

  // No live twin means the live fetch failed (offline) — the baked-in entry is
  // the fallback, never the preference.
  return categories.find((c) => c.name_en === legacy.name_en) ?? legacy;
}

/**
 * The icon to render for a category. The API returns `icon: ""` for a blank cell
 * in the sheet, and `""` survives `??`, so guard with `||` — an empty string must
 * never reach the DOM as nothing at all.
 */
export function categoryIcon(category: { icon?: string } | undefined): string {
  return category?.icon?.trim() || FALLBACK_ICON;
}

export function resolveCategoryIcon(
  categoryId: string,
  categories: Category[]
): string {
  return categoryIcon(resolveCategory(categoryId, categories));
}

export const LAST_CATEGORY_KEY = "expense_last_category_id";

/**
 * The stored last-used id, verbatim, or "" when nothing is stored.
 *
 * This deliberately validates nothing. It used to gate the stored value through
 * `DEFAULT_CATEGORIES.find`, which rejected every live `cat_NNN` id — so a
 * captain's choice was written to localStorage and thrown away on the next load,
 * reverting to the `eating-out` slug. Deciding whether the stored id is still
 * usable needs the live Categories list, which only the caller has: that is
 * `pickCategoryId`'s job.
 */
export function getDefaultCategory(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LAST_CATEGORY_KEY) ?? "";
}

/**
 * The id a picker should start on, given the stored preference and the live
 * ACTIVE categories. Returns "" only when the live list is empty — there is no
 * slug fallback, because a slug is not a value any write path may submit.
 *
 * Pass the is_active-filtered list: an id that is stored but archived has to
 * fall back, since the picker renders no tile for it to highlight.
 */
export function pickCategoryId(stored: string, activeCategories: Category[]): string {
  if (stored && activeCategories.some((c) => c.id === stored)) return stored;
  return activeCategories[0]?.id ?? "";
}

export function saveLastCategory(categoryId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_CATEGORY_KEY, categoryId);
}
