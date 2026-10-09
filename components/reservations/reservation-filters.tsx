import Link from "next/link";
import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constants";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface ReservationFiltersProps {
  condoSlug: string;
  areas: { id: string; name: string }[];
  selectedArea?: string;
  selectedStatus?: ReservationStatus | "all";
  selectedDate?: string;
  view?: "list" | "agenda" | "presenca";
  showAttendanceView?: boolean;
}

export function ReservationFilters({
  condoSlug,
  areas,
  selectedArea,
  selectedStatus = "all",
  selectedDate,
  view = "list",
  showAttendanceView = false,
}: ReservationFiltersProps) {
  const basePath = `/app/${condoSlug}/reservations`;

  function buildHref(nextView: "list" | "agenda" | "presenca") {
    const params = new URLSearchParams();
    params.set("view", nextView);
    if (selectedArea) params.set("area", selectedArea);
    if (nextView !== "presenca" && selectedStatus && selectedStatus !== "all") {
      params.set("status", selectedStatus);
    }
    if (nextView === "presenca" && selectedDate) {
      params.set("date", selectedDate);
    }
    return `${basePath}?${params.toString()}`;
  }

  return (
    <form method="get" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <input type="hidden" name="view" value={view} />

      <div className="grid grid-cols-1 gap-3 sm:contents">
        <div className="space-y-2 sm:min-w-[180px]">
          <Label htmlFor="area">Espaço</Label>
          <select
            id="area"
            name="area"
            defaultValue={selectedArea ?? ""}
            className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm sm:h-9 sm:min-w-[180px]"
          >
            <option value="">Todos os espaços</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        {view === "presenca" ? (
          <div className="space-y-2 sm:min-w-[160px]">
            <Label htmlFor="date">Data da aula</Label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={selectedDate}
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm sm:h-9 sm:min-w-[160px]"
            />
          </div>
        ) : (
          <div className="space-y-2 sm:min-w-[160px]">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={selectedStatus}
              className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm sm:h-9 sm:min-w-[160px]"
            >
              <option value="all">Todos</option>
              <option value={RESERVATION_STATUS.AWAITING_RECEIPT}>Aguardando comprovante</option>
              <option value={RESERVATION_STATUS.PENDING}>Pendentes</option>
              <option value={RESERVATION_STATUS.APPROVED}>Aprovadas</option>
              <option value={RESERVATION_STATUS.REJECTED}>Rejeitadas</option>
              <option value={RESERVATION_STATUS.CANCELLED}>Canceladas</option>
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="secondary" size="sm" className="min-h-11 flex-1 sm:min-h-9 sm:flex-none">
          Aplicar
        </Button>

        {(selectedArea || (view !== "presenca" && selectedStatus !== "all")) && (
          <Button variant="ghost" size="sm" className="min-h-11 sm:min-h-9" asChild>
            <Link href={view === "presenca" ? `${basePath}?view=presenca` : `${basePath}?view=${view}`}>
              Limpar
            </Link>
          </Button>
        )}

        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <Button
            variant={view === "list" ? "default" : "outline"}
            size="sm"
            className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
            asChild
          >
            <Link href={buildHref("list")}>Lista</Link>
          </Button>
          <Button
            variant={view === "agenda" ? "default" : "outline"}
            size="sm"
            className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
            asChild
          >
            <Link href={buildHref("agenda")}>Agenda</Link>
          </Button>
          {showAttendanceView && (
            <Button
              variant={view === "presenca" ? "default" : "outline"}
              size="sm"
              className="min-h-11 flex-1 sm:min-h-9 sm:flex-none"
              asChild
            >
              <Link href={buildHref("presenca")}>Presença</Link>
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
