"use client";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import CategoryPicker from "./components/CategoryPicker";
import { DEFAULT_CATEGORIES, getDefaultCategory, saveLastCategory } from "./lib/categories";
import { addExpense, getTodayExpenses, Expense } from "./lib/expenses";
import { DEFAULT_USER, type UserId } from "./lib/users";
import { useAuth } from "./lib/authContext";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const KEYS = [
  ["7","8","9","÷"],
  ["4","5","6","×"],
  ["1","2","3","+"],
  ["00","0",".","-"],
];

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { resolvedUserId } = useAuth();
  const [categoryId, setCategoryId] = useState<string>(() => getDefaultCategory());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [paidBy, setPaidBy] = useState<UserId>(DEFAULT_USER);
  const [date, setDate] = useState(() => localDateStr(new Date()));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectedCat = DEFAULT_CATEGORIES.find(c => c.id === categoryId);

  // Default paidBy to the signed-in user
  useEffect(() => {
    if (resolvedUserId) setPaidBy(resolvedUserId);
  }, [resolvedUserId]);

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
    if (key === "⌫") { setAmount(a => a.slice(0, -1)); return; }
    if (key === "C") { setAmount(""); return; }
    setAmount(a => a + key);
  }

  async function handleConfirm() {
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
      setNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
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
    setDate(localDateStr(d));
  }

  function formatDateLabel(d: string) {
    const today = localDateStr(new Date());
    const yesterday = localDateStr(new Date(new Date().setDate(new Date().getDate() - 1)));
    const tomorrow = localDateStr(new Date(new Date().setDate(new Date().getDate() + 1)));
    const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dow = DOW[new Date(d + "T00:00:00").getDay()];
    if (d === today) return `${t("home.today")} ${d}`;
    if (d === yesterday) return `${t("home.yesterday")} ${d}`;
    if (d === tomorrow) return `${t("home.tomorrow")} ${d}`;
    return `${d} ${dow}`;
  }

  return (
    <main className="flex flex-col bg-base-100 max-w-md mx-auto overflow-hidden" style={{ height: "100dvh" }}>

      {/* Header */}
      <div className="bg-primary text-primary-content px-4 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <span>{selectedCat?.icon}</span>
            <span>{lang === "zh" && selectedCat?.name_zh ? selectedCat.name_zh : selectedCat?.name_en}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs opacity-70">
              {saved ? "✓ Saved · " : ""}{expenses.length > 0 ? `${expenses.length} ${t("home.logged_today")}` : ""}
            </span>
            <button
              onClick={() => setNoteOpen(true)}
              className={`opacity-60 active:opacity-100 ${note ? "opacity-100" : ""}`}
              title="Add note"
            >
              <PenLine size={16} />
              {note && <span className="absolute w-1.5 h-1.5 rounded-full bg-warning top-0 right-0" />}
            </button>
          </div>
        </div>
        <div className="text-5xl font-mono font-bold min-h-[52px] break-all">
          {amount || <span className="opacity-40">0</span>}
        </div>
        {submitError && (
          <div className="text-xs mt-1 opacity-80">{submitError}</div>
        )}
      </div>

      {/* Category picker — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <CategoryPicker
          categories={DEFAULT_CATEGORIES}
          selectedId={categoryId}
          onSelect={handleSelectCategory}
        />
      </div>

      {/* Bottom: date + keypad + save */}
      <div className="shrink-0 bg-base-100 border-t border-base-300 px-3 pt-2 pb-16">

        {/* Date stepper */}
        <div className="flex items-center justify-between mb-2 px-1">
          <button onClick={() => stepDate(-1)} className="w-6 h-6 grid place-items-center rounded-full bg-base-200 active:bg-base-300">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium text-base-content/70">{formatDateLabel(date)}</span>
          <button onClick={() => stepDate(1)} className="w-6 h-6 grid place-items-center rounded-full bg-base-200 active:bg-base-300">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-4 gap-1 mb-1">
          {KEYS.flat().map((key, i) => {
            const isOp = ["÷","×","+","-"].includes(key);
            return (
              <button
                key={i}
                onClick={() => handleKey(key)}
                className={`h-9 rounded-xl text-base font-medium transition-all active:scale-95
                  ${isOp
                    ? "bg-secondary/20 text-secondary border border-secondary/30"
                    : "bg-white border border-base-300 text-base-content"}`}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* ⌫  C  [Save] */}
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => handleKey("⌫")}
            className="h-9 rounded-xl bg-base-200 border border-base-300 text-base-content/70 font-medium active:scale-95"
          >⌫</button>
          <button
            onClick={() => handleKey("C")}
            className="h-9 rounded-xl bg-base-200 border border-base-300 text-base-content/70 text-sm font-medium active:scale-95"
          >C</button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className={`col-span-2 h-9 rounded-xl font-semibold text-sm active:opacity-80 disabled:opacity-50 transition-colors
              ${saved ? "bg-success text-success-content" : "bg-primary text-primary-content"}`}
          >
            {saved ? `✓ ${t("home.save")}` : submitting ? "…" : t("home.save")}
          </button>
        </div>
      </div>

      {/* Notes modal */}
      {noteOpen && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm">
            <h3 className="font-bold mb-3">Note</h3>
            <textarea
              autoFocus
              className="textarea textarea-bordered w-full"
              placeholder={t("home.notes_placeholder")}
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
            <div className="modal-action mt-3">
              <button className="btn btn-ghost btn-sm" onClick={() => { setNote(""); setNoteOpen(false); }}>Clear</button>
              <button className="btn btn-primary btn-sm" onClick={() => setNoteOpen(false)}>Done</button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setNoteOpen(false)} />
        </div>
      )}
    </main>
  );
}
