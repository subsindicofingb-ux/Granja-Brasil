import { RESERVATION_STATUS, type ReservationStatus } from "@/lib/constants";

export const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  [RESERVATION_STATUS.PENDING]: "Pendente",
  [RESERVATION_STATUS.APPROVED]: "Aprovada",
  [RESERVATION_STATUS.REJECTED]: "Rejeitada",
  [RESERVATION_STATUS.CANCELLED]: "Cancelada",
};

export const RESERVATION_STATUS_OPTIONS = Object.values(RESERVATION_STATUS).map((value) => ({
  value,
  label: RESERVATION_STATUS_LABELS[value],
}));

export function getReservationStatusLabel(status: string): string {
  return RESERVATION_STATUS_LABELS[status as ReservationStatus] ?? status;
}

export function getReservationStatusBadgeClass(status: ReservationStatus): string {
  switch (status) {
    case RESERVATION_STATUS.APPROVED:
      return "border-green-200 bg-green-50 text-green-700";
    case RESERVATION_STATUS.PENDING:
      return "border-amber-200 bg-amber-50 text-amber-700";
    case RESERVATION_STATUS.REJECTED:
      return "border-red-200 bg-red-50 text-red-700";
    case RESERVATION_STATUS.CANCELLED:
      return "border-gray-200 bg-gray-50 text-gray-600";
    default:
      return "";
  }
}
