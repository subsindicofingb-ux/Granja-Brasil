import type { RegistrationRequestStatus, RegistrationUnitKind } from "@/types";
import { REGISTRATION_REQUEST_STATUS } from "@/lib/constants";

export const REGISTRATION_UNIT_KIND_LABELS: Record<RegistrationUnitKind, string> = {
  apartment: "Apartamento",
  house: "Casa",
};

export const REGISTRATION_REQUEST_STATUS_LABELS: Record<RegistrationRequestStatus, string> = {
  [REGISTRATION_REQUEST_STATUS.PENDING]: "Pendente",
  [REGISTRATION_REQUEST_STATUS.APPROVED]: "Aprovada",
  [REGISTRATION_REQUEST_STATUS.REJECTED]: "Recusada",
};

export function getRegistrationRequestStatusBadgeClass(status: RegistrationRequestStatus): string {
  switch (status) {
    case REGISTRATION_REQUEST_STATUS.APPROVED:
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case REGISTRATION_REQUEST_STATUS.REJECTED:
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
}
