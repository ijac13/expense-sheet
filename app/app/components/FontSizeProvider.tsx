"use client";
import { useEffect } from "react";

export type FontSize = "small" | "medium" | "large";
export const FONT_SIZE_KEY = "font-size";
export const DEFAULT_FONT_SIZE: FontSize = "medium";

export function getFontSize(): FontSize {
  if (typeof window === "undefined") return DEFAULT_FONT_SIZE;
  return (localStorage.getItem(FONT_SIZE_KEY) as FontSize) ?? DEFAULT_FONT_SIZE;
}

export function setFontSize(size: FontSize) {
  localStorage.setItem(FONT_SIZE_KEY, size);
  document.documentElement.setAttribute("data-font-size", size);
}

export default function FontSizeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Apply saved font size on mount
    document.documentElement.setAttribute("data-font-size", getFontSize());
  }, []);
  return <>{children}</>;
}
