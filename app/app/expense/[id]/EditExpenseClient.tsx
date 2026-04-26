"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Expense } from "../../lib/expenses";
import { applyKey, evaluateExpression, KeypadKey } from "../../lib/calculator";
import CalculatorKeypad from "../../components/CalculatorKeypad";
import CategoryPicker from "../../components/CategoryPicker";
import { DEFAULT_CATEGORIES } from "../../lib/categories";
import { USERS } from "../../lib/users";
import { updateExpense, deleteExpense } from "../../lib/expenseService";

interface EditExpenseClientProps {
  expense: Expense;
}

export default function EditExpenseClient({ expense }: EditExpenseClientProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const [expression, setExpression] = useState(String(expense.amount));
  const [categoryId, setCategoryId] = useState(expense.category_id);
  const [date, setDate] = useState(expense.date);
  // Resolve paid_by: handle both user ID and display name stored in sheet
  const initialPayer = USERS.find(u => u.id === expense.paid_by || u.name === expense.paid_by)?.id ?? USERS[0].id;
  const [paidBy, setPaidBy] = useState(initialPayer);
  const [notes, setNotes] = useState(expense.notes ?? "");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [evalError, setEvalError] = useState(false);
  const [saving, setSaving] = useState(false);

  const isSubscription = !!expense.subscription_id;

  function handleKey(key: KeypadKey) {
    setEvalError(false);
    setExpression(prev => applyKey(prev, key));
  }

  async function handleSave() {
    const amount = evaluateExpression(expression);
    if (!amount || amount <= 0) { setEvalError(true); return; }
    setSaving(true);
    try {
      await updateExpense(expense.id, { amount, category_id: categoryId, date, paid_by: paidBy, notes });
      router.back();
    } catch {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteExpense(expense.id);
      setShowDeleteDialog(false);
      router.back();
    } catch {
      setSaving(false);
    }
  }

  function cyclePayer() {
    const idx = USERS.findIndex(u => u.id === paidBy);
    const next = USERS[(idx + 1) % USERS.length];
    setPaidBy(next.id);
  }

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-base-200">
        <button onClick={() => router.back()} className="btn btn-ghost btn-sm">← {t("common.back")}</button>
        <h1 className="text-xl font-bold flex-1">{t("history.edit_title")}</h1>
        <button onClick={() => setShowDeleteDialog(true)} className="btn btn-ghost btn-sm text-error">{t("common.delete")}</button>
      </div>

      {/* Subscription warning */}
      {isSubscription && (
        <div className="mx-4 mt-4 p-3 bg-warning/20 border border-warning rounded-xl text-sm">
          {t("history.subscription_edit_warning")}
        </div>
      )}

      {/* Amount display */}
      <div className="bg-primary text-primary-content px-4 pt-6 pb-4">
        <div className="text-base opacity-70 mb-1">{t("home.amount_label")}</div>
        <div className={`text-5xl font-mono font-bold min-h-[60px] break-all ${evalError ? "text-error" : ""}`}>
          {expression || <span className="opacity-40">0</span>}
        </div>
        {evalError && <div className="text-sm text-error-content bg-error/20 rounded px-2 py-1 mt-1">{t("common.save")}</div>}
      </div>

      {/* Scrollable fields */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 pb-6">
        <div className="flex gap-2">
          <button type="button" onClick={() => {}} className="btn btn-outline btn-sm flex-1 justify-start gap-2">
            <span>📅</span><span>{date}</span>
          </button>
          <button type="button" onClick={cyclePayer} className="btn btn-outline btn-sm flex-1 justify-start gap-2">
            <span>👤</span><span>{USERS.find(u => u.id === paidBy)?.name ?? paidBy}</span>
          </button>
        </div>
        <input type="text" placeholder={t("home.notes_placeholder")} className="input input-bordered w-full" value={notes} onChange={e => setNotes(e.target.value)} />
        <div>
          <div className="text-xs text-base-content/50 mb-2 uppercase tracking-wide">{t("common.category")}</div>
          <CategoryPicker categories={DEFAULT_CATEGORIES} selectedId={categoryId} onSelect={setCategoryId} />
        </div>
      </div>

      {/* Keypad + save */}
      <div className="sticky bottom-0 bg-base-100/95 backdrop-blur-sm border-t border-base-200 px-4 pt-3 pb-20 space-y-3">
        <CalculatorKeypad onKey={handleKey} />
        <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full">
          {saving ? <span className="loading loading-spinner loading-sm" /> : t("history.save_changes")}
        </button>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-base-100 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold">{t("history.delete_confirm")}</h3>
            {isSubscription && <p className="text-sm text-base-content/70">{t("history.delete_subscription_note")}</p>}
            <p className="text-sm text-base-content/70">{t("history.cannot_undo")}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteDialog(false)} className="btn btn-ghost flex-1">{t("common.cancel")}</button>
              <button onClick={handleDelete} disabled={saving} className="btn btn-error flex-1">
                {saving ? <span className="loading loading-spinner loading-sm" /> : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
