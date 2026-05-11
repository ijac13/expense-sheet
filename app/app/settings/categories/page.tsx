"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Category } from "../../lib/categories";
import {
  getCategories,
  addCategory,
  updateCategory,
  archiveCategory,
  restoreCategory,
  reorderCategory,
} from "../../lib/categoryService";

type FormMode = { type: "add" } | { type: "edit"; id: string } | null;

interface FormState {
  icon: string;
  name_en: string;
  name_zh: string;
  error: string;
}

const emptyForm: FormState = { icon: "", name_en: "", name_zh: "", error: "" };

export default function CategoryManagementPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [archivedOpen, setArchivedOpen] = useState(false);

  useEffect(() => {
    getCategories()
      .then((cats) => setCategories(cats))
      .catch(() => {
        // If fetch fails, leave the list empty — do not fall back to hardcoded list
      })
      .finally(() => setLoading(false));
  }, []);

  const active = [...categories.filter((c) => c.is_active)].sort(
    (a, b) => a.sort_order - b.sort_order
  );
  const archived = categories.filter((c) => !c.is_active);

  function openAdd() {
    setForm(emptyForm);
    setFormMode({ type: "add" });
  }

  function openEdit(cat: Category) {
    setForm({ icon: cat.icon, name_en: cat.name_en, name_zh: cat.name_zh, error: "" });
    setFormMode({ type: "edit", id: cat.id });
  }

  function closeForm() {
    setFormMode(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name_en.trim()) {
      setForm((f) => ({ ...f, error: t("cat_mgmt.error_en_required") }));
      return;
    }
    if (!form.name_zh.trim()) {
      setForm((f) => ({ ...f, error: t("cat_mgmt.error_zh_required") }));
      return;
    }

    if (formMode?.type === "add") {
      // Client-side duplicate guard
      const duplicate = active.some(
        (c) => c.name_en.toLowerCase() === form.name_en.trim().toLowerCase()
      );
      if (duplicate) {
        setForm((f) => ({ ...f, error: t("cat_mgmt.error_duplicate") }));
        return;
      }

      const data = {
        icon: form.icon.trim() || "📦",
        name_en: form.name_en.trim(),
        name_zh: form.name_zh.trim(),
      };

      // Optimistic update with a placeholder
      const placeholder: Category = {
        ...data,
        id: `__optimistic_${Date.now()}`,
        sort_order: active.length > 0 ? Math.max(...active.map((c) => c.sort_order)) + 1 : 1,
        is_active: true,
      };
      setCategories((prev) => [...prev, placeholder]);
      closeForm();

      try {
        const newCat = await addCategory(data);
        // Replace placeholder with real category from API
        setCategories((prev) =>
          prev.map((c) => (c.id === placeholder.id ? newCat : c))
        );
      } catch (err) {
        // Roll back optimistic update
        setCategories((prev) => prev.filter((c) => c.id !== placeholder.id));
        const msg = err instanceof Error ? err.message : "Failed to save category";
        setFormMode({ type: "add" });
        setForm({ ...data, error: msg });
      }
    } else if (formMode?.type === "edit") {
      const editId = formMode.id;
      const duplicate = active.some(
        (c) => c.id !== editId && c.name_en.toLowerCase() === form.name_en.trim().toLowerCase()
      );
      if (duplicate) {
        setForm((f) => ({ ...f, error: t("cat_mgmt.error_duplicate") }));
        return;
      }
      const data = {
        icon: form.icon.trim() || "📦",
        name_en: form.name_en.trim(),
        name_zh: form.name_zh.trim(),
      };

      // Optimistic update
      setCategories((prev) =>
        prev.map((c) => (c.id === editId ? { ...c, ...data } : c))
      );
      closeForm();

      try {
        await updateCategory(editId, data);
      } catch (err) {
        // Roll back by refetching
        getCategories().then(setCategories).catch(() => {});
        const msg = err instanceof Error ? err.message : "Failed to update category";
        alert(msg);
      }
    }
  }

  async function handleArchive(id: string) {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
    if (formMode?.type === "edit" && formMode.id === id) closeForm();
    try {
      await archiveCategory(id);
    } catch (err) {
      // Roll back
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: true } : c)));
      const msg = err instanceof Error ? err.message : "Failed to archive category";
      alert(msg);
    }
  }

  async function handleRestore(id: string) {
    const currentMax = active.length > 0 ? Math.max(...active.map((c) => c.sort_order)) : 0;
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: true, sort_order: currentMax + 1 } : c))
    );
    try {
      await restoreCategory(id);
    } catch (err) {
      // Roll back by refetching
      getCategories().then(setCategories).catch(() => {});
      const msg = err instanceof Error ? err.message : "Failed to restore category";
      alert(msg);
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    const sorted = [...active].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // Optimistic swap
    const catA = sorted[idx];
    const catB = sorted[swapIdx];
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === catA.id) return { ...c, sort_order: catB.sort_order };
        if (c.id === catB.id) return { ...c, sort_order: catA.sort_order };
        return c;
      })
    );

    try {
      await reorderCategory(id, direction, categories);
    } catch (err) {
      // Roll back by refetching
      getCategories().then(setCategories).catch(() => {});
      const msg = err instanceof Error ? err.message : "Failed to reorder category";
      alert(msg);
    }
  }

  const isFormOpen = formMode !== null;

  return (
    <div className="max-w-lg mx-auto p-4">
      <Link href="/settings" className="flex items-center gap-1 text-sm text-base-content/60 mb-4">
        <ChevronLeft size={16} /> {t("settings.title")}
      </Link>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{t("cat_mgmt.title")}</h1>
        {!isFormOpen && (
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            {t("cat_mgmt.add")}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md" />
        </div>
      )}

      {/* Add/Edit Form */}
      {isFormOpen && (
        <div className="card bg-base-200 mb-4">
          <div className="card-body p-4">
            <h2 className="card-title text-base">
              {formMode?.type === "add" ? t("cat_mgmt.form_add") : t("cat_mgmt.form_edit")}
            </h2>
            <div className="form-control gap-3">
              <div>
                <label className="label pb-1">
                  <span className="label-text">{t("cat_mgmt.icon_label")}</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-20"
                  maxLength={2}
                  value={form.icon}
                  placeholder="📦"
                  onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                />
              </div>
              <div>
                <label className="label pb-1">
                  <span className="label-text">{t("cat_mgmt.name_en")} <span className="text-error">*</span></span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.name_en}
                  placeholder="e.g. Eating Out"
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value, error: "" }))}
                />
              </div>
              <div>
                <label className="label pb-1">
                  <span className="label-text">{t("cat_mgmt.name_zh")} <span className="text-error">*</span></span>
                </label>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  value={form.name_zh}
                  placeholder="e.g. 外食"
                  onChange={(e) => setForm((f) => ({ ...f, name_zh: e.target.value, error: "" }))}
                />
              </div>
              {form.error && (
                <p className="text-error text-sm">{form.error}</p>
              )}
              <div className="flex gap-2 mt-1">
                <button className="btn btn-primary btn-sm" onClick={handleSave}>
                  {t("common.save")}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={closeForm}>
                  {t("common.cancel")}
                </button>
                {formMode?.type === "edit" && (
                  <button
                    className="btn btn-warning btn-sm ml-auto"
                    onClick={() => formMode.type === "edit" && handleArchive(formMode.id)}
                  >
                    {t("cat_mgmt.archive")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Categories */}
      {!loading && (
        <div className="mb-4">
          <h2 className="font-semibold text-sm text-base-content/60 mb-2">
            {t("cat_mgmt.active")} ({active.length})
          </h2>
          <div className="flex flex-col gap-1">
            {active.map((cat, idx) => (
              <div
                key={cat.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-base-100 border border-base-300"
              >
                <span className="text-2xl w-8 text-center">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{cat.name_en}</span>
                  <span className="text-base-content/50 text-sm ml-2">{cat.name_zh}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={idx === 0}
                    onClick={() => handleReorder(cat.id, "up")}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    disabled={idx === active.length - 1}
                    onClick={() => handleReorder(cat.id, "down")}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => openEdit(cat)}
                  >
                    {t("common.edit")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Archived Section */}
      {!loading && archived.length > 0 && (
        <div>
          <button
            className="flex items-center gap-2 text-sm font-semibold text-base-content/60 mb-2 w-full text-left"
            onClick={() => setArchivedOpen((o) => !o)}
          >
            <span>{archivedOpen ? "▾" : "▸"}</span>
            <span>{t("cat_mgmt.archived")} ({archived.length})</span>
          </button>
          {archivedOpen && (
            <div className="flex flex-col gap-1">
              {archived.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-base-200 border border-base-300 opacity-60"
                >
                  <span className="text-2xl w-8 text-center">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{cat.name_en}</span>
                    <span className="text-base-content/50 text-sm ml-2">{cat.name_zh}</span>
                  </div>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => handleRestore(cat.id)}
                  >
                    {t("cat_mgmt.restore")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
