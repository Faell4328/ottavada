import { useTranslation } from "react-i18next";
import type { Category } from "../../types";

interface CategoryCheckboxListProps {
  categories: Category[];
  selectedIds: string[];
  onToggle: (categoryId: string) => void;
  disabled?: boolean;
}

export function CategoryCheckboxList({
  categories,
  selectedIds,
  onToggle,
  disabled,
}: CategoryCheckboxListProps) {
  const { t } = useTranslation();

  if (categories.length === 0) {
    return (
      <p className="text-xs text-[#8b9db2]">{t("sidebar.noCategories")}</p>
    );
  }

  return (
    <div className="space-y-2 border border-[#c5cfdb] rounded p-3 max-h-40 overflow-y-auto">
      {categories.map((category) => (
        <label
          key={category.id}
          className="flex items-center gap-2 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(category.id)}
            onChange={() => onToggle(category.id)}
            disabled={disabled}
            className="rounded border-[#c5cfdb]"
          />
          <span className="text-sm text-[#344b61]">{category.name}</span>
        </label>
      ))}
    </div>
  );
}
