"use client";

import { useState } from "react";
import { Subscription, MOCK_SUBSCRIPTIONS, getNextDueDate } from "../lib/subscriptions";
import { addSubscription, updateSubscription, cancelSubscription } from "../lib/subscriptionService";
import { DEFAULT_CATEGORIES } from "../lib/categories";

type ModalMode = "add" | "edit" | null;

function getCategoryDisplay(category_id: string) {
  const cat = DEFAULT_CATEGORIES.find((c) => c.id === category_id);
  return cat ? { icon: cat.icon, name: cat.name_en } : { icon: "📦", name: category_id };
}

function formatDueDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface AddFormState {
  name: string;
  amount: string;
  category_id: string;
  frequency: "monthly" | "annual";
  due_day: string;
  due_month: string;
}

interface EditFormState {
  name: string;
  category_id: string;
  due_day: string;
  due_month: string;
}

const defaultAddForm: AddFormState = {
  name: "",
  amount: "",
  category_id: DEFAULT_CATEGORIES[0].id,
  frequency: "monthly",
  due_day: "1",
  due_month: "1",
};

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(MOCK_SUBSCRIPTIONS);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddFormState>(defaultAddForm);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: "",
    category_id: DEFAULT_CATEGORIES[0].id,
    due_day: "1",
    due_month: "1",
  });

  const active = subscriptions.filter((s) => s.is_active);
  const cancelled = subscriptions.filter((s) => !s.is_active);

  function openAdd() {
    setAddForm(defaultAddForm);
    setModalMode("add");
  }

  function openEdit(sub: Subscription) {
    setEditingId(sub.id);
    setEditForm({
      name: sub.name,
      category_id: sub.category_id,
      due_day: String(sub.due_day),
      due_month: String(sub.due_month ?? 1),
    });
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
  }

  function handleAdd() {
    const amount = parseFloat(addForm.amount);
    if (!addForm.name.trim() || isNaN(amount) || amount <= 0) return;
    const due_day = Math.max(1, Math.min(31, parseInt(addForm.due_day) || 1));
    const due_month = addForm.frequency === "annual"
      ? Math.max(1, Math.min(12, parseInt(addForm.due_month) || 1))
      : undefined;
    const newSub = addSubscription({
      name: addForm.name.trim(),
      amount,
      category_id: addForm.category_id,
      frequency: addForm.frequency,
      due_day,
      due_month,
      paid_by: "user1",
    });
    setSubscriptions((prev) => [...prev, newSub]);
    closeModal();
  }

  function handleEdit() {
    if (!editingId) return;
    const due_day = Math.max(1, Math.min(31, parseInt(editForm.due_day) || 1));
    const due_month = subscriptions.find((s) => s.id === editingId)?.frequency === "annual"
      ? Math.max(1, Math.min(12, parseInt(editForm.due_month) || 1))
      : undefined;
    const updates: Parameters<typeof updateSubscription>[1] = {
      name: editForm.name.trim() || undefined,
      category_id: editForm.category_id,
      due_day,
      due_month,
    };
    updateSubscription(editingId, updates);
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === editingId
          ? { ...s, ...updates, due_month: due_month ?? s.due_month }
          : s
      )
    );
    closeModal();
  }

  function handleCancel(id: string) {
    cancelSubscription(id);
    setSubscriptions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: false } : s))
    );
  }

  const editingFrequency = editingId
    ? subscriptions.find((s) => s.id === editingId)?.frequency
    : undefined;

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-12 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Subscriptions</h1>
        <button className="btn btn-primary btn-sm gap-1" onClick={openAdd}>
          <span className="text-lg leading-none">+</span>
          Add
        </button>
      </div>

      {/* Active subscriptions */}
      {active.length > 0 && (
        <section className="mb-6">
          <div className="text-xs text-base-content/50 uppercase tracking-wide mb-2">Active</div>
          <div className="space-y-2">
            {active.map((sub) => {
              const cat = getCategoryDisplay(sub.category_id);
              const nextDue = getNextDueDate(sub);
              return (
                <div key={sub.id} className="card bg-base-200 shadow-sm">
                  <div className="card-body p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{cat.icon}</span>
                          <span className="font-semibold truncate">{sub.name}</span>
                        </div>
                        <div className="text-sm text-base-content/60 mt-1 space-y-0.5">
                          <div>
                            <span className="font-medium text-base-content">NT${sub.amount.toLocaleString()}</span>
                            <span className="mx-1.5 text-base-content/30">·</span>
                            <span>{sub.frequency === "monthly" ? "Monthly" : "Annual"}</span>
                          </div>
                          <div>
                            <span>{cat.name}</span>
                            <span className="mx-1.5 text-base-content/30">·</span>
                            <span>Due {formatDueDate(nextDue)}</span>
                          </div>
                          <div className="text-xs text-base-content/40">
                            Paid by {sub.paid_by}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => openEdit(sub)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => handleCancel(sub.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Cancelled subscriptions */}
      {cancelled.length > 0 && (
        <section>
          <div className="text-xs text-base-content/50 uppercase tracking-wide mb-2">Cancelled</div>
          <div className="space-y-2">
            {cancelled.map((sub) => {
              const cat = getCategoryDisplay(sub.category_id);
              return (
                <div key={sub.id} className="card bg-base-200/50 shadow-sm opacity-60">
                  <div className="card-body p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl">{cat.icon}</span>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{sub.name}</div>
                          <div className="text-sm text-base-content/50">
                            NT${sub.amount.toLocaleString()}
                            <span className="mx-1.5">·</span>
                            {cat.name}
                          </div>
                        </div>
                      </div>
                      <span className="badge badge-ghost badge-sm shrink-0">Cancelled</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {active.length === 0 && cancelled.length === 0 && (
        <p className="text-base-content/50 text-center mt-12">No subscriptions yet. Tap + Add to get started.</p>
      )}

      {/* Add Modal */}
      {modalMode === "add" && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Add Subscription</h3>
            <div className="space-y-3">
              <div>
                <label className="label label-text text-xs">Name</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. Netflix"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label label-text text-xs">Amount (NT$)</label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  placeholder="0"
                  min="0"
                  value={addForm.amount}
                  onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="label label-text text-xs">Category</label>
                <select
                  className="select select-bordered w-full"
                  value={addForm.category_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  {DEFAULT_CATEGORIES.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label label-text text-xs">Frequency</label>
                <div className="join w-full">
                  <button
                    type="button"
                    className={`join-item btn flex-1 ${addForm.frequency === "monthly" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setAddForm((f) => ({ ...f, frequency: "monthly" }))}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    className={`join-item btn flex-1 ${addForm.frequency === "annual" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setAddForm((f) => ({ ...f, frequency: "annual" }))}
                  >
                    Annual
                  </button>
                </div>
              </div>
              {addForm.frequency === "annual" && (
                <div>
                  <label className="label label-text text-xs">Due Month (1–12)</label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    min="1"
                    max="12"
                    value={addForm.due_month}
                    onChange={(e) => setAddForm((f) => ({ ...f, due_month: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className="label label-text text-xs">Due Day (1–31)</label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  min="1"
                  max="31"
                  value={addForm.due_day}
                  onChange={(e) => setAddForm((f) => ({ ...f, due_day: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAdd}>
                Add
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeModal} />
        </div>
      )}

      {/* Edit Modal */}
      {modalMode === "edit" && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">Edit Subscription</h3>
            <div className="space-y-3">
              <div>
                <label className="label label-text text-xs">Name</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label label-text text-xs">Category</label>
                <select
                  className="select select-bordered w-full"
                  value={editForm.category_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  {DEFAULT_CATEGORIES.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name_en}
                    </option>
                  ))}
                </select>
              </div>
              {editingFrequency === "annual" && (
                <div>
                  <label className="label label-text text-xs">Due Month (1–12)</label>
                  <input
                    type="number"
                    className="input input-bordered w-full"
                    min="1"
                    max="12"
                    value={editForm.due_month}
                    onChange={(e) => setEditForm((f) => ({ ...f, due_month: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className="label label-text text-xs">Due Day (1–31)</label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  min="1"
                  max="31"
                  value={editForm.due_day}
                  onChange={(e) => setEditForm((f) => ({ ...f, due_day: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleEdit}>
                Save
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeModal} />
        </div>
      )}
    </main>
  );
}
