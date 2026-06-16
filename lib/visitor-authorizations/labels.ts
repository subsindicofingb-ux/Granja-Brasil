import {
  GUEST_TYPE,
  VISITOR_AUTHORIZATION_STATUS,
  type GuestType,
  type VisitorAuthorizationStatus,
} from "@/lib/constants";
import type { VisitorAuthorizationDisplayStatus } from "@/lib/visitor-authorizations/types";

export const GUEST_TYPE_LABELS: Record<GuestType, string> = {
  [GUEST_TYPE.VISITOR]: "Visitante",
  [GUEST_TYPE.SERVICE_PROVIDER]: "Prestador",
};

export const GUEST_TYPE_OPTIONS = Object.values(GUEST_TYPE).map((value) => ({
  value,
  label: GUEST_TYPE_LABELS[value],
}));

export const VISITOR_AUTHORIZATION_STATUS_LABELS: Record<
  VisitorAuthorizationStatus,
  string
> = {
  [VISITOR_AUTHORIZATION_STATUS.PENDING]: "Pendente",
  [VISITOR_AUTHORIZATION_STATUS.APPROVED]: "Aprovado",
  [VISITOR_AUTHORIZATION_STATUS.REJECTED]: "Rejeitado",
  [VISITOR_AUTHORIZATION_STATUS.CANCELLED]: "Cancelado",
};

export const VISITOR_DISPLAY_STATUS_LABELS: Record<
  VisitorAuthorizationDisplayStatus,
  string
> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  scheduled: "Agendado",
  active: "Vigente",
  expired: "Expirado",
};

export function getGuestTypeLabel(type: string): string {
  return GUEST_TYPE_LABELS[type as GuestType] ?? type;
}

export function getVisitorAuthorizationStatusLabel(status: string): string {
  return VISITOR_AUTHORIZATION_STATUS_LABELS[status as VisitorAuthorizationStatus] ?? status;
}

export function getVisitorDisplayStatusLabel(status: VisitorAuthorizationDisplayStatus): string {
  return VISITOR_DISPLAY_STATUS_LABELS[status];
}

export function getVisitorDisplayStatusBadgeClass(
  status: VisitorAuthorizationDisplayStatus,
): string {
  switch (status) {
    case "active":
      return "border-green-200 bg-green-50 text-green-700";
    case "scheduled":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "rejected":
      return "border-red-200 bg-red-50 text-red-700";
    case "cancelled":
    case "expired":
      return "border-gray-200 bg-gray-50 text-gray-600";
    case "approved":
      return "border-green-200 bg-green-50 text-green-700";
    default:
      return "";
  }
}
