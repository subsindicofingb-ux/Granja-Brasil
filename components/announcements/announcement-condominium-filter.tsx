import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AnnouncementCondominiumFilterProps {
  condoSlug: string;
  mode: "granja" | "towers";
  towers?: { id: string; name: string }[];
  condominiums?: { id: string; name: string }[];
  selectedTower?: string;
  selectedCondominium?: string;
}

export function AnnouncementCondominiumFilter({
  condoSlug,
  mode,
  towers = [],
  condominiums = [],
  selectedTower,
  selectedCondominium,
}: AnnouncementCondominiumFilterProps) {
  const basePath = `/app/${condoSlug}/announcements`;
  const hasSelection = Boolean(selectedTower || selectedCondominium);

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="condominium-filter">Condomínio</Label>
        {mode === "granja" ? (
          <select
            id="condominium-filter"
            name="condo"
            defaultValue={selectedCondominium ?? ""}
            className="flex h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todos os condomínios</option>
            {condominiums.map((condominium) => (
              <option key={condominium.id} value={condominium.id}>
                {condominium.name}
              </option>
            ))}
          </select>
        ) : (
          <select
            id="condominium-filter"
            name="tower"
            defaultValue={selectedTower ?? ""}
            className="flex h-9 min-w-[220px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Todo o condomínio</option>
            {towers.map((tower) => (
              <option key={tower.id} value={tower.id}>
                {tower.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Aplicar
      </Button>
      {hasSelection && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={basePath}>Limpar</Link>
        </Button>
      )}
    </form>
  );
}
