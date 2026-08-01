"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Category } from "../lib/categories";
import { Expense } from "../lib/expenses";
import { USERS } from "../lib/users";
import { updateExpense, deleteExpense } from "../lib/expenseService";
import CategoryPicker from "./CategoryPicker";

interface EditForm {
  amount: string;
  date: string;
  paidBy: string;  // user ID
  notes: string;
  categoryId: string;
}

interface Props {
  expense: Expense;
  categories: Category[];
  onClose: () => void;
  onSaved: (updated: Expense) => void;
  onDeleted: (id: string) => void;
}

function formatFullDate(dateStr: string, lang: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(
    lang === "zh" ? "zh-TW" : "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" }
  );
}

// Resolve paid_by field to a user ID (handles both IDs and display names)
function resolveUserId(paid_by: string): string {
  const byId = USERS.find(u => u.id === paid_by);
  if (byId) return byId.id;
  const byName = USERS.find(u => u.name === paid_by);
  if (byName) return byName.id;
  return USERS[0].id; // default
}

export default function ExpenseEditSheet({ expense, categories, onClose, onSaved, onDeleted }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const [mode, setMode] = useState<"view" | "edit" | "delete-confirm">("view");
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  const cat = categories.find(c => c.id === expense.category_id);
  const paidByUser = USERS.find(u => u.id === expense.paid_by || u.name === expense.paid_by);
  const createdByUser = USERS.find(u => u.id === expense.created_by || u.name === expense.created_by);
  const isSubscription = !!expense.subscription_id;

  function startEdit() {
    setEditForm({
      amount: String(expense.amount),
      date: expense.date,
      paidBy: resolveUserId(expense.paid_by),
      notes: expense.notes ?? "",
      categoryId: expense.category_id,
    });
    setMode("edit");
    setActionError("");
  }

  function cyclePayer() {
    if (!editForm) return;
    const idx = USERS.findIndex(u => u.id === editForm.paidBy);
    const next = USERS[(idx + 1) % USERS.length];
    setEditForm(f => f ? { ...f, paidBy: next.id } : f);
  }

  async function handleSave() {
    if (!editForm) return;
    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || amount <= 0) { setActionError("Enter a valid amount."); return; }
    setSaving(true);
    setActionError("");
    try {
      const updated = await updateExpense(expense.id, {
        amount,
        date: editForm.date,
        paid_by: editForm.paidBy,
        notes: editForm.notes,
        category_id: editForm.categoryId,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setActionError("");
    try {
      await deleteExpense(expense.id);
      onDeleted(expense.id);
      onClose();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete.");
      setSaving(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/45 flex items-end" onClick={onClose}>
      <div
        className="w-full max-w-md mx-auto bg-base-100 rounded-t-3xl pb-8 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Sheet handle */}
        <div className="w-9 h-1 rounded-full bg-base-300 mx-auto mt-3 mb-1" />

        {/* ── VIEW mode ── */}
        {mode === "view" && (
          <>
            <div className="flex items-center justify-between px-4 pt-2 pb-2">
              <button
                onClick={startEdit}
                className="p-2 rounded-full text-base-content/50 hover:bg-base-200 hover:text-primary transition-colors"
                title={t("history.edit_title")}
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={() => { setMode("delete-confirm"); setActionError(""); }}
                className="p-2 rounded-full text-base-content/50 hover:bg-base-200 hover:text-error transition-colors"
                title={t("common.delete")}
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="flex items-center gap-4 px-5 pt-2 pb-4 border-b border-base-300">
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-primary/10 text-primary">
                <span className="text-3xl">{cat?.icon ?? "💰"}</span>
              </span>
              <div>
                <div className="text-xl font-semibold">
                  {lang === "zh" ? (cat?.name_zh ?? cat?.name_en ?? expense.category_id) : (cat?.name_en ?? expense.category_id)}
                </div>
                <div className="text-sm text-base-content/50">{formatFullDate(expense.date, lang)}</div>
              </div>
              <div className="ml-auto text-2xl font-semibold tabular-nums">
                NT${expense.amount.toLocaleString()}
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {expense.notes && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">{t("history.note_label")}</div>
                  <div className="text-base text-base-content">{expense.notes}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">{t("history.paid_by")}</div>
                  <div className="text-sm font-medium">{paidByUser?.name ?? expense.paid_by}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">{t("history.logged_by")}</div>
                  <div className="text-sm font-medium">{createdByUser?.name ?? expense.created_by}</div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── EDIT mode ── */}
        {mode === "edit" && editForm && (
          <>
            <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-base-300">
              <button onClick={() => setMode("view")} className="btn btn-ghost btn-sm">
                {t("common.cancel")}
              </button>
              <span className="font-semibold text-base">{t("history.edit_title")}</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary btn-sm"
              >
                {saving ? <span className="loading loading-spinner loading-xs" /> : t("history.save_changes")}
              </button>
            </div>

            {isSubscription && (
              <div className="mx-5 mt-4 p-3 bg-warning/20 border border-warning rounded-xl text-sm">
                {t("history.subscription_edit_warning")}
              </div>
            )}

            <div className="px-5 py-4 space-y-4">
              {/* Amount */}
              <div>
                <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">{t("home.amount_label")}</div>
                <input
                  type="number"
                  className="input input-bordered w-full text-lg font-mono"
                  value={editForm.amount}
                  onChange={e => setEditForm(f => f ? { ...f, amount: e.target.value } : f)}
                  min="0"
                  step="1"
                />
              </div>

              {/* Date */}
              <div>
                <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">{t("history.date_range")}</div>
                <input
                  type="date"
                  className="input input-bordered w-full"
                  value={editForm.date}
                  onChange={e => setEditForm(f => f ? { ...f, date: e.target.value } : f)}
                />
              </div>

              {/* Paid by */}
              <div>
                <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">{t("history.paid_by")}</div>
                <button
                  type="button"
                  onClick={cyclePayer}
                  className="btn btn-outline w-full justify-start gap-2"
                >
                  <span>👤</span>
                  <span>{USERS.find(u => u.id === editForm.paidBy)?.name ?? editForm.paidBy}</span>
                </button>
              </div>

              {/* Notes */}
              <div>
                <div className="text-xs uppercase tracking-wider text-base-content/40 mb-1">{t("history.note_label")}</div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder={t("home.notes_placeholder")}
                  value={editForm.notes}
                  onChange={e => setEditForm(f => f ? { ...f, notes: e.target.value } : f)}
                />
              </div>

              {/* Category */}
              <div>
                <div className="text-xs uppercase tracking-wider text-base-content/40 mb-2">{t("common.category")}</div>
                <CategoryPicker
                  categories={categories}
                  selectedId={editForm.categoryId}
                  onSelect={id => setEditForm(f => f ? { ...f, categoryId: id } : f)}
                />
              </div>

              {actionError && (
                <p className="text-sm text-error">{actionError}</p>
              )}
            </div>
          </>
        )}

        {/* ── DELETE CONFIRM mode ── */}
        {mode === "delete-confirm" && (
          <div className="px-5 py-6 space-y-4">
            <h3 className="text-lg font-bold">{t("history.delete_confirm")}</h3>
            {isSubscription && (
              <p className="text-sm text-base-content/70">{t("history.delete_subscription_note")}</p>
            )}
            <p className="text-sm text-base-content/60">{t("history.cannot_undo")}</p>
            {actionError && (
              <p className="text-sm text-error">{actionError}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setMode("view")}
                className="btn btn-ghost flex-1"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="btn btn-error flex-1"
              >
                {saving ? <span className="loading loading-spinner loading-xs" /> : t("common.delete")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
