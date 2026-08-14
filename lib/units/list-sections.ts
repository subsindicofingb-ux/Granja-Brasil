import type { UnitWithTower } from "@/lib/services/units";

export type UnitListSection = {
  key: string;
  label: string;
  units: UnitWithTower[];
};

export function groupSortedUnitsByLabel(
  units: UnitWithTower[],
  getLabel: (unit: UnitWithTower) => string,
): UnitListSection[] {
  const sections: UnitListSection[] = [];

  for (const unit of units) {
    const label = getLabel(unit);
    const last = sections.at(-1);

    if (last && last.label === label) {
      last.units.push(unit);
      continue;
    }

    sections.push({
      key: `${label}-${unit.id}`,
      label,
      units: [unit],
    });
  }

  return sections;
}
