import Link from "next/link";
import type { ReservationWithDetails } from "@/lib/reservations/types";
import { formatUnitWithTower } from "@/lib/residents/labels";
import { ReservationStatusBadge } from "@/components/reservations/reservation-status-badge";
import { formatDateTime } from "@/lib/utils";

interface DashboardReservationItemProps {
  condoSlug: string;
  reservation: ReservationWithDetails;
}

export function DashboardReservationItem({
  condoSlug,
  reservation,
}: DashboardReservationItemProps) {
  return (
    <Link
      href={`/app/${condoSlug}/reservations/${reservation.id}`}
      className="flex items-start justify-between gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/40"
    >
      <div>
        <p className="font-medium">{reservation.common_area.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatUnitWithTower(reservation.unit)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDateTime(reservation.start_at)} — {formatDateTime(reservation.end_at)}
        </p>
      </div>
      <ReservationStatusBadge status={reservation.status} />
    </Link>
  );
}
