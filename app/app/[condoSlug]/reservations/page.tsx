import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { requireCondoAccess } from "@/lib/auth/access";
import {
  canCreateReservations,
  canViewClassAttendance,
} from "@/lib/reservations/create-permission";
import { getUnitListFilterForAccess, unitFilterToQueryOptions } from "@/lib/auth/unit-scope";
import { listReservableCommonAreasForContext } from "@/lib/services/common-areas";
import { listCondominiums } from "@/lib/services/condominiums-admin";
import {
  listClassReservationsForDate,
  listReservationsForContext,
} from "@/lib/services/reservations";
import { addDaysToDateKey } from "@/lib/reservations/calendar-availability";
import {
  buildClassAttendanceRolls,
  isClassArea,
} from "@/lib/reservations/class-booking";
import { getLocalDateKey, localDateTimeToIso } from "@/lib/reservations/timezone";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constants";
import { isValidUuid, formatDate, formatDateTime } from "@/lib/utils";
import { ErrorAlert } from "@/components/shared/feedback";
import { TableSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState, PageHeader } from "@/components/shared/page-shell";
import { AreaAgenda } from "@/components/reservations/area-agenda";
import { ClassAttendanceRolls } from "@/components/reservations/class-attendance-roll";
import { ReservationFilters } from "@/components/reservations/reservation-filters";
import { ReservationStatusBadge } from "@/components/reservations/reservation-status-badge";
import { Button } from "@/components/ui/button";
import {
  MobileRecordCard,
  MobileRecordRow,
  ResponsiveRecords,
} from "@/components/shared/responsive-records";

interface ReservationsPageProps {
  params: Promise<{ condoSlug: string }>;
  searchParams: Promise<{ area?: string; status?: string; view?: string; date?: string }>;
}

function parseStatus(value?: string): ReservationStatus | "all" {
  const values = Object.values(RESERVATION_STATUS);
  if (value && values.includes(value as ReservationStatus)) {
    return value as ReservationStatus;
  }
  return "all";
}

function parseView(value?: string): "list" | "agenda" | "presenca" {
  if (value === "agenda" || value === "presenca") {
    return value;
  }
  return "list";
}

function parseDateKey(value?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return getLocalDateKey(new Date());
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
      description="Agenda, reservas e conferência de presença das aulas."
      action={
        canCreateReservations(access) ? (
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
  dateKey,
}: {
  condoSlug: string;
  areaId?: string;
  status: ReservationStatus | "all";
  view: "list" | "agenda" | "presenca";
  dateKey: string;
}) {
  const access = await requireCondoAccess(condoSlug);
  const canSeeAttendance = canViewClassAttendance(access);
  const viewMode = view === "presenca" && !canSeeAttendance ? "list" : view;
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
    viewMode === "presenca"
      ? Promise.resolve({ ok: true as const, data: [] })
      : listReservationsForContext(bookingContext, {
          commonAreaId: areaId,
          status,
          ...(viewMode === "agenda" ? getAgendaRange() : {}),
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
  const classAreas = areas.filter(isClassArea);
  const selectedClassAreaId = classAreas.some((area) => area.id === areaId) ? areaId : undefined;
  const areaOptions = (viewMode === "presenca" ? classAreas : areas).map((area) => ({
    id: area.id,
    name: area.name,
  }));

  if (viewMode === "presenca") {
    const rollAreas = selectedClassAreaId
      ? classAreas.filter((area) => area.id === selectedClassAreaId)
      : classAreas;
    const nextDateKey = addDaysToDateKey(dateKey, 1);
    const attendanceResult = await listClassReservationsForDate({
      areaIds: rollAreas.map((area) => area.id),
      from: localDateTimeToIso(dateKey, "00:00"),
      to: localDateTimeToIso(nextDateKey, "00:00"),
    });

    if (!attendanceResult.ok) {
      return <ErrorAlert message={attendanceResult.error} title="Erro ao carregar presença" />;
    }

    const condominiumsResult = await listCondominiums();
    const condominiumNamesById = condominiumsResult.ok
      ? Object.fromEntries(condominiumsResult.data.map((condo) => [condo.id, condo.name]))
      : {};
    const rolls = buildClassAttendanceRolls({
      areas: rollAreas,
      reservations: attendanceResult.data,
      dateKey,
    });
    const dateLabel = formatDate(`${dateKey}T12:00:00`);

    return (
      <div className="space-y-4">
        <ReservationFilters
          condoSlug={condoSlug}
          areas={areaOptions}
          selectedArea={selectedClassAreaId}
          selectedDate={dateKey}
          view="presenca"
          showAttendanceView
        />
        <ClassAttendanceRolls
          condoSlug={condoSlug}
          rolls={rolls}
          dateLabel={dateLabel}
          condominiumNamesById={condominiumNamesById}
        />
      </div>
    );
  }

  if (viewMode === "agenda") {
    if (!areaId) {
      return (
        <div className="space-y-4">
          <ReservationFilters
            condoSlug={condoSlug}
            areas={areaOptions}
            selectedStatus={status}
            view="agenda"
            showAttendanceView={canSeeAttendance}
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
          showAttendanceView={canSeeAttendance}
        />
        <AreaAgenda
          condoSlug={condoSlug}
          areaName={selectedArea?.name ?? "Espaço"}
          reservations={reservations}
          isClassArea={selectedArea?.booking_mode === "class"}
          capacity={selectedArea?.capacity}
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
        showAttendanceView={canSeeAttendance}
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
            canCreateReservations(access) ? (
              <Button asChild>
                <Link href={`/app/${condoSlug}/reservations/new`}>Nova reserva</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ResponsiveRecords
          mobile={reservations.map((reservation) => (
            <MobileRecordCard key={reservation.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-base font-semibold leading-snug">
                  {reservation.common_area.name}
                </p>
                <ReservationStatusBadge status={reservation.status} />
              </div>
              {reservation.attendee_name && (
                <MobileRecordRow label="Nome">{reservation.attendee_name}</MobileRecordRow>
              )}
              <MobileRecordRow label="Unidade">
                {formatUnitWithTower(reservation.unit)}
              </MobileRecordRow>
              <MobileRecordRow label="Período">
                <span>
                  {formatDateTime(reservation.start_at)}
                  <span className="block text-xs font-normal text-muted-foreground">
                    até {formatDateTime(reservation.end_at)}
                  </span>
                </span>
              </MobileRecordRow>
              <Button className="mt-1 w-full min-h-11" variant="outline" asChild>
                <Link href={`/app/${condoSlug}/reservations/${reservation.id}`}>
                  Ver reserva
                </Link>
              </Button>
            </MobileRecordCard>
          ))}
          desktop={
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Espaço</th>
                    <th className="px-4 py-3 text-left font-medium">Nome</th>
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
                        {reservation.attendee_name ?? "—"}
                      </td>
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
          }
        />
      )}
    </div>
  );
}

export default async function ReservationsPage({ params, searchParams }: ReservationsPageProps) {
  const { condoSlug } = await params;
  const { area, status, view, date } = await searchParams;

  const areaId = isValidUuid(area) ? area : undefined;
  const statusFilter = parseStatus(status);
  const viewMode = parseView(view);
  const dateKey = parseDateKey(date);

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-16 animate-pulse rounded-lg bg-muted" />}>
        <ReservationsHeader condoSlug={condoSlug} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={5} cols={6} />}>
        <ReservationsContent
          condoSlug={condoSlug}
          areaId={areaId}
          status={statusFilter}
          view={viewMode}
          dateKey={dateKey}
        />
      </Suspense>
    </div>
  );
}
