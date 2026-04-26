"use client";

import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, SlidersHorizontal, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAllExpenses } from "../lib/historyService";
import { DEFAULT_CATEGORIES } from "../lib/categories";
import { Expense } from "../lib/expenses";
import { USERS } from "../lib/users";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayGroup {
  date: string;
  total: number;
  expenses: Expense[];
}

type DatePreset = "all" | "this-month" | "last-month" | "last-3m" | "custom";

interface Filters {
  categories: string[];   // empty = all
  paidBy: string[];       // empty = all
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: Filters = {
  categories: [],
  paidBy: [],
  datePreset: "all",
  dateFrom: "",
  dateTo: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function getPresetRange(preset: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  if (preset === "this-month") {
    const from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
    return { from, to: localDateStr(now) };
  }
  if (preset === "last-month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: localDateStr(first), to: localDateStr(last) };
  }
  if (preset === "last-3m") {
    const from = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    return { from: localDateStr(from), to: localDateStr(now) };
  }
  return null;
}

function applyFilters(expenses: Expense[], filters: Filters, search: string): Expense[] {
  let result = expenses;

  if (filters.categories.length > 0)
    result = result.filter(e => filters.categories.includes(e.category_id));

  if (filters.paidBy.length > 0)
    result = result.filter(e => filters.paidBy.includes(e.paid_by));

  const range = filters.datePreset === "custom"
    ? { from: filters.dateFrom, to: filters.dateTo }
    : getPresetRange(filters.datePreset);
  if (range) {
    if (range.from) result = result.filter(e => e.date >= range.from);
    if (range.to)   result = result.filter(e => e.date <= range.to);
  }

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter(e => {
      const catName = DEFAULT_CATEGORIES.find(c => c.id === e.category_id)?.name_en ?? "";
      return (e.notes ?? "").toLowerCase().includes(q) || catName.toLowerCase().includes(q);
    });
  }

  return result;
}

function countActiveFilters(filters: Filters): number {
  let n = 0;
  if (filters.categories.length > 0) n++;
  if (filters.paidBy.length > 0) n++;
  if (filters.datePreset !== "all") n++;
  return n;
}

function groupByDate(expenses: Expense[]): DayGroup[] {
  const map = new Map<string, Expense[]>();
  for (const exp of expenses) {
    const list = map.get(exp.date) ?? [];
    list.push(exp);
    map.set(exp.date, list);
  }
  return Array.from(map.keys())
    .sort((a, b) => b.localeCompare(a))
    .map(date => ({
      date,
      total: map.get(date)!.reduce((s, e) => s + e.amount, 0),
      expenses: map.get(date)!,
    }));
}

function getMonthKey(dateStr: string): string { return dateStr.slice(0, 7); }

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDateHeader(dateStr: string): string {
  const today = new Date();
  const todayStr = localDateStr(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = localDateStr(yesterday);
  if (dateStr === todayStr) return "Today";
  if (dateStr === yesterdayStr) return "Yesterday";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

function FilterSheet({
  filters,
  onApply,
  onClose,
}: {
  filters: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Filters>(filters);
  const activeCategories = DEFAULT_CATEGORIES.filter(c => c.is_active);

  function toggleCategory(id: string) {
    setDraft(f => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter(c => c !== id) : [...f.categories, id],
    }));
  }

  function togglePaidBy(id: string) {
    setDraft(f => ({
      ...f,
      paidBy: f.paidBy.includes(id) ? f.paidBy.filter(u => u !== id) : [...f.paidBy, id],
    }));
  }

  const DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "this-month", label: "This month" },
    { value: "last-month", label: "Last month" },
    { value: "last-3m", label: "Last 3 months" },
    { value: "custom", label: "Custom" },
  ];

  return typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[60] bg-black/45 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-base-100 rounded-t-3xl max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="w-9 h-1 rounded-full bg-base-300 absolute left-1/2 -translate-x-1/2 top-3" />
          <span className="font-semibold text-base">Filter</span>
          <button onClick={onClose} className="p-1.5 rounded-full bg-base-200 text-base-content/60">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-6 space-y-5">

