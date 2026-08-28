"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Subscription, getNextDueDate, todayLocalIso, endsBeforeStart } from "../lib/subscriptions";
import { getSubscriptions, addSubscription, updateSubscription, cancelSubscription, getSchedulerStatus, SchedulerStatus } from "../lib/subscriptionService";
import { Category, DEFAULT_CATEGORIES, categoryIcon, resolveCategory } from "../lib/categories";
import { getCategories } from "../lib/categoryService";
import { USERS, DEFAULT_USER } from "../lib/users";
import { useAuth } from "../lib/authContext";
import { useTranslation } from "react-i18next";
import DatePickerModal from "../components/DatePickerModal";

type ModalMode = "add" | "edit" | null;

function getCategoryDisplay(category_id: string, categories: Category[]) {
  const cat = resolveCategory(category_id, categories);
  return { icon: categoryIcon(cat), name: cat?.name_en ?? category_id };
}

function formatDueDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatRunTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface AddFormState {
  name: string;
  amount: string;
  category_id: string;
  frequency: "monthly" | "annual";
  due_day: string;
  due_month: string;
  start_date: string;
  notes: string;
}

interface EditFormState {
  name: string;
  amount: string;
  category_id: string;
  due_day: string;
  due_month: string;
  notes: string;
}

// A hard cap rather than a truncating ellipsis, following entity 043: a note is
// either fully readable on the card or it was never accepted. Enforced in the
// handler as well as by maxLength, so a paste is capped by the same rule typing is.
const NOTES_MAX = 200;

// category_id is deliberately empty rather than a DEFAULT_CATEGORIES slug: the
// select is populated from the live list, so a slug here would show one category
// and submit another. openAdd fills it from the live list, and submission is
// blocked until that list exists.
const defaultAddForm: AddFormState = {
  name: "",
  amount: "",
  category_id: "",
  frequency: "monthly",
  due_day: "1",
  due_month: "1",
  start_date: "",
  notes: "",
};

