"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { USERS } from "../lib/users";
import { getFontSize, setFontSize, type FontSize } from "../components/FontSizeProvider";
import LanguageToggle from "../components/LanguageToggle";
import { useAuth } from "../lib/authContext";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { resolvedUserId, signOut } = useAuth();
  const currentUser = USERS.find(u => u.id === resolvedUserId);
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");

  const FONT_OPTIONS: { value: FontSize; label: string; description: string }[] = [
    { value: "small",  label: t("settings.small"),  description: "16px" },
    { value: "medium", label: t("settings.medium"), description: "18px" },
    { value: "large",  label: t("settings.large"),  description: "20px" },
  ];

  useEffect(() => {
    setFontSizeState(getFontSize());
  }, []);

  function handleFontSize(size: FontSize) {
    setFontSizeState(size);
    setFontSize(size);
  }

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-6 pb-20">
      <h1 className="text-2xl font-semibold mb-1">{t("settings.title")}</h1>
      {currentUser && (
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-base-content/50">
            {t("settings.signed_in_as")} <span className="font-medium text-base-content/70">{currentUser.name}</span>
          </p>
          <button onClick={signOut} className="btn btn-ghost btn-xs text-error">
            {t("settings.sign_out")}
          </button>
        </div>
      )}

      <div className="space-y-4">
        {/* Navigation links */}
        <div className="space-y-2">
          <Link href="/settings/categories" className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
            <span>{t("settings.category_management")}</span>
            <span className="text-base-content/40">›</span>
          </Link>
          <Link href="/settings/users" className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
            <span>{t("settings.user_management")}</span>
            <span className="text-base-content/40">›</span>
          </Link>
        </div>

        {/* Font size */}
        <div className="bg-base-200 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">{t("settings.font_size")}</div>
          <div className="grid grid-cols-3 gap-2">
            {FONT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleFontSize(opt.value)}
                className={`py-3 rounded-xl border text-center transition-colors
                  ${fontSize === opt.value
                    ? "bg-primary text-primary-content border-primary"
                    : "bg-base-100 text-base-content/70 border-base-300"}`}
              >
                <div className={`font-medium ${opt.value === "small" ? "text-sm" : opt.value === "large" ? "text-lg" : "text-base"}`}>
                  {opt.label}
                </div>
                <div className="text-[11px] opacity-60 mt-0.5">{opt.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="bg-base-200 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">{t("settings.language")}</div>
          <LanguageToggle />
        </div>
      </div>
    </main>
  );
}
