"use client";
import { useTranslation } from "react-i18next";
import "../lib/i18n";

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const setLang = (lang: string) => {
    i18n.changeLanguage(lang);
    if (typeof window !== "undefined") localStorage.setItem("language", lang);
  };
  return (
    <div className="flex gap-1 bg-base-200 rounded-lg p-1 w-fit">
      {["en", "zh"].map((lang) => (
        <button
          key={lang}
          onClick={() => setLang(lang)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${i18n.language === lang ? "bg-base-100 shadow text-primary" : "text-base-content/50"}`}
        >
          {lang === "en" ? "EN" : "繁中"}
        </button>
      ))}
    </div>
  );
}
