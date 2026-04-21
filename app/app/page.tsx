"use client";

import { useState, useEffect } from "react";
import CalculatorKeypad from "./components/CalculatorKeypad";
import CategoryPicker from "./components/CategoryPicker";
import TodayExpenseList from "./components/TodayExpenseList";
import { KeypadKey, applyKey, evaluateExpression } from "./lib/calculator";
import { getDefaultCategory, saveLastCategory } from "./lib/categories";
import { Expense, MOCK_EXPENSES, stubSaveExpense } from "./lib/expenses";
import { USERS, UserId, DEFAULT_USER } from "./lib/users";

type View = "entry" | "list";

export default function Home() {
  const [view, setView] = useState<View>("entry");
  const [expression, setExpression] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [paidBy, setPaidBy] = useState<UserId>(DEFAULT_USER);
  const [notes, setNotes] = useState("");
  const [expenses, setExpenses] = useState<Expense[]>(MOCK_EXPENSES);
  const [evalError, setEvalError] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Load last-used category from localStorage on mount
  useEffect(() => {
    setCategoryId(getDefaultCategory());
  }, []);

  function handleKey(key: KeypadKey) {
    setEvalError(false);
    setExpression((prev) => applyKey(prev, key));
  }

  function handleCategorySelect(id: string) {
    setCategoryId(id);
    saveLastCategory(id);
  }

  function handleConfirm() {
    const amount = evaluateExpression(expression);
    if (amount === null || amount <= 0) {
      setEvalError(true);
      return;
    }
    const newExpense = stubSaveExpense({
      date,
      amount,
      category_id: categoryId,
      paid_by: paidBy,
      notes,
    });
    setExpenses((prev) => [newExpense, ...prev]);
    resetForm();
    setView("list");
  }

  function handleCancel() {
    resetForm();
    setView("list");
  }

  function resetForm() {
    setExpression("");
    setNotes("");
    setEvalError(false);
    setDate(new Date().toISOString().split("T")[0]);
    setPaidBy(DEFAULT_USER);
  }

  // Computed display: show evaluated value preview when expression is valid
  const evaluatedAmount = evaluateExpression(expression);
  const showPreview =
    expression.includes("+") ||
    expression.includes("-") ||
    expression.includes("×") ||
    expression.includes("÷") ||
    expression.includes("(");

  if (view === "list") {
    return (
      <TodayExpenseList
        expenses={expenses}
        onAddNew={() => setView("entry")}
      />
    );
  }

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto">
      {/* Amount display */}
      <div className="bg-primary text-primary-content px-4 pt-12 pb-4">
        <div className="text-base opacity-70 mb-1">Amount (TWD)</div>
        <div
          className={`text-5xl font-mono font-bold min-h-[52px] break-all ${
            evalError ? "text-error" : ""
          }`}
        >
          {expression || <span className="opacity-40">0</span>}
        </div>
        {showPreview && evaluatedAmount !== null && (
          <div className="text-sm opacity-70 mt-1">= NT${evaluatedAmount.toLocaleString()}</div>
        )}
        {evalError && (
          <div className="text-sm text-error-content bg-error/20 rounded px-2 py-1 mt-1">
            Enter a valid amount
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-6">
        {/* Supporting fields */}
        <div className="flex gap-2">
          {/* Date */}
          <button
            type="button"
            onClick={() => setShowDatePicker((p) => !p)}
            className="btn btn-outline btn-sm flex-1 justify-start gap-2"
          >
            <span>📅</span>
            <span>{date}</span>
          </button>
          {/* Paid by toggle */}
          <button
            type="button"
            onClick={() => setPaidBy((p) => {
              const idx = USERS.findIndex((u) => u.id === p);
              return USERS[(idx + 1) % USERS.length].id;
            })}
            className="btn btn-outline btn-sm flex-1 justify-start gap-2"
          >
            <span>👤</span>
            <span>{USERS.find((u) => u.id === paidBy)?.name ?? paidBy}</span>
          </button>
        </div>

        {showDatePicker && (
          <input
            type="date"
            className="input input-bordered w-full"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setShowDatePicker(false);
            }}
          />
        )}

        {/* Notes */}
        <input
          type="text"
          placeholder="Notes (optional)"
          className="input input-bordered w-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Category picker */}
        <div>
          <div className="text-xs text-base-content/50 mb-2 uppercase tracking-wide">Category</div>
          {categoryId && (
            <CategoryPicker selected={categoryId} onSelect={handleCategorySelect} />
          )}
        </div>
      </div>

      {/* Keypad + actions — sticky at bottom */}
      <div className="sticky bottom-0 bg-base-100/95 backdrop-blur-sm border-t border-base-200 px-4 pt-3 pb-6 space-y-3">
        <CalculatorKeypad onKey={handleKey} />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="btn btn-ghost border border-base-300 text-base-content"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="btn btn-primary"
          >
            Confirm
          </button>
        </div>
      </div>

    </main>
  );
}
