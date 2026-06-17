import Link from "next/link";
import { formatCondominiumDisplayName } from "@/lib/condominiums/display";
import type { CondominiumRecord } from "@/lib/services/condominiums-admin";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface CondominiumFilterProps {
  condoSlug: string;
  condominiums: CondominiumRecord[];
  selectedCondominiumSlug?: string;
}

export function CondominiumFilter({
  condoSlug,
  condominiums,
  selectedCondominiumSlug,
}: CondominiumFilterProps) {
  const basePath = `/app/${condoSlug}/units`;

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
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
      <Button type="submit" variant="secondary" size="sm">
        Aplicar
      </Button>
      {selectedCondominiumSlug && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={basePath}>Limpar</Link>
        </Button>
      )}
    </form>
  );
}
