import type { UnitWithTower } from "@/lib/services/units";

export const UNIT_SORT_OPTIONS = [
  { value: "number_asc", label: "Número (crescente)" },
  { value: "number_desc", label: "Número (decrescente)" },
  { value: "tower_asc", label: "Torre (A-Z)" },
  { value: "block_asc", label: "Bloco (A-Z)" },
  { value: "block_desc", label: "Bloco (Z-A)" },
  { value: "condominium_asc", label: "Condomínio (A-Z)" },
] as const;

export type UnitSortValue = (typeof UNIT_SORT_OPTIONS)[number]["value"];

const DEFAULT_UNIT_SORT: UnitSortValue = "number_asc";

export function parseUnitSort(value?: string): UnitSortValue {
  if (value && UNIT_SORT_OPTIONS.some((option) => option.value === value)) {
    return value as UnitSortValue;
  }

  return DEFAULT_UNIT_SORT;
}

export function sortUnits(
  units: UnitWithTower[],
  sort: UnitSortValue,
  getCondominiumLabel?: (unit: UnitWithTower) => string,
): UnitWithTower[] {
  const [field, order] = sort.split("_") as [string, "asc" | "desc"];
  const direction = order === "desc" ? -1 : 1;
  const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

  return [...units].sort((left, right) => {
    let compare = 0;

    switch (field) {
      case "number":
        compare = collator.compare(left.number, right.number);
        break;
      case "tower":
        compare = collator.compare(left.tower.name, right.tower.name);
        break;
      case "block":
        compare = collator.compare(left.block ?? "", right.block ?? "");
        break;
      case "condominium":
        compare = collator.compare(
          getCondominiumLabel?.(left) ?? "",
          getCondominiumLabel?.(right) ?? "",
        );
        break;
    }

    if (compare === 0) {
      compare = collator.compare(left.number, right.number);
    }

    return compare * direction;
  });
}
