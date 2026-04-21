/**
 * Evaluates a simple arithmetic expression string.
 * Supports: digits, decimal point, +, -, *, /, (, )
 * Uses × and ÷ as display aliases for * and /
 */
export function evaluateExpression(expr: string): number | null {
  if (!expr || expr.trim() === "") return null;

  // Replace display operators with JS operators
  const normalized = expr.replace(/×/g, "*").replace(/÷/g, "/");

  // Only allow safe characters: digits, operators, parens, decimal, whitespace
  if (!/^[\d\s+\-*/().]+$/.test(normalized)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + normalized + ")")() as unknown;
    if (typeof result !== "number" || !isFinite(result) || isNaN(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

export type KeypadKey =
  | "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "." | "+" | "-" | "×" | "÷" | "(" | ")"
  | "backspace" | "clear" | "noop";

export const KEYPAD_LAYOUT: (KeypadKey)[][] = [
  ["(", ")", "÷", "×"],
  ["7", "8", "9", "-"],
  ["4", "5", "6", "+"],
  ["1", "2", "3", "backspace"],
  ["clear", "0", ".", "noop"],
];

export function applyKey(current: string, key: KeypadKey): string {
  if (key === "clear") return "";
  if (key === "backspace") return current.slice(0, -1);
  if (key === "noop") return current;
  return current + key;
}
