import Link from "next/link";
import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constants";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ReservationFiltersProps {
  condoSlug: string;
  areas: { id: string; name: string }[];
  selectedArea?: string;
  selectedStatus?: ReservationStatus | "all";
  view?: "list" | "agenda";
}

export function ReservationFilters({
  condoSlug,
  areas,
  selectedArea,
  selectedStatus = "all",
  view = "list",
}: ReservationFiltersProps) {
  const basePath = `/app/${condoSlug}/reservations`;

  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="view" value={view} />

      <div className="space-y-2">
        <Label htmlFor="area">Espaço</Label>
        <select
          id="area"
          name="area"
          defaultValue={selectedArea ?? ""}
          className="flex h-9 min-w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Todos os espaços</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={selectedStatus}
          className="flex h-9 min-w-[160px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
        >
          <option value="all">Todos</option>
          <option value={RESERVATION_STATUS.AWAITING_RECEIPT}>Aguardando recibo</option>
          <option value={RESERVATION_STATUS.PENDING}>Pendentes</option>
          <option value={RESERVATION_STATUS.APPROVED}>Aprovadas</option>
          <option value={RESERVATION_STATUS.REJECTED}>Rejeitadas</option>
          <option value={RESERVATION_STATUS.CANCELLED}>Canceladas</option>
        </select>
      </div>

      <Button type="submit" variant="secondary" size="sm">
        Aplicar
      </Button>

      {(selectedArea || selectedStatus !== "all") && (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`${basePath}?view=${view}`}>Limpar</Link>
        </Button>
      )}

      <div className="ml-auto flex gap-2">
        <Button
          variant={view === "list" ? "default" : "outline"}
          size="sm"
          asChild
        >
          <Link
            href={`${basePath}?view=list${selectedArea ? `&area=${selectedArea}` : ""}${selectedStatus !== "all" ? `&status=${selectedStatus}` : ""}`}
          >
            Lista
          </Link>
        </Button>
        <Button
          variant={view === "agenda" ? "default" : "outline"}
          size="sm"
          asChild
        >
          <Link
            href={`${basePath}?view=agenda${selectedArea ? `&area=${selectedArea}` : ""}${selectedStatus !== "all" ? `&status=${selectedStatus}` : ""}`}
          >
            Agenda
          </Link>
        </Button>
      </div>
    </form>
  );
}
