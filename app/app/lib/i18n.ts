import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../../public/locales/en/common.json";
import zh from "../../public/locales/zh/common.json";

const LANGUAGE_KEY = "app-language";

if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: { en: { common: en }, zh: { common: zh } },
      lng: typeof window !== "undefined"
        ? (localStorage.getItem(LANGUAGE_KEY) ?? "zh")
        : "zh",
      fallbackLng: "zh",
      defaultNS: "common",
      interpolation: { escapeValue: false },
    });
}

export default i18n;
