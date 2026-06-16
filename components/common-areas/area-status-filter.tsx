import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface AreaStatusFilterProps {
  condoSlug: string;
  selected?: "all" | "active" | "inactive";
}

export function AreaStatusFilter({ condoSlug, selected = "all" }: AreaStatusFilterProps) {
  const basePath = `/app/${condoSlug}/areas`;

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={selected}
          className="flex h-9 min-w-[160px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Aplicar
      </Button>
      {selected !== "all" && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={basePath}>Limpar</Link>
        </Button>
      )}
    </form>
  );
}
