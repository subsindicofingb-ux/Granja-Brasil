import Link from "next/link";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import type { CondominiumRecord } from "@/lib/services/condominiums-admin";
import type { UnitWithTower } from "@/lib/services/units";
import { formatUnitOptionLabel } from "@/lib/residents/labels";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ResidentFiltersProps {
  condoSlug: string;
  units: UnitWithTower[];
  selectedUnitId?: string;
  towers?: { id: string; name: string }[];
  selectedTowerId?: string;
  condominiums?: CondominiumRecord[];
  selectedCondominiumSlug?: string;
  condominiumNamesById?: Record<string, string>;
}

export function ResidentFilters({
  condoSlug,
  units,
  selectedUnitId,
  towers,
  selectedTowerId,
  condominiums,
  selectedCondominiumSlug,
  condominiumNamesById,
}: ResidentFiltersProps) {
  const basePath = `/app/${condoSlug}/residents`;
  const useCondominiumFilter = Boolean(condominiums?.length);
  const filteredUnits = useCondominiumFilter
    ? selectedCondominiumSlug
      ? units.filter((unit) => {
          const condominium = condominiums?.find(
            (item) => item.slug === selectedCondominiumSlug,
          );
          return condominium ? unit.tower.condominium_id === condominium.id : true;
        })
      : units
    : selectedTowerId
      ? units.filter((unit) => unit.tower_id === selectedTowerId)
      : units;

  const hasFilters = Boolean(
    selectedTowerId || selectedUnitId || selectedCondominiumSlug,
  );

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {useCondominiumFilter ? (
        <div className="space-y-2">
          <Label htmlFor="condominium">Condomínio</Label>
          <select
            id="condominium"
            name="condominium"
            defaultValue={selectedCondominiumSlug ?? ""}
            className="flex h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos os condomínios</option>
            {condominiums?.map((condominium) => (
              <option key={condominium.id} value={condominium.slug}>
                {formatCondominiumDisplayName(condominium.name, condominium.slug)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        towers &&
        towers.length > 0 && (
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
        )
      )}

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
              {formatUnitOptionLabel(unit, condominiumNamesById)}
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
