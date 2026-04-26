"use client";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export type Language = "en" | "zh";
export const LANGUAGE_KEY = "app-language";
export const DEFAULT_LANGUAGE: Language = "zh";

export function getLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  return (localStorage.getItem(LANGUAGE_KEY) as Language) ?? DEFAULT_LANGUAGE;
}

export function setLanguage(lang: Language) {
  localStorage.setItem(LANGUAGE_KEY, lang);
  document.documentElement.setAttribute("lang", lang === "zh" ? "zh-TW" : "en");
}

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    setLang(getLanguage());
  }, []);

  function toggle(l: Language) {
    setLang(l);
    setLanguage(l);
    i18n.changeLanguage(l);
  }

  return (
    <div className="flex gap-1 bg-base-300 p-1 rounded-xl">
      {(["en", "zh"] as Language[]).map(l => (
        <button
          key={l}
          onClick={() => toggle(l)}
          className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${lang === l ? "bg-primary text-primary-content" : "text-base-content/60"}`}
        >
          {l === "en" ? "EN" : "繁中"}
        </button>
      ))}
    </div>
  );
}
