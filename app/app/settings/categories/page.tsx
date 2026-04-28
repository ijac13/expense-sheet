"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Category, DEFAULT_CATEGORIES } from "../../lib/categories";
import {
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
  const [categories, setCategories] = useState<Category[]>(() =>
    DEFAULT_CATEGORIES.map((c) => ({ ...c, is_active: c.is_active ?? true }))
  );
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [archivedOpen, setArchivedOpen] = useState(false);

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

  function handleSave() {
    if (!form.name_en.trim()) {
      setForm((f) => ({ ...f, error: t("cat_mgmt.error_en_required") }));
      return;
    }
    if (!form.name_zh.trim()) {
      setForm((f) => ({ ...f, error: t("cat_mgmt.error_zh_required") }));
      return;
    }

    if (formMode?.type === "add") {
      const duplicate = active.some(
        (c) => c.name_en.toLowerCase() === form.name_en.trim().toLowerCase()
      );
      if (duplicate) {
        setForm((f) => ({ ...f, error: t("cat_mgmt.error_duplicate") }));
        return;
      }
      const currentMax = active.length > 0 ? Math.max(...active.map((c) => c.sort_order)) : 0;
      const newCat = addCategory(
        { icon: form.icon.trim() || "📦", name_en: form.name_en.trim(), name_zh: form.name_zh.trim() },
        currentMax
      );
      setCategories((prev) => [...prev, newCat]);
      closeForm();
    } else if (formMode?.type === "edit") {
      const editId = formMode.id;
      const duplicate = active.some(
        (c) => c.id !== editId && c.name_en.toLowerCase() === form.name_en.trim().toLowerCase()
      );
      if (duplicate) {
        setForm((f) => ({ ...f, error: t("cat_mgmt.error_duplicate") }));
        return;
      }
      const data = { icon: form.icon.trim() || "📦", name_en: form.name_en.trim(), name_zh: form.name_zh.trim() };
      updateCategory(editId, data);
      setCategories((prev) =>
        prev.map((c) => (c.id === editId ? { ...c, ...data } : c))
      );
      closeForm();
    }
  }

  function handleArchive(id: string) {
    archiveCategory(id);
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
    if (formMode?.type === "edit" && formMode.id === id) closeForm();
  }

  function handleRestore(id: string) {
    restoreCategory(id);
    const currentMax = active.length > 0 ? Math.max(...active.map((c) => c.sort_order)) : 0;
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, is_active: true, sort_order: currentMax + 1 } : c))
    );
  }

  function handleReorder(id: string, direction: "up" | "down") {
    reorderCategory(id, direction);
    setCategories((prev) => {
      const sorted = [...prev.filter((c) => c.is_active)].sort((a, b) => a.sort_order - b.sort_order);
      const idx = sorted.findIndex((c) => c.id === id);
      if (idx === -1) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const tempOrder = sorted[idx].sort_order;
      const newSorted = sorted.map((c, i) => {
        if (i === idx) return { ...c, sort_order: sorted[swapIdx].sort_order };
        if (i === swapIdx) return { ...c, sort_order: tempOrder };
        return c;
      });
      const inactiveItems = prev.filter((c) => !c.is_active);
      return [...newSorted, ...inactiveItems];
    });
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

      {/* Archived Section */}
      {archived.length > 0 && (
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