export default function SubscriptionsPage() {
  const { t } = useTranslation();
  const { resolvedUserId } = useAuth();
  const currentUserId = resolvedUserId ?? DEFAULT_USER;
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  // Full live list, archived included — a subscription on an archived category
  // still resolves its icon. DEFAULT_CATEGORIES is the offline fallback only.
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  // Same split as the home screen: DEFAULT_CATEGORIES still renders a stored
  // category's icon while the live list is in flight, but nothing may be written
  // against it. Entity 049 fixed which id the add form STARTS on; this is the
  // guard for the two residual paths it left — a failed fetch, and a modal opened
  // before the fetch resolves.
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [categoriesFailed, setCategoriesFailed] = useState(false);

  useEffect(() => {
    getSubscriptions()
      .then(setSubscriptions)
      .catch(() => setSubscriptions([]))
      .finally(() => setLoading(false));
  }, []);

  const loadCategories = useCallback(() => {
    setCategoriesFailed(false);
    return getCategories()
      .then((cats) => {
        if (cats.length === 0) { setCategoriesFailed(true); return; }
        setCategories(cats);
        setCategoriesReady(true);
      })
      .catch(() => setCategoriesFailed(true));
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);

  useEffect(() => {
    getSchedulerStatus().then(setSchedulerStatus);
  }, []);

  // A stale scheduler still names the date it last ran, so "how long has this
  // been broken?" is answerable from the screen rather than from the sheet.
  const autoAddLine = useMemo(() => {
    if (!schedulerStatus) return "";
    const lastRan = schedulerStatus.last_run_at
      ? `${t("subscriptions.auto_add_last_ran")} ${formatRunTime(schedulerStatus.last_run_at)}`
      : "";
    if (!schedulerStatus.stale) return lastRan;
    return [t("subscriptions.auto_add_not_running"), lastRan].filter(Boolean).join(" · ");
  }, [schedulerStatus, t]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddFormState>(defaultAddForm);
  const [editForm, setEditForm] = useState<EditFormState>({
    name: "",
    amount: "",
    category_id: "",
    due_day: "1",
    due_month: "1",
    notes: "",
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [cancelDate, setCancelDate] = useState("");
  const [cancelInvalid, setCancelInvalid] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [startPickerOpen, setStartPickerOpen] = useState(false);
  const [endPickerOpen, setEndPickerOpen] = useState(false);

  // Sort newest first (IDs are timestamp-based: sub-{ms})
  const active = subscriptions.filter((s) => s.is_active).sort((a, b) => b.id.localeCompare(a.id));
  const cancelled = subscriptions.filter((s) => !s.is_active).sort((a, b) => b.id.localeCompare(a.id));

  function openAdd() {
    // The options are live categories now, so the initial value has to be a live
    // id — a legacy slug default would show one category and submit another.
    // The start date is filled in at open time, not at module load, so a session
    // left open overnight does not offer yesterday.
    setAddForm({
      ...defaultAddForm,
      category_id: activeCategories[0]?.id ?? "",
      start_date: todayLocalIso(),
    });
    setStartPickerOpen(false);
    setModalMode("add");
  }

  function openEdit(sub: Subscription) {
    setEditingId(sub.id);
    setEditForm({
      name: sub.name,
      amount: String(sub.amount),
      category_id: sub.category_id,
      due_day: String(sub.due_day),
      due_month: String(sub.due_month ?? 1),
      // `?? ""` despite the type: hosting and functions deploy in one command but
      // land independently, so a new bundle can briefly talk to a backend whose
      // /api/subscriptions carries no notes key. Without this, opening Edit in
      // that window throws on .trim() and takes the whole page down.
      notes: sub.notes ?? "",
    });
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setEditingId(null);
  }

  async function handleAdd() {
    if (addSubmitting || !categoriesReady) return;
    const amount = parseFloat(addForm.amount);
    if (!addForm.name.trim() || isNaN(amount) || amount <= 0) return;
    const due_day = Math.max(1, Math.min(31, parseInt(addForm.due_day) || 1));
    const due_month = addForm.frequency === "annual"
      ? Math.max(1, Math.min(12, parseInt(addForm.due_month) || 1))
      : undefined;
    setAddSubmitting(true);
    try {
      const newSub = await addSubscription({
        name: addForm.name.trim(),
        amount,
        category_id: addForm.category_id,
        frequency: addForm.frequency,
        due_day,
        due_month,
        paid_by: USERS.find(u => u.id === currentUserId)?.name ?? currentUserId,
        start_date: addForm.start_date,
        end_date: "",
        // Trimmed, so a note of only spaces is stored as unset rather than as a
        // note line that occupies card space showing nothing.
        notes: addForm.notes.trim(),
      });
      setSubscriptions((prev) => [...prev, newSub]);
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add subscription");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleEdit() {
    if (!editingId || editSubmitting || !categoriesReady) return;
    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || amount <= 0) return;
    const due_day = Math.max(1, Math.min(31, parseInt(editForm.due_day) || 1));
    const due_month = subscriptions.find((s) => s.id === editingId)?.frequency === "annual"
      ? Math.max(1, Math.min(12, parseInt(editForm.due_month) || 1))
      : undefined;
    const updates = {
      name: editForm.name.trim() || undefined,
      amount,
      category_id: editForm.category_id,
      due_day,
      due_month,
      notes: editForm.notes.trim(),
    };
    setEditSubmitting(true);
    try {
      await updateSubscription(editingId, updates);
      setSubscriptions((prev) =>
        prev.map((s) =>
          s.id === editingId
            ? { ...s, name: updates.name ?? s.name, amount: updates.amount, category_id: updates.category_id ?? s.category_id, due_day: updates.due_day ?? s.due_day, due_month: due_month ?? s.due_month, notes: updates.notes }
            : s
        )
      );
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update subscription");
    } finally {
      setEditSubmitting(false);
    }
  }

  // Archiving asks when the subscription actually ended before it writes
  // anything. Cancel used to PATCH straight through, which recorded only THAT it
  // ended, never when.
  function openCancel(sub: Subscription) {
    setCancelTarget(sub);
    setCancelDate(todayLocalIso());
    setCancelInvalid(false);
    setCancelSubmitting(false);
    setEndPickerOpen(false);
  }

  function closeCancel() {
    setCancelTarget(null);
  }

  async function handleCancelConfirm() {
    if (!cancelTarget || cancelSubmitting) return;
    // Blocked here as well as on the server, because the modal is not the only
    // caller and the server is not the only place the captain sees an error.
    if (endsBeforeStart(cancelTarget.start_date, cancelDate)) {
      setCancelInvalid(true);
      return;
    }
    setCancelInvalid(false);
    setCancelSubmitting(true);
    try {
      await cancelSubscription(cancelTarget.id, cancelDate);
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === cancelTarget.id ? { ...s, is_active: false, end_date: cancelDate } : s))
      );
      closeCancel();
    } catch (err) {
      // The modal stays open and the card stays in Active: nothing local is
      // mutated on a write that did not land.
      alert(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setCancelSubmitting(false);
    }
  }

  const editingFrequency = editingId
    ? subscriptions.find((s) => s.id === editingId)?.frequency
    : undefined;

  // Rendered inside whichever modal is open, next to the disabled Save.
  const categoryStatus = !categoriesReady && (
    <div
      data-testid="category-status"
      className={`text-xs mt-3 flex items-center gap-2 ${categoriesFailed ? "text-error" : "text-base-content/50"}`}
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
  );

  // Every stored subscription carries a legacy slug id, which is absent from the
  // live list. Keep that stored id as the option's value so saving an unrelated
  // field cannot silently rewrite the category, and label it with the live
  // category's icon and name so the modal shows what Category Management shows.
  const editCategoryOptions = useMemo(() => {
    const options = activeCategories.map((c) => ({ value: c.id, label: `${categoryIcon(c)} ${c.name_en}` }));
    if (editForm.category_id && !options.some((o) => o.value === editForm.category_id)) {
      const stored = resolveCategory(editForm.category_id, categories);
      options.unshift({
        value: editForm.category_id,
        label: `${categoryIcon(stored)} ${stored?.name_en ?? editForm.category_id}`,
      });
    }
    return options;
  }, [activeCategories, categories, editForm.category_id]);

  if (loading) return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-6 pb-6">
      <h1 className="text-2xl font-bold mb-4">{t("subscriptions.title")}</h1>
      <div className="flex justify-center py-16"><span className="loading loading-spinner loading-md text-primary" /></div>
    </main>
  );

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("subscriptions.title")}</h1>
          {/* Whether auto-add is still running, on the screen it affects. Its
              absence is what let a dead scheduler go unnoticed for months. */}
          {autoAddLine && (
            <div
              data-testid="auto-add-status"
              className={`text-xs mt-0.5 ${schedulerStatus?.stale ? "text-warning" : "text-base-content/50"}`}
            >
              {autoAddLine}
            </div>
          )}
        </div>
        <button className="btn btn-primary btn-sm gap-1" onClick={openAdd}>
          <span className="text-lg leading-none">+</span>
          {t("subscriptions.add")}
        </button>
      </div>

      {/* Active subscriptions */}
      {active.length > 0 && (
        <section className="mb-6">
          <div className="text-xs text-base-content/50 uppercase tracking-wide mb-2">{t("subscriptions.active")}</div>
          <div className="space-y-2">
            {active.map((sub) => {
              const cat = getCategoryDisplay(sub.category_id, categories);
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
                            <span>{sub.frequency === "monthly" ? t("subscriptions.monthly") : t("subscriptions.annual")}</span>
                          </div>
                          <div>
                            <span>{cat.name}</span>
                            <span className="mx-1.5 text-base-content/30">·</span>
                            <span>{t("subscriptions.due")} {formatDueDate(nextDue)}</span>
                          </div>
                          <div className="text-xs text-base-content/40">
                            {t("subscriptions.paid_by")} {USERS.find(u => u.id === sub.paid_by)?.name ?? sub.paid_by}
                          </div>
                          {/* Every subscription active before this feature has an
                              empty start_date, so absent must stay absent rather
                              than becoming a blank or a fabricated date. Shown
                              verbatim for the same reason as end_date below. */}
                          {sub.start_date && (
                            <div data-testid="start-date" className="text-xs text-base-content/40">
                              {t("subscriptions.started")} {sub.start_date}
                            </div>
                          )}
                          {/* Absent, not empty — same rule as the dates above. The
                              note is capped at input time, so it renders in full;
                              pre-line keeps the captain's own line breaks. */}
                          {sub.notes && (
                            <div data-testid="notes" className="text-xs text-base-content/50 whitespace-pre-line break-words">
                              {sub.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          className="btn btn-ghost btn-xs"
                          onClick={() => openEdit(sub)}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          onClick={() => openCancel(sub)}
                        >
                          {t("subscriptions.cancel")}
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
          <div className="text-xs text-base-content/50 uppercase tracking-wide mb-2">{t("subscriptions.cancelled")}</div>
          <div className="space-y-2">
            {cancelled.map((sub) => {
              const cat = getCategoryDisplay(sub.category_id, categories);
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
                          {/* Start and end are independent: a card cancelled through
                              this feature but never backfilled has an end date and no
                              start date, and the reverse is equally real. Every
                              subscription that predates this feature has neither, and
                              those render no line at all rather than a blank one or a
                              fabricated date. Shown verbatim: a hand-typed cell comes
                              back locale-formatted, and reformatting it would misread it. */}
                          {sub.start_date && (
                            <div data-testid="start-date" className="text-xs text-base-content/40">
                              {t("subscriptions.started")} {sub.start_date}
                            </div>
                          )}
                          {sub.end_date && (
                            <div data-testid="end-date" className="text-xs text-base-content/40">
                              {t("subscriptions.ended")} {sub.end_date}
                            </div>
                          )}
                          {sub.notes && (
                            <div data-testid="notes" className="text-xs text-base-content/50 whitespace-pre-line break-words">
                              {sub.notes}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="badge badge-ghost badge-sm shrink-0">{t("subscriptions.cancelled")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {active.length === 0 && cancelled.length === 0 && (
        <p className="text-base-content/50 text-center mt-12">{t("subscriptions.empty")}</p>
      )}

      {/* Add Modal */}
      {modalMode === "add" && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm">
            <h3 className="font-bold text-lg mb-4">{t("subscriptions.add_title")}</h3>
            <div className="space-y-3">
              <div>
                <label className="label label-text text-xs">{t("subscriptions.name")}</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="e.g. Netflix"
                  value={addForm.name}
                  onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label label-text text-xs">{t("subscriptions.amount_label")}</label>
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
                <label className="label label-text text-xs">{t("common.category")}</label>
                <select
                  className="select select-bordered w-full"
                  value={addForm.category_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  {activeCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryIcon(c)} {c.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label label-text text-xs">{t("subscriptions.frequency")}</label>
                <div className="join w-full">
                  <button
                    type="button"
                    className={`join-item btn flex-1 ${addForm.frequency === "monthly" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setAddForm((f) => ({ ...f, frequency: "monthly" }))}
                  >
                    {t("subscriptions.monthly")}
                  </button>
                  <button
                    type="button"
                    className={`join-item btn flex-1 ${addForm.frequency === "annual" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setAddForm((f) => ({ ...f, frequency: "annual" }))}
                  >
                    {t("subscriptions.annual")}
                  </button>
                </div>
              </div>
              {addForm.frequency === "annual" && (
                <div>
                  <label className="label label-text text-xs">{t("subscriptions.due_month_label")}</label>
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
                <label className="label label-text text-xs">{t("subscriptions.due_day_label")}</label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  min="1"
                  max="31"
                  value={addForm.due_day}
                  onChange={(e) => setAddForm((f) => ({ ...f, due_day: e.target.value }))}
                />
              </div>
              <div>
                <label className="label label-text text-xs">{t("subscriptions.start_date_label")}</label>
                {/* Raw ISO, matching the History filter's triggers and the card
                    line directly beneath — prose here would disagree with it. */}
                <button
                  type="button"
                  data-testid="add-start-date"
                  onClick={() => setStartPickerOpen(true)}
                  className="input input-bordered w-full flex items-center justify-start"
                >
                  {addForm.start_date || t("picker.choose_date")}
                </button>
                {startPickerOpen && (
                  <DatePickerModal
                    value={addForm.start_date}
                    onPick={(iso) => setAddForm((f) => ({ ...f, start_date: iso }))}
                    onClose={() => setStartPickerOpen(false)}
                  />
                )}
              </div>
              <div>
                <label className="label label-text text-xs">{t("subscriptions.notes_label")}</label>
                <textarea
                  data-testid="add-notes"
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  maxLength={NOTES_MAX}
                  value={addForm.notes}
                  onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value.slice(0, NOTES_MAX) }))}
                />
              </div>
            </div>
            {categoryStatus}
            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={closeModal}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-primary" onClick={handleAdd} disabled={addSubmitting || !categoriesReady}>
                {addSubmitting ? <span className="loading loading-spinner loading-xs" /> : t("subscriptions.add")}
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
            <h3 className="font-bold text-lg mb-4">{t("subscriptions.edit_title")}</h3>
            <div className="space-y-3">
              <div>
                <label className="label label-text text-xs">{t("subscriptions.name")}</label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label label-text text-xs">{t("subscriptions.amount_label")}</label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="label label-text text-xs">{t("common.category")}</label>
                <select
                  className="select select-bordered w-full"
                  value={editForm.category_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  {editCategoryOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {editingFrequency === "annual" && (
                <div>
                  <label className="label label-text text-xs">{t("subscriptions.due_month_label")}</label>
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
                <label className="label label-text text-xs">{t("subscriptions.due_day_label")}</label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  min="1"
                  max="31"
                  value={editForm.due_day}
                  onChange={(e) => setEditForm((f) => ({ ...f, due_day: e.target.value }))}
                />
              </div>
              <div>
                <label className="label label-text text-xs">{t("subscriptions.notes_label")}</label>
                <textarea
                  data-testid="edit-notes"
                  className="textarea textarea-bordered w-full"
                  rows={3}
                  maxLength={NOTES_MAX}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value.slice(0, NOTES_MAX) }))}
                />
              </div>
            </div>
            {categoryStatus}
            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={closeModal}>
                {t("common.cancel")}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleEdit}
                disabled={editSubmitting || !categoriesReady || !editForm.amount || parseFloat(editForm.amount) <= 0}
              >
                {editSubmitting ? <span className="loading loading-spinner loading-xs" /> : t("common.save")}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeModal} />
        </div>
      )}

      {/* Cancel confirmation — asks WHEN it ended, not just that it did */}
      {cancelTarget && (
        <div className="modal modal-open">
          <div className="modal-box w-full max-w-sm">
            <h3 className="font-bold text-lg mb-1">{t("subscriptions.cancel_title")}</h3>
            <p className="text-sm text-base-content/60 mb-4">{cancelTarget.name}</p>
            <div>
              <label className="label label-text text-xs">{t("subscriptions.end_date_label")}</label>
              <button
                type="button"
                data-testid="cancel-end-date"
                onClick={() => setEndPickerOpen(true)}
                className="input input-bordered w-full flex items-center justify-start"
              >
                {cancelDate || t("picker.choose_date")}
              </button>
              {endPickerOpen && (
                <DatePickerModal
                  value={cancelDate}
                  onPick={(iso) => {
                    setCancelDate(iso);
                    // onPick is now the only write path, so it carries the reset
                    // the old input's onChange did — without it a corrected date
                    // still sits under a stale red error.
                    setCancelInvalid(false);
                  }}
                  onClose={() => setEndPickerOpen(false)}
                />
              )}
              {cancelInvalid && (
                <div data-testid="cancel-end-date-error" className="text-error text-xs mt-1">
                  {t("subscriptions.end_before_start")}
                </div>
              )}
            </div>
            <div className="modal-action mt-4">
              <button className="btn btn-ghost" onClick={closeCancel}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-error" onClick={handleCancelConfirm} disabled={cancelSubmitting}>
                {cancelSubmitting ? <span className="loading loading-spinner loading-xs" /> : t("subscriptions.confirm_cancel")}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeCancel} />
        </div>
      )}
    </main>
  );
}