          {/* Paid by */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">Paid by</div>
            <div className="flex gap-2 flex-wrap">
              {USERS.map(u => (
                <button
                  key={u.id}
                  onClick={() => togglePaidBy(u.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${draft.paidBy.includes(u.id)
                      ? "bg-primary text-primary-content border-primary"
                      : "bg-base-200 text-base-content/70 border-base-300"}`}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">Date range</div>
            <div className="flex gap-2 flex-wrap">
              {DATE_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setDraft(f => ({ ...f, datePreset: p.value }))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${draft.datePreset === p.value
                      ? "bg-primary text-primary-content border-primary"
                      : "bg-base-200 text-base-content/70 border-base-300"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {draft.datePreset === "custom" && (
              <div className="flex gap-2 mt-3">
                <div className="flex-1">
                  <div className="text-xs text-base-content/50 mb-1">From</div>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={draft.dateFrom}
                    onChange={e => setDraft(f => ({ ...f, dateFrom: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-base-content/50 mb-1">To</div>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={draft.dateTo}
                    onChange={e => setDraft(f => ({ ...f, dateTo: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-base-content/50 mb-2">Category</div>
            <div className="flex gap-2 flex-wrap">
              {activeCategories.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${draft.categories.includes(c.id)
                      ? "bg-primary text-primary-content border-primary"
                      : "bg-base-200 text-base-content/70 border-base-300"}`}
                >
                  {c.icon} {c.name_en}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => { setDraft(DEFAULT_FILTERS); onApply(DEFAULT_FILTERS); onClose(); }}
              className="btn btn-ghost flex-1"
            >
              Reset
            </button>
            <button
              onClick={() => { onApply(draft); onClose(); }}
              className="btn btn-primary flex-1"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { t } = useTranslation();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Expense | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  useEffect(() => {
    getAllExpenses()
      .then(setExpenses)
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => applyFilters(expenses, filters, search), [expenses, filters, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const monthGroups = useMemo(() => {
    const months = new Map<string, DayGroup[]>();
    for (const g of groups) {
      const mk = getMonthKey(g.date);
      const arr = months.get(mk) ?? [];
      arr.push(g);
      months.set(mk, arr);
    }
    return Array.from(months.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [groups]);

  const selectedCat = selected ? DEFAULT_CATEGORIES.find(c => c.id === selected.category_id) : null;
  const selectedPaidBy = selected ? USERS.find(u => u.id === selected.paid_by) : null;
  const selectedCreatedBy = selected ? USERS.find(u => u.id === selected.created_by) : null;
  const activeFilterCount = countActiveFilters(filters);
  const isFiltered = activeFilterCount > 0 || search.trim().length > 0;

  // Active filter chip labels
  const chips: { label: string; onRemove: () => void }[] = [];
  if (search.trim()) chips.push({ label: `"${search.trim()}"`, onRemove: () => setSearch("") });
  filters.paidBy.forEach(id => {
    const u = USERS.find(u => u.id === id);
    if (u) chips.push({ label: u.name, onRemove: () => setFilters(f => ({ ...f, paidBy: f.paidBy.filter(x => x !== id) })) });
  });
  if (filters.datePreset !== "all") {
    const label = filters.datePreset === "this-month" ? "This month"
      : filters.datePreset === "last-month" ? "Last month"
      : filters.datePreset === "last-3m" ? "Last 3 months"
      : `${filters.dateFrom} – ${filters.dateTo}`;
    chips.push({ label, onRemove: () => setFilters(f => ({ ...f, datePreset: "all", dateFrom: "", dateTo: "" })) });
  }
  filters.categories.forEach(id => {
    const c = DEFAULT_CATEGORIES.find(c => c.id === id);
    if (c) chips.push({ label: `${c.icon} ${c.name_en}`, onRemove: () => setFilters(f => ({ ...f, categories: f.categories.filter(x => x !== id) })) });
  });

  if (loading) return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-6 pb-20">
      <h1 className="text-2xl font-semibold mb-4">{t("history.title")}</h1>
      <div className="flex justify-center py-16"><span className="loading loading-spinner loading-md text-primary" /></div>
    </main>
  );

  return (
    <>
      <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto pb-20">

        {/* Sticky header */}
        <div className="sticky top-0 bg-base-100 z-10 border-b border-base-300">
          <div className="flex items-center justify-between px-4 pt-6 pb-3">
            <h1 className="text-2xl font-semibold">{t("history.title")}</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setSearchOpen(v => !v); }}
                className={`p-2 rounded-full transition-colors ${searchOpen || search ? "bg-primary/10 text-primary" : "text-base-content/50"}`}
              >
                <Search size={18} />
              </button>
              <button
                onClick={() => setFilterOpen(true)}
                className={`relative p-2 rounded-full transition-colors ${activeFilterCount > 0 ? "bg-primary/10 text-primary" : "text-base-content/50"}`}
              >
                <SlidersHorizontal size={18} />
                {activeFilterCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Search bar */}
          {searchOpen && (
            <div className="px-4 pb-3">
              <input
                autoFocus
                type="text"
                className="w-full px-3 py-2 rounded-xl bg-base-200 text-sm outline-none placeholder:text-base-content/40"
                placeholder="Search by category or notes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}

          {/* Active filter chips */}
          {chips.length > 0 && (
            <div className="flex items-center gap-2 px-4 pb-3 overflow-x-auto scrollbar-none">
              {chips.map((chip, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium whitespace-nowrap shrink-0"
                >
                  {chip.label}
                  <button onClick={chip.onRemove} className="opacity-60 hover:opacity-100">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button
                onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(""); }}
                className="text-xs text-base-content/40 whitespace-nowrap shrink-0 pl-1"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results count when filtered */}
        {isFiltered && (
          <div className="px-4 py-2 text-xs text-base-content/40">
            {filtered.length === 0 ? "No results" : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && !loading && (
          <p className="text-base-content/50 text-sm text-center pt-12">
            {isFiltered ? "No expenses match your filters." : t("history.no_expenses")}
          </p>
        )}

        {/* List */}
        <div className="py-2">
          {monthGroups.map(([monthKey, dayGroups]) => {
            const monthTotal = dayGroups.reduce((s, g) => s + g.total, 0);
            const entryCount = dayGroups.reduce((s, g) => s + g.expenses.length, 0);
            return (
              <div key={monthKey} className="mb-4">
                <div className="flex items-center justify-between px-4 py-2 bg-base-200">
                  <span className="text-sm font-semibold text-base-content/80">{formatMonthLabel(monthKey)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-base-content/40">{entryCount} {t("history.entries")}</span>
                    <span className="text-sm font-semibold">NT${monthTotal.toLocaleString()}</span>
                  </div>
                </div>

                {dayGroups.map((group) => (
                  <div key={group.date}>
                    <div className="flex justify-between items-center px-4 pt-3 pb-1.5 border-b border-base-300/60">
                      <span className="text-[11px] uppercase tracking-wider text-base-content/50 font-medium">
                        {formatDateHeader(group.date)}
                      </span>
                      <span className="text-sm font-semibold text-base-content">
                        NT${group.total.toLocaleString()}
                      </span>
                    </div>

                    <div className="divide-y divide-base-300">
                      {group.expenses.map((expense) => {
                        const cat = DEFAULT_CATEGORIES.find(c => c.id === expense.category_id);
                        const paidByUser = USERS.find(u => u.id === expense.paid_by);
                        return (
                          <button
                            key={expense.id}
                            onClick={() => setSelected(expense)}
                            className="w-full grid grid-cols-[44px_1fr_auto] gap-3 items-center px-4 py-3 hover:bg-base-200 transition-colors text-left"
                          >
                            <span className="grid place-items-center w-10 h-10 rounded-xl bg-white border border-base-300">
                              <span className="text-xl">{cat?.icon ?? "💰"}</span>
                            </span>
                            <div className="min-w-0">
                              <div className="text-[15px] font-medium">{cat?.name_en ?? expense.category_id}</div>
                              {expense.notes && (
                                <div className="text-[13px] text-base-content/50 mt-0.5 truncate">{expense.notes}</div>
                              )}
                              <div className="text-[12px] text-base-content/40 mt-0.5">
                                {paidByUser?.name ?? expense.paid_by}
                              </div>
                            </div>
                            <div className="text-[15px] font-medium tabular-nums shrink-0">
                              NT${expense.amount.toLocaleString()}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </main>

      {/* Filter sheet */}
      {filterOpen && (
        <FilterSheet
          filters={filters}
          onApply={setFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}

      {/* Expense detail bottom sheet */}
      {selected && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[60] bg-black/45 flex items-end" onClick={() => setSelected(null)}>
          <div
            className="w-full max-w-md mx-auto bg-base-100 rounded-t-3xl pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="w-9 h-1 rounded-full bg-base-300 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <div />
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-full bg-base-200 text-base-content/60">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-4 px-5 pt-2 pb-4 border-b border-base-300">
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
                <span className="text-3xl">{selectedCat?.icon ?? "💰"}</span>
              </span>
              <div>
                <div className="text-xl font-semibold">{selectedCat?.name_en ?? selected.category_id}</div>
                <div className="text-sm text-base-content/50">{formatFullDate(selected.date)}</div>
              </div>
              <div className="ml-auto text-2xl font-semibold tabular-nums">
                NT${selected.amount.toLocaleString()}
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {selected.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">Note</div>
                  <div className="text-base text-base-content">{selected.notes}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">Paid by</div>
                  <div className="text-sm font-medium">{selectedPaidBy?.name ?? selected.paid_by}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">Logged by</div>
                  <div className="text-sm font-medium">{selectedCreatedBy?.name ?? selected.created_by}</div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
