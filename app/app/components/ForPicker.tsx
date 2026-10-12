"use client";
import { useTranslation } from "react-i18next";
import { Business, BUSINESSES, BUSINESS_ICONS } from "../lib/categories";

/** The label for a For choice: 💙 Life, 🚗 Uber or 🏠 Rent. */
export function useForLabel(): (b: Business) => string {
  const { t } = useTranslation();
  return (b) => (b ? `${BUSINESS_ICONS[b]} ${t(`earnings.business_${b}`)}` : `💙 ${t("home.for_life")}`);
}

/**
 * Who an expense is for: Life, or a business with its own earnings. One row of
 * chips, used by Home, the edit sheet and Subscriptions so all three offer the
 * same choices in the same order.
 */
export default function ForPicker({
  value,
  onChange,
  compact = false,
  testId,
}: {
  value: Business;
  onChange: (b: Business) => void;
  compact?: boolean;
  testId?: string;
}) {
  const label = useForLabel();
  return (
    <div data-testid={testId} className={`flex flex-wrap items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      {(["", ...BUSINESSES] as Business[]).map((b) => (
        <button
          key={b || "life"}
          type="button"
          aria-pressed={value === b}
          onClick={() => onChange(b)}
          className={`rounded-full border font-medium transition-colors ${compact ? "px-2.5 py-1" : "px-3 py-1.5 text-sm"} ${
            value === b ? "bg-primary border-primary text-primary-content" : "bg-base-100 border-base-300"
          }`}
        >
          {label(b)}
        </button>
      ))}
    </div>
  );
}
