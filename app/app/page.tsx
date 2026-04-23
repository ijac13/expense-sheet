"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import CategoryPicker from "./components/CategoryPicker";
import { DEFAULT_CATEGORIES, CATEGORY_ICONS, getDefaultCategory, saveLastCategory } from "./lib/categories";
import { addExpense, getTodayExpenses, Expense } from "./lib/expenses";
import { USERS, DEFAULT_USER, type UserId } from "./lib/users";

const KEYS = [
  ["7","8","9","⌫"],
  ["4","5","6","C"],
  ["1","2","3","+"],
  [".","0","×","÷"],
  ["(",")","-",""],
];

export default function HomePage() {
  const { t } = useTranslation();
  const [categoryId, setCategoryId] = useState<string>(() => getDefaultCategory());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paidBy, setPaidBy] = useState<UserId>(DEFAULT_USER);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedCat = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
  const SelectedIcon = selectedCat ? (CATEGORY_ICONS[selectedCat.id] ?? Package) : Package;
  const paidByUser = USERS.find(u => u.id === paidBy);
  const nextUser = USERS[(USERS.findIndex(u => u.id === paidBy) + 1) % USERS.length];

  // Load today's expenses on mount
  useEffect(() => {
    getTodayExpenses()
      .then(setExpenses)
      .catch(() => setExpenses([]));
  }, []);

  function handleSelectCategory(id: string) {
    setCategoryId(id);
    saveLastCategory(id);
  }

  function handleKey(key: string) {
    if (key === "") return;
    if (key === "⌫") { setAmount(a => a.slice(0, -1)); return; }
    if (key === "C") { setAmount(""); return; }
    setAmount(a => a + key);
  }

  async function handleConfirm(andContinue = false) {
    let val: number;
    try { val = Function(`"use strict"; return (${amount || "0"})`)() as number; }
    catch { return; }
    if (!val || val <= 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await addExpense({ amount: val, category_id: categoryId, date, paid_by: paidBy, created_by: paidBy, notes: note });
      const updated = await getTodayExpenses();
      setExpenses(updated);
      setAmount("");
      if (!andContinue) setNote("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save expense";
      setSubmitError(msg);
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function stepDate(dir: 1 | -1) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + dir);
    setDate(d.toISOString().split("T")[0]);
  }

  function formatDateLabel(d: string) {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (d === today) return t("home.today");
    if (d === yesterday) return t("home.yesterday");
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <main className="flex flex-col bg-base-100 max-w-md mx-auto overflow-hidden" style={{ height: "100dvh" }}>

      {/* Amount display */}
      <div className="bg-primary text-primary-content px-4 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm opacity-70">{t("home.amount_label")}</span>
          {expenses.length > 0 && (
            <span className="text-base font-semibold opacity-80">{expenses.length} {t("home.logged_today")}</span>
          )}
        </div>
        <div className="text-5xl font-mono font-bold min-h-[52px] break-all">
          {amount || <span className="opacity-40">0</span>}
        </div>
      </div>

      {/* Scrollable middle: category picker */}
      <div className="flex-1 overflow-y-auto">
        {/* Meta row: category icon + date/payer/notes */}
        <div className="px-4 pt-3 pb-2 flex gap-2">
          <button
            onClick={() => {}}
            className="flex items-center gap-2 px-3 py-2 bg-base-200 rounded-xl text-sm"
          >
            <SelectedIcon size={16} strokeWidth={1.6} />
            <span className="text-base-content/70">{selectedCat?.name_en}</span>
          </button>
          <button
            onClick={() => setPaidBy(nextUser.id)}
            className="flex items-center gap-2 px-3 py-2 bg-base-200 rounded-xl text-sm text-base-content/70"
          >
            {paidByUser?.name ?? paidBy}
          </button>
        </div>

        {/* Date stepper */}
        <div className="mx-4 mb-2 h-9 rounded-full bg-primary/10 flex items-center justify-between px-3 text-sm font-medium">
          <button onClick={() => stepDate(-1)} className="w-6 h-6 grid place-items-center rounded-full bg-white shadow-sm">
            <ChevronLeft size={14} />
          </button>
          <span className="text-base-content/80">{formatDateLabel(date)} · {date}</span>
          <button onClick={() => stepDate(1)} className="w-6 h-6 grid place-items-center rounded-full bg-white shadow-sm">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Notes */}
        <div className="px-4 mb-3">
          <input
            className="w-full px-3 py-2 rounded-xl bg-base-200 text-sm outline-none placeholder:text-base-content/40"
            placeholder={t("home.notes_placeholder")}
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        {/* Error state */}
        {submitError && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-error/10 text-error text-sm">
            {submitError}
          </div>
        )}

        {/* Category picker */}
        <CategoryPicker
          categories={DEFAULT_CATEGORIES}
          selectedId={categoryId}
          onSelect={handleSelectCategory}
        />
      </div>

      {/* Calculator — always visible at bottom */}
      <div className="shrink-0 bg-base-100 border-t border-base-300 px-3 pt-2 pb-20">
        <div className="grid grid-cols-4 gap-1.5 mb-1.5">
          {KEYS.flat().map((key, i) => {
            if (key === "") return <div key={i} />;
            const isOp = ["+","-","×","÷","(",")"].includes(key);
            const isDel = key === "⌫" || key === "C";
            return (
              <button
                key={i}
                onClick={() => handleKey(key)}
                className={`h-12 rounded-xl text-lg font-medium transition-all active:scale-95
                  ${isDel ? "bg-base-200 text-base-content/70 border border-base-300"
                  : isOp ? "bg-secondary/20 text-secondary border border-secondary/30"
                  : "bg-white border border-base-300 text-base-content"}`}
              >
                {key}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleConfirm(true)}
            disabled={submitting}
            className="h-12 rounded-xl bg-base-200 text-sm font-semibold text-base-content/70 active:bg-base-300 disabled:opacity-50"
          >
            {t("home.log_another")}
          </button>
          <button
            onClick={() => handleConfirm(false)}
            disabled={submitting}
            className="h-12 rounded-xl bg-primary text-primary-content font-semibold active:opacity-80 disabled:opacity-50"
          >
            {submitting ? "Saving..." : t("home.save")}
          </button>
        </div>
      </div>
    </main>
  );
}
