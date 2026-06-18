import Link from "next/link";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import type { CondominiumRecord } from "@/lib/services/condominiums-admin";
import { UNIT_SORT_OPTIONS, type UnitSortValue } from "@/lib/units/sort";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface UnitsListControlsProps {
  condoSlug: string;
  selectedSort: UnitSortValue;
  condominiums?: CondominiumRecord[];
  selectedCondominiumSlug?: string;
  showCondominiumSort?: boolean;
}

export function UnitsListControls({
  condoSlug,
  selectedSort,
  condominiums,
  selectedCondominiumSlug,
  showCondominiumSort = false,
}: UnitsListControlsProps) {
  const basePath = `/app/${condoSlug}/units`;
  const hasFilters = Boolean(selectedCondominiumSlug || selectedSort !== "number_asc");
  const sortOptions = showCondominiumSort
    ? UNIT_SORT_OPTIONS
    : UNIT_SORT_OPTIONS.filter((option) => option.value !== "condominium_asc");

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      {condominiums && condominiums.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="condominium">Filtrar Condomínio</Label>
          <select
            id="condominium"
            name="condominium"
            defaultValue={selectedCondominiumSlug ?? ""}
            className="flex h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos os condomínios</option>
            {condominiums.map((condominium) => (
              <option key={condominium.id} value={condominium.slug}>
                {formatCondominiumDisplayName(condominium.name, condominium.slug)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="sort">Ordenar por</Label>
        <select
          id="sort"
          name="sort"
          defaultValue={selectedSort}
          className="flex h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
