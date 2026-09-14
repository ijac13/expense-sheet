"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/** Years offered by the year view, relative to the local current year — same
 *  range DatePickerModal's year view already uses. */
const YEARS_BACK = 20;
const YEARS_FORWARD = 5;

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Props {
  year: number;
  month: number;
  onPick: (year: number, month: number) => void;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function monthShortLabel(year: number, month: number, lang: string): string {
  return new Date(year, month - 1, 1).toLocaleDateString(
    lang === "zh" ? "zh-TW" : "en-US",
    { month: "short" }
  );
}

export default function MonthPickerModal({ year, month, onPick, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [view, setView] = useState<"months" | "years">("months");
  const [cursorYear, setCursorYear] = useState(year);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function stepYear(dir: 1 | -1) {
    setCursorYear((y) => y + dir);
  }

  function pickMonth(m: number) {
    onPick(cursorYear, m);
    onClose();
  }

  const years = Array.from(
    { length: YEARS_BACK + YEARS_FORWARD + 1 },
    (_, i) => currentYear - YEARS_BACK + i
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-testid="month-picker"
      className="fixed inset-0 z-[1000] bg-black/45 grid place-items-center px-4"
      onClick={(e) => {
        // Same reasoning as DatePickerModal: React bubbles portal clicks up the
        // REACT tree, so this stops a tap inside from also closing a host sheet.
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xs bg-base-100 rounded-2xl shadow-xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-2 py-2 border-b border-base-300">
          <button
            type="button"
            data-testid="month-picker-prev"
            aria-label={t("picker.previous_year")}
            title={t("picker.previous_year")}
            onClick={() => stepYear(-1)}
            className="w-8 h-8 grid place-items-center rounded-full text-base-content/60 hover:bg-base-200"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            data-testid="month-picker-title"
            aria-label={t("picker.select_year")}
            onClick={() => setView((v) => (v === "months" ? "years" : "months"))}
            className="px-3 py-1 rounded-lg font-semibold text-sm hover:bg-base-200"
          >
            {String(cursorYear)}
          </button>
          <div className="flex items-center">
            <button
              type="button"
              data-testid="month-picker-next"
              aria-label={t("picker.next_year")}
              title={t("picker.next_year")}
              onClick={() => stepYear(1)}
              className="w-8 h-8 grid place-items-center rounded-full text-base-content/60 hover:bg-base-200"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              data-testid="month-picker-close"
              aria-label={t("picker.close")}
              title={t("picker.close")}
              onClick={onClose}
              className="w-8 h-8 grid place-items-center rounded-full text-base-content/60 hover:bg-base-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {view === "months" && (
          <div className="grid grid-cols-3 gap-1 p-3">
            {MONTHS.map((m) => {
              const isSelected = cursorYear === year && m === month;
              const isToday = cursorYear === currentYear && m === currentMonth;
              return (
                <button
                  type="button"
                  key={m}
                  data-testid={`month-cell-${cursorYear}-${pad(m)}`}
                  aria-selected={isSelected}
                  data-today={isToday ? "true" : undefined}
                  onClick={() => pickMonth(m)}
                  className={`h-12 grid place-items-center text-sm rounded-lg transition-colors
                    ${isSelected
                      ? "bg-primary text-primary-content font-semibold"
                      : isToday
                        ? "text-primary font-semibold ring-1 ring-primary/40"
                        : "text-base-content hover:bg-base-200"}`}
                >
                  {monthShortLabel(cursorYear, m, lang)}
                </button>
              );
            })}
          </div>
        )}

        {view === "years" && (
          <div data-testid="month-picker-year-view" className="grid grid-cols-4 gap-1 p-3 max-h-64 overflow-y-auto">
            {years.map((y) => (
              <button
                type="button"
                key={y}
                data-testid={`month-picker-year-${y}`}
                aria-selected={y === cursorYear}
                onClick={() => {
                  setCursorYear(y);
                  setView("months");
                }}
                className={`h-9 grid place-items-center text-sm rounded-lg transition-colors
                  ${y === cursorYear
                    ? "bg-primary text-primary-content font-semibold"
                    : "text-base-content hover:bg-base-200"}`}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
