import { Badge } from "@/components/ui/badge";
import type { ReservationStatus } from "@/lib/constants";
import {
  getReservationStatusBadgeClass,
  getReservationStatusLabel,
} from "@/lib/reservations/labels";

interface ReservationStatusBadgeProps {
  status: ReservationStatus;
}

export function ReservationStatusBadge({ status }: ReservationStatusBadgeProps) {
  return (
    <Badge className={getReservationStatusBadgeClass(status)}>
      {getReservationStatusLabel(status)}
    </Badge>
  );
}
