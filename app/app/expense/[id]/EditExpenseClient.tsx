"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Expense } from "../../lib/expenses";
import { applyKey, evaluateExpression, KeypadKey } from "../../lib/calculator";
import CalculatorKeypad from "../../components/CalculatorKeypad";
import CategoryPicker from "../../components/CategoryPicker";
import { updateExpense, deleteExpense } from "../../lib/expenseService";

interface EditExpenseClientProps {
  expense: Expense;
}

export default function EditExpenseClient({ expense }: EditExpenseClientProps) {
  const router = useRouter();

  const [expression, setExpression] = useState(String(expense.amount));
  const [categoryId, setCategoryId] = useState(expense.category_id);
  const [date, setDate] = useState(expense.date);
  const [paidBy, setPaidBy] = useState(expense.paid_by);
  const [notes, setNotes] = useState(expense.notes ?? "");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [evalError, setEvalError] = useState(false);

  const isSubscription = !!expense.subscription_id;

  function handleKey(key: KeypadKey) {
    setEvalError(false);
    setExpression(prev => applyKey(prev, key));
  }

  function handleSave() {
    const amount = evaluateExpression(expression);
    if (!amount || amount <= 0) { setEvalError(true); return; }
    updateExpense(expense.id, { amount, category_id: categoryId, date, paid_by: paidBy, notes });
    router.back();
  }

  function handleDelete() {
    deleteExpense(expense.id);
    setShowDeleteDialog(false);
    router.back();
  }

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-base-200">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">← Back</button>
        <h1 className="text-xl font-bold flex-1">Edit Expense</h1>
        <button onClick={() => setShowDeleteDialog(true)} className="btn btn-ghost btn-sm text-error">Delete</button>
      </div>

      {/* Subscription warning */}
      {isSubscription && (
        <div className="mx-4 mt-4 p-3 bg-warning/20 border border-warning rounded-xl text-sm">
          This expense was created by a subscription. Editing it here won&apos;t affect future entries — update the subscription directly if the amount or details have changed.
        </div>
      )}

      {/* Amount display */}
      <div className="bg-primary text-primary-content px-4 pt-6 pb-4">
        <div className="text-base opacity-70 mb-1">Amount (TWD)</div>
        <div className={`text-5xl font-mono font-bold min-h-[60px] break-all ${evalError ? "text-error" : ""}`}>
          {expression || <span className="opacity-40">0</span>}
        </div>
        {evalError && <div className="text-sm text-error-content bg-error/20 rounded px-2 py-1 mt-1">Enter a valid amount</div>}
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-6">
        <div className="flex gap-2">
          <button type="button" onClick={() => {}} className="btn btn-outline btn-sm flex-1 justify-start gap-2">
            <span>📅</span><span>{date}</span>
          </button>
          <button type="button" onClick={() => setPaidBy(p => p === "user1" ? "user2" : "user1")} className="btn btn-outline btn-sm flex-1 justify-start gap-2">
            <span>👤</span><span>{paidBy === "user1" ? "User 1" : "User 2"}</span>
          </button>
        </div>
        <input type="text" placeholder="Notes (optional)" className="input input-bordered w-full" value={notes} onChange={e => setNotes(e.target.value)} />
        <div>
          <div className="text-xs text-base-content/50 mb-2 uppercase tracking-wide">Category</div>
          <CategoryPicker selected={categoryId} onSelect={setCategoryId} />
        </div>
      </div>

      {/* Keypad + save */}
      <div className="sticky bottom-0 bg-base-100/95 backdrop-blur-sm border-t border-base-200 px-4 pt-3 pb-20 space-y-3">
        <CalculatorKeypad onKey={handleKey} />
        <button onClick={handleSave} className="btn btn-primary w-full">Save Changes</button>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-base-100 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold">Delete this expense?</h3>
            {isSubscription && <p className="text-sm text-base-content/70">This was created by a subscription. Future entries won&apos;t be affected.</p>}
            <p className="text-sm text-base-content/70">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteDialog(false)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleDelete} className="btn btn-error flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
