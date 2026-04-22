"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { DEFAULT_USER, USERS } from "../lib/users";
import { getFontSize, setFontSize, type FontSize } from "../components/FontSizeProvider";
import LanguageToggle from "../components/LanguageToggle";

const FONT_OPTIONS: { value: FontSize; label: string; description: string }[] = [
  { value: "small",  label: "Small",  description: "14px" },
  { value: "medium", label: "Medium", description: "16px" },
  { value: "large",  label: "Large",  description: "18px" },
];

export default function SettingsPage() {
  const currentUser = USERS.find(u => u.id === DEFAULT_USER);
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");

  useEffect(() => {
    setFontSizeState(getFontSize());
  }, []);

  function handleFontSize(size: FontSize) {
    setFontSizeState(size);
    setFontSize(size);
  }

  return (
    <main className="flex flex-col min-h-screen bg-base-100 max-w-md mx-auto px-4 pt-12 pb-20">
      <h1 className="text-2xl font-semibold mb-1">Settings</h1>
      {currentUser && (
        <p className="text-sm text-base-content/50 mb-6">
          Signed in as <span className="font-medium text-base-content/70">{currentUser.name}</span>
        </p>
      )}

      <div className="space-y-4">
        {/* Navigation links */}
        <div className="space-y-2">
          <Link href="/settings/categories" className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
            <span>Category Management</span>
            <span className="text-base-content/40">›</span>
          </Link>
          <Link href="/settings/users" className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
            <span>User Management</span>
            <span className="text-base-content/40">›</span>
          </Link>
        </div>

        {/* Font size */}
        <div className="bg-base-200 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">Font Size</div>
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
          <div className="text-sm font-medium mb-3">Language</div>
          <LanguageToggle />
          <p className="text-xs text-base-content/40 mt-2">UI translations coming in a future update.</p>
        </div>
      </div>
    </main>
  );
}
