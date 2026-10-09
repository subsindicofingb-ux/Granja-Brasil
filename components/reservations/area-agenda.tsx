import Link from "next/link";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import { groupReservationsByLocalDate } from "@/lib/reservations/validate-booking";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ReservationStatusBadge } from "@/components/reservations/reservation-status-badge";
import { Button } from "@/components/ui/button";

interface AreaAgendaProps {
  condoSlug: string;
  areaName: string;
  reservations: ReservationWithDetails[];
  isClassArea?: boolean;
  capacity?: number;
}

function groupByStartAt(reservations: ReservationWithDetails[]) {
  const grouped = new Map<string, ReservationWithDetails[]>();

  for (const reservation of reservations) {
    const list = grouped.get(reservation.start_at) ?? [];
    list.push(reservation);
    grouped.set(reservation.start_at, list);
  }

  return grouped;
}

export function AreaAgenda({
  condoSlug,
  areaName,
  reservations,
  isClassArea,
  capacity,
}: AreaAgendaProps) {
  const grouped = groupReservationsByLocalDate(reservations);
  const sortedDates = [...grouped.keys()].sort();

  if (sortedDates.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma reserva encontrada para <span className="font-medium">{areaName}</span> no período.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => {
        const dayReservations = grouped.get(dateKey) ?? [];
        const displayDate = formatDate(`${dateKey}T12:00:00`);

        return (
          <section key={dateKey} className="rounded-xl border bg-card shadow-sm">
            <header className="border-b bg-muted/40 px-4 py-3">
              <h3 className="font-medium">{displayDate}</h3>
              <p className="text-xs text-muted-foreground">
                {isClassArea
                  ? `${dayReservations.length} inscrição(ões) na lista de presença`
                  : `${dayReservations.length} reserva(s)`}
              </p>
            </header>
            {isClassArea ? (
              <ul className="divide-y">
                {[...groupByStartAt(dayReservations).entries()]
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([startAt, attendees]) => (
                    <li key={startAt} className="space-y-2 px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">{formatDateTime(startAt)}</p>
                        <p className="text-xs text-muted-foreground">
                          {attendees.length}/{capacity ?? "—"} vagas
                        </p>
                      </div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {attendees.map((reservation) => (
                          <li key={reservation.id} className="flex items-center justify-between gap-2">
                            <span>
                              {reservation.attendee_name ?? "Sem nome"}
                              <span className="block text-xs">
                                {formatUnitWithTower(reservation.unit)}
                              </span>
                            </span>
                            <span className="flex items-center gap-2">
                              <ReservationStatusBadge status={reservation.status} />
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/app/${condoSlug}/reservations/${reservation.id}`}>
                                  Ver
                                </Link>
                              </Button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
              </ul>
            ) : (
            <ul className="divide-y">
              {dayReservations.map((reservation) => (
                <li
                  key={reservation.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium">
                      {formatDateTime(reservation.start_at)} — {formatDateTime(reservation.end_at)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatUnitWithTower(reservation.unit)}
                    </p>
                    {reservation.notes && (
                      <p className="text-sm text-muted-foreground">{reservation.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <ReservationStatusBadge status={reservation.status} />
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/${condoSlug}/reservations/${reservation.id}`}>
                        Detalhes
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
