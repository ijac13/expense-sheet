"use client";

interface Category {
  id: string;
  name_en: string;
  name_zh?: string;
  icon?: string;
}

interface Props {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function CategoryPicker({ categories, selectedId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 gap-1 px-2 pb-4">
      {categories.map(cat => {
        const selected = cat.id === selectedId;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-colors active:bg-base-200
              ${selected ? "ring-2 ring-primary ring-offset-1 ring-offset-base-100" : ""}`}
          >
            <span className="grid place-items-center w-12 h-12 rounded-xl bg-base-100 border border-base-300">
              <span className="text-2xl">{cat.icon ?? "💰"}</span>
            </span>
            <span className={`text-[13px] leading-tight text-center ${selected ? "font-medium text-primary" : "text-base-content/70"}`}>
              {cat.name_en}
            </span>
          </button>
        );
      })}
    </div>
  );
}
