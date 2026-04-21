"use client";

import { KEYPAD_LAYOUT, KeypadKey } from "../lib/calculator";

interface CalculatorKeypadProps {
  onKey: (key: KeypadKey) => void;
}

function keyLabel(key: KeypadKey): string {
  if (key === "backspace") return "⌫";
  if (key === "clear") return "C";
  return key;
}

function keyStyle(key: KeypadKey): string {
  const base = "btn h-16 text-2xl font-medium rounded-xl transition-all active:scale-95";
  if (key === "backspace") return `${base} btn-error btn-outline`;
  if (key === "clear") return `${base} btn-warning btn-outline`;
  if (key === "noop") return `${base} invisible pointer-events-none`;
  if (["+", "-", "×", "÷"].includes(key)) return `${base} btn-secondary`;
  if (["(", ")"].includes(key)) return `${base} btn-ghost border border-base-300`;
  return `${base} btn-ghost border border-base-300`;
}

export default function CalculatorKeypad({ onKey }: CalculatorKeypadProps) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {KEYPAD_LAYOUT.flat().map((key, i) => (
        <button
          key={i}
          type="button"
          onClick={() => key !== "noop" && onKey(key)}
          className={keyStyle(key)}
        >
          {keyLabel(key)}
        </button>
      ))}
    </div>
  );
}
