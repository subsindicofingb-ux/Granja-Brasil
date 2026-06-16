import Link from "next/link";
import type { Tower } from "@/types";
import type { UnitWithTower } from "@/lib/services/units";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ResidentFiltersProps {
  condoSlug: string;
  towers: Pick<Tower, "id" | "name">[];
  units: UnitWithTower[];
  selectedTowerId?: string;
  selectedUnitId?: string;
}

export function ResidentFilters({
  condoSlug,
  towers,
  units,
  selectedTowerId,
  selectedUnitId,
}: ResidentFiltersProps) {
  const basePath = `/app/${condoSlug}/residents`;
  const filteredUnits = selectedTowerId
    ? units.filter((unit) => unit.tower_id === selectedTowerId)
    : units;

  const hasFilters = Boolean(selectedTowerId || selectedUnitId);

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="tower">Torre</Label>
        <select
          id="tower"
          name="tower"
          defaultValue={selectedTowerId ?? ""}
          className="flex h-9 min-w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Todas as torres</option>
          {towers.map((tower) => (
            <option key={tower.id} value={tower.id}>
              {tower.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unit">Unidade</Label>
        <select
          id="unit"
          name="unit"
          defaultValue={selectedUnitId ?? ""}
          className="flex h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Todas as unidades</option>
          {filteredUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {formatUnitWithTower(unit)}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" variant="secondary" size="sm">
        Aplicar
      </Button>

      {hasFilters && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={basePath}>Limpar</Link>
        </Button>
      )}
    </form>
  );
}
