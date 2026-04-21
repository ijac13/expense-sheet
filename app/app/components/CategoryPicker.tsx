"use client";

import { DEFAULT_CATEGORIES } from "../lib/categories";

interface CategoryPickerProps {
  selected: string;
  onSelect: (categoryId: string) => void;
}

export default function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full">
      {DEFAULT_CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={`flex flex-col items-center justify-center gap-1 p-2 rounded-xl border-2 transition-all min-h-[64px] ${
            selected === cat.id
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-base-300 bg-base-100 text-base-content hover:border-primary/50"
          }`}
        >
          <span className="text-2xl leading-none">{cat.icon}</span>
          <span className="text-[10px] text-center leading-tight">{cat.name_en}</span>
        </button>
      ))}
    </div>
  );
}
