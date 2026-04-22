"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Expand, Package } from "lucide-react";
import CategoryPicker from "./components/CategoryPicker";
import TodayExpenseList from "./components/TodayExpenseList";
import { DEFAULT_CATEGORIES, CATEGORY_ICONS } from "./lib/categories";
import { getDefaultCategory, saveLastCategory } from "./lib/categories";
import { addExpense, getTodayExpenses } from "./lib/expenses";
import { USERS, DEFAULT_USER, type UserId } from "./lib/users";

export default function HomePage() {
  const [categoryId, setCategoryId] = useState<string>(() => getDefaultCategory());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [paidBy, setPaidBy] = useState<UserId>(DEFAULT_USER);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showList, setShowList] = useState(false);
  const [expenses, setExpenses] = useState(() => getTodayExpenses());

  const selectedCat = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
  const SelectedIcon = selectedCat ? (CATEGORY_ICONS[selectedCat.id] ?? Package) : Package;

  function handleSelectCategory(id: string) {
    setCategoryId(id);
    saveLastCategory(id);
  }

  function handleKeypad(key: string) {
    if (key === "⌫") {
      setAmount(a => a.slice(0, -1));
    } else if (key === "." && amount.includes(".")) {
      // no-op
    } else {
      setAmount(a => a + key);
    }
  }

  function handleConfirm() {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    addExpense({ amount: val, category_id: categoryId, date, paid_by: paidBy, created_by: paidBy, notes: note });
    setExpenses(getTodayExpenses());
    setAmount("");
    setNote("");
    setShowKeypad(false);
  }

  function stepDate(dir: 1 | -1) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + dir);
    setDate(d.toISOString().split("T")[0]);
  }

  function formatDateLabel(d: string) {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    if (d === today) return "Today";
    if (d === yesterday) return "Yesterday";
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const paidByUser = USERS.find(u => u.id === paidBy);
  const nextUser = USERS[(USERS.findIndex(u => u.id === paidBy) + 1) % USERS.length];

  if (showList) {
    return (
      <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto pb-20">
        <div className="sticky top-0 bg-base-100 px-4 pt-12 pb-3 border-b border-base-300">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Today</h1>
            <button onClick={() => setShowList(false)} className="btn btn-sm btn-primary">+ Add</button>
          </div>
        </div>
        <TodayExpenseList expenses={expenses} />
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen bg-base-100 max-w-md mx-auto overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3">
        <h1 className="text-xl font-semibold text-base-content">Add Expense</h1>
        <button onClick={() => setShowList(true)} className="text-sm text-base-content/60 underline underline-offset-2">
          Today ({expenses.length})
        </button>
      </div>

      {/* Category grid — scrollable middle */}
      <div className="flex-1 overflow-y-auto">
        <CategoryPicker
          categories={DEFAULT_CATEGORIES}
          selectedId={categoryId}
          onSelect={handleSelectCategory}
        />
      </div>

      {/* Entry dock — amount display + tap to open sheet */}
      <div className="shrink-0 bg-base-100 border-t border-base-300 pb-20">
        <button
          onClick={() => setShowKeypad(true)}
          className="w-full flex items-center gap-3 px-3.5 py-3"
        >
          <span className="grid place-items-center w-[34px] h-[34px] rounded-xl bg-primary text-primary-content shrink-0">
            <SelectedIcon size={18} strokeWidth={1.6} />
          </span>
          <div className="flex-1 text-left">
            <div className="text-[11px] font-medium text-base-content/50 uppercase tracking-wider">TWD · tap to enter</div>
            <div className={`text-lg font-medium leading-tight ${amount ? "text-base-content" : "text-base-content/35"}`}>
              {amount ? `$${amount}` : "$0"}
            </div>
          </div>
          <Expand size={18} className="text-base-content/40" />
        </button>
      </div>

      {/* Keypad bottom sheet — amount + note + payer + date all together */}
      {showKeypad && (
        <div
          className="fixed inset-0 z-20 bg-black/45 flex items-end"
          onClick={() => setShowKeypad(false)}
        >
          <div
            className="w-full max-w-md mx-auto bg-base-100 rounded-t-3xl p-4 pb-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-9 h-1 rounded-full bg-base-300 mx-auto mb-4" />

            {/* Amount display */}
            <div className="text-4xl font-medium tracking-tight px-1 pb-3 border-b border-base-300">
              <span className="text-lg text-base-content/50 mr-1">$</span>
              {amount || "0"}
            </div>

            {/* Note input */}
            <input
              className="w-full bg-transparent outline-none text-sm text-base-content placeholder:text-base-content/40 py-2.5 border-b border-base-300"
              placeholder="Add a note…"
              value={note}
              onChange={e => setNote(e.target.value)}
            />

            {/* Payer + Date row */}
            <div className="flex items-center gap-3 py-2.5 border-b border-base-300">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-base-content/50">Paid by</span>
                <button
                  onClick={() => setPaidBy(nextUser.id)}
                  className="px-2.5 py-1 rounded-full bg-base-200 text-xs font-medium text-base-content/70"
                >
                  {paidByUser?.name ?? paidBy}
                </button>
              </div>
              <div className="flex items-center gap-1 ml-auto">
                <button onClick={() => stepDate(-1)} className="w-6 h-6 grid place-items-center rounded-full bg-base-200">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-medium text-base-content/70 px-1">{formatDateLabel(date)}</span>
                <button onClick={() => stepDate(1)} className="w-6 h-6 grid place-items-center rounded-full bg-base-200">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(k => (
                <button
                  key={k}
                  onClick={() => handleKeypad(k)}
                  className="h-14 rounded-2xl bg-white border border-base-300 text-xl font-medium active:bg-primary/10"
                >
                  {k}
                </button>
              ))}
            </div>

            {/* Submit / Log another */}
            <div className="grid grid-cols-2 gap-1.5 mt-1.5">
              <button
                onClick={() => { handleConfirm(); }}
                className="h-14 rounded-2xl bg-base-200 text-sm font-semibold text-base-content/70 active:bg-base-300"
              >
                Log another
              </button>
              <button
                onClick={() => { handleConfirm(); setShowList(true); }}
                className="h-14 rounded-2xl bg-primary text-primary-content font-semibold text-base active:opacity-80"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
