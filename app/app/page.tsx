"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { useTranslation } from "react-i18next";
import CategoryPicker from "./components/CategoryPicker";
import DatePickerModal from "./components/DatePickerModal";
import { Business, BUSINESSES, BUSINESS_ICONS, Category, CategoryKind, DEFAULT_CATEGORIES, categoriesOfKind, categoryIcon, getCachedCategories, getDefaultCategory, pickCategoryId, resolveCategory, saveCachedCategories, saveLastCategory } from "./lib/categories";
import { getCategories } from "./lib/categoryService";
import { addExpense, getTodayExpenses, Expense } from "./lib/expenses";
import { addIncome } from "./lib/incomes";
import { DEFAULT_USER, USERS, type UserId } from "./lib/users";
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
  // DEFAULT_CATEGORIES is what the picker DRAWS before the live list arrives, so
  // the screen is never blank. `categoriesReady` is what decides whether anything
  // may be SUBMITTED — a slug is a legitimate placeholder and an illegitimate
  // write, and conflating the two is the bug this entity exists to remove.
  // A device that has fetched successfully before draws its last-known live list
  // instead, so first paint doesn't visibly swap out from under the captain.
  const [allCategories, setCategories] = useState<Category[]>(() => getCachedCategories() ?? DEFAULT_CATEGORIES);
  // Expense or income: the same calculator logs both, each with its own categories.
  const [mode, setMode] = useState<CategoryKind>("expense");
  const categories = categoriesOfKind(allCategories, mode);
  // Who an expense is for. Starts at Life; a category with a default (Rent paid,
  // Tenant) fills it in, and the captain can change it before saving.
  const [business, setBusiness] = useState<Business>("");
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [paidBy, setPaidBy] = useState<UserId>(DEFAULT_USER);
  const [date, setDate] = useState(() => localDateStr(new Date()));
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const selectedCat = categories.find(c => c.id === categoryId) ?? DEFAULT_CATEGORIES.find(c => c.id === categoryId);
  // Resolved separately from `selectedCat`: on page load `categoryId` is a
  // DEFAULT_CATEGORIES slug, which matches no live `cat_NNN` id, so `selectedCat`
  // falls back to the baked-in entry — and baked-in entries carry no note.
  const categoryNote = resolveCategory(categoryId, categories)?.note?.trim();

  // Default paidBy to the signed-in user
  useEffect(() => {
    if (resolvedUserId) setPaidBy(resolvedUserId);
  }, [resolvedUserId]);

  useEffect(() => {
    getTodayExpenses()
      .then(setExpenses)
      .catch(() => setExpenses([]));
  }, []);

  const loadCategories = useCallback(() => {
    setCategoriesFailed(false);
    return getCategories()
      .then((cats) => {
        const active = cats.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order);
        if (active.length === 0) { setCategoriesFailed(true); return; }
        setCategories(active);
        saveCachedCategories(active);
        // The seed from localStorage was never reconciled here, which is how a
        // stale slug survived all the way into the POST body on the fastest path
        // through the app: type an amount, confirm, touch nothing else.
        const expenseCats = categoriesOfKind(active, "expense");
        setCategoryId((current) => {
          const picked = pickCategoryId(current, expenseCats);
          setBusiness(expenseCats.find((c) => c.id === picked)?.business ?? "");
          return picked;
        });
        setCategoriesReady(true);
      })
      .catch(() => setCategoriesFailed(true));
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  function switchMode(next: CategoryKind) {
    if (next === mode) return;
    setMode(next);
    const list = categoriesOfKind(allCategories, next);
    const picked = pickCategoryId(next === "expense" ? getDefaultCategory() : "", list);
    setCategoryId(picked);
    setBusiness(next === "expense" ? list.find((c) => c.id === picked)?.business ?? "" : "");
  }

  function handleSelectCategory(id: string) {
    setCategoryId(id);
    if (mode === "expense") setBusiness(categories.find((c) => c.id === id)?.business ?? "");
    // Only a live id is worth remembering. Before the list resolves the tiles are
    // DEFAULT_CATEGORIES placeholders, and persisting one of those would replace
    // the captain's real last-used category with a slug.
    if (categoriesReady && mode === "expense") saveLastCategory(id);
  }

  function handleKey(key: string) {
    if (key === "⌫") { setAmount(a => a.slice(0, -1)); return; }
    if (key === "C") { setAmount(""); return; }
    setAmount(a => a + key);
  }

  async function handleConfirm() {
    // The write is blocked here as well as on the button, because a visible error
    // beats a silently mis-filed expense — and the button is not the only caller.
    if (!categoriesReady) return;
    let val: number;
    try { val = Function(`"use strict"; return (${amount || "0"})`)() as number; }
    catch { return; }
    if (!val || val <= 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const paidByName = USERS.find(u => u.id === paidBy)?.name ?? paidBy;
      if (mode === "income") {
        await addIncome({ amount: val, category_id: categoryId, date, received_by: paidByName, created_by: paidByName, notes: note });
      } else {
        await addExpense({ amount: val, category_id: categoryId, date, paid_by: paidByName, created_by: paidByName, notes: note, business });
      }
      const updated = await getTodayExpenses();
      setExpenses(updated);
      setAmount("");
      setNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to save ${mode}`;
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
    <main className="flex flex-col bg-base-100 max-w-md mx-auto overflow-hidden fixed inset-0">

      {/* Header */}
      <div className="bg-primary text-primary-content px-4 pt-5 pb-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <span>{categoryIcon(selectedCat)}</span>
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
        {categoryNote && (
          <div className="text-xs opacity-70 mb-2 break-words">{categoryNote}</div>
        )}
        <div className="text-5xl font-mono font-bold min-h-[52px] break-all">
          {amount || <span className="opacity-40">0</span>}
        </div>
        {submitError && (
          <div className="text-xs mt-1 opacity-80">{submitError}</div>
        )}
      </div>

      {/* Expense / Income, then the categories of that kind — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div data-testid="entry-mode" className="grid grid-cols-2 gap-1 bg-base-200 rounded-xl p-1 mx-2 mt-2">
          {(["expense", "income"] as CategoryKind[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={mode === k}
              onClick={() => switchMode(k)}
              className={`py-1.5 text-sm font-medium rounded-lg transition-colors ${
                mode === k ? "bg-primary text-primary-content" : "text-base-content/70"
              }`}
            >
              {t(`home.mode_${k}`)}
            </button>
          ))}
        </div>
        <CategoryPicker
          categories={categories}
          selectedId={categoryId}
          onSelect={handleSelectCategory}
        />
      </div>

      {/* Bottom: date + keypad + save */}
      <div className="shrink-0 bg-base-100 border-t border-base-300 px-3 pt-2 pb-16">

        {/* Why Save is dead. Sits next to the button it explains, so the captain
            is never left tapping an unresponsive control. */}
        {!categoriesReady && (
          <div
            data-testid="category-status"
            className={`text-xs mb-2 px-1 flex items-center gap-2 ${categoriesFailed ? "text-error" : "text-base-content/50"}`}
          >
            <span>{categoriesFailed ? t("common.categories_unavailable") : t("common.categories_loading")}</span>
            {categoriesFailed && (
              <button
                type="button"
                data-testid="category-retry"
                className="btn btn-ghost btn-xs"
                onClick={() => loadCategories()}
              >
                {t("common.retry")}
              </button>
            )}
          </div>
        )}

        {/* Who this expense is for: Life, or a business with its own earnings */}
        {mode === "expense" && (
          <div data-testid="for-row" className="flex items-center gap-1.5 mb-2 px-1 text-xs">
            <span className="text-base-content/60 mr-0.5">{t("home.for")}</span>
            {(["", ...BUSINESSES] as Business[]).map((b) => (
              <button
                key={b || "life"}
                type="button"
                aria-pressed={business === b}
                onClick={() => setBusiness(b)}
                className={`px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  business === b ? "bg-primary border-primary text-primary-content" : "bg-base-100 border-base-300"
                }`}
              >
                {b ? `${BUSINESS_ICONS[b]} ${t(`earnings.business_${b}`)}` : `❤️ ${t("home.for_life")}`}
              </button>
            ))}
          </div>
        )}

        {/* Date stepper */}
        <div className="flex items-center justify-between mb-2 px-1">
          <button onClick={() => stepDate(-1)} className="w-6 h-6 grid place-items-center rounded-full bg-base-200 active:bg-base-300">
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            data-testid="home-date-button"
            onClick={() => setDatePickerOpen(true)}
            className="text-xs font-medium text-base-content/70 px-2 py-1 rounded-lg active:bg-base-200"
          >
            {formatDateLabel(date)}
          </button>
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
            disabled={submitting || !categoriesReady}
            className={`col-span-2 h-9 rounded-xl font-semibold text-sm active:opacity-80 disabled:opacity-50 transition-colors
              ${saved ? "bg-success text-success-content" : "bg-primary text-primary-content"}`}
          >
            {saved ? `✓ ${t("home.save")}` : submitting ? "…" : t(mode === "income" ? "home.save_income" : "home.save")}
          </button>
        </div>
      </div>

      {datePickerOpen && (
        <DatePickerModal
          value={date}
          onPick={setDate}
          onClose={() => setDatePickerOpen(false)}
        />
      )}

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
