import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import { getUnitListFilterForAccess, unitFilterToQueryOptions } from "@/lib/auth/unit-scope";
import { listReservableCommonAreasForContext } from "@/lib/services/common-areas";
import { listReservationsForContext } from "@/lib/services/reservations";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constants";
import { isValidUuid, formatDateTime } from "@/lib/utils";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { AreaAgenda } from "@/components/reservations/area-agenda";
import { ReservationFilters } from "@/components/reservations/reservation-filters";
import { ReservationStatusBadge } from "@/components/reservations/reservation-status-badge";
import { Button } from "@/components/ui/button";

interface ReservationsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ area?: string; status?: string; view?: string }>;
}

function parseStatus(value?: string): ReservationStatus | "all" {
  const values = Object.values(RESERVATION_STATUS);
  if (value && values.includes(value as ReservationStatus)) {
    return value as ReservationStatus;
  }
  return "all";
}

function getAgendaRange(): { from: string; to: string } {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function ReservationsHeader({ condoSlug }: { condoSlug: string }) {
  const access = await requireCondoAccess(condoSlug);

  return (
    <PageHeader
      title="Reservas"
      description="Agenda e gestão de reservas dos espaços comuns."
      action={
        access.permissions.canManageReservations ? (
          <Button asChild>
            <Link href={`/app/${condoSlug}/reservations/new`}>
              <Plus className="h-4 w-4" />
              Nova reserva
            </Link>
          </Button>
        ) : undefined
      }
    />
  );
}

async function ReservationsContent({
  condoSlug,
  areaId,
  status,
  view,
}: {
  condoSlug: string;
  areaId?: string;
  status: ReservationStatus | "all";
  view: "list" | "agenda";
}) {
  const access = await requireCondoAccess(condoSlug);
  const unitQuery = unitFilterToQueryOptions(await getUnitListFilterForAccess(access));

  if (unitQuery === "none") {
    return (
      <EmptyState
        title="Unidade não vinculada"
        description="Seu cadastro ainda não está vinculado a uma unidade neste condomínio."
      />
    );
  }

  const bookingContext = {
    condominiumId: access.condominium.id,
    condominiumSlug: access.condominium.slug,
  };
  const [areasResult, reservationsResult] = await Promise.all([
    listReservableCommonAreasForContext(bookingContext, { isActive: true }),
    listReservationsForContext(bookingContext, {
      commonAreaId: areaId,
      status,
      ...(view === "agenda" ? getAgendaRange() : {}),
      ...unitQuery,
    }),
  ]);

  if (!areasResult.ok) {
    return <ErrorAlert message={areasResult.error} title="Erro ao carregar espaços" />;
  }

  if (!reservationsResult.ok) {
    return <ErrorAlert message={reservationsResult.error} title="Erro ao carregar reservas" />;
  }

  const areas = areasResult.data;
  const reservations = reservationsResult.data;
  const areaOptions = areas.map((area) => ({ id: area.id, name: area.name }));

  if (view === "agenda") {
    if (!areaId) {
      return (
        <div className="space-y-4">
          <ReservationFilters
            condoSlug={condoSlug}
            areas={areaOptions}
            selectedStatus={status}
            view="agenda"
          />
          <EmptyState
            title="Selecione um espaço"
            description="Escolha um espaço comum para visualizar a agenda dos próximos 30 dias."
          />
        </div>
      );
    }

    const selectedArea = areas.find((area) => area.id === areaId);

    return (
      <div className="space-y-4">
        <ReservationFilters
          condoSlug={condoSlug}
          areas={areaOptions}
          selectedArea={areaId}
          selectedStatus={status}
          view="agenda"
        />
        <AreaAgenda
          condoSlug={condoSlug}
          areaName={selectedArea?.name ?? "Espaço"}
          reservations={reservations}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReservationFilters
        condoSlug={condoSlug}
        areas={areaOptions}
        selectedArea={areaId}
        selectedStatus={status}
        view="list"
      />

      {reservations.length === 0 ? (
        <EmptyState
          title="Nenhuma reserva encontrada"
          description={
            status !== "all" || areaId
              ? "Não há reservas com os filtros selecionados."
              : "Crie a primeira reserva de um espaço comum."
          }
          action={
            access.permissions.canManageReservations ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/reservations/new`}>Nova reserva</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Espaço</th>
                <th className="px-4 py-3 text-left font-medium">Unidade</th>
                <th className="px-4 py-3 text-left font-medium">Período</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{reservation.common_area.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatUnitWithTower(reservation.unit)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{formatDateTime(reservation.start_at)}</div>
                    <div className="text-xs">até {formatDateTime(reservation.end_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ReservationStatusBadge status={reservation.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/app/${condoSlug}/reservations/${reservation.id}`}>
                        Ver
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function ReservationsPage({ params, searchParams }: ReservationsPageProps) {
  const { condoSlug } = await params;
  const { area, status, view } = await searchParams;

  const areaId = isValidUuid(area) ? area : undefined;
  const statusFilter = parseStatus(status);
  const viewMode = view === "agenda" ? "agenda" : "list";

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <ReservationsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={5} cols={5} />}>
        <ReservationsContent
          condoSlug={condoSlug}
          areaId={areaId}
          status={statusFilter}
          view={viewMode}
        />
      </Suspense>
    </div>
  );
}
