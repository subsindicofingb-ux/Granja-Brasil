import Link from "next/link";
import type { Tower } from "@/types";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface TowerFilterProps {
  condoSlug: string;
  towers: Pick<Tower, "id" | "name">[];
  selectedTowerId?: string;
}

export function TowerFilter({ condoSlug, towers, selectedTowerId }: TowerFilterProps) {
  const basePath = `/app/${condoSlug}/units`;

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="tower">Filtrar por torre</Label>
        <select
          id="tower"
          name="tower"
          defaultValue={selectedTowerId ?? ""}
          className="flex h-9 min-w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Todas as torres</option>
          {towers.map((tower) => (
            <option key={tower.id} value={tower.id}>
              {tower.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Aplicar
      </Button>
      {selectedTowerId && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={basePath}>Limpar</Link>
        </Button>
      )}
    </form>
  );
}
