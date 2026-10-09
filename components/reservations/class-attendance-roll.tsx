import type { ClassAttendanceRoll } from "@/lib/reservations/class-booking";
import { formatUnitOptionLabel } from "@/lib/residents/labels";
import { ClassAttendanceToggle } from "@/components/reservations/class-attendance-toggle";
import { EmptyState } from "@/components/shared/page-shell";

interface ClassAttendanceRollsProps {
  condoSlug: string;
  rolls: ClassAttendanceRoll[];
  dateLabel: string;
  condominiumNamesById?: Record<string, string>;
}

export function ClassAttendanceRolls({
  condoSlug,
  rolls,
  dateLabel,
  condominiumNamesById,
}: ClassAttendanceRollsProps) {
  if (rolls.length === 0) {
    return (
      <EmptyState
        title="Nenhuma aula neste dia"
        description={`Não há aulas programadas para ${dateLabel}.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {rolls.map((roll) => {
        const presentCount = roll.attendees.filter((attendee) => attendee.attended_at).length;

        return (
          <section
            key={`${roll.areaId}-${roll.startAt}`}
            className="rounded-xl border bg-card shadow-sm"
          >
            <header className="flex flex-col gap-1 border-b bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-medium">{roll.areaName}</h3>
                <p className="text-sm text-muted-foreground">
                  {roll.startTime} – {roll.endTime}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {roll.attendees.length}/{roll.capacity} vagas · {presentCount} presente(s)
              </p>
            </header>

            {roll.attendees.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Nenhuma reserva confirmada nesta aula.
              </p>
            ) : (
              <ul className="divide-y">
                {roll.attendees.map((attendee, index) => (
                  <li
                    key={attendee.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {index + 1}. {attendee.attendee_name ?? "Sem nome"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatUnitOptionLabel(
                          {
                            number: attendee.unit.number,
                            block: attendee.unit.block,
                            tower: {
                              name: attendee.unit.tower.name,
                              condominium_id: attendee.unit.tower.condominium_id ?? "",
                            },
                          },
                          condominiumNamesById,
                        )}
                      </p>
                    </div>
                    <ClassAttendanceToggle
                      condoSlug={condoSlug}
                      reservationId={attendee.id}
                      attended={Boolean(attendee.attended_at)}
                    />
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
