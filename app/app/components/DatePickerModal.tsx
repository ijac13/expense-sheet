"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { todayLocalIso } from "../lib/subscriptions";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Years offered by the year view, relative to the local current year. */
const YEARS_BACK = 20;
const YEARS_FORWARD = 5;

/** 1 January 2023 was a Sunday — the reference week the headers are read off. */
const REFERENCE_SUNDAY = new Date(2023, 0, 1);

interface Props {
  /** `YYYY-MM-DD`, or `""` when the opening field is empty. */
  value: string;
  onPick: (iso: string) => void;
  onClose: () => void;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Day 0 of the following month is the last day of this one — leap years included. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function firstWeekdayOf(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function monthLabel(year: number, month: number, lang: string): string {
  return new Date(year, month - 1, 1).toLocaleDateString(
    lang === "zh" ? "zh-TW" : "en-US",
    { month: "long", year: "numeric" }
  );
}

function weekdayLabels(lang: string): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    new Date(
      REFERENCE_SUNDAY.getFullYear(),
      REFERENCE_SUNDAY.getMonth(),
      REFERENCE_SUNDAY.getDate() + i
    ).toLocaleDateString(lang === "zh" ? "zh-TW" : "en-US", { weekday: "short" })
  );
}

export default function DatePickerModal({ value, onPick, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const today = todayLocalIso();
  const selected = ISO_DATE.test(value) ? value : null;

  const [view, setView] = useState<"days" | "years">("days");
  const [cursor, setCursor] = useState(() => {
    const [year, month] = (selected ?? today).split("-").map(Number);
    return { year, month };
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Arithmetic on the (year, month) pair, never `setMonth` on a date: stepping
  // forward from 31 January with `setMonth` lands on 3 March, skipping February.
  function stepMonth(dir: 1 | -1) {
    setCursor(({ year, month }) => {
      const next = month + dir;
      if (next < 1) return { year: year - 1, month: 12 };
      if (next > 12) return { year: year + 1, month: 1 };
      return { year, month: next };
    });
  }

  function pickDay(day: number) {
    onPick(isoOf(cursor.year, cursor.month, day));
    onClose();
  }

  const currentYear = Number(today.slice(0, 4));
  const years = Array.from(
    { length: YEARS_BACK + YEARS_FORWARD + 1 },
    (_, i) => currentYear - YEARS_BACK + i
  );

  const leading = firstWeekdayOf(cursor.year, cursor.month);
  const days = Array.from({ length: daysInMonth(cursor.year, cursor.month) }, (_, i) => i + 1);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-testid="date-picker"
      className="fixed inset-0 z-[70] bg-black/45 grid place-items-center px-4"
      onClick={(e) => {
        // React bubbles portal events up the REACT tree, not the DOM tree, so a
        // click in here reaches the ancestors of wherever the picker was
        // rendered — including a host sheet wrapper whose own onClick is
        // onClose. Both current hosts happen to sit behind their own inner
        // stopPropagation guard, so this is what keeps the picker safe to drop
        // into a host that does not.
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xs bg-base-100 rounded-2xl shadow-xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center justify-between px-2 py-2 border-b border-base-300">
          <button
            type="button"
            data-testid="picker-prev"
            aria-label={t("picker.previous_month")}
            title={t("picker.previous_month")}
            onClick={() => stepMonth(-1)}
            className="w-8 h-8 grid place-items-center rounded-full text-base-content/60 hover:bg-base-200"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            data-testid="picker-title"
            aria-label={t("picker.select_year")}
            onClick={() => setView((v) => (v === "days" ? "years" : "days"))}
            className="px-3 py-1 rounded-lg font-semibold text-sm hover:bg-base-200"
          >
            {view === "years" ? String(cursor.year) : monthLabel(cursor.year, cursor.month, lang)}
          </button>
          <div className="flex items-center">
            <button
              type="button"
              data-testid="picker-next"
              aria-label={t("picker.next_month")}
              title={t("picker.next_month")}
              onClick={() => stepMonth(1)}
              className="w-8 h-8 grid place-items-center rounded-full text-base-content/60 hover:bg-base-200"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              data-testid="picker-close"
              aria-label={t("picker.close")}
              title={t("picker.close")}
              onClick={onClose}
              className="w-8 h-8 grid place-items-center rounded-full text-base-content/60 hover:bg-base-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {view === "days" && (
          <div className="p-2">
            <div className="grid grid-cols-7 mb-1">
              {weekdayLabels(lang).map((label, i) => (
                <span
                  key={i}
                  data-testid={`weekday-${i}`}
                  className="h-7 grid place-items-center text-[11px] font-medium text-base-content/40"
                >
                  {label}
                </span>
              ))}
            </div>
            <div data-testid="day-grid" className="grid grid-cols-7">
              {Array.from({ length: leading }, (_, i) => (
                <span key={`blank-${i}`} data-testid="day-blank" className="h-9" />
              ))}
              {days.map((day) => {
                const iso = isoOf(cursor.year, cursor.month, day);
                const isSelected = iso === selected;
                const isToday = iso === today;
                return (
                  <button
                    type="button"
                    key={iso}
                    data-testid={`day-${iso}`}
                    data-col={(leading + day - 1) % 7}
                    data-today={isToday ? "true" : undefined}
                    aria-selected={isSelected}
                    onClick={() => pickDay(day)}
                    className={`h-9 grid place-items-center text-sm rounded-full transition-colors
                      ${isSelected
                        ? "bg-primary text-primary-content font-semibold"
                        : isToday
                          ? "text-primary font-semibold ring-1 ring-primary/40"
                          : "text-base-content hover:bg-base-200"}`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === "years" && (
          <div data-testid="year-view" className="grid grid-cols-4 gap-1 p-3 max-h-64 overflow-y-auto">
            {years.map((year) => (
              <button
                type="button"
                key={year}
                data-testid={`year-${year}`}
                aria-selected={year === cursor.year}
                onClick={() => {
                  setCursor((c) => ({ ...c, year }));
                  setView("days");
                }}
                className={`h-9 grid place-items-center text-sm rounded-lg transition-colors
                  ${year === cursor.year
                    ? "bg-primary text-primary-content font-semibold"
                    : "text-base-content hover:bg-base-200"}`}
              >
                {year}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
