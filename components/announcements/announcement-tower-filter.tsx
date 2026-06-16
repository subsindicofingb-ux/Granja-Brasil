import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AnnouncementTowerFilterProps {
  condoSlug: string;
  towers: { id: string; name: string }[];
  selectedTower?: string;
}

export function AnnouncementTowerFilter({
  condoSlug,
  towers,
  selectedTower,
}: AnnouncementTowerFilterProps) {
  const basePath = `/app/${condoSlug}/announcements`;

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="tower">Torre</Label>
        <select
          id="tower"
          name="tower"
          defaultValue={selectedTower ?? ""}
          className="flex h-9 min-w-[200px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Condomínio inteiro + todas as torres</option>
          {towers.map((tower) => (
            <option key={tower.id} value={tower.id}>
              {tower.name} e avisos gerais
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Aplicar
      </Button>
      {selectedTower && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={basePath}>Limpar</Link>
        </Button>
      )}
    </form>
  );
}
